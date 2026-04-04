import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Loader2, FileText, TrendingUp, TrendingDown, Minus, FileSpreadsheet, AlertTriangle, Calendar, SlidersHorizontal, Users, BarChart3 } from "lucide-react";
import { gerarRelatorioFinanceiro } from "@/lib/pdfUtils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";
import { RelatorioPersonalizado } from "@/components/relatorios/RelatorioPersonalizado";
import { RelatorioComissao } from "@/components/relatorios/RelatorioComissao";
import { RelatorioDRE } from "@/components/relatorios/RelatorioDRE";
import { RelatorioInadimplencia } from "@/components/relatorios/RelatorioInadimplencia";

const chartStyle = { borderRadius: "8px", fontSize: "13px", border: "1px solid hsl(var(--border))" };
const pieColors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--warning))", "hsl(var(--success))"];

type PeriodPreset = "mes_atual" | "mes_anterior" | "ultimos_3" | "ultimos_6" | "ultimo_ano" | "personalizado";

function getDateRange(preset: PeriodPreset, customStart?: string, customEnd?: string): { inicio: string; fim: string; label: string } {
  const now = new Date();
  const brNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = brNow.getFullYear();
  const m = brNow.getMonth();

  switch (preset) {
    case "mes_atual": {
      const s = new Date(y, m, 1);
      const e = new Date(y, m + 1, 0);
      return { inicio: fmt(s), fim: fmt(e), label: s.toLocaleString("pt-BR", { month: "long", year: "numeric" }) };
    }
    case "mes_anterior": {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { inicio: fmt(s), fim: fmt(e), label: s.toLocaleString("pt-BR", { month: "long", year: "numeric" }) };
    }
    case "ultimos_3": {
      const s = new Date(y, m - 2, 1);
      const e = new Date(y, m + 1, 0);
      return { inicio: fmt(s), fim: fmt(e), label: "Últimos 3 meses" };
    }
    case "ultimos_6": {
      const s = new Date(y, m - 5, 1);
      const e = new Date(y, m + 1, 0);
      return { inicio: fmt(s), fim: fmt(e), label: "Últimos 6 meses" };
    }
    case "ultimo_ano": {
      const s = new Date(y - 1, m + 1, 1);
      const e = new Date(y, m + 1, 0);
      return { inicio: fmt(s), fim: fmt(e), label: "Último ano" };
    }
    case "personalizado":
      return { inicio: customStart || fmt(new Date(y, m, 1)), fim: customEnd || fmt(new Date(y, m + 1, 0)), label: "Período personalizado" };
    default:
      return { inicio: fmt(new Date(y, m, 1)), fim: fmt(new Date(y, m + 1, 0)), label: "Mês atual" };
  }
}

function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

function pctChange(atual: number, anterior: number): { pct: number; direction: "up" | "down" | "neutral" } {
  if (anterior === 0) return { pct: atual > 0 ? 100 : 0, direction: atual > 0 ? "up" : "neutral" };
  const pct = ((atual - anterior) / anterior) * 100;
  return { pct: Math.abs(pct), direction: pct > 0 ? "up" : pct < 0 ? "down" : "neutral" };
}

const Relatorios = () => {
  const [preset, setPreset] = useState<PeriodPreset>("mes_atual");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = useMemo(() => getDateRange(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["relatorios-data", range.inicio, range.fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("relatorios_data", {
        _data_inicio: range.inicio,
        _data_fim: range.fim,
      } as any);
      if (error) throw error;
      return data as any;
    },
  });

  const m = metrics || {};
  const alunosPorProduto = (m.matriculas_por_produto || []) as { name: string; value: number }[];
  const alunosPorCidade = ((m.alunos_por_cidade || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: pieColors[i % pieColors.length] }));
  const crescimento = (m.crescimento_alunos || []) as { mes: string; alunos: number }[];
  const fluxoCaixa = ((m.fluxo_caixa || []) as { mes: string; receita: number; despesa: number }[]).map(f => ({ ...f, lucro: Number(f.receita) - Number(f.despesa) }));
  const receitaPorProduto = ((m.receita_por_produto || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: pieColors[i % pieColors.length] }));
  const despesasPorCategoria = ((m.despesas_por_categoria || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: pieColors[i % pieColors.length] }));
  const comissoesPorVendedor = (m.comissoes_por_vendedor || []) as { name: string; pago: number; pendente: number }[];
  const processosPorStatus = ((m.processos_por_status || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: pieColors[i % pieColors.length] }));
  const leadsPorOrigem = ((m.leads_por_origem || []) as { name: string; value: number }[]).map((c, i) => ({ ...c, color: pieColors[i % pieColors.length] }));
  const leadsPorEtapa = (m.leads_por_etapa || []) as { name: string; value: number }[];

  const comp = m.comparativo || {};
  const dre = m.dre || {};
  const inad = m.inadimplencia || {};

  // DRE calculations
  const receitaBruta = Number(dre.receita_pagamentos || 0) + Number(dre.receita_avulsas || 0);
  const comissoesPagas = Number(dre.comissoes_pagas || 0);
  const despesasOp = Number(dre.despesas_operacionais || 0);
  const despesasEv = Number(dre.despesas_eventos || 0);
  const lucroLiquido = receitaBruta - comissoesPagas - despesasOp - despesasEv;

  const handleExportCSV = () => {
    exportToCSV(
      fluxoCaixa.map(r => ({ mes: r.mes, receita: Number(r.receita).toFixed(2), despesa: Number(r.despesa).toFixed(2), lucro: r.lucro.toFixed(2) })),
      "relatorio-fluxo-caixa",
      [{ key: "mes", label: "Mês" }, { key: "receita", label: "Receita (R$)" }, { key: "despesa", label: "Despesa (R$)" }, { key: "lucro", label: "Lucro (R$)" }]
    );
  };

  const handleExportPDF = () => {
    const totalReceita = fluxoCaixa.reduce((s, f) => s + Number(f.receita), 0);
    const totalDespesa = fluxoCaixa.reduce((s, f) => s + Number(f.despesa), 0);
    gerarRelatorioFinanceiro({
      periodo: `${range.label} — ${range.inicio} a ${range.fim}`,
      receitaTotal: totalReceita,
      despesaTotal: totalDespesa,
      lucro: totalReceita - totalDespesa,
      receitaPorProduto: receitaPorProduto.map(r => ({ nome: r.name, valor: Number(r.value) })),
      despesaPorCategoria: despesasPorCategoria.map(d => ({ nome: d.name, valor: Number(d.value) })),
      comissoesPorVendedor: comissoesPorVendedor.map(c => ({ nome: c.name, pago: Number(c.pago), pendente: Number(c.pendente) })),
    });
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Fluxo de Caixa
    const fcData = fluxoCaixa.map(f => ({ Mês: f.mes, "Receita (R$)": Number(f.receita), "Despesa (R$)": Number(f.despesa), "Lucro (R$)": f.lucro }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fcData), "Fluxo de Caixa");

    // Receita por Produto
    if (receitaPorProduto.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receitaPorProduto.map(r => ({ Produto: r.name, "Valor (R$)": Number(r.value) }))), "Receita Produto");
    }

    // Despesas por Categoria
    if (despesasPorCategoria.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(despesasPorCategoria.map(d => ({ Categoria: d.name, "Valor (R$)": Number(d.value) }))), "Despesas");
    }

    // Comissões
    if (comissoesPorVendedor.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(comissoesPorVendedor.map(c => ({ Vendedor: c.name, "Pago (R$)": Number(c.pago), "Pendente (R$)": Number(c.pendente) }))), "Comissões");
    }

    // DRE
    const dreData = [
      { Descrição: "Receita Bruta (Pagamentos)", "Valor (R$)": Number(dre.receita_pagamentos || 0) },
      { Descrição: "(+) Receitas Avulsas", "Valor (R$)": Number(dre.receita_avulsas || 0) },
      { Descrição: "= Receita Total", "Valor (R$)": receitaBruta },
      { Descrição: "(-) Comissões Pagas", "Valor (R$)": -comissoesPagas },
      { Descrição: "(-) Despesas Operacionais", "Valor (R$)": -despesasOp },
      { Descrição: "(-) Despesas com Eventos", "Valor (R$)": -despesasEv },
      { Descrição: "= Lucro Líquido", "Valor (R$)": lucroLiquido },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dreData), "DRE");

    // Inadimplência
    const topDev = (inad.top_devedores || []) as any[];
    if (topDev.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topDev.map((d: any) => ({
        Aluno: d.nome, "Total Devido (R$)": Number(d.total_devido), "Parcelas Vencidas": d.parcelas_vencidas, "Máx Dias Atraso": d.max_dias_atraso,
      }))), "Inadimplência");
    }

    XLSX.writeFile(wb, `relatorio-${range.inicio}-${range.fim}.xlsx`);
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Relatórios" description="Relatórios automáticos do Grupo Excellence" />
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Relatórios" description="Relatórios automáticos do Grupo Excellence" />

      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />Relatório Geral</TabsTrigger>
          <TabsTrigger value="personalizado" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" />Relatório Personalizado</TabsTrigger>
          <TabsTrigger value="comissao" className="gap-1.5"><Users className="h-3.5 w-3.5" />Comissão</TabsTrigger>
          <TabsTrigger value="dre" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />DRE</TabsTrigger>
          <TabsTrigger value="inadimplencia" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Inadimplência</TabsTrigger>
        </TabsList>

        <TabsContent value="personalizado">
          <RelatorioPersonalizado />
        </TabsContent>

        <TabsContent value="comissao">
          <RelatorioComissao />
        </TabsContent>

        <TabsContent value="dre">
          <RelatorioDRE />
        </TabsContent>

        <TabsContent value="inadimplencia">
          <RelatorioInadimplencia />
        </TabsContent>

        <TabsContent value="geral">
        <div className="flex gap-2 flex-wrap mb-6">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-2" />PDF</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel</Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-2" />CSV</Button>
        </div>

      {/* ═══ FILTRO DE PERÍODO ═══ */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
                  <SelectItem value="ultimos_3">Últimos 3 meses</SelectItem>
                  <SelectItem value="ultimos_6">Últimos 6 meses</SelectItem>
                  <SelectItem value="ultimo_ano">Último ano</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "personalizado" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Início</label>
                  <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[160px]" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
                  <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[160px]" />
                </div>
              </>
            )}
            <Badge variant="secondary" className="text-xs">{range.inicio} → {range.fim}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ═══ COMPARATIVO ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <CompCard label="Receita" atual={Number(comp.receita_atual || 0)} anterior={Number(comp.receita_anterior || 0)} isCurrency />
        <CompCard label="Matrículas" atual={Number(comp.matriculas_atual || 0)} anterior={Number(comp.matriculas_anterior || 0)} />
        <CompCard label="Leads" atual={Number(comp.leads_atual || 0)} anterior={Number(comp.leads_anterior || 0)} />
        <CompCard label="Despesas" atual={Number(comp.despesas_atual || 0)} anterior={Number(comp.despesas_anterior || 0)} isCurrency invertColor />
      </div>

      {/* ═══ DRE SIMPLIFICADO ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">DRE Simplificado</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <DRERow label="Receita Bruta (Pagamentos)" value={Number(dre.receita_pagamentos || 0)} />
              <DRERow label="(+) Receitas Avulsas" value={Number(dre.receita_avulsas || 0)} />
              <div className="border-t pt-2">
                <DRERow label="= Receita Total" value={receitaBruta} bold />
              </div>
              <DRERow label="(-) Comissões Pagas" value={-comissoesPagas} negative />
              <DRERow label="(-) Despesas Operacionais" value={-despesasOp} negative />
              <DRERow label="(-) Despesas com Eventos" value={-despesasEv} negative />
              <div className="border-t pt-2">
                <DRERow label="= Lucro Líquido" value={lucroLiquido} bold highlight />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ INADIMPLÊNCIA ═══ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Inadimplência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">{formatCurrency(Number(inad.total || 0))}</p>
                <p className="text-xs text-muted-foreground">Total devido</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{Number(inad.quantidade || 0)}</p>
                <p className="text-xs text-muted-foreground">Parcelas vencidas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{Math.round(Number(inad.dias_atraso_medio || 0))}</p>
                <p className="text-xs text-muted-foreground">Dias atraso (média)</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground">Top 10 Devedores</p>
              {(inad.top_devedores || []).map((d: any, i: number) => (
                <div key={d.aluno_id || i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <div>
                    <span className="font-medium">{d.nome}</span>
                    <span className="text-xs text-muted-foreground ml-2">{d.parcelas_vencidas} parcela(s) · {d.max_dias_atraso}d atraso</span>
                  </div>
                  <span className="font-semibold text-destructive">{formatCurrency(Number(d.total_devido))}</span>
                </div>
              ))}
              {(inad.top_devedores || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma inadimplência encontrada 🎉</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ CHARTS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Fluxo de Caixa Mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fluxoCaixa} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartStyle} />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Lucro Líquido Mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={fluxoCaixa}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartStyle} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Matrículas por Produto</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={alunosPorProduto} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Alunos por Cidade</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={alunosPorCidade} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                  {alunosPorCidade.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {alunosPorCidade.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-muted-foreground">{c.name}: <span className="font-medium text-foreground">{c.value}</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Crescimento de Alunos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={crescimento}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chartStyle} />
                <Line type="monotone" dataKey="alunos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Receita por Produto</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={receitaPorProduto} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {receitaPorProduto.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {receitaPorProduto.map((p) => (
                <div key={p.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-muted-foreground truncate">{p.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={despesasPorCategoria} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {despesasPorCategoria.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {despesasPorCategoria.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-muted-foreground truncate">{c.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {comissoesPorVendedor.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Comissões por Vendedor</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={comissoesPorVendedor} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={chartStyle} />
                  <Bar dataKey="pago" name="Pago" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pendente" name="Pendente" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {processosPorStatus.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Processos por Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={processosPorStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={4}>
                    {processosPorStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {processosPorStatus.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-muted-foreground">{p.name}: <span className="font-medium text-foreground">{p.value}</span></span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {leadsPorOrigem.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base font-semibold">Leads por Origem</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={leadsPorOrigem} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={4}>
                    {leadsPorOrigem.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {leadsPorOrigem.map((o) => (
                  <div key={o.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: o.color }} />
                    <span className="text-muted-foreground">{o.name}: <span className="font-medium text-foreground">{o.value}</span></span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Funil de Leads</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leadsPorEtapa} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Subcomponents ───

function CompCard({ label, atual, anterior, isCurrency, invertColor }: { label: string; atual: number; anterior: number; isCurrency?: boolean; invertColor?: boolean }) {
  const { pct, direction } = pctChange(atual, anterior);
  const isGood = invertColor ? direction === "down" : direction === "up";
  const isBad = invertColor ? direction === "up" : direction === "down";

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold">{isCurrency ? formatCurrency(atual) : atual}</p>
        <div className="flex items-center gap-1 mt-1">
          {direction === "up" && <TrendingUp className={`h-3.5 w-3.5 ${isGood ? "text-success" : "text-destructive"}`} />}
          {direction === "down" && <TrendingDown className={`h-3.5 w-3.5 ${isBad ? "text-destructive" : "text-success"}`} />}
          {direction === "neutral" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className={`text-xs font-medium ${isGood ? "text-success" : isBad ? "text-destructive" : "text-muted-foreground"}`}>
            {pct.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">vs anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}

function DRERow({ label, value, bold, negative, highlight }: { label: string; value: number; bold?: boolean; negative?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1 ${bold ? "font-semibold" : ""} ${highlight ? (value >= 0 ? "text-success" : "text-destructive") : ""}`}>
      <span className={negative ? "text-muted-foreground" : ""}>{label}</span>
      <span className={negative ? "text-destructive" : ""}>{formatCurrency(Math.abs(value))}{negative && value !== 0 ? "" : ""}</span>
    </div>
  );
}

export default Relatorios;
