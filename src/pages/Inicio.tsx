import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useAlunoLabel } from "@/hooks/useAlunoLabel";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProximosEventosCard } from "@/components/dashboard/ProximosEventosCard";
import { formatCurrency } from "@/lib/formatters";
import {
  Users, CalendarPlus, CalendarDays, CircleCheck, ListChecks, Calendar,
  AlertTriangle, Cake, ChevronRight, DollarSign, CheckCircle2, Circle,
} from "lucide-react";

function formatarNome(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] || "";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

function hojeBrasilISO(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function saudacao(): string {
  const h = new Date(Date.now() - 3 * 3_600_000).getUTCHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const Inicio = () => {
  const navigate = useNavigate();
  const { canAccess } = usePermissions();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const { plural: alunoPlural } = useAlunoLabel();
  const hoje = hojeBrasilISO();

  const dataExtenso = new Date(hoje + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { data: perfil } = useQuery({
    queryKey: ["inicio-perfil"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { nome: "" };
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return { nome: (data as any)?.nome || "" };
    },
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["inicio-tarefas", hoje, empresaId],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data, error } = await (supabase as any)
        .from("tarefas")
        .select("id, titulo, data_vencimento")
        .eq("empresa_id", empresaId!)
        .eq("responsavel_id", auth.user.id)
        .in("status", ["pendente", "em_andamento"])
        .or(`data_vencimento.lte.${hoje},data_vencimento.is.null`)
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: agenda = [] } = useQuery({
    queryKey: ["inicio-agenda", hoje, empresaId],
    queryFn: async () => {
      const [{ data: eventos }, { data: encontros }, { data: googleEventos }] = await Promise.all([
        supabase.from("eventos").select("id, nome").eq("empresa_id", empresaId!).eq("data", hoje).is("deleted_at", null),
        (supabase as any)
          .from("encontros")
          .select("id, sessao_numero, turma_id, turmas(nome, produtos(nome))")
          .eq("empresa_id", empresaId!)
          .eq("data", hoje),
        (supabase as any)
          .from("google_agenda_eventos")
          .select("id, titulo, hora")
          .eq("empresa_id", empresaId!)
          .eq("data", hoje),
      ]);
      const itens = [
        ...(eventos || []).map((e: any) => ({
          id: `ev-${e.id}`,
          titulo: e.nome,
          tipo: "Evento",
          href: `/eventos/${e.id}`,
        })),
        ...(encontros || []).map((e: any) => ({
          id: `en-${e.id}`,
          titulo: `${e.turmas?.produtos?.nome ? `${e.turmas.produtos.nome} · ` : ""}${e.turmas?.nome || "Turma"} · Sessão ${e.sessao_numero ?? ""}`.trim(),
          tipo: "Aula",
          href: `/turmas`,
        })),
        ...(googleEventos || []).map((g: any) => ({
          id: `g-${g.id}`,
          titulo: g.hora ? `${g.hora.slice(0, 5)} · ${g.titulo}` : g.titulo,
          tipo: "Google",
          href: `/agenda`,
        })),
      ];
      return itens;
    },
    enabled: !!empresaId,
  });

  const queryClient = useQueryClient();

  const { data: agendaChecks = [] } = useQuery({
    queryKey: ["inicio-agenda-checks", hoje],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("agenda_item_checks")
        .select("item_id")
        .eq("data", hoje);
      return (data || []).map((r: any) => r.item_id as string);
    },
    refetchInterval: 30_000,
  });

  const toggleCheck = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: string; checked: boolean }) => {
      if (checked) {
        await (supabase as any)
          .from("agenda_item_checks")
          .delete()
          .eq("item_id", itemId)
          .eq("data", hoje);
      } else {
        const { data: auth } = await supabase.auth.getUser();
        await (supabase as any)
          .from("agenda_item_checks")
          .insert({ item_id: itemId, data: hoje, concluido_por: auth.user?.id });
      }
    },
    onMutate: async ({ itemId, checked }) => {
      await queryClient.cancelQueries({ queryKey: ["inicio-agenda-checks", hoje] });
      const prev = queryClient.getQueryData<string[]>(["inicio-agenda-checks", hoje]) ?? [];
      queryClient.setQueryData(
        ["inicio-agenda-checks", hoje],
        checked ? prev.filter((id) => id !== itemId) : [...prev, itemId],
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["inicio-agenda-checks", hoje], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["inicio-agenda-checks", hoje] }),
  });

  const temAcessoFinanceiro = canAccess("financeiro");

  const { data: atencao } = useQuery({
    queryKey: ["inicio-atencao", hoje, temAcessoFinanceiro, empresaId],
    queryFn: async () => {
      const mmdd = hoje.slice(5); // "MM-DD"
      const [vencidosRes, { data: alunosNasc }] = await Promise.all([
        temAcessoFinanceiro
          ? (supabase as any)
              .from("pagamentos")
              .select("valor")
              .eq("empresa_id", empresaId!)
              .eq("status", "pendente")
              .lt("data_vencimento", hoje)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        supabase
          .from("alunos")
          .select("nome, data_nascimento")
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null)
          .not("data_nascimento", "is", null),
      ]);
      const vencidosArr = (vencidosRes.data || []) as any[];
      const aniversariantes = (alunosNasc || []).filter(
        (a: any) => (a.data_nascimento || "").slice(5) === mmdd,
      );
      return {
        vencidosQtd: vencidosArr.length,
        vencidosValor: vencidosArr.reduce((s, p) => s + Number(p.valor || 0), 0),
        aniversariantes,
      };
    },
    enabled: !!empresaId,
  });

  const atrasadas = tarefas.filter((t: any) => t.data_vencimento && t.data_vencimento < hoje).length;
  const tarefasHoje = tarefas.filter((t: any) => t.data_vencimento === hoje).length;
  const tarefasTop = tarefas.slice(0, 3);

  const atalhos = [
    { label: alunoPlural, icon: Users, url: "/alunos" },
    { label: "Eventos", icon: CalendarPlus, url: "/eventos" },
    { label: "Agenda", icon: CalendarDays, url: "/agenda" },
    { label: "Tarefas", icon: ListChecks, url: "/tarefas" },
  ];

  const temAtencao =
    (temAcessoFinanceiro && (atencao?.vencidosQtd ?? 0) > 0) ||
    atrasadas > 0 ||
    (atencao?.aniversariantes?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${saudacao()}${perfil?.nome ? `, ${formatarNome(perfil.nome)}` : ""}`}
        description={dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)}
      />

      {/* Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {atalhos.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.url)}
            className="rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted/50"
          >
            <a.icon className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-sm font-medium">{a.label}</div>
          </button>
        ))}
      </div>

      {/* Próximos eventos (reaproveita o card de contagem regressiva) */}
      <ProximosEventosCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Minhas tarefas de hoje */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-muted-foreground" /> Minhas tarefas
            </CardTitle>
            {tarefas.length > 0 && (
              <button onClick={() => navigate("/tarefas")} className="text-xs text-primary hover:underline">
                Ver todas
              </button>
            )}
          </CardHeader>
          <CardContent>
            {tarefas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhuma tarefa pendente. 🎉</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 font-medium">
                    {tarefasHoje} para hoje
                  </span>
                  {atrasadas > 0 && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-medium">
                      {atrasadas} atrasada(s)
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {tarefasTop.map((t: any) => {
                    const atrasada = t.data_vencimento && t.data_vencimento < hoje;
                    return (
                      <button
                        key={t.id}
                        onClick={() => navigate("/tarefas")}
                        className="w-full flex items-center gap-2 text-sm text-left rounded-md px-1.5 py-1 hover:bg-muted/50"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${atrasada ? "bg-red-500" : "bg-blue-500"}`} />
                        <span className="flex-1 truncate">{t.titulo}</span>
                      </button>
                    );
                  })}
                </div>
                {tarefas.length > 3 && (
                  <button
                    onClick={() => navigate("/tarefas")}
                    className="text-xs text-muted-foreground mt-2 hover:text-foreground"
                  >
                    + {tarefas.length >= 50 ? "muitas" : tarefas.length - 3} outra(s) — ver todas
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Agenda de hoje */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" /> Agenda de hoje
              </CardTitle>
              <span className="text-sm font-medium text-muted-foreground">
                {new Date(hoje + "T12:00:00")
                  .toLocaleDateString("pt-BR", { day: "numeric", month: "long" })
                  .replace(/de (\w)/, (_, c) => `de ${c.toUpperCase()}`)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nada na agenda de hoje.</p>
            ) : (
              <div className="space-y-0.5">
                {agenda.map((a: any) => {
                  const checked = agendaChecks.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`w-full flex items-center gap-2 text-sm py-1.5 px-1.5 rounded-md transition-colors ${checked ? "opacity-50" : ""}`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCheck.mutate({ itemId: a.id, checked });
                        }}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        title={checked ? "Desmarcar" : "Marcar como feito"}
                      >
                        {checked
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <Circle className="h-4 w-4" />}
                      </button>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {a.tipo}
                      </span>
                      <button
                        className={`flex-1 text-left truncate ${checked ? "line-through text-muted-foreground" : ""}`}
                        onClick={() => a.href && navigate(a.href)}
                      >
                        {a.titulo}
                      </button>
                      {!checked && (
                        <ChevronRight
                          className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-pointer"
                          onClick={() => a.href && navigate(a.href)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Precisa de atenção */}
      {temAtencao && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Precisa de atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {temAcessoFinanceiro && (atencao?.vencidosQtd ?? 0) > 0 && (
              <button
                onClick={() => navigate("/financeiro")}
                className="w-full flex items-center gap-2 text-sm text-left rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <DollarSign className="h-4 w-4 text-destructive shrink-0" />
                <span className="flex-1">
                  {atencao?.vencidosQtd} pagamento(s) vencido(s) · {formatCurrency(atencao?.vencidosValor || 0)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {atrasadas > 0 && (
              <button
                onClick={() => navigate("/tarefas")}
                className="w-full flex items-center gap-2 text-sm text-left rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <ListChecks className="h-4 w-4 text-destructive shrink-0" />
                <span className="flex-1">{atrasadas} tarefa(s) atrasada(s)</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {(atencao?.aniversariantes?.length ?? 0) > 0 && (
              <button
                onClick={() => navigate("/aniversarios")}
                className="w-full flex items-center gap-2 text-sm text-left rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Cake className="h-4 w-4 text-pink-500 shrink-0" />
                <span className="flex-1">
                  {atencao?.aniversariantes.length} aniversariante(s) hoje —{" "}
                  {atencao?.aniversariantes.slice(0, 3).map((a: any) => a.nome).join(", ")}
                  {(atencao?.aniversariantes.length ?? 0) > 3 ? "…" : ""}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Inicio;
