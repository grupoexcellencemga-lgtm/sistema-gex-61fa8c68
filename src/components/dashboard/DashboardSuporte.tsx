import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Cake, Calendar, CheckSquare } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { TarefaRow } from "@/types";

interface Props {
  mes: number;
  ano: number;
}

export function DashboardSuporte({ mes, ano }: Props) {
  const { user } = useAuth();
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  const { data: totalAlunos = 0, isLoading } = useQuery({
    queryKey: ["dash-sup-alunos"],
    queryFn: async () => {
      const { count } = await supabase.from("alunos").select("id", { count: "exact", head: true }).is("deleted_at", null);
      return count || 0;
    },
  });

  const { data: aniversariantesMes = 0 } = useQuery({
    queryKey: ["dash-sup-aniversarios", mes],
    queryFn: async () => {
      const mesStr = String(mes + 1).padStart(2, "0");
      const { data } = await supabase.from("alunos").select("id, data_nascimento").is("deleted_at", null).not("data_nascimento", "is", null);
      return (data || []).filter((a) => a.data_nascimento && a.data_nascimento.substring(5, 7) === mesStr).length;
    },
  });

  const { data: eventosProximos = [] } = useQuery({
    queryKey: ["dash-sup-eventos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("eventos")
        .select("id, nome, data, local")
        .is("deleted_at", null)
        .gte("data", hojeStr)
        .lte("data", em7dias)
        .order("data")
        .limit(5);
      return data || [];
    },
  });

  const { data: aniversariantesSemana = [] } = useQuery({
    queryKey: ["dash-sup-aniversarios-semana"],
    queryFn: async () => {
      const { data } = await supabase.from("alunos").select("id, nome, data_nascimento, telefone").is("deleted_at", null).not("data_nascimento", "is", null);
      const hojeMMDD = `${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
      const em7 = new Date(Date.now() + 7 * 86400000);
      const em7MMDD = `${String(em7.getMonth() + 1).padStart(2, "0")}-${String(em7.getDate()).padStart(2, "0")}`;

      return (data || [])
        .filter((a) => {
          if (!a.data_nascimento) return false;
          const mmdd = a.data_nascimento.substring(5);
          return mmdd >= hojeMMDD && mmdd <= em7MMDD;
        })
        .slice(0, 10);
    },
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

  const tarefasPendentes = minhasTarefas.length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total de Alunos" value={totalAlunos} icon={Users} variant="primary" />
        <MetricCard title="Aniversariantes do Mês" value={aniversariantesMes} icon={Cake} variant="success" />
        <MetricCard title="Eventos Próximos" value={eventosProximos.length} icon={Calendar} variant="default" />
        <MetricCard title="Tarefas Pendentes" value={tarefasPendentes} icon={CheckSquare} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {aniversariantesSemana.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Cake className="h-4 w-4" /> Aniversariantes da Semana</CardTitle>
                <Link to="/aniversarios" className="text-xs text-primary hover:underline">Ver todos →</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aniversariantesSemana.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{a.nome}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {a.data_nascimento ? new Date(a.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {eventosProximos.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Próximos Eventos</CardTitle>
                <Link to="/eventos" className="text-xs text-primary hover:underline">Ver todos →</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {eventosProximos.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.nome}</p>
                      <p className="text-xs text-muted-foreground">{e.local || "—"}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {e.data ? new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
