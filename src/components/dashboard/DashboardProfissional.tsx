import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Calendar, CheckCircle, Users, CheckSquare } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import type { TarefaRow } from "@/types";

interface Props {
  mes: number;
  ano: number;
}

export function DashboardProfissional({ mes, ano }: Props) {
  const { user } = useAuth();
  const startStr = new Date(ano, mes, 1).toISOString().split("T")[0];
  const endStr = new Date(ano, mes + 1, 0).toISOString().split("T")[0];

  const { data: profNome } = useQuery({
    queryKey: ["my-prof-nome", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_profissional_nome", { _user_id: user.id });
      return data as string | null;
    },
    enabled: !!user,
  });

  const { data: profId } = useQuery({
    queryKey: ["my-prof-id", user?.id, profNome],
    queryFn: async () => {
      if (!profNome) return null;
      const { data } = await supabase
        .from("profissionais")
        .select("id")
        .ilike("nome", profNome)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!profNome,
  });

  const { data: processosIndAtivos = 0, isLoading } = useQuery({
    queryKey: ["dash-prof-ind", profNome],
    queryFn: async () => {
      if (!profNome) return 0;
      const { count } = await supabase
        .from("processos_individuais")
        .select("id", { count: "exact", head: true })
        .ilike("responsavel", profNome)
        .eq("status", "ativo")
        .is("deleted_at", null);
      return count || 0;
    },
    enabled: !!profNome,
  });

  const { data: processosEmpAtivos = 0 } = useQuery({
    queryKey: ["dash-prof-emp", profNome],
    queryFn: async () => {
      if (!profNome) return 0;
      const { count } = await supabase
        .from("processos_empresariais")
        .select("id", { count: "exact", head: true })
        .ilike("responsavel", profNome)
        .eq("status", "ativo")
        .is("deleted_at", null);
      return count || 0;
    },
    enabled: !!profNome,
  });

  const { data: concluidosMes = 0 } = useQuery({
    queryKey: ["dash-prof-concluidos", profNome, mes, ano],
    queryFn: async () => {
      if (!profNome) return 0;
      const { count: c1 } = await supabase
        .from("processos_individuais")
        .select("id", { count: "exact", head: true })
        .ilike("responsavel", profNome)
        .eq("status", "concluido")
        .is("deleted_at", null)
        .gte("data_finalizacao", startStr)
        .lte("data_finalizacao", endStr);
      const { count: c2 } = await supabase
        .from("processos_empresariais")
        .select("id", { count: "exact", head: true })
        .ilike("responsavel", profNome)
        .eq("status", "concluido")
        .is("deleted_at", null)
        .gte("data_finalizacao", startStr)
        .lte("data_finalizacao", endStr);
      return (c1 || 0) + (c2 || 0);
    },
    enabled: !!profNome,
  });

  const { data: turmasAtivas = 0 } = useQuery({
    queryKey: ["dash-prof-turmas", profNome],
    queryFn: async () => {
      if (!profNome) return 0;
      const { count } = await supabase
        .from("turmas")
        .select("id", { count: "exact", head: true })
        .ilike("responsavel", profNome)
        .is("deleted_at", null)
        .eq("status", "ativa");
      return count || 0;
    },
    enabled: !!profNome,
  });

  const { data: meusProcessos = [] } = useQuery({
    queryKey: ["dash-prof-processos-lista", profNome],
    queryFn: async () => {
      if (!profNome) return [];
      const { data: ind } = await supabase
        .from("processos_individuais")
        .select("id, cliente_nome, sessoes, sessoes_realizadas, status")
        .ilike("responsavel", profNome)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8);
      const { data: emp } = await supabase
        .from("processos_empresariais")
        .select("id, empresa_nome, sessoes, sessoes_realizadas, status")
        .ilike("responsavel", profNome)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8);
      return [
        ...(ind || []).map((p) => ({ id: p.id, nome: p.cliente_nome, tipo: "Individual" as const, sessoes: p.sessoes || 0, realizadas: p.sessoes_realizadas })),
        ...(emp || []).map((p) => ({ id: p.id, nome: p.empresa_nome, tipo: "Empresarial" as const, sessoes: p.sessoes || 0, realizadas: p.sessoes_realizadas })),
      ];
    },
    enabled: !!profNome,
  });

  const { data: minhasTarefas = [] } = useQuery<Pick<TarefaRow, "id" | "titulo" | "prioridade" | "data_vencimento" | "status">[]>({
    queryKey: ["minhas-tarefas-dashboard", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("tarefas").select("id, titulo, prioridade, data_vencimento, status").eq("responsavel_id", user.id).in("status", ["pendente", "em_andamento"]).order("data_vencimento", { ascending: true, nullsFirst: false }).limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  if (isLoading && !profNome) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Processos Ativos" value={processosIndAtivos + processosEmpAtivos} icon={Briefcase} variant="primary" />
        <MetricCard title="Concluídos no Mês" value={concluidosMes} icon={CheckCircle} variant="success" />
        <MetricCard title="Turmas Ativas" value={turmasAtivas} icon={Users} variant="default" />
        <MetricCard title="Total Sessões" value={meusProcessos.reduce((s, p) => s + p.realizadas, 0)} icon={Calendar} variant="warning" trend="realizadas nos ativos" />
      </div>

      {meusProcessos.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base font-semibold">Meus Processos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {meusProcessos.map((p) => {
                const pct = p.sessoes > 0 ? Math.min((p.realizadas / p.sessoes) * 100, 100) : 0;
                return (
                  <div key={p.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{p.nome}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{p.tipo}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{p.realizadas}/{p.sessoes}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
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
