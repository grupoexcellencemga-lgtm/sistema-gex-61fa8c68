import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Bot, TrendingUp, Handshake, MessageSquare, Loader2, BarChart3 } from "lucide-react";

type Conversa = {
  id: string;
  agente_id: string | null;
  iniciado_em: string;
  houve_handoff: boolean;
  motivo_fim: string | null;
  total_mensagens: number;
  total_iteracoes: number;
  score_inicial: number | null;
  score_final: number | null;
};

type Agente = { id: string; nome: string };

const PERIODOS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

function fmt(n: number, dec = 1) {
  return Number.isFinite(n) ? n.toFixed(dec) : "—";
}

function datePtBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function BotIARelatorioCard() {
  const { empresaId } = useEmpresa();
  const [periodo, setPeriodo] = useState("30");

  const since = new Date(Date.now() - Number(periodo) * 86_400_000).toISOString();

  const { data: conversas = [], isLoading: loadingConversas } = useQuery<Conversa[]>({
    queryKey: ["bot-ia-relatorio-conversas", empresaId, periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversas_ia")
        .select("id, agente_id, iniciado_em, houve_handoff, motivo_fim, total_mensagens, total_iteracoes, score_inicial, score_final")
        .eq("empresa_id", empresaId!)
        .gte("iniciado_em", since)
        .is("deleted_at", null)
        .order("iniciado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Conversa[];
    },
    enabled: !!empresaId,
    refetchInterval: 120_000,
  });

  const { data: agentes = [] } = useQuery<Agente[]>({
    queryKey: ["agentes-bot-nomes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agentes_bot")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as Agente[];
    },
    enabled: !!empresaId,
  });

  const agenteNome = (id: string | null) =>
    agentes.find((a) => a.id === id)?.nome ?? "Sem agente";

  // KPIs globais
  const total = conversas.length;
  const handoffs = conversas.filter((c) => c.houve_handoff).length;
  const handoffRate = total > 0 ? (handoffs / total) * 100 : 0;

  const comScore = conversas.filter((c) => c.score_inicial != null && c.score_final != null);
  const deltaScore =
    comScore.length > 0
      ? comScore.reduce((s, c) => s + (c.score_final! - c.score_inicial!), 0) / comScore.length
      : null;

  const avgMsgs =
    total > 0 ? conversas.reduce((s, c) => s + c.total_mensagens, 0) / total : 0;

  const avgIter =
    total > 0 ? conversas.reduce((s, c) => s + c.total_iteracoes, 0) / total : 0;

  // Sessões por dia (gráfico)
  const byDay: Record<string, number> = {};
  for (const c of conversas) {
    const day = c.iniciado_em.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }
  const chartData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day: datePtBr(day), count }));

  // Por agente
  const byAgente: Record<string, { total: number; handoffs: number }> = {};
  for (const c of conversas) {
    const key = c.agente_id ?? "__none__";
    if (!byAgente[key]) byAgente[key] = { total: 0, handoffs: 0 };
    byAgente[key].total++;
    if (c.houve_handoff) byAgente[key].handoffs++;
  }
  const agenteData = Object.entries(byAgente)
    .map(([id, v]) => ({
      id,
      nome: agenteNome(id === "__none__" ? null : id),
      total: v.total,
      handoffs: v.handoffs,
      pctHandoff: v.total > 0 ? Math.round((v.handoffs / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const isLoading = loadingConversas;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Analytics — Agente IA
          </CardTitle>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODOS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma sessão registrada no período.
          </p>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Bot className="h-3.5 w-3.5" />
                  Sessões
                </div>
                <p className="text-2xl font-bold">{total}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <Handshake className="h-3.5 w-3.5" />
                  Taxa de handoff
                </div>
                <p className="text-2xl font-bold">{fmt(handoffRate)}%</p>
                <p className="text-[10px] text-muted-foreground">{handoffs} handoffs</p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Msgs / sessão
                </div>
                <p className="text-2xl font-bold">{fmt(avgMsgs)}</p>
                <p className="text-[10px] text-muted-foreground">{fmt(avgIter)} iterações médias</p>
              </div>
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Δ Score médio
                </div>
                <p className={`text-2xl font-bold ${deltaScore != null && deltaScore > 0 ? "text-green-600 dark:text-green-400" : deltaScore != null && deltaScore < 0 ? "text-red-500" : ""}`}>
                  {deltaScore != null ? `${deltaScore > 0 ? "+" : ""}${fmt(deltaScore)}` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">{comScore.length} leads com score</p>
              </div>
            </div>

            {/* Gráfico sessões por dia */}
            {chartData.length > 1 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Sessões por dia</p>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(v: number) => [v, "sessões"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--primary))`} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Por agente */}
            {agenteData.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Por agente</p>
                <div className="space-y-2">
                  {agenteData.map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <p className="text-sm w-40 truncate shrink-0">{a.nome}</p>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(100, (a.total / total) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground w-6 text-right shrink-0">{a.total}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {a.pctHandoff}% handoff
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
