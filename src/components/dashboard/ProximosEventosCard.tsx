import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useDataFilter } from "@/hooks/useDataFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { CalendarClock, ChevronRight } from "lucide-react";

const HORIZONTE_DIAS = 45;

function hojeBrasilISO(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function diffDiasISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

interface ItemProximo {
  key: string;
  nome: string;
  subtitulo: string;
  dataRef: string;
  dias: number;
  total: number;
  concluidas: number;
  href: string;
}

export function ProximosEventosCard() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const { isProfissional, profissionalNome, filterByResponsavel } = useDataFilter();

  // Busca os dados brutos sem filtro — o filtro é aplicado no useMemo abaixo
  const { data: rawData } = useQuery({
    queryKey: ["proximos-eventos-card-raw", empresaId],
    queryFn: async () => {
      const hoje = hojeBrasilISO();
      const limite = (() => {
        const [y, m, d] = hoje.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d + HORIZONTE_DIAS)).toISOString().slice(0, 10);
      })();

      const [{ data: eventosRaw }, { data: turmas }] = await Promise.all([
        (supabase as any)
          .from("eventos")
          .select("id, nome, tipo, data, responsavel, eventos_responsaveis(profissional_id, profissionais(nome))")
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null)
          .neq("status", "cancelado")
          .gte("data", hoje)
          .lte("data", limite),
        (supabase as any)
          .from("turmas")
          .select("id, nome, data_inicio, responsavel, produtos(nome), encontros(data)")
          .eq("empresa_id", empresaId!)
          .is("deleted_at", null),
      ]);

      // Constrói responsavel a partir da tabela de vínculo, igual ao Eventos.tsx
      const eventos = (eventosRaw || []).map((e: any) => {
        const nomes = (e.eventos_responsaveis || [])
          .map((r: any) => r.profissionais?.nome)
          .filter(Boolean);
        return { ...e, responsavel: nomes.join(", ") || e.responsavel || null };
      });

      return { eventos, turmas: turmas || [] };
    },
    staleTime: 5 * 60_000,
    enabled: !!empresaId,
  });

  const allEventoIds = rawData?.eventos.map((e: any) => e.id) ?? [];
  const allTurmaIds = rawData?.turmas.map((t: any) => t.id) ?? [];

  const { data: tarefasData } = useQuery({
    queryKey: ["proximos-eventos-tarefas", allEventoIds, allTurmaIds],
    queryFn: async () => {
      const [{ data: tEvt }, { data: tTur }] = await Promise.all([
        allEventoIds.length
          ? supabase.from("tarefas").select("status, evento_id").in("evento_id", allEventoIds)
          : Promise.resolve({ data: [] as any[] }),
        allTurmaIds.length
          ? (supabase as any).from("tarefas").select("status, turma_id").in("turma_id", allTurmaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      return { tEvt: tEvt || [], tTur: tTur || [] };
    },
    staleTime: 5 * 60_000,
    enabled: !!rawData,
  });

  // Filtro e processamento fora da query — re-executa quando profissionalNome carrega
  const itens = useMemo<ItemProximo[]>(() => {
    if (!rawData) return [];

    const hoje = hojeBrasilISO();
    const tEvt = tarefasData?.tEvt ?? [];
    const tTur = tarefasData?.tTur ?? [];

    const eventosFiltrados = filterByResponsavel(rawData.eventos);
    const turmasFiltradas = filterByResponsavel(rawData.turmas);

    const turmasProx = turmasFiltradas
      .map((t: any) => {
        const futuras = (t.encontros || [])
          .map((e: any) => e.data as string | null)
          .filter((d: string | null): d is string => !!d && d >= hoje)
          .sort();
        const dataRef = futuras[0] || (t.data_inicio && t.data_inicio >= hoje ? t.data_inicio : null);
        return { ...t, dataRef };
      })
      .filter((t: any) => t.dataRef && diffDiasISO(hoje, t.dataRef) <= HORIZONTE_DIAS);

    const result: ItemProximo[] = [];

    for (const e of eventosFiltrados) {
      const tarefas = tEvt.filter((t: any) => t.evento_id === e.id);
      result.push({
        key: `evt-${e.id}`,
        nome: e.nome,
        subtitulo: `${e.tipo || "evento"} · ${formatDate(e.data)}`,
        dataRef: e.data,
        dias: diffDiasISO(hoje, e.data),
        total: tarefas.length,
        concluidas: tarefas.filter((t: any) => t.status === "concluida").length,
        href: `/eventos?evento=${e.id}`,
      });
    }

    for (const t of turmasProx) {
      const tarefas = tTur.filter((x: any) => x.turma_id === t.id);
      const totalSessoes = (t.encontros || []).filter((e: any) => e.data).length;
      const cursoNome = t.produtos?.nome as string | undefined;
      result.push({
        key: `tur-${t.id}`,
        nome: cursoNome || t.nome,
        subtitulo: `${cursoNome ? `${t.nome} · ` : ""}${totalSessoes ? `${totalSessoes} sessões · ` : ""}próxima ${formatDate(t.dataRef)}`,
        dataRef: t.dataRef,
        dias: diffDiasISO(hoje, t.dataRef),
        total: tarefas.length,
        concluidas: tarefas.filter((x: any) => x.status === "concluida").length,
        href: `/turmas?turma=${t.id}&tab=operacao`,
      });
    }

    return result.sort((a, b) => a.dias - b.dias).slice(0, 6);
  }, [rawData, tarefasData, isProfissional, profissionalNome, filterByResponsavel]);

  if (itens.length === 0) return null;

  return (
    <Card>
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
                <div className="flex-1 h-2 rounded-full bg-muted/60 border border-border/40 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {it.total === 0 ? "Sem atividades" : `${it.concluidas} de ${it.total} feitas`}
                </span>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
