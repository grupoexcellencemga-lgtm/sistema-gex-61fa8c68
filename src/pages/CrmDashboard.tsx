import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MessageSquare, Clock, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type DayCount = { dia: string; total: number };
type CanalCount = { canal: string; total: number };
type EtapaCount = { etapa: string; total: number; tipo: string };

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CrmDashboard() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  // Mensagens por dia (últimos 14 dias)
  const { data: msgsPorDia = [], isLoading: loadMsgs } = useQuery<DayCount[]>({
    queryKey: ["crm-dash-msgs-dia", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("crm_mensagens_por_dia", { p_empresa_id: empresaId, p_dias: 14 });
      return (data ?? []) as DayCount[];
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  // Leads por canal
  const { data: leadsPorCanal = [] } = useQuery<CanalCount[]>({
    queryKey: ["crm-dash-leads-canal", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("leads")
        .select("canal_id, canais_crm(nome)")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .neq("status_atendimento", "finalizado");
      const map = new Map<string, { nome: string; count: number }>();
      for (const r of (data ?? [])) {
        const nome = (r as any).canais_crm?.nome ?? "Sem canal";
        const existing = map.get(nome);
        if (existing) existing.count++;
        else map.set(nome, { nome, count: 1 });
      }
      return Array.from(map.values()).map((v) => ({ canal: v.nome, total: v.count })).sort((a, b) => b.total - a.total);
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  // Leads por status_atendimento
  const { data: leadsStatus = [] } = useQuery<{ status: string; total: number }[]>({
    queryKey: ["crm-dash-leads-status", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("leads")
        .select("status_atendimento")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);
      const map = new Map<string, number>();
      for (const r of (data ?? [])) {
        const s = (r as any).status_atendimento ?? "desconhecido";
        map.set(s, (map.get(s) ?? 0) + 1);
      }
      return Array.from(map.entries()).map(([status, total]) => ({ status, total })).sort((a, b) => b.total - a.total);
    },
    enabled: !!empresaId,
    staleTime: 60000,
  });

  // Tempo médio de resposta (minutos) — mensagens saída após entrada
  const { data: tempoMedioResp } = useQuery<number | null>({
    queryKey: ["crm-dash-tempo-resp", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("crm_tempo_medio_resposta", { p_empresa_id: empresaId });
      return data != null ? Number(data) : null;
    },
    enabled: !!empresaId,
    staleTime: 120000,
  });

  // Total de conversas abertas agora
  const filaCount = leadsStatus.find((s) => s.status === "fila")?.total ?? 0;
  const ativoCount = leadsStatus.find((s) => s.status === "ativo")?.total ?? 0;
  const finalizadoCount = leadsStatus.find((s) => s.status === "finalizado")?.total ?? 0;
  const totalMsgsHoje = msgsPorDia.find((d) => {
    const today = new Date().toISOString().slice(0, 10);
    return d.dia.startsWith(today);
  })?.total ?? 0;

  const maxMsgs = Math.max(...msgsPorDia.map((d) => d.total), 1);

  function tempoLabel(min: number | null): string {
    if (min == null) return "—";
    if (min < 60) return `${Math.round(min)}min`;
    return `${Math.floor(min / 60)}h${Math.round(min % 60) > 0 ? Math.round(min % 60) + "min" : ""}`;
  }

  return (
    <>
      <PageHeader title="Dashboard CRM" subtitle="Visão geral de atendimentos e conversas" />
      <div className="p-4 space-y-6 max-w-5xl">
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Na fila agora" value={filaCount} icon={Clock} color="bg-amber-500" sub="aguardando atendimento" />
          <StatCard title="Em andamento" value={ativoCount} icon={MessageSquare} color="bg-blue-500" sub="conversas ativas" />
          <StatCard title="Finalizados" value={finalizadoCount} icon={TrendingUp} color="bg-green-500" sub="total histórico" />
          <StatCard title="Tempo médio resp." value={tempoLabel(tempoMedioResp ?? null)} icon={Users} color="bg-purple-500" sub="últimos 7 dias" />
        </div>

        {/* Mensagens por dia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Mensagens por dia — últimos 14 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {loadMsgs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : msgsPorDia.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {msgsPorDia.map((d) => {
                  const pct = Math.max(4, Math.round((d.total / maxMsgs) * 100));
                  const date = new Date(d.dia);
                  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                  return (
                    <div key={d.dia} className="flex flex-col items-center gap-1 flex-1 min-w-0 group">
                      <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                        {d.total}
                      </span>
                      <div
                        className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                        style={{ height: `${pct}%` }}
                        title={`${label}: ${d.total} msg`}
                      />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Leads por canal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Leads ativos por canal</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsPorCanal.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum dado.</p>
              ) : (
                <div className="space-y-2">
                  {leadsPorCanal.map((c) => {
                    const pct = Math.round((c.total / (leadsPorCanal[0]?.total || 1)) * 100);
                    return (
                      <div key={c.canal}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium truncate">{c.canal}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">{c.total}</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status dos leads */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição por status</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsStatus.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum dado.</p>
              ) : (
                <div className="space-y-2">
                  {leadsStatus.map((s) => {
                    const total = leadsStatus.reduce((a, b) => a + b.total, 0);
                    const pct = Math.round((s.total / total) * 100);
                    const color =
                      s.status === "ativo" ? "bg-blue-500"
                      : s.status === "fila" ? "bg-amber-400"
                      : s.status === "finalizado" ? "bg-green-500"
                      : "bg-muted-foreground";
                    const label =
                      s.status === "ativo" ? "Em andamento"
                      : s.status === "fila" ? "Na fila"
                      : s.status === "finalizado" ? "Finalizado"
                      : s.status;
                    return (
                      <div key={s.status}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="font-medium capitalize">{label}</span>
                          <span className="text-muted-foreground">{s.total} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
