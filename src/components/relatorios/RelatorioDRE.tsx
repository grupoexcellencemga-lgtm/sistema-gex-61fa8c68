import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Filter, FileText, FileSpreadsheet, FileDown, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function RelatorioDRE() {
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  });
  const [produtoId, setProdutoId] = useState("todos");
  const [turmaId, setTurmaId] = useState("todos");
  const [eventoId, setEventoId] = useState("todos");
  const [vendedorId, setVendedorId] = useState("todos");
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Reference data
  const { data: produtos } = useQuery({
    queryKey: ["dre-produtos"],
    queryFn: async () => { const { data } = await supabase.from("produtos").select("id, nome").is("deleted_at", null).order("nome"); return data || []; },
  });
  const { data: turmasAll } = useQuery({
    queryKey: ["dre-turmas"],
    queryFn: async () => { const { data } = await supabase.from("turmas").select("id, nome, produto_id").is("deleted_at", null).order("nome"); return data || []; },
  });
  const { data: eventosAll } = useQuery({
    queryKey: ["dre-eventos"],
    queryFn: async () => { const { data } = await supabase.from("eventos").select("id, nome, produto_id").is("deleted_at", null).order("nome"); return data || []; },
  });
  const { data: comerciais } = useQuery({
    queryKey: ["dre-comerciais"],
    queryFn: async () => { const { data } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome"); return data || []; },
  });
  const { data: taxas } = useQuery({
    queryKey: ["dre-taxas"],
    queryFn: async () => { const { data } = await supabase.from("taxas_sistema").select("*").order("ordem"); return data || []; },
  });

  // Financial data
  const { data: pagamentos, isLoading: loadPag } = useQuery({
    queryKey: ["dre-pagamentos", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase.from("pagamentos").select("*, alunos!pagamentos_aluno_id_fkey(nome), produtos!pagamentos_produto_id_fkey(nome), matriculas!pagamentos_matricula_id_fkey(turma_id, comercial_id, produto_id)")
        .is("deleted_at", null).eq("status", "pago").gte("data_pagamento", dataInicio).lte("data_pagamento", dataFim);
      return data || [];
    },
  });
  const { data: receitasAvulsas, isLoading: loadRA } = useQuery({
    queryKey: ["dre-receitas-avulsas", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase.from("receitas_avulsas").select("*").is("deleted_at", null).gte("data", dataInicio).lte("data", dataFim);
      return data || [];
    },
  });
  const { data: despesas, isLoading: loadDesp } = useQuery({
    queryKey: ["dre-despesas", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase.from("despesas").select("*, categorias_despesas!despesas_categoria_id_fkey(nome)").is("deleted_at", null).gte("data", dataInicio).lte("data", dataFim);
      return data || [];
    },
  });
  const { data: comissoes, isLoading: loadCom } = useQuery({
    queryKey: ["dre-comissoes", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase.from("comissoes").select("*, comerciais!comissoes_comercial_id_fkey(nome)")
        .is("deleted_at", null).eq("status", "pago").gte("data_pagamento", dataInicio).lte("data_pagamento", dataFim);
      return data || [];
    },
  });
  const { data: participantesEventos, isLoading: loadPart } = useQuery({
    queryKey: ["dre-participantes", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase.from("participantes_eventos").select("*, eventos!participantes_eventos_evento_id_fkey(id, nome, produto_id)")
        .eq("status_pagamento", "pago");
      return data || [];
    },
  });

  const isLoading = loadPag || loadRA || loadDesp || loadCom || loadPart;

  // Cascade filters
  const turmas = useMemo(() => {
    if (!turmasAll) return [];
    return produtoId === "todos" ? turmasAll : turmasAll.filter((t: any) => t.produto_id === produtoId);
  }, [turmasAll, produtoId]);
  const eventos = useMemo(() => {
    if (!eventosAll) return [];
    return produtoId === "todos" ? eventosAll : eventosAll.filter((e: any) => e.produto_id === produtoId);
  }, [eventosAll, produtoId]);

  const handleProdutoChange = (v: string) => { setProdutoId(v); setTurmaId("todos"); setEventoId("todos"); };

  // Imposto default
  const impostoDefault = useMemo(() => {
    const imp = (taxas || []).find((t: any) => t.tipo === "imposto");
    return imp ? Number(imp.percentual) : 9.5;
  }, [taxas]);

  // ─── DRE Calculation ───
  const dre = useMemo(() => {
    // Filter pagamentos
    const filteredPag = (pagamentos || []).filter((p: any) => {
      if (produtoId !== "todos") {
        const pid = p.produto_id || p.matriculas?.produto_id;
        if (pid !== produtoId) return false;
      }
      if (turmaId !== "todos") {
        const tid = p.matriculas?.turma_id;
        if (tid !== turmaId) return false;
      }
      if (vendedorId !== "todos") {
        const cid = p.matriculas?.comercial_id;
        if (cid !== vendedorId) return false;
      }
      return true;
    });

    // Filter receitas avulsas (only if no specific product/turma/event/vendor filter)
    const filteredRA = (produtoId === "todos" && turmaId === "todos" && eventoId === "todos" && vendedorId === "todos")
      ? (receitasAvulsas || []) : [];

    // Filter despesas
    const filteredDesp = (despesas || []).filter((d: any) => {
      if (produtoId !== "todos" && d.produto_id !== produtoId) return false;
      if (turmaId !== "todos" && d.turma_id !== turmaId) return false;
      if (eventoId !== "todos" && d.evento_id !== eventoId) return false;
      return true;
    });

    // Filter comissoes
    const filteredCom = (comissoes || []).filter((c: any) => {
      if (vendedorId !== "todos" && c.comercial_id !== vendedorId) return false;
      if (produtoId !== "todos" && c.produto_id !== produtoId) return false;
      if (turmaId !== "todos" && c.turma_id !== turmaId) return false;
      return true;
    });

    // Filter participantes eventos
    const filteredPart = (participantesEventos || []).filter((pe: any) => {
      if (eventoId !== "todos" && pe.evento_id !== eventoId) return false;
      if (produtoId !== "todos" && pe.eventos?.produto_id !== produtoId) return false;
      return true;
    });

    // 1. RECEITA BRUTA
    const receitaPagamentos = filteredPag.reduce((s: number, p: any) => s + Number(p.valor_pago || p.valor || 0), 0);
    const receitaEventos = filteredPart.reduce((s: number, pe: any) => s + Number(pe.valor || 0), 0);
    const receitaAvulsas = filteredRA.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    const receitaBruta = receitaPagamentos + receitaEventos + receitaAvulsas;

    // 2. TAXAS (from pagamentos taxa_cartao)
    const totalTaxas = filteredPag.reduce((s: number, p: any) => s + Number(p.taxa_cartao || 0), 0);

    // 3. IMPOSTOS
    const totalImpostos = receitaBruta * (impostoDefault / 100);

    // 4. RECEITA LÍQUIDA
    const receitaLiquida = receitaBruta - totalTaxas - totalImpostos;

    // 5. DESPESAS
    const despesasOperacionais = filteredDesp.filter((d: any) => !d.evento_id).reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    const despesasEventos = filteredDesp.filter((d: any) => d.evento_id).reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    const totalDespesas = despesasOperacionais + despesasEventos;

    // 6. COMISSÕES
    const totalComissoes = filteredCom.reduce((s: number, c: any) => s + Number(c.valor_pago || 0), 0);

    // 7. RESULTADO
    const resultadoOperacional = receitaLiquida - totalDespesas - totalComissoes;
    const margemLiquida = receitaBruta > 0 ? (resultadoOperacional / receitaBruta) * 100 : 0;

    return {
      receitaPagamentos, receitaEventos, receitaAvulsas, receitaBruta,
      totalTaxas, totalImpostos, impostoPerc: impostoDefault,
      receitaLiquida,
      despesasOperacionais, despesasEventos, totalDespesas,
      totalComissoes,
      resultadoOperacional, margemLiquida,
    };
  }, [pagamentos, receitasAvulsas, despesas, comissoes, participantesEventos, produtoId, turmaId, eventoId, vendedorId, impostoDefault]);

  // ─── Export helpers ───
  const dreLines = [
    { label: "RECEITA BRUTA", value: dre.receitaBruta, bold: true, section: true },
    { label: "  Pagamentos de Alunos", value: dre.receitaPagamentos },
    { label: "  Receita de Eventos", value: dre.receitaEventos },
    { label: "  Receitas Avulsas", value: dre.receitaAvulsas },
    { label: "", value: null, separator: true },
    { label: `(-) Taxas de Pagamento`, value: -dre.totalTaxas, negative: true },
    { label: `(-) Impostos (${dre.impostoPerc}%)`, value: -dre.totalImpostos, negative: true },
    { label: "", value: null, separator: true },
    { label: "= RECEITA LÍQUIDA", value: dre.receitaLiquida, bold: true, section: true },
    { label: "", value: null, separator: true },
    { label: "DEDUÇÕES", value: null, bold: true, section: true, headerOnly: true },
    { label: "  (-) Despesas Operacionais", value: -dre.despesasOperacionais, negative: true },
    { label: "  (-) Despesas com Eventos", value: -dre.despesasEventos, negative: true },
    { label: "  (-) Comissões de Vendas", value: -dre.totalComissoes, negative: true },
    { label: "", value: null, separator: true },
    { label: "= RESULTADO OPERACIONAL", value: dre.resultadoOperacional, bold: true, section: true, highlight: true },
    { label: `  Margem Líquida: ${dre.margemLiquida.toFixed(1)}%`, value: null, info: true },
  ];

  const handleExportPDF = () => {
    const doc = new jsPDF({ format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(22, 78, 138);
    doc.rect(0, 0, pw, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("GRUPO EXCELLENCE", 15, 16);
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text("Demonstrativo de Resultado do Exercício (DRE)", 15, 26);
    doc.setFontSize(9);
    doc.text(`Período: ${dataInicio} a ${dataFim}`, 15, 32);
    doc.setTextColor(30, 41, 59);

    const tableData = dreLines
      .filter(l => !l.separator && !l.info)
      .map(l => [l.label, l.headerOnly ? "" : formatCurrency(Number(l.value || 0))]);

    autoTable(doc, {
      startY: 42,
      head: [["Descrição", "Valor (R$)"]],
      body: tableData,
      headStyles: { fillColor: [22, 78, 138], textColor: [255, 255, 255], fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 1: { halign: "right" } },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data: any) => {
        const row = dreLines.filter(l => !l.separator && !l.info)[data.row.index];
        if (row?.bold) { data.cell.styles.fontStyle = "bold"; }
        if (row?.highlight) { data.cell.styles.fillColor = [22, 78, 138]; data.cell.styles.textColor = [255, 255, 255]; }
        if (row?.negative) { data.cell.styles.textColor = [220, 38, 38]; }
      },
      margin: { left: 15, right: 15 },
    });

    // Margin info
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text(`Margem Líquida: ${dre.margemLiquida.toFixed(1)}%`, 15, finalY + 10);

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7); doc.setTextColor(100, 116, 139);
      doc.text(`Grupo Excellence — Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 15, ph - 8);
      doc.text(`Página ${i}/${pages}`, pw - 15, ph - 8, { align: "right" });
    }
    doc.output("dataurlnewwindow");
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const data = dreLines.filter(l => !l.separator).map(l => ({
      Descrição: l.label, "Valor (R$)": l.headerOnly || l.info ? "" : Number(l.value || 0),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "DRE");
    XLSX.writeFile(wb, `dre-${dataInicio}-${dataFim}.xlsx`);
  };

  const handleExportWord = () => {
    const rows = dreLines.filter(l => !l.separator).map(l => {
      const val = l.headerOnly || l.info ? "" : formatCurrency(Number(l.value || 0));
      const style = l.highlight ? 'background:#164E8A;color:white;font-weight:bold' : l.bold ? 'font-weight:bold;background:#F1F5F9' : l.negative ? 'color:#DC2626' : '';
      return `<tr style="${style}"><td style="border:1px solid #ddd;padding:6px">${l.label}</td><td style="border:1px solid #ddd;padding:6px;text-align:right">${val}</td></tr>`;
    }).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Arial;margin:20px}.header{background:#164E8A;color:white;padding:15px 20px;margin-bottom:20px}.header h1{margin:0;font-size:18pt}.header p{margin:4px 0 0;font-size:10pt}table{border-collapse:collapse;width:100%}.footer{margin-top:20px;font-size:8pt;color:#64748B}</style></head><body><div class="header"><h1>GRUPO EXCELLENCE</h1><p>DRE — ${dataInicio} a ${dataFim}</p></div><table><thead><tr><th style="background:#164E8A;color:white;padding:8px;text-align:left">Descrição</th><th style="background:#164E8A;color:white;padding:8px;text-align:right">Valor (R$)</th></tr></thead><tbody>${rows}</tbody></table><p style="margin-top:10px;font-size:10pt;color:#64748B">Margem Líquida: ${dre.margemLiquida.toFixed(1)}%</p><div class="footer">Gerado em ${new Date().toLocaleDateString("pt-BR")}</div></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `dre-${dataInicio}-${dataFim}.doc`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* ═══ FILTROS ═══ */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />Filtros do DRE
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-end">
                <div><Label className="text-xs">Início</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[150px] h-9" /></div>
                <div><Label className="text-xs">Fim</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[150px] h-9" /></div>
                <div className="w-[180px]"><Label className="text-xs">Produto</Label>
                  <Select value={produtoId} onValueChange={handleProdutoChange}><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{(produtos || []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="w-[180px]"><Label className="text-xs">Turma</Label>
                  <Select value={turmaId} onValueChange={setTurmaId}><SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{turmas.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="w-[180px]"><Label className="text-xs">Evento</Label>
                  <Select value={eventoId} onValueChange={setEventoId}><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{eventos.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="w-[180px]"><Label className="text-xs">Vendedor</Label>
                  <Select value={vendedorId} onValueChange={setVendedorId}><SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem>{(comerciais || []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══ EXPORT ═══ */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
        <Button variant="outline" size="sm" onClick={handleExportWord}><FileDown className="h-4 w-4 mr-1.5" />Word</Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ DRE TABLE ═══ */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Demonstrativo de Resultado (DRE)</CardTitle>
              <p className="text-xs text-muted-foreground">{dataInicio} a {dataFim}</p>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* RECEITA BRUTA */}
              <DRESection title="RECEITA BRUTA" total={dre.receitaBruta} positive>
                <DRELine label="Pagamentos de Alunos" value={dre.receitaPagamentos} />
                <DRELine label="Receita de Eventos" value={dre.receitaEventos} />
                <DRELine label="Receitas Avulsas" value={dre.receitaAvulsas} />
              </DRESection>

              <Separator className="my-3" />

              {/* DEDUÇÕES DA RECEITA */}
              <DRESection title="DEDUÇÕES DA RECEITA" total={-(dre.totalTaxas + dre.totalImpostos)} negative>
                <DRELine label="Taxas de Pagamento" value={-dre.totalTaxas} negative />
                <DRELine label={`Impostos (${dre.impostoPerc}%)`} value={-dre.totalImpostos} negative />
              </DRESection>

              {/* RECEITA LÍQUIDA */}
              <div className="bg-muted/50 rounded-lg p-3 my-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-foreground">= RECEITA LÍQUIDA</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(dre.receitaLiquida)}</span>
                </div>
              </div>

              <Separator className="my-3" />

              {/* CUSTOS E DESPESAS */}
              <DRESection title="CUSTOS E DESPESAS" total={-(dre.totalDespesas + dre.totalComissoes)} negative>
                <DRELine label="Despesas Operacionais" value={-dre.despesasOperacionais} negative />
                <DRELine label="Despesas com Eventos" value={-dre.despesasEventos} negative />
                <DRELine label="Comissões de Vendas" value={-dre.totalComissoes} negative />
              </DRESection>

              <Separator className="my-3" />

              {/* RESULTADO */}
              <div className={`rounded-lg p-4 ${dre.resultadoOperacional >= 0 ? 'bg-success/10 border border-success/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {dre.resultadoOperacional >= 0
                      ? <TrendingUp className="h-5 w-5 text-success" />
                      : <TrendingDown className="h-5 w-5 text-destructive" />}
                    <span className="text-base font-bold">= RESULTADO OPERACIONAL</span>
                  </div>
                  <span className={`text-lg font-bold ${dre.resultadoOperacional >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(dre.resultadoOperacional)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  Margem Líquida: <span className="font-semibold">{dre.margemLiquida.toFixed(1)}%</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ═══ RESUMO LATERAL ═══ */}
          <div className="space-y-4">
            <SummaryCard label="Receita Bruta" value={dre.receitaBruta} icon={<TrendingUp className="h-4 w-4 text-success" />} />
            <SummaryCard label="Taxas Descontadas" value={dre.totalTaxas} icon={<TrendingDown className="h-4 w-4 text-destructive" />} negative />
            <SummaryCard label={`Impostos (${dre.impostoPerc}%)`} value={dre.totalImpostos} negative />
            <SummaryCard label="Receita Líquida" value={dre.receitaLiquida} highlight />
            <SummaryCard label="Total Despesas" value={dre.totalDespesas} negative />
            <SummaryCard label="Total Comissões" value={dre.totalComissoes} negative />
            <Card className={`border-2 ${dre.resultadoOperacional >= 0 ? 'border-success/50' : 'border-destructive/50'}`}>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Resultado Final</p>
                <p className={`text-xl font-bold ${dre.resultadoOperacional >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(dre.resultadoOperacional)}
                </p>
                <Badge variant={dre.resultadoOperacional >= 0 ? "default" : "destructive"} className="mt-2 text-[10px]">
                  Margem {dre.margemLiquida.toFixed(1)}%
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function DRESection({ title, total, children, positive, negative }: {
  title: string; total: number; children: React.ReactNode; positive?: boolean; negative?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-center py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className={`text-sm font-semibold ${negative ? 'text-destructive' : positive ? 'text-success' : 'text-foreground'}`}>
          {formatCurrency(total)}
        </span>
      </div>
      <div className="pl-4 space-y-0.5">{children}</div>
    </div>
  );
}

function DRELine({ label, value, negative }: { label: string; value: number; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? 'text-destructive' : 'text-foreground'}>{formatCurrency(value)}</span>
    </div>
  );
}

function SummaryCard({ label, value, icon, highlight, negative }: {
  label: string; value: number; icon?: React.ReactNode; highlight?: boolean; negative?: boolean;
}) {
  return (
    <Card className={highlight ? "bg-primary/5 border-primary/30" : ""}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <span className={`text-sm font-bold ${negative ? 'text-destructive' : highlight ? 'text-primary' : 'text-foreground'}`}>
            {formatCurrency(negative ? -value : value)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
