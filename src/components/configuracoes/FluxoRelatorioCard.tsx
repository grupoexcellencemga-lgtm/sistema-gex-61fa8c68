import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, CheckCircle2, Clock, Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SessaoRow = {
  fluxo_id: string;
  status: "active" | "waiting" | "completed";
};

type FluxoInfo = {
  id: string;
  nome: string;
};

type FluxoMetrics = {
  id: string;
  nome: string;
  total: number;
  completed: number;
  active: number;
  waiting: number;
  pct: number;
};

export function FluxoRelatorioCard() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data: sessoes = [], isLoading: loadingSessoes } = useQuery<SessaoRow[]>({
    queryKey: ["fluxo-sessoes-relatorio", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_sessoes")
        .select("fluxo_id, status")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return (data ?? []) as SessaoRow[];
    },
    enabled: !!empresaId,
    refetchInterval: 60_000,
  });

  const { data: fluxos = [], isLoading: loadingFluxos } = useQuery<FluxoInfo[]>({
    queryKey: ["fluxos-bot-info", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxos_bot")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as FluxoInfo[];
    },
    enabled: !!empresaId,
  });

  const isLoading = loadingSessoes || loadingFluxos;

  const metrics: FluxoMetrics[] = fluxos.map((f) => {
    const rows = sessoes.filter((s) => s.fluxo_id === f.id);
    const total     = rows.length;
    const completed = rows.filter((s) => s.status === "completed").length;
    const active    = rows.filter((s) => s.status === "active").length;
    const waiting   = rows.filter((s) => s.status === "waiting").length;
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { id: f.id, nome: f.nome, total, completed, active, waiting, pct };
  }).filter((m) => m.total > 0);

  const totalGeral     = sessoes.length;
  const completedGeral = sessoes.filter((s) => s.status === "completed").length;
  const activeGeral    = sessoes.filter((s) => s.status === "active").length;
  const waitingGeral   = sessoes.filter((s) => s.status === "waiting").length;
  const pctGeral       = totalGeral > 0 ? Math.round((completedGeral / totalGeral) * 100) : 0;

  if (!isLoading && totalGeral === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-primary" />
          Desempenho dos Fluxos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Totais gerais */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Total", value: totalGeral, icon: BarChart3, color: "text-foreground" },
                { label: "Concluídas", value: completedGeral, icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
                { label: "Em andamento", value: activeGeral, icon: Activity, color: "text-blue-600 dark:text-blue-400" },
                { label: "Aguardando", value: waitingGeral, icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
              ].map((stat) => (
                <div key={stat.label} className="text-center space-y-1 p-3 rounded-lg bg-muted/40">
                  <stat.icon className={cn("h-4 w-4 mx-auto", stat.color)} />
                  <p className={cn("text-xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Taxa de conclusão geral */}
            {totalGeral > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Taxa de conclusão geral</span>
                  <span className="font-semibold tabular-nums">{pctGeral}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${pctGeral}%` }}
                  />
                </div>
              </div>
            )}

            {/* Por fluxo */}
            {metrics.length > 1 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Por fluxo</p>
                {metrics.map((m) => (
                  <div key={m.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium truncate">{m.nome}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{m.total} sessões</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.active > 0 && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400">{m.active} ativas</span>
                        )}
                        {m.waiting > 0 && (
                          <span className="text-[10px] text-yellow-600 dark:text-yellow-400">{m.waiting} aguard.</span>
                        )}
                        <span className="text-xs font-semibold tabular-nums text-green-600 dark:text-green-400">{m.pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
