import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { TrendingUp, TrendingDown, Landmark, AlertTriangle, CreditCard } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

interface Props {
  mes: number;
  ano: number;
}

export function DashboardFinanceiro({ mes, ano }: Props) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const startStr = new Date(ano, mes, 1).toISOString().split("T")[0];
  const endStr = new Date(ano, mes + 1, 0).toISOString().split("T")[0];
  const hoje = new Date().toISOString().split("T")[0];

  const { data: receitaMes = 0, isLoading } = useQuery({
    queryKey: ["dash-fin-receita", mes, ano, empresaId],
    queryFn: async () => {
      const { data: pag } = await supabase.from("pagamentos").select("valor, valor_pago").eq("empresa_id", empresaId!).eq("status", "pago").is("deleted_at", null).gte("data_pagamento", startStr).lte("data_pagamento", endStr);
      const { data: rec } = await supabase.from("receitas_avulsas").select("valor").eq("empresa_id", empresaId!).is("deleted_at", null).gte("data", startStr).lte("data", endStr);
      const totalPag = (pag || []).reduce((s, p) => s + Number(p.valor_pago || p.valor), 0);
      const totalRec = (rec || []).reduce((s, r) => s + Number(r.valor), 0);
      return totalPag + totalRec;
    },
    enabled: !!empresaId,
  });

  const { data: despesasMes = 0 } = useQuery({
    queryKey: ["dash-fin-despesas", mes, ano, empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("despesas").select("valor").eq("empresa_id", empresaId!).is("deleted_at", null).gte("data", startStr).lte("data", endStr);
      return (data || []).reduce((s, d) => s + Number(d.valor), 0);
    },
    enabled: !!empresaId,
  });

  const { data: inadimplencia = { total: 0, count: 0 } } = useQuery({
    queryKey: ["dash-fin-inadimplencia", empresaId],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("pagamentos")
        .select("valor", { count: "exact" })
        .eq("empresa_id", empresaId!)
        .eq("status", "pendente")
        .is("deleted_at", null)
        .lt("data_vencimento", hoje);
      const total = (data || []).reduce((s, p) => s + Number(p.valor), 0);
      return { total, count: count || 0 };
    },
    enabled: !!empresaId,
  });

  const lucro = receitaMes - despesasMes;

  const { data: fluxo6meses = [] } = useQuery({
    queryKey: ["dash-fin-fluxo6m", mes, ano, empresaId],
    queryFn: async () => {
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ano, mes - i, 1);
        const mStart = d.toISOString().split("T")[0];
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
        const label = d.toLocaleDateString("pt-BR", { month: "short" });

        const { data: pag } = await supabase.from("pagamentos").select("valor, valor_pago").eq("empresa_id", empresaId!).eq("status", "pago").is("deleted_at", null).gte("data_pagamento", mStart).lte("data_pagamento", mEnd);
        const { data: rec } = await supabase.from("receitas_avulsas").select("valor").eq("empresa_id", empresaId!).is("deleted_at", null).gte("data", mStart).lte("data", mEnd);
        const { data: desp } = await supabase.from("despesas").select("valor").eq("empresa_id", empresaId!).is("deleted_at", null).gte("data", mStart).lte("data", mEnd);

        const receita = (pag || []).reduce((s, p) => s + Number(p.valor_pago || p.valor), 0) + (rec || []).reduce((s, r) => s + Number(r.valor), 0);
        const despesa = (desp || []).reduce((s, d) => s + Number(d.valor), 0);
        results.push({ name: label, receita, despesa });
      }
      return results;
    },
    enabled: !!empresaId,
  });

  const { data: fluxoAnual = [] } = useQuery({
    queryKey: ["dash-fin-fluxo-anual", ano, empresaId],
    queryFn: async () => {
      const mesAtual = new Date().getFullYear() === ano ? new Date().getMonth() : 11;
      const results = [];
      for (let m = 0; m < 12; m++) {
        const d = new Date(ano, m, 1);
        const mStart = d.toISOString().split("T")[0];
        const mEnd = new Date(ano, m + 1, 0).toISOString().split("T")[0];
        const label = d.toLocaleDateString("pt-BR", { month: "short" });
        if (m > mesAtual) {
          results.push({ name: label, receita: 0, despesa: 0, lucro: 0, isFuture: true });
          continue;
        }
        const [{ data: pag }, { data: rec }, { data: desp }] = await Promise.all([
          supabase.from("pagamentos").select("valor, valor_pago").eq("empresa_id", empresaId!).eq("status", "pago").is("deleted_at", null).gte("data_pagamento", mStart).lte("data_pagamento", mEnd),
          supabase.from("receitas_avulsas").select("valor").eq("empresa_id", empresaId!).is("deleted_at", null).gte("data", mStart).lte("data", mEnd),
          supabase.from("despesas").select("valor").eq("empresa_id", empresaId!).is("deleted_at", null).gte("data", mStart).lte("data", mEnd),
        ]);
        const receita = (pag || []).reduce((s, p) => s + Number(p.valor_pago || p.valor), 0) + (rec || []).reduce((s, r) => s + Number(r.valor), 0);
        const despesa = (desp || []).reduce((s, d) => s + Number(d.valor), 0);
        results.push({ name: label, receita, despesa, lucro: receita - despesa, isFuture: false });
      }
      return results;
    },
    enabled: !!empresaId,
  });

  const { data: vencidos = [] } = useQuery({
    queryKey: ["dash-fin-vencidos", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("id, valor, data_vencimento, alunos(nome)")
        .eq("empresa_id", empresaId!)
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
    enabled: !!empresaId,
  });

  const { data: contasProximas = [] } = useQuery({
    queryKey: ["dash-fin-contas-proximas", empresaId],
    queryFn: async () => {
      const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const { data } = await supabase
        .from("contas_a_pagar")
        .select("id, descricao, valor, data_vencimento, fornecedor")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje)
        .lte("data_vencimento", em7dias)
        .order("data_vencimento")
        .limit(10);
      return data || [];
    },
    enabled: !!empresaId,
  });


  const totalReceitaAnual = fluxoAnual.reduce((s, d) => s + d.receita, 0);
  const totalDespesaAnual = fluxoAnual.reduce((s, d) => s + d.despesa, 0);
  const lucroAnual = totalReceitaAnual - totalDespesaAnual;

  const CustomMonthTick = ({ x, y, payload }: any) => {
    const item = fluxoAnual.find((d) => d.name === payload.value);
    const hasData = item && !item.isFuture && (item.receita > 0 || item.despesa > 0);
    const dotColor = hasData
      ? item!.lucro >= 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)"
      : "transparent";
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>{payload.value}</text>
        <circle cx={0} cy={22} r={3.5} fill={dotColor} />
      </g>
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-semibold">Visão Anual {ano}</CardTitle>
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">↑ {formatCurrency(totalReceitaAnual)}</span>
              <span className="text-red-600 dark:text-red-400 font-medium">↓ {formatCurrency(totalDespesaAnual)}</span>
              <span className={`font-semibold ${lucroAnual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                = {formatCurrency(lucroAnual)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fluxoAnual} barSize={14} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={<CustomMonthTick />} height={40} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v)} width={80} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload?.length) return null;
                  const receita = Number(payload.find((p: any) => p.dataKey === "receita")?.value || 0);
                  const despesa = Number(payload.find((p: any) => p.dataKey === "despesa")?.value || 0);
                  const resultado = receita - despesa;
                  return (
                    <div style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, padding: "10px 14px", fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,.12)" }}>
                      <p style={{ fontWeight: 600, marginBottom: 6 }}>{label}</p>
                      <p style={{ color: "hsl(142 71% 45%)" }}>Receita: {formatCurrency(receita)}</p>
                      <p style={{ color: "hsl(0 72% 51%)" }}>Despesa: {formatCurrency(despesa)}</p>
                      <p style={{ color: resultado >= 0 ? "hsl(142 71% 45%)" : "hsl(0 72% 51%)", fontWeight: 700, marginTop: 6, borderTop: "1px solid hsl(var(--border))", paddingTop: 6 }}>
                        Resultado: {formatCurrency(resultado)}
                      </p>
                    </div>
                  );
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar dataKey="receita" name="Receita" fill="hsl(142 71% 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-1 text-center">● verde = mês positivo &nbsp;● vermelho = mês negativo</p>
        </CardContent>
      </Card>

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
                <Bar dataKey="receita" name="Receita" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
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

    </>
  );
}
