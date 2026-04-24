import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Filter, FileText, FileSpreadsheet, FileDown, Users, DollarSign, TrendingUp, ShoppingCart } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const formasPgto = ["Pix", "Dinheiro", "Débito", "Cartão de crédito", "Link", "Boleto", "Cheque", "Cartão recorrente", "Permuta"];
const statusOptions = ["pendente", "pago", "cancelado"];

export function RelatorioComissao() {
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split("T")[0];
  });
  const [vendedorId, setVendedorId] = useState("todos");
  const [produtoId, setProdutoId] = useState("todos");
  const [turmaId, setTurmaId] = useState("todos");
  const [eventoId, setEventoId] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [formaPgto, setFormaPgto] = useState("todos");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [viewMode, setViewMode] = useState("vendedor");

  // Fetch reference data
  const { data: comerciais } = useQuery({
    queryKey: ["comerciais-comissao"],
    queryFn: async () => {
      const { data } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-comissao"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("id, nome").is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const { data: turmasAll } = useQuery({
    queryKey: ["turmas-comissao"],
    queryFn: async () => {
      const { data } = await supabase.from("turmas").select("id, nome, produto_id").is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const { data: eventosAll } = useQuery({
    queryKey: ["eventos-comissao"],
    queryFn: async () => {
      const { data } = await supabase.from("eventos").select("id, nome, produto_id").is("deleted_at", null).order("nome");
      return data || [];
    },
  });

  const { data: taxas } = useQuery({
    queryKey: ["taxas-comissao"],
    queryFn: async () => {
      const { data } = await supabase.from("taxas_sistema").select("*").order("ordem");
      return data || [];
    },
  });

  // Fetch comissoes with related data
  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["relatorio-comissoes", dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select(`
          *,
          comerciais!comissoes_comercial_id_fkey(nome),
          alunos!comissoes_aluno_id_fkey(nome),
          produtos!comissoes_produto_id_fkey(nome),
          turmas!comissoes_turma_id_fkey(nome),
          matriculas!comissoes_matricula_id_fkey(valor_final, valor_total, desconto)
        `)
        .is("deleted_at", null)
        .gte("created_at", dataInicio)
        .lte("created_at", dataFim + "T23:59:59");
      if (error) throw error;
      return data || [];
    },
  });

  // Also fetch pagamentos linked to comissoes for tax info
  const { data: pagamentos } = useQuery({
    queryKey: ["pagamentos-comissao", dataInicio, dataFim],
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("matricula_id, taxa_cartao, forma_pagamento, valor, valor_pago, parcelas_cartao")
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim)
        .is("deleted_at", null);
      return data || [];
    },
  });

  // Cascade filters
  const turmas = useMemo(() => {
    if (!turmasAll) return [];
    if (produtoId === "todos") return turmasAll;
    return turmasAll.filter((t: any) => t.produto_id === produtoId);
  }, [turmasAll, produtoId]);

  const eventos = useMemo(() => {
    if (!eventosAll) return [];
    if (produtoId === "todos") return eventosAll;
    return eventosAll.filter((e: any) => e.produto_id === produtoId);
  }, [eventosAll, produtoId]);

  const handleProdutoChange = (v: string) => {
    setProdutoId(v);
    setTurmaId("todos");
    setEventoId("todos");
  };

  // Get imposto default
  const impostoDefault = useMemo(() => {
    const imp = (taxas || []).find((t: any) => t.tipo === "imposto");
    return imp ? Number(imp.percentual) : 9.5;
  }, [taxas]);

  // Process and filter comissoes
  const rows = useMemo(() => {
    if (!comissoes) return [];

    // Build pagamento map by matricula_id
    const pagMap = new Map<string, any[]>();
    (pagamentos || []).forEach((p: any) => {
      if (p.matricula_id) {
        if (!pagMap.has(p.matricula_id)) pagMap.set(p.matricula_id, []);
        pagMap.get(p.matricula_id)!.push(p);
      }
    });

    return comissoes
      .map((c: any) => {
        const vendedorNome = c.comerciais?.nome || "—";
        const alunoNome = c.alunos?.nome || "—";
        const produtoNome = c.produtos?.nome || "—";
        const turmaNome = c.turmas?.nome || "—";
        const forma = c.matriculas?.forma_pagamento || c.forma_pagamento || "—";
        const valorBruto = Number(c.valor_matricula || 0);
        const taxaCartao = Number(c.matriculas?.valor_total || 0) > 0 
          ? Number(c.matriculas.valor_total) - Number(c.matriculas.valor_final || c.matriculas.valor_total)
          : 0;
        
        // Calculate tax from pagamentos if available
        const pags = pagMap.get(c.matricula_id) || [];
        const totalTaxa = pags.reduce((s: number, p: any) => s + Number(p.taxa_cartao || 0), 0) || taxaCartao;
        
        const imposto = valorBruto * (impostoDefault / 100);
        const valorLiquido = valorBruto - totalTaxa - imposto;

        return {
          id: c.id,
          comercial_id: c.comercial_id,
          produto_id: c.produto_id,
          turma_id: c.turma_id,
          status: c.status,
          forma_pagamento: forma,
          vendedor: vendedorNome,
          aluno: alunoNome,
          produto: produtoNome,
          turma: turmaNome,
          valor_bruto: valorBruto,
          taxa: totalTaxa,
          imposto,
          valor_liquido: valorLiquido,
          percentual: Number(c.percentual || 0),
          valor_comissao: Number(c.valor_comissao || 0),
          valor_pago: Number(c.valor_pago || 0),
          data_pagamento: c.data_pagamento,
          created_at: c.created_at,
        };
      })
      .filter((r: any) => {
        if (vendedorId !== "todos" && r.comercial_id !== vendedorId) return false;
        if (produtoId !== "todos" && r.produto_id !== produtoId) return false;
        if (turmaId !== "todos" && r.turma_id !== turmaId) return false;
        if (statusFilter !== "todos" && r.status !== statusFilter) return false;
        if (formaPgto !== "todos" && r.forma_pagamento !== formaPgto) return false;
        return true;
      });
  }, [comissoes, pagamentos, vendedorId, produtoId, turmaId, statusFilter, formaPgto, impostoDefault]);

  // Aggregations
  const byVendedor = useMemo(() => {
    const map = new Map<string, any>();
    rows.forEach(r => {
      const key = r.vendedor;
      if (!map.has(key)) {
        map.set(key, { vendedor: key, totalVendido: 0, valorBruto: 0, taxa: 0, imposto: 0, valorLiquido: 0, comissaoTotal: 0, comissaoPaga: 0, qtdVendas: 0 });
      }
      const g = map.get(key)!;
      g.totalVendido += r.valor_bruto;
      g.valorBruto += r.valor_bruto;
      g.taxa += r.taxa;
      g.imposto += r.imposto;
      g.valorLiquido += r.valor_liquido;
      g.comissaoTotal += r.valor_comissao;
      g.comissaoPaga += r.valor_pago;
      g.qtdVendas += 1;
    });
    return [...map.values()].map(g => ({ ...g, ticketMedio: g.qtdVendas > 0 ? g.valorBruto / g.qtdVendas : 0 }));
  }, [rows]);

  const byProduto = useMemo(() => {
    const map = new Map<string, any>();
    rows.forEach(r => {
      const key = r.produto;
      if (!map.has(key)) {
        map.set(key, { produto: key, valorBruto: 0, taxa: 0, imposto: 0, valorLiquido: 0, comissaoTotal: 0, qtdVendas: 0 });
      }
      const g = map.get(key)!;
      g.valorBruto += r.valor_bruto;
      g.taxa += r.taxa;
      g.imposto += r.imposto;
      g.valorLiquido += r.valor_liquido;
      g.comissaoTotal += r.valor_comissao;
      g.qtdVendas += 1;
    });
    return [...map.values()];
  }, [rows]);

  const totals = useMemo(() => {
    return rows.reduce((acc, r) => ({
      valorBruto: acc.valorBruto + r.valor_bruto,
      taxa: acc.taxa + r.taxa,
      imposto: acc.imposto + r.imposto,
      valorLiquido: acc.valorLiquido + r.valor_liquido,
      comissaoTotal: acc.comissaoTotal + r.valor_comissao,
      comissaoPaga: acc.comissaoPaga + r.valor_pago,
      qtdVendas: acc.qtdVendas + 1,
    }), { valorBruto: 0, taxa: 0, imposto: 0, valorLiquido: 0, comissaoTotal: 0, comissaoPaga: 0, qtdVendas: 0 });
  }, [rows]);

  // ─── Exports ───
  const getExportData = () => {
    if (viewMode === "vendedor") return { title: "por Vendedor", data: byVendedor, cols: ["Vendedor", "Qtd Vendas", "Ticket Médio", "Valor Bruto", "Taxa", "Imposto", "Valor Líquido", "Comissão Total", "Comissão Paga"], mapFn: (r: any) => [r.vendedor, r.qtdVendas, formatCurrency(r.ticketMedio), formatCurrency(r.valorBruto), formatCurrency(r.taxa), formatCurrency(r.imposto), formatCurrency(r.valorLiquido), formatCurrency(r.comissaoTotal), formatCurrency(r.comissaoPaga)] };
    if (viewMode === "produto") return { title: "por Produto", data: byProduto, cols: ["Produto", "Qtd Vendas", "Valor Bruto", "Taxa", "Imposto", "Valor Líquido", "Comissão Total"], mapFn: (r: any) => [r.produto, r.qtdVendas, formatCurrency(r.valorBruto), formatCurrency(r.taxa), formatCurrency(r.imposto), formatCurrency(r.valorLiquido), formatCurrency(r.comissaoTotal)] };
    // venda or consolidada
    return { title: viewMode === "venda" ? "por Venda" : "Consolidado", data: rows, cols: ["Vendedor", "Aluno", "Produto", "Turma", "Forma Pgto", "Status", "Valor Bruto", "Taxa", "Imposto", "Líquido", "% Comissão", "Comissão", "Data"], mapFn: (r: any) => [r.vendedor, r.aluno, r.produto, r.turma, r.forma_pagamento, r.status, formatCurrency(r.valor_bruto), formatCurrency(r.taxa), formatCurrency(r.imposto), formatCurrency(r.valor_liquido), `${r.percentual}%`, formatCurrency(r.valor_comissao), formatDate(r.created_at)] };
  };

  const handleExportPDF = () => {
    const { title, data, cols, mapFn } = getExportData();
    const doc = new jsPDF({ format: "a4", orientation: cols.length > 8 ? "landscape" : "portrait" });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(22, 78, 138);
    doc.rect(0, 0, pw, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GRUPO EXCELLENCE", 15, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório de Comissão ${title} — ${dataInicio} a ${dataFim}`, 15, 25);
    doc.setTextColor(30, 41, 59);

    let y = 40;
    doc.setFontSize(9);
    doc.text(`Vendas: ${totals.qtdVendas}   |   Bruto: ${formatCurrency(totals.valorBruto)}   |   Líquido: ${formatCurrency(totals.valorLiquido)}   |   Comissão: ${formatCurrency(totals.comissaoTotal)}`, 15, y);
    y += 8;

    autoTable(doc, {
      startY: y,
      head: [cols],
      body: data.map(mapFn),
      headStyles: { fillColor: [22, 78, 138], textColor: [255, 255, 255], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 10, right: 10 },
    });

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`Grupo Excellence — Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 15, ph - 8);
      doc.text(`Página ${i}/${pages}`, pw - 15, ph - 8, { align: "right" });
    }
    doc.output("dataurlnewwindow");
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    // Summary
    const summaryData = byVendedor.map(v => ({
      Vendedor: v.vendedor, "Qtd Vendas": v.qtdVendas, "Ticket Médio": v.ticketMedio,
      "Valor Bruto": v.valorBruto, "Taxa": v.taxa, "Imposto": v.imposto,
      "Valor Líquido": v.valorLiquido, "Comissão Total": v.comissaoTotal, "Comissão Paga": v.comissaoPaga,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Por Vendedor");
    // Detail
    const detailData = rows.map(r => ({
      Vendedor: r.vendedor, Aluno: r.aluno, Produto: r.produto, Turma: r.turma,
      "Forma Pgto": r.forma_pagamento, Status: r.status, "Valor Bruto": r.valor_bruto,
      Taxa: r.taxa, Imposto: r.imposto, "Valor Líquido": r.valor_liquido,
      "% Comissão": r.percentual, "Valor Comissão": r.valor_comissao, "Valor Pago": r.valor_pago,
      Data: formatDate(r.created_at),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), "Detalhado");
    // By Product
    const prodData = byProduto.map(p => ({
      Produto: p.produto, "Qtd Vendas": p.qtdVendas, "Valor Bruto": p.valorBruto,
      Taxa: p.taxa, Imposto: p.imposto, "Valor Líquido": p.valorLiquido, "Comissão Total": p.comissaoTotal,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), "Por Produto");
    XLSX.writeFile(wb, `comissoes-${dataInicio}-${dataFim}.xlsx`);
  };

  const handleExportWord = () => {
    const { title, data, cols, mapFn } = getExportData();
    const tableRows = data.map(r => `<tr>${mapFn(r).map((v: any) => `<td style="border:1px solid #ccc;padding:4px;font-size:9pt">${v}</td>`).join("")}</tr>`).join("");
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
      <head><meta charset="utf-8"><style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #164E8A; color: white; padding: 15px 20px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18pt; }
        .header p { margin: 4px 0 0; font-size: 10pt; }
        .summary { background: #F1F5F9; padding: 10px 15px; margin-bottom: 15px; font-size: 10pt; border-radius: 4px; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #164E8A; color: white; padding: 6px; font-size: 9pt; text-align: left; }
        .footer { margin-top: 20px; font-size: 8pt; color: #64748B; }
      </style></head>
      <body>
        <div class="header"><h1>GRUPO EXCELLENCE</h1><p>Relatório de Comissão ${title} — ${dataInicio} a ${dataFim}</p></div>
        <div class="summary">
          <strong>Vendas:</strong> ${totals.qtdVendas} &nbsp;|&nbsp;
          <strong>Bruto:</strong> ${formatCurrency(totals.valorBruto)} &nbsp;|&nbsp;
          <strong>Líquido:</strong> ${formatCurrency(totals.valorLiquido)} &nbsp;|&nbsp;
          <strong>Comissão Total:</strong> ${formatCurrency(totals.comissaoTotal)}
        </div>
        <table><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>
        <div class="footer">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</div>
      </body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes-${title.replace(/ /g, "-")}-${dataInicio}-${dataFim}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* ═══ MÉTRICAS ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricBox icon={<ShoppingCart className="h-4 w-4" />} label="Vendas" value={String(totals.qtdVendas)} />
        <MetricBox icon={<DollarSign className="h-4 w-4" />} label="Valor Bruto" value={formatCurrency(totals.valorBruto)} />
        <MetricBox label="Taxa" value={formatCurrency(totals.taxa)} />
        <MetricBox label="Imposto" value={formatCurrency(totals.imposto)} />
        <MetricBox icon={<TrendingUp className="h-4 w-4" />} label="Valor Líquido" value={formatCurrency(totals.valorLiquido)} />
        <MetricBox icon={<Users className="h-4 w-4" />} label="Comissão Total" value={formatCurrency(totals.comissaoTotal)} highlight />
        <MetricBox label="Ticket Médio" value={formatCurrency(totals.qtdVendas > 0 ? totals.valorBruto / totals.qtdVendas : 0)} />
      </div>

      {/* ═══ FILTROS ═══ */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros
                <Badge variant="secondary" className="ml-auto text-xs">{rows.length} comissões</Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[150px] h-9" />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[150px] h-9" />
                </div>
                <div className="w-[180px]">
                  <Label className="text-xs">Vendedor</Label>
                  <Select value={vendedorId} onValueChange={setVendedorId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {(comerciais || []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[140px]">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[160px]">
                  <Label className="text-xs">Forma Pgto</Label>
                  <Select value={formaPgto} onValueChange={setFormaPgto}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {formasPgto.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-[180px]">
                  <Label className="text-xs">Produto</Label>
                  <Select value={produtoId} onValueChange={handleProdutoChange}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {(produtos || []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <Label className="text-xs">Turma</Label>
                  <Select value={turmaId} onValueChange={setTurmaId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {turmas.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <Label className="text-xs">Evento</Label>
                  <Select value={eventoId} onValueChange={setEventoId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {eventos.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══ VIEW TABS + EXPORT ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={viewMode} onValueChange={setViewMode}>
          <TabsList>
            <TabsTrigger value="vendedor" className="text-xs gap-1"><Users className="h-3.5 w-3.5" />Por Vendedor</TabsTrigger>
            <TabsTrigger value="venda" className="text-xs gap-1"><ShoppingCart className="h-3.5 w-3.5" />Por Venda</TabsTrigger>
            <TabsTrigger value="produto" className="text-xs gap-1"><TrendingUp className="h-3.5 w-3.5" />Por Produto</TabsTrigger>
            <TabsTrigger value="consolidado" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Consolidado</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
          <Button variant="outline" size="sm" onClick={handleExportWord}><FileDown className="h-4 w-4 mr-1.5" />Word</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
        </div>
      </div>

      {/* ═══ TABLE ═══ */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma comissão encontrada para os filtros selecionados</div>
          ) : viewMode === "vendedor" ? (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Vendedor</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Vendas</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Ticket Médio</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Valor Bruto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Taxa</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Imposto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Valor Líquido</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Comissão</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byVendedor.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium py-2">{v.vendedor}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{v.qtdVendas}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(v.ticketMedio)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(v.valorBruto)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(v.taxa)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(v.imposto)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(v.valorLiquido)}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-semibold">{formatCurrency(v.comissaoTotal)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(v.comissaoPaga)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell className="text-xs py-2">Total</TableCell>
                    <TableCell className="text-xs py-2 text-right">{totals.qtdVendas}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.qtdVendas > 0 ? totals.valorBruto / totals.qtdVendas : 0)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.valorBruto)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.taxa)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.imposto)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.valorLiquido)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.comissaoTotal)}</TableCell>
                    <TableCell className="text-xs py-2 text-right">{formatCurrency(totals.comissaoPaga)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : viewMode === "produto" ? (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Produto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Vendas</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Valor Bruto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Taxa</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Imposto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Valor Líquido</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byProduto.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium py-2">{p.produto}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{p.qtdVendas}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.valorBruto)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.taxa)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.imposto)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(p.valorLiquido)}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-semibold">{formatCurrency(p.comissaoTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Vendedor</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Aluno</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Produto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Forma Pgto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Status</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Bruto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Taxa</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Imposto</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Líquido</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">%</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10 text-right">Comissão</TableHead>
                    <TableHead className="text-xs sticky top-0 bg-background z-10">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs py-2">{r.vendedor}</TableCell>
                      <TableCell className="text-xs py-2">{r.aluno}</TableCell>
                      <TableCell className="text-xs py-2">{r.produto}</TableCell>
                      <TableCell className="text-xs py-2">{r.forma_pagamento}</TableCell>
                      <TableCell className="text-xs py-2">
                        <Badge variant={r.status === "pago" ? "default" : r.status === "pendente" ? "secondary" : "destructive"} className="text-[10px]">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(r.valor_bruto)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(r.taxa)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(r.imposto)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCurrency(r.valor_liquido)}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{r.percentual}%</TableCell>
                      <TableCell className="text-xs py-2 text-right font-semibold">{formatCurrency(r.valor_comissao)}</TableCell>
                      <TableCell className="text-xs py-2">{formatDate(r.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricBox({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="p-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
          {icon}
          <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
        </div>
        <p className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
