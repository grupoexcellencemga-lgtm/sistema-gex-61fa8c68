import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { CalendarClock, AlertTriangle, ChevronRight } from "lucide-react";

// Card de contagem regressiva no Dashboard: mostra os próximos eventos e turmas
// (com checklist) dentro do horizonte, quantos dias faltam, o progresso e o que
// ainda falta fazer. Some sozinho quando não há nada chegando.

const HORIZONTE_DIAS = 45;

// Hoje no fuso de Brasília (mesma convenção usada no resto do app: UTC-3).
function hojeBrasilISO(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function diffDiasISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

interface Pendente {
  titulo: string;
  data_vencimento: string | null;
  atrasada: boolean;
}

interface ItemProximo {
  key: string;
  kind: "Evento" | "Turma";
  nome: string;
  subtitulo: string;
  dataRef: string;
  dias: number;
  total: number;
  concluidas: number;
  atrasadas: number;
  pendentes: Pendente[];
  href: string;
}

function resumirTarefas(
  tarefas: { titulo: string; status: string; data_vencimento: string | null }[],
  hoje: string,
) {
  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === "concluida").length;
  const abertas = tarefas.filter((t) => t.status === "pendente");
  const atrasadas = abertas.filter((t) => t.data_vencimento && t.data_vencimento < hoje).length;
  const pendentes: Pendente[] = abertas
    .slice()
    .sort((a, b) => (a.data_vencimento || "9999").localeCompare(b.data_vencimento || "9999"))
    .slice(0, 3)
    .map((t) => ({
      titulo: t.titulo,
      data_vencimento: t.data_vencimento,
      atrasada: !!(t.data_vencimento && t.data_vencimento < hoje),
    }));
  return { total, concluidas, atrasadas, pendentes };
}

export function ProximosEventosCard() {
  const navigate = useNavigate();

  const { data: itens = [] } = useQuery<ItemProximo[]>({
    queryKey: ["proximos-eventos-card"],
    queryFn: async () => {
      const hoje = hojeBrasilISO();
      const limite = (() => {
        const [y, m, d] = hoje.split("-").map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + HORIZONTE_DIAS));
        return dt.toISOString().slice(0, 10);
      })();

      const [{ data: eventos }, { data: turmas }] = await Promise.all([
        supabase
          .from("eventos")
          .select("id, nome, tipo, data")
          .is("deleted_at", null)
          .not("checklist_template_id", "is", null)
          .gte("data", hoje)
          .lte("data", limite),
        (supabase as any)
          .from("turmas")
          .select("id, nome, data_inicio, encontros(data)")
          .is("deleted_at", null)
          .not("checklist_template_id", "is", null),
      ]);

      const eventoIds = (eventos || []).map((e: any) => e.id);
      // Para cada turma, a próxima sessão a partir de hoje é a âncora do countdown.
      const turmasProx = (turmas || [])
        .map((t: any) => {
          const futuras = (t.encontros || [])
            .map((e: any) => e.data as string | null)
            .filter((d: string | null): d is string => !!d && d >= hoje)
            .sort();
          const dataRef = futuras[0] || (t.data_inicio && t.data_inicio >= hoje ? t.data_inicio : null);
          return { ...t, dataRef };
        })
        .filter((t: any) => t.dataRef && diffDiasISO(hoje, t.dataRef) <= HORIZONTE_DIAS);
      const turmaIds = turmasProx.map((t: any) => t.id);

      const [{ data: tEvt }, { data: tTur }] = await Promise.all([
        eventoIds.length
          ? supabase
              .from("tarefas")
              .select("titulo, status, data_vencimento, evento_id")
              .eq("origem_tarefa", "template")
              .in("evento_id", eventoIds)
          : Promise.resolve({ data: [] as any[] }),
        turmaIds.length
          ? (supabase as any)
              .from("tarefas")
              .select("titulo, status, data_vencimento, turma_id")
              .eq("origem_tarefa", "template")
              .in("turma_id", turmaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const itens: ItemProximo[] = [];

      for (const e of eventos || []) {
        const tarefas = (tEvt || []).filter((t: any) => t.evento_id === e.id);
        if (tarefas.length === 0) continue;
        const r = resumirTarefas(tarefas, hoje);
        itens.push({
          key: `evt-${e.id}`,
          kind: "Evento",
          nome: e.nome,
          subtitulo: `${e.tipo || "evento"} · ${formatDate(e.data)}`,
          dataRef: e.data,
          dias: diffDiasISO(hoje, e.data),
          ...r,
          href: `/eventos?evento=${e.id}`,
        });
      }

      for (const t of turmasProx) {
        const tarefas = (tTur || []).filter((x: any) => x.turma_id === t.id);
        if (tarefas.length === 0) continue;
        const r = resumirTarefas(tarefas, hoje);
        const totalSessoes = (t.encontros || []).filter((e: any) => e.data).length;
        itens.push({
          key: `tur-${t.id}`,
          kind: "Turma",
          nome: t.nome,
          subtitulo: `Turma${totalSessoes ? ` · ${totalSessoes} sessões` : ""} · próxima ${formatDate(t.dataRef)}`,
          dataRef: t.dataRef,
          dias: diffDiasISO(hoje, t.dataRef),
          ...r,
          href: `/turmas?turma=${t.id}&tab=operacao`,
        });
      }

      return itens.sort((a, b) => a.dias - b.dias).slice(0, 6);
    },
    staleTime: 5 * 60_000,
  });

  if (itens.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Próximos eventos
        </CardTitle>
        <span className="text-xs text-muted-foreground">{itens.length} chegando</span>
      </CardHeader>
      <CardContent className="space-y-3">
        {itens.map((it) => {
          const pct = it.total ? Math.round((it.concluidas / it.total) * 100) : 0;
          const urgente = it.dias <= 3;
          const atencao = it.dias > 3 && it.dias <= 7;
          const corDias = urgente ? "text-destructive" : atencao ? "text-amber-600" : "text-foreground";
          return (
            <button
              key={it.key}
              onClick={() => navigate(it.href)}
              className={`w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/40 ${
                urgente ? "border-red-200 dark:border-red-900" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{it.nome}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{it.subtitulo}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xl font-bold leading-none ${corDias}`}>
                    {it.dias <= 0 ? "hoje" : it.dias}
                  </div>
                  {it.dias > 0 && <div className={`text-[11px] ${corDias}`}>dias</div>}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {it.concluidas} de {it.total} feitas
                </span>
              </div>

              {it.pendentes.length > 0 && (
                <div className="mt-2.5 space-y-1">
                  {it.pendentes.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate text-muted-foreground">{p.titulo}</span>
                      {p.atrasada ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 whitespace-nowrap">
                          atrasada
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {p.data_vencimento ? formatDate(p.data_vencimento) : "sem prazo"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {it.atrasadas > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  {it.atrasadas} tarefa(s) atrasada(s)
                </div>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
