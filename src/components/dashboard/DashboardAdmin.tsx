import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, CreditCard, AlertTriangle, Calendar, TrendingUp, TrendingDown, Landmark, Target, Briefcase, CheckSquare } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Progress } from "@/components/ui/progress";
import { MetricDetailDialog, MetricDetailItem } from "@/components/MetricDetailDialog";
import { formatCurrency } from "@/lib/formatters";
import { Loader2 } from "lucide-react";
import type { DashboardMetrics, MetaRow } from "@/types";

const CATEGORICAL_COLORS = [
  "hsl(20 85% 42%)",   // laranja queimado
  "hsl(25 95% 53%)",   // laranja primário
  "hsl(30 98% 62%)",   // laranja médio
  "hsl(35 100% 70%)",  // laranja claro
  "hsl(22 90% 48%)",   // laranja escuro
  "hsl(28 97% 58%)",   // laranja médio-escuro
  "hsl(33 99% 66%)",   // laranja médio-claro
  "hsl(40 100% 77%)",  // pêssego
];

interface Props {
  mes: number;
  ano: number;
}

export function DashboardAdmin({ mes, ano }: Props) {
  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  // Checklists de eventos/turmas com tarefas em aberto — visão geral da empresa,
  // agrupada por evento/turma para apontar onde agir primeiro.
  const { data: checklistPendentes = [] } = useQuery({
    queryKey: ["checklist-pendentes-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("evento_id, turma_id, data_vencimento, eventos(nome), turmas(nome)")
        .eq("origem_tarefa", "template")
        .eq("status", "pendente");
      if (error) throw error;
      return data || [];
    },
  });

  const gruposChecklist = (() => {
    const hojeISO = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
    const map = new Map<string, { tipo: "evento" | "turma"; id: string; nome: string; pendentes: number; atrasadas: number }>();
    for (const t of checklistPendentes as any[]) {
      const tipo: "evento" | "turma" = t.evento_id ? "evento" : "turma";
      const id = t.evento_id || t.turma_id;
      if (!id) continue;
      const nome = t.eventos?.nome || t.turmas?.nome || "—";
      const key = `${tipo}:${id}`;
      if (!map.has(key)) map.set(key, { tipo, id, nome, pendentes: 0, atrasadas: 0 });
      const g = map.get(key)!;
      g.pendentes++;
      if (t.data_vencimento && t.data_vencimento < hojeISO) g.atrasadas++;
    }
    return Array.from(map.values()).sort((a, b) => b.atrasadas - a.atrasadas || b.pendentes - a.pendentes);
  })();

  const { data: metrics, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics", mes, ano],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_metrics", { _mes: mes, _ano: ano });
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
  });

  const { data: detailData } = useQuery<MetricDetailItem[] | null>({
    queryKey: ["dashboard-detail", activeDialog, mes, ano],
    queryFn: async () => {
      if (!activeDialog) return null;
      const startDate = new Date(ano, mes, 1);
      const endDate = new Date(ano, mes + 1, 0);
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];
      const hoje = new Date().toISOString().split("T")[0];

      switch (activeDialog) {
        case "alunos": {
          const { data } = await supabase.from("alunos").select("nome, cidade, created_at").is("deleted_at", null).gte("created_at", startStr).lt("created_at", new Date(ano, mes + 1, 1).toISOString());
          return (data || []).map(a => ({ nome: a.nome, data: a.created_at, valor: a.cidade || "—" }));
        }
        case "matriculas": {
          const { data } = await supabase.from("matriculas").select("created_at, alunos(nome), produtos(nome)").eq("status", "ativo").is("deleted_at", null).gte("created_at", startStr).lt("created_at", new Date(ano, mes + 1, 1).toISOString());
          return (data || []).map((m) => ({ nome: (m.alunos as { nome: string } | null)?.nome || "—", data: m.created_at, valor: (m.produtos as { nome: string } | null)?.nome || "—" }));
        }
        case "receita": {
          const { data: pag } = await supabase.from("pagamentos").select("valor, valor_pago, data_pagamento, alunos(nome)").eq("status", "pago").is("deleted_at", null).gte("data_pagamento", startStr).lte("data_pagamento", endStr);
          const { data: rec } = await supabase.from("receitas_avulsas").select("valor, data, descricao").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
          return [
            ...(pag || []).map((p) => ({ nome: (p.alunos as { nome: string } | null)?.nome || "—", data: p.data_pagamento || "", valor: formatCurrency(Number(p.valor_pago || p.valor)) })),
            ...(rec || []).map((r) => ({ nome: r.descricao, data: r.data, valor: formatCurrency(Number(r.valor)) })),
          ];
        }
        case "despesas": {
          const { data } = await supabase.from("despesas").select("descricao, data, valor").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
          return (data || []).map(d => ({ nome: d.descricao, data: d.data, valor: formatCurrency(Number(d.valor)) }));
        }
        case "lucro": {
          const { data: pag } = await supabase.from("pagamentos").select("valor, valor_pago, data_pagamento, alunos(nome)").eq("status", "pago").is("deleted_at", null).gte("data_pagamento", startStr).lte("data_pagamento", endStr);
          const { data: rec } = await supabase.from("receitas_avulsas").select("valor, data, descricao").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
          const { data: desp } = await supabase.from("despesas").select("descricao, data, valor").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
          return [
            ...(pag || []).map((p) => ({ nome: `Receita: ${(p.alunos as { nome: string } | null)?.nome || "—"}`, data: p.data_pagamento || "", valor: formatCurrency(Number(p.valor_pago || p.valor)) })),
            ...(rec || []).map((r) => ({ nome: `Receita: ${r.descricao}`, data: r.data, valor: formatCurrency(Number(r.valor)) })),
            ...(desp || []).map(d => ({ nome: `Despesa: ${d.descricao}`, data: d.data, valor: `-${formatCurrency(Number(d.valor))}` })),
          ];
        }
        case "pendentes": {
          const { data } = await supabase.from("pagamentos").select("valor, data_vencimento, alunos(nome)").eq("status", "pendente").is("deleted_at", null).or(`data_pagamento.gte.${startStr},data_vencimento.gte.${startStr}`).or(`data_pagamento.lte.${endStr},data_vencimento.lte.${endStr}`);
          return (data || []).map((p) => ({ nome: (p.alunos as { nome: string } | null)?.nome || "—", data: p.data_vencimento || "", valor: formatCurrency(Number(p.valor)) }));
        }
        case "vencidos": {
          const { data } = await supabase.from("pagamentos").select("valor, data_vencimento, alunos(nome)").eq("status", "pendente").is("deleted_at", null).lt("data_vencimento", hoje);
          return (data || []).map((p) => ({ nome: (p.alunos as { nome: string } | null)?.nome || "—", data: p.data_vencimento || "", valor: formatCurrency(Number(p.valor)) }));
        }
        case "comissoes": {
          const { data } = await supabase.from("comissoes").select("valor_comissao, created_at, comerciais(nome)").is("deleted_at", null).eq("status", "pendente").gte("created_at", startStr).lt("created_at", new Date(ano, mes + 1, 1).toISOString());
          return (data || []).map((c) => ({ nome: (c.comerciais as { nome: string } | null)?.nome || "—", data: c.created_at, valor: formatCurrency(Number(c.valor_comissao)) }));
        }
        case "processos": {
          const { data } = await supabase.from("processos_individuais").select("cliente_nome, created_at, valor_total").eq("status", "ativo").is("deleted_at", null).gte("created_at", startStr).lt("created_at", new Date(ano, mes + 1, 1).toISOString());
          return (data || []).map(p => ({ nome: p.cliente_nome, data: p.created_at, valor: formatCurrency(Number(p.valor_total)) }));
        }
        case "eventos": {
          const { data } = await supabase.from("eventos").select("nome, data").is("deleted_at", null).gte("data", startStr).lte("data", endStr);
          return (data || []).map(e => ({ nome: e.nome, data: e.data || "", valor: "—" }));
        }
        default: return [];
      }
    },
    enabled: !!activeDialog,
  });

  const m = metrics || {} as Partial<DashboardMetrics>;
  const receitaTotal = Number(m.receita_paga || 0) + Number(m.receitas_avulsas || 0);
  const totalDespesas = Number(m.total_despesas || 0);
  const lucroLiquido = receitaTotal - totalDespesas;
  const pendentes = Number(m.pagamentos_pendentes || 0);
  const totalVencido = Number(m.pagamentos_vencidos || 0);
  const vencidosCount = Number(m.pagamentos_vencidos_count || 0);
  const comissoesPendentesVal = Number(m.comissoes_pendentes || 0);
  const processosAtivos = Number(m.processos_ativos || 0);
  const eventosMes = Number(m.eventos_mes || 0);

  const productData = (m.matriculas_por_produto || []) as { name: string; alunos: number }[];
  const cityData = ((m.alunos_por_cidade || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }));
  const despesasPorCategoria = ((m.despesas_por_categoria || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }));
  const comissoesPorVendedor = (m.comissoes_por_vendedor || []) as { name: string; pago: number; pendente: number }[];
  const metasAtivas = (m.metas_ativas || []) as MetaRow[];

  const dialogTitles: Record<string, string> = {
    alunos: "Novos Alunos", matriculas: "Novas Matrículas", receita: "Receita Total",
    despesas: "Despesas Total", lucro: "Lucro Líquido", pendentes: "Pagamentos Pendentes",
    vencidos: "Pagamentos Vencidos", comissoes: "Comissões Pendentes",
    processos: "Processos Ativos", eventos: "Eventos do Mês",
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <MetricDetailDialog
        open={!!activeDialog}
        onOpenChange={(o) => { if (!o) setActiveDialog(null); }}
        title={activeDialog ? dialogTitles[activeDialog] || "" : ""}
        items={(detailData as MetricDetailItem[]) || []}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard title="Novos Alunos" value={Number(m.total_alunos_mes || 0)} icon={Users} variant="primary" onClick={() => setActiveDialog("alunos")} />
        <MetricCard title="Novas Matrículas" value={Number(m.total_matriculas_mes || 0)} icon={UserPlus} variant="success" onClick={() => setActiveDialog("matriculas")} />
        <MetricCard title="Receita Total" value={formatCurrency(receitaTotal)} icon={TrendingUp} variant="success" onClick={() => setActiveDialog("receita")} />
        <MetricCard title="Despesas Total" value={formatCurrency(totalDespesas)} icon={TrendingDown} variant="warning" onClick={() => setActiveDialog("despesas")} />
        <MetricCard title="Lucro Líquido" value={formatCurrency(lucroLiquido)} icon={Landmark} variant={lucroLiquido >= 0 ? "primary" : "destructive"} onClick={() => setActiveDialog("lucro")} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard title="Pgtos Pendentes" value={formatCurrency(pendentes)} icon={CreditCard} variant="warning" onClick={() => setActiveDialog("pendentes")} />
        <MetricCard title="Pgtos Vencidos" value={formatCurrency(totalVencido)} icon={AlertTriangle} variant="destructive" onClick={() => setActiveDialog("vencidos")} />
        <MetricCard title="Comissões Pend." value={formatCurrency(comissoesPendentesVal)} icon={CreditCard} variant="warning" onClick={() => setActiveDialog("comissoes")} />
        <MetricCard title="Processos Ativos" value={processosAtivos} icon={Briefcase} variant="primary" onClick={() => setActiveDialog("processos")} />
        <MetricCard title="Eventos do Mês" value={eventosMes} icon={Calendar} variant="default" onClick={() => setActiveDialog("eventos")} />
      </div>

      {vencidosCount > 0 && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm"><span className="font-semibold text-destructive">{vencidosCount} pagamento{vencidosCount > 1 ? "s" : ""} vencido{vencidosCount > 1 ? "s" : ""}</span> — Total: {formatCurrency(totalVencido)}</p>
          </CardContent>
        </Card>
      )}

      {metasAtivas.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><Target className="h-4 w-4" /> Metas Ativas</CardTitle>
              <Link to="/metas" className="text-xs text-primary hover:underline">Ver todas →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metasAtivas.map((meta) => {
                const pct = Number(meta.valor_meta) > 0 ? Math.min((Number(meta.valor_atual) / Number(meta.valor_meta)) * 100, 100) : 0;
                return (
                  <div key={meta.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{meta.titulo}</span>
                      <span className="text-muted-foreground">
                        {meta.tipo === "receita" || meta.tipo === "financeira" ? formatCurrency(Number(meta.valor_atual)) : meta.valor_atual} / {meta.tipo === "receita" || meta.tipo === "financeira" ? formatCurrency(Number(meta.valor_meta)) : meta.valor_meta}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {gruposChecklist.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Checklists em Aberto</CardTitle>
              <Link to="/tarefas" className="text-xs text-primary hover:underline">Ver todas →</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gruposChecklist.slice(0, 8).map((g) => (
                <Link
                  key={`${g.tipo}-${g.id}`}
                  to={g.tipo === "evento" ? `/eventos?evento=${g.id}&tab=operacao&sub=checklist` : `/turmas?turma=${g.id}&tab=operacao&sub=checklist`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                      {g.tipo === "evento" ? "Evento" : "Turma"}
                    </Badge>
                    <span className="text-sm truncate">{g.nome}</span>
                  </div>
                  <span className="text-xs shrink-0 space-x-1.5">
                    {g.atrasadas > 0 && (
                      <span className="text-destructive font-medium">
                        {g.atrasadas} atrasada{g.atrasadas > 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {g.pendentes} pendente{g.pendentes > 1 ? "s" : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {productData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Matrículas por Produto</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={productData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="alunos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {cityData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Novos Alunos por Cidade</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={cityData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={4}>
                    {cityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {cityData.map((city) => (
                  <div key={city.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: city.color }} />
                      <span className="text-muted-foreground">{city.name}</span>
                    </div>
                    <span className="font-medium">{city.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {despesasPorCategoria.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={despesasPorCategoria} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={4}>
                    {despesasPorCategoria.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {despesasPorCategoria.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {comissoesPorVendedor.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Comissões por Vendedor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comissoesPorVendedor} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="pago" name="Pago" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendente" name="Pendente" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
