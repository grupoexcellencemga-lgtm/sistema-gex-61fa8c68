import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, TrendingUp, Percent, CreditCard, Target, CheckSquare, Phone } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { Loader2 } from "lucide-react";
import type { TarefaRow } from "@/types";

interface Props {
  mes: number;
  ano: number;
}

const etapaLabels: Record<string, string> = {
  lead: "Lead", contato: "Contato", negociacao: "Negociação", matricula: "Matrícula",
};
const etapaColors: Record<string, string> = {
  lead: "bg-muted text-muted-foreground", contato: "bg-warning/10 text-warning",
  negociacao: "bg-primary/10 text-primary", matricula: "bg-success/10 text-success",
};

export function DashboardComercial({ mes, ano }: Props) {
  const { user } = useAuth();
  const startStr = new Date(ano, mes, 1).toISOString().split("T")[0];
  const endStr = new Date(ano, mes + 1, 0).toISOString().split("T")[0];

  const { data: comercialId } = useQuery({
    queryKey: ["my-comercial-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_comercial_id", { _user_id: user.id });
      return data as string | null;
    },
    enabled: !!user,
  });

  const { data: leadsAtivos = 0, isLoading: loadingLeads } = useQuery({
    queryKey: ["dash-comercial-leads", comercialId],
    queryFn: async () => {
      if (!comercialId) return 0;
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("responsavel_id", comercialId)
        .is("deleted_at", null)
        .in("etapa", ["lead", "contato", "negociacao"]);
      return count || 0;
    },
    enabled: !!comercialId,
  });

  const { data: conversoesMes = 0 } = useQuery({
    queryKey: ["dash-comercial-conversoes", comercialId, mes, ano],
    queryFn: async () => {
      if (!comercialId) return 0;
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("responsavel_id", comercialId)
        .eq("etapa", "matricula")
        .is("deleted_at", null)
        .gte("updated_at", startStr)
        .lte("updated_at", endStr + "T23:59:59");
      return count || 0;
    },
    enabled: !!comercialId,
  });

  const taxaConversao = leadsAtivos + conversoesMes > 0
    ? ((conversoesMes / (leadsAtivos + conversoesMes)) * 100).toFixed(1)
    : "0";

  const { data: comissoesMes = 0 } = useQuery({
    queryKey: ["dash-comercial-comissoes", comercialId, mes, ano],
    queryFn: async () => {
      if (!comercialId) return 0;
      const { data } = await supabase
        .from("comissoes")
        .select("valor_comissao")
        .eq("comercial_id", comercialId)
        .is("deleted_at", null)
        .gte("created_at", startStr)
        .lt("created_at", new Date(ano, mes + 1, 1).toISOString());
      return (data || []).reduce((sum, c) => sum + Number(c.valor_comissao), 0);
    },
    enabled: !!comercialId,
  });

  const { data: funilData = [] } = useQuery({
    queryKey: ["dash-comercial-funil", comercialId],
    queryFn: async () => {
      if (!comercialId) return [];
      const etapas = ["lead", "contato", "negociacao", "matricula"];
      const results = [];
      for (const etapa of etapas) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", comercialId)
          .eq("etapa", etapa)
          .is("deleted_at", null);
        results.push({ etapa, count: count || 0 });
      }
      return results;
    },
    enabled: !!comercialId,
  });

  const { data: metas = [] } = useQuery({
    queryKey: ["dash-comercial-metas", comercialId],
    queryFn: async () => {
      if (!comercialId) return [];
      const hoje = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("metas")
        .select("id, titulo, tipo, valor_meta, valor_atual")
        .is("deleted_at", null)
        .eq("responsavel_id", comercialId)
        .lte("periodo_inicio", hoje)
        .gte("periodo_fim", hoje);
      return data || [];
    },
    enabled: !!comercialId,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ["dash-comercial-followups", comercialId],
    queryFn: async () => {
      if (!comercialId) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, etapa, updated_at")
        .eq("responsavel_id", comercialId)
        .is("deleted_at", null)
        .in("etapa", ["lead", "contato", "negociacao"])
        .order("updated_at", { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!comercialId,
  });

  const { data: minhasTarefas = [] } = useQuery<Pick<TarefaRow, "id" | "titulo" | "prioridade" | "data_vencimento" | "status">[]>({
    queryKey: ["minhas-tarefas-dashboard", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("tarefas")
        .select("id, titulo, prioridade, data_vencimento, status")
        .eq("responsavel_id", user.id)
        .in("status", ["pendente", "em_andamento"])
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  if (loadingLeads && !comercialId) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Meus Leads" value={leadsAtivos} icon={Users} variant="primary" />
        <MetricCard title="Conversões no Mês" value={conversoesMes} icon={TrendingUp} variant="success" />
        <MetricCard title="Taxa de Conversão" value={`${taxaConversao}%`} icon={Percent} variant="default" />
        <MetricCard title="Comissões do Mês" value={formatCurrency(comissoesMes)} icon={CreditCard} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Meu Funil</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funilData.map((f) => (
                <div key={f.etapa} className="flex items-center justify-between">
                  <Badge className={etapaColors[f.etapa] || ""}>{etapaLabels[f.etapa] || f.etapa}</Badge>
                  <span className="text-lg font-bold">{f.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {metas.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Minhas Metas</CardTitle>
                <Link to="/metas" className="text-xs text-primary hover:underline">Ver todas →</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metas.map((meta) => {
                  const pct = Number(meta.valor_meta) > 0 ? Math.min((Number(meta.valor_atual) / Number(meta.valor_meta)) * 100, 100) : 0;
                  return (
                    <div key={meta.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{meta.titulo}</span>
                        <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {followUps.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><Phone className="h-4 w-4" /> Próximos Follow-ups</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {followUps.map((lead) => {
                const diasSemContato = Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000);
                return (
                  <Link key={lead.id} to="/funil" className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{lead.nome}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{etapaLabels[lead.etapa]}</Badge>
                    </div>
                    <span className={`text-xs shrink-0 ${diasSemContato > 7 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {diasSemContato}d sem contato
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {minhasTarefas.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Minhas Tarefas</CardTitle>
              <Link to="/tarefas" className="text-xs text-primary hover:underline">Ver todas →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {minhasTarefas.map((t) => {
                const isVencida = t.data_vencimento && new Date(t.data_vencimento + "T23:59:59") < new Date();
                const prioridadeColors: Record<string, string> = { urgente: "text-destructive", alta: "text-orange-600 dark:text-orange-400", media: "text-blue-600 dark:text-blue-400", baixa: "text-muted-foreground" };
                return (
                  <Link key={t.id} to="/tarefas" className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-medium ${prioridadeColors[t.prioridade] || ""}`}>●</span>
                      <span className="text-sm truncate">{t.titulo}</span>
                    </div>
                    {t.data_vencimento && (
                      <span className={`text-xs shrink-0 ${isVencida ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {new Date(t.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
