import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

  const { data: itens = [] } = useQuery<ItemProximo[]>({
    queryKey: ["proximos-eventos-card"],
    queryFn: async () => {
      const hoje = hojeBrasilISO();
      const limite = (() => {
        const [y, m, d] = hoje.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d + HORIZONTE_DIAS)).toISOString().slice(0, 10);
      })();

      const [{ data: eventos }, { data: turmas }] = await Promise.all([
        supabase
          .from("eventos")
          .select("id, nome, tipo, data")
          .is("deleted_at", null)
          .gte("data", hoje)
          .lte("data", limite),
        (supabase as any)
          .from("turmas")
          .select("id, nome, data_inicio, produtos(nome), encontros(data)")
          .is("deleted_at", null),
      ]);

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

      const eventoIds = (eventos || []).map((e: any) => e.id);
      const turmaIds = turmasProx.map((t: any) => t.id);

      const [{ data: tEvt }, { data: tTur }] = await Promise.all([
        eventoIds.length
          ? supabase
              .from("tarefas")
              .select("status, evento_id")
              .in("evento_id", eventoIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as any[] }),
        turmaIds.length
          ? (supabase as any)
              .from("tarefas")
              .select("status, turma_id")
              .in("turma_id", turmaIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const result: ItemProximo[] = [];

      for (const e of eventos || []) {
        const tarefas = (tEvt || []).filter((t: any) => t.evento_id === e.id);
        const total = tarefas.length;
        const concluidas = tarefas.filter((t: any) => t.status === "concluida").length;
        result.push({
          key: `evt-${e.id}`,
          nome: e.nome,
          subtitulo: `${e.tipo || "evento"} · ${formatDate(e.data)}`,
          dataRef: e.data,
          dias: diffDiasISO(hoje, e.data),
          total,
          concluidas,
          href: `/eventos?evento=${e.id}`,
        });
      }

      for (const t of turmasProx) {
        const tarefas = (tTur || []).filter((x: any) => x.turma_id === t.id);
        const total = tarefas.length;
        const concluidas = tarefas.filter((x: any) => x.status === "concluida").length;
        const totalSessoes = (t.encontros || []).filter((e: any) => e.data).length;
        const cursoNome = t.produtos?.nome as string | undefined;
        result.push({
          key: `tur-${t.id}`,
          nome: cursoNome || t.nome,
          subtitulo: `${cursoNome ? `${t.nome} · ` : ""}${totalSessoes ? `${totalSessoes} sessões · ` : ""}próxima ${formatDate(t.dataRef)}`,
          dataRef: t.dataRef,
          dias: diffDiasISO(hoje, t.dataRef),
          total,
          concluidas,
          href: `/turmas?turma=${t.id}&tab=operacao`,
        });
      }

      return result.sort((a, b) => a.dias - b.dias).slice(0, 6);
    },
    staleTime: 5 * 60_000,
  });

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
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
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
