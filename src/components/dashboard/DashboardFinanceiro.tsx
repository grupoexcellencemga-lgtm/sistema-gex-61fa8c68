import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, Landmark, AlertTriangle, CheckSquare, CreditCard } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Loader2 } from "lucide-react";
import type { TarefaRow } from "@/types";

interface Props {
  mes: number;
  ano: number;
}

export function DashboardFinanceiro({ mes, ano }: Props) {
  const { user } = useAuth();
  const startStr = new Date(ano, mes, 1).toISOString().split("T")[0];
  const endStr = new Date(ano, mes + 1, 0).toISOString().split("T")[0];
  const hoje = new Date().toISOString().split("T")[0];

  const { data: receitaMes = 0, isLoading } = useQuery({
    queryKey: ["dash-fin-receita", mes, ano],
    queryFn: async () => {
      const { data: pag } = await supabase.from("pagamentos").select("valor, valor_pago").eq("status", "pago").is("deleted_at", null).gte("data_pagamento", startStr).lte("data_pagamento", endStr);
      const { data: rec } = await supabase.from("receitas_avulsas").select("valor").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
      const totalPag = (pag || []).reduce((s, p) => s + Number(p.valor_pago || p.valor), 0);
      const totalRec = (rec || []).reduce((s, r) => s + Number(r.valor), 0);
      return totalPag + totalRec;
    },
  });

  const { data: despesasMes = 0 } = useQuery({
    queryKey: ["dash-fin-despesas", mes, ano],
    queryFn: async () => {
      const { data } = await supabase.from("despesas").select("valor").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
      return (data || []).reduce((s, d) => s + Number(d.valor), 0);
    },
  });

  const { data: inadimplencia = { total: 0, count: 0 } } = useQuery({
    queryKey: ["dash-fin-inadimplencia"],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("pagamentos")
        .select("valor", { count: "exact" })
        .eq("status", "pendente")
        .is("deleted_at", null)
        .lt("data_vencimento", hoje);
      const total = (data || []).reduce((s, p) => s + Number(p.valor), 0);
      return { total, count: count || 0 };
    },
  });

  const lucro = receitaMes - despesasMes;

  const { data: fluxo6meses = [] } = useQuery({
    queryKey: ["dash-fin-fluxo6m", mes, ano],
    queryFn: async () => {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ano, mes - i, 1);
        const mStart = d.toISOString().split("T")[0];
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
        const label = d.toLocaleDateString("pt-BR", { month: "short" });

        const { data: pag } = await supabase.from("pagamentos").select("valor, valor_pago").eq("status", "pago").is("deleted_at", null).gte("data_pagamento", mStart).lte("data_pagamento", mEnd);
        const { data: rec } = await supabase.from("receitas_avulsas").select("valor").is("deleted_at", null).gte("data", mStart).lte("data", mEnd);
        const { data: desp } = await supabase.from("despesas").select("valor").is("deleted_at", null).gte("data", mStart).lte("data", mEnd);

        const receita = (pag || []).reduce((s, p) => s + Number(p.valor_pago || p.valor), 0) + (rec || []).reduce((s, r) => s + Number(r.valor), 0);
        const despesa = (desp || []).reduce((s, d) => s + Number(d.valor), 0);
        results.push({ name: label, receita, despesa });
      }
      return results;
    },
  });

  const { data: vencidos = [] } = useQuery({
    queryKey: ["dash-fin-vencidos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("id, valor, data_vencimento, alunos(nome)")
        .eq("status", "pendente")
        .is("deleted_at", null)
        .lt("data_vencimento", hoje)
        .order("data_vencimento", { ascending: true })
        .limit(10);
      return (data || []).map((p) => ({
        id: p.id,
        aluno: (p.alunos as { nome: string } | null)?.nome || "—",
        valor: Number(p.valor),
        vencimento: p.data_vencimento || "",
        diasAtraso: Math.floor((Date.now() - new Date((p.data_vencimento || "") + "T12:00:00").getTime()) / 86400000),
      }));
    },
  });

  const { data: contasProximas = [] } = useQuery({
    queryKey: ["dash-fin-contas-proximas"],
    queryFn: async () => {
      const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("contas_a_pagar")
        .select("id, descricao, valor, data_vencimento, fornecedor")
        .is("deleted_at", null)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", em7dias)
        .order("data_vencimento")
        .limit(10);
      return data || [];
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Receita do Mês" value={formatCurrency(receitaMes)} icon={TrendingUp} variant="success" />
        <MetricCard title="Despesas do Mês" value={formatCurrency(despesasMes)} icon={TrendingDown} variant="warning" />
        <MetricCard title="Lucro Líquido" value={formatCurrency(lucro)} icon={Landmark} variant={lucro >= 0 ? "primary" : "destructive"} />
        <MetricCard title="Inadimplência" value={formatCurrency(inadimplencia.total)} icon={AlertTriangle} variant="destructive" trend={`${inadimplencia.count} pgto(s) vencido(s)`} />
      </div>

      {fluxo6meses.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base font-semibold">Receita vs Despesa (6 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={fluxo6meses} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {vencidos.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Pagamentos Vencidos</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vencidos.map((v) => (
                  <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-destructive/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{v.aluno}</p>
                      <p className="text-xs text-muted-foreground">{v.diasAtraso}d de atraso</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive shrink-0">{formatCurrency(v.valor)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {contasProximas.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Contas a Pagar (7 dias)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {contasProximas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.descricao}</p>
                      <p className="text-xs text-muted-foreground">{c.fornecedor || "—"} • {new Date(c.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-sm font-semibold shrink-0">{formatCurrency(Number(c.valor))}</span>
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
