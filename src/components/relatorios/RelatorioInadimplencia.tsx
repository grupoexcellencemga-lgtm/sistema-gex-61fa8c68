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
import { Loader2, Filter, FileText, FileSpreadsheet, AlertTriangle, Calendar, Search, MessageSquare, Mail } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { WhatsAppDialog } from "@/components/WhatsAppDialog";

export function RelatorioInadimplencia() {
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });
  const [faixaFiltro, setFaixaFiltro] = useState("todos");
  const [vendedorId, setVendedorId] = useState("todos");
  const [produtoId, setProdutoId] = useState("todos");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [buscaAluno, setBuscaAluno] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const [waOpen, setWaOpen] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waName, setWaName] = useState("");

  const hojeStr = new Date().toISOString().split("T")[0];

  const { data: comerciais } = useQuery({
    queryKey: ["comerciais-inad"],
    queryFn: async () => {
      const { data } = await supabase.from("comerciais").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-inad"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("id, nome").order("nome");
      return data || [];
    },
  });

  const { data: pagamentos, isLoading } = useQuery({
    queryKey: ["relatorio-inadimplencia", dataInicio, dataFim],
    queryFn: async () => {
      // Vencimento <= Limit (max yesterday or dataFim)
      const limitDate = dataFim > hojeStr ? hojeStr : dataFim;
      const { data, error } = await supabase
        .from("pagamentos")
        .select(`
          id,
          valor,
          data_vencimento,
          status,
          parcela_atual,
          parcelas,
          aluno_id,
          alunos (nome, telefone, email),
          produtos (id, nome),
          matriculas (comercial_id, comerciais (id, nome))
        `)
        .is("deleted_at", null)
        .in("status", ["pendente", "atrasado"])
        .lt("data_vencimento", hojeStr)
        .gte("data_vencimento", dataInicio)
        .lte("data_vencimento", limitDate);

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate days of delay and classify ranges
  const rowsRaw = useMemo(() => {
    if (!pagamentos) return [];
    const now = new Date(hojeStr).getTime();

    return pagamentos.map((p: any) => {
      const vencDate = new Date(p.data_vencimento).getTime();
      const diasAtraso = Math.floor((now - vencDate) / (1000 * 60 * 60 * 24));
      
      let faixa = "90+";
      let faixaSort = 4;
      if (diasAtraso >= 1 && diasAtraso <= 30) { faixa = "1-30"; faixaSort = 1; }
      else if (diasAtraso >= 31 && diasAtraso <= 60) { faixa = "31-60"; faixaSort = 2; }
      else if (diasAtraso >= 61 && diasAtraso <= 90) { faixa = "61-90"; faixaSort = 3; }

      const vId = p.matriculas?.comercial_id || "sem_vendedor";
      const vNome = p.matriculas?.comerciais?.nome || "Sem Vendedor";

      return {
        id: p.id,
        aluno_id: p.aluno_id,
        aluno_nome: p.alunos?.nome || "—",
        aluno_telefone: p.alunos?.telefone || "",
        aluno_email: p.alunos?.email || "",
        produto_id: p.produtos?.id,
        produto_nome: p.produtos?.nome || "—",
        vendedor_id: vId,
        vendedor_nome: vNome,
        valor: Number(p.valor || 0),
        vencimento: p.data_vencimento,
        parcela: p.parcelas ? `${p.parcela_atual}/${p.parcelas}` : p.parcela_atual || "—",
        dias_atraso: Math.max(1, diasAtraso),
        faixa,
        faixaSort,
      };
    });
  }, [pagamentos, hojeStr]);

  // Apply filters
  const rows = useMemo(() => {
    let res = rowsRaw;
    if (vendedorId !== "todos") res = res.filter(r => r.vendedor_id === vendedorId);
    if (produtoId !== "todos") res = res.filter(r => r.produto_id === produtoId);
    if (faixaFiltro !== "todos") res = res.filter(r => r.faixa === faixaFiltro);
    if (buscaAluno.trim()) {
      const q = buscaAluno.toLowerCase();
      res = res.filter(r => r.aluno_nome.toLowerCase().includes(q));
    }
    
    if (sortConfig) {
      res.sort((a: any, b: any) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (sortConfig.key === "valor") {
          valA = Number(valA); valB = Number(valB);
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      res.sort((a, b) => b.dias_atraso - a.dias_atraso); // default
    }

    return res;
  }, [rowsRaw, vendedorId, produtoId, faixaFiltro, buscaAluno, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? " ↑" : " ↓";
  };

  // Metrics
  const totalInadimplente = rows.reduce((acc, r) => acc + r.valor, 0);
  const qtdParcelas = rows.length;
  const alunosInadimplentes = new Set(rows.map(r => r.aluno_id)).size;
  const ticketMedio = qtdParcelas > 0 ? totalInadimplente / qtdParcelas : 0;

  // Aging Data
  const agingData = useMemo(() => {
    const data = [
      { faixa: "1-30", sort: 1, color: "#eab308", total: 0 }, // yellow-500
      { faixa: "31-60", sort: 2, color: "#f97316", total: 0 }, // orange-500
      { faixa: "61-90", sort: 3, color: "#ef4444", total: 0 }, // red-500
      { faixa: "90+", sort: 4, color: "#991b1b", total: 0 }, // red-800
    ];
    rows.forEach(r => {
      const item = data.find(d => d.faixa === r.faixa);
      if (item) item.total += r.valor;
    });
    return data;
  }, [rows]);

  // Exports
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Aba Resumo
    const resumoMetrics = [
      { Métrica: "Total Inadimplente", Valor: formatCurrency(totalInadimplente) },
      { Métrica: "Quantidade Parecelas", Valor: qtdParcelas },
      { Métrica: "Alunos Inadimplentes", Valor: alunosInadimplentes },
      { Métrica: "Ticket Médio", Valor: formatCurrency(ticketMedio) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoMetrics), "Resumo");

    const resumoAging = agingData.map(a => ({
      Faixa: a.faixa,
      Total: formatCurrency(a.total),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoAging), "Resumo Aging");

    // Aba Detalhada
    const detailData = rows.map(r => ({
      "Aluno": r.aluno_nome,
      "Produto": r.produto_nome,
      "Parcela": r.parcela,
      "Valor (R$)": r.valor,
      "Vencimento": formatDate(r.vencimento),
      "Dias Atraso": r.dias_atraso,
      "Faixa": r.faixa,
      "Vendedor": r.vendedor_nome,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailData), "Detalhado");
    
    XLSX.writeFile(wb, `relatorio-inadimplencia-${dataInicio}-${dataFim}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ format: "a4", orientation: "landscape" });
    const pw = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(22, 78, 138);
    doc.rect(0, 0, pw, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GRUPO EXCELLENCE", 15, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório de Inadimplência — ${dataInicio} a ${dataFim}`, 15, 25);
    
    doc.setTextColor(30, 41, 59);
    let y = 40;
    
    doc.setFontSize(9);
    doc.text(`Total Devido: ${formatCurrency(totalInadimplente)}   |   Parcelas: ${qtdParcelas}   |   Alunos: ${alunosInadimplentes}   |   Médio: ${formatCurrency(ticketMedio)}`, 15, y);
    y += 8;

    // Top 20 Devedores Aggregation
    const devMap = new Map<string, { nome: string; valor: number; maxAtraso: number; parcelas: number }>();
    rows.forEach(r => {
      if (!devMap.has(r.aluno_nome)) {
        devMap.set(r.aluno_nome, { nome: r.aluno_nome, valor: 0, maxAtraso: 0, parcelas: 0 });
      }
      const g = devMap.get(r.aluno_nome)!;
      g.valor += r.valor;
      g.parcelas += 1;
      if (r.dias_atraso > g.maxAtraso) g.maxAtraso = r.dias_atraso;
    });
    const top20 = Array.from(devMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Top 20 Devedores", 15, y);
    y += 4;
    
    autoTable(doc, {
      startY: y,
      head: [["Aluno", "Parcelas", "Max. Atraso", "Valor Total"]],
      body: top20.map(t => [t.nome, t.parcelas, t.maxAtraso + " dias", formatCurrency(t.valor)]),
      headStyles: { fillColor: [22, 78, 138], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 15, right: 15 },
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

  const getBadgeColor = (faixa: string) => {
    switch(faixa) {
      case "1-30": return "bg-yellow-500 hover:bg-yellow-600";
      case "31-60": return "bg-orange-500 hover:bg-orange-600";
      case "61-90": return "bg-red-500 hover:bg-red-600";
      case "90+": return "bg-red-800 hover:bg-red-900";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-4">
      <WhatsAppDialog
        open={waOpen}
        onOpenChange={setWaOpen}
        telefone={waPhone}
        nome={waName}
      />

      {/* ═══ MÉTRICAS ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricBox icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Total Inadimplente" value={formatCurrency(totalInadimplente)} highlight />
        <MetricBox label="Parcelas Vencidas" value={String(qtdParcelas)} />
        <MetricBox label="Alunos Inadimplentes" value={String(alunosInadimplentes)} />
        <MetricBox label="Ticket Médio" value={formatCurrency(ticketMedio)} />
      </div>

      {/* ═══ CONTEÚDO PRINCIPAL ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* GRÁFICO AGING */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Aging de Inadimplência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} />
                  <XAxis type="number" tickFormatter={(v) => (v > 0 ? `${(v/1000).toFixed(0)}k` : "0")} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="faixa" tick={{ fontSize: 11 }} width={50} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                    {agingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* FILTROS E TABELA */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between gap-2">
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="flex-1">
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Filter className="h-4 w-4" /> Filtros
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4 space-y-4">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <Label className="text-xs">Início Vencimento</Label>
                        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[140px] h-9 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Fim Vencimento</Label>
                        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[140px] h-9 text-xs" />
                      </div>
                      <div className="w-[130px]">
                        <Label className="text-xs">Faixa</Label>
                        <Select value={faixaFiltro} onValueChange={setFaixaFiltro}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todas</SelectItem>
                            <SelectItem value="1-30">1 a 30 dias</SelectItem>
                            <SelectItem value="31-60">31 a 60 dias</SelectItem>
                            <SelectItem value="61-90">61 a 90 dias</SelectItem>
                            <SelectItem value="90+">Mais de 90</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[150px]">
                        <Label className="text-xs">Produto</Label>
                        <Select value={produtoId} onValueChange={setProdutoId}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            {(produtos || []).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[150px]">
                        <Label className="text-xs">Vendedor</Label>
                        <Select value={vendedorId} onValueChange={setVendedorId}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            {(comerciais || []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
          
          <div className="flex gap-2 justify-end mb-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1.5" />PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1.5" />Excel</Button>
          </div>

          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">Detalhes</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar aluno..."
                  className="pl-8 h-8 text-xs"
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma parcela atrasada encontrada.</div>
              ) : (
                <div className="overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => requestSort("aluno_nome")}>
                          Aluno{getSortIcon("aluno_nome")}
                        </TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => requestSort("produto_nome")}>
                          Produto{getSortIcon("produto_nome")}
                        </TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Parcela</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap text-right cursor-pointer hover:bg-muted/50" onClick={() => requestSort("valor")}>
                          Valor{getSortIcon("valor")}
                        </TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-muted/50" onClick={() => requestSort("vencimento")}>
                          Vencimento{getSortIcon("vencimento")}
                        </TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap text-center cursor-pointer hover:bg-muted/50" onClick={() => requestSort("dias_atraso")}>
                          Atraso{getSortIcon("dias_atraso")}
                        </TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Faixa</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap">Vendedor</TableHead>
                        <TableHead className="text-xs font-semibold whitespace-nowrap text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={i} className="group">
                          <TableCell className="text-xs py-2">{r.aluno_nome}</TableCell>
                          <TableCell className="text-xs py-2"><span className="truncate block max-w-[120px]" title={r.produto_nome}>{r.produto_nome}</span></TableCell>
                          <TableCell className="text-xs py-2">{r.parcela}</TableCell>
                          <TableCell className="text-xs py-2 text-right text-destructive font-medium">{formatCurrency(r.valor)}</TableCell>
                          <TableCell className="text-xs py-2">{formatDate(r.vencimento)}</TableCell>
                          <TableCell className="text-xs py-2 text-center text-muted-foreground">{r.dias_atraso}d</TableCell>
                          <TableCell className="text-xs py-2">
                            <Badge className={`${getBadgeColor(r.faixa)} text-[10px] text-white border-0`}>{r.faixa}</Badge>
                          </TableCell>
                          <TableCell className="text-xs py-2"><span className="truncate block max-w-[100px]" title={r.vendedor_nome}>{r.vendedor_nome}</span></TableCell>
                          <TableCell className="text-xs py-2 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="WhatsApp"
                                onClick={() => {
                                  setWaPhone(r.aluno_telefone);
                                  setWaName(r.aluno_nome);
                                  setWaOpen(true);
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="E-mail"
                                onClick={() => r.aluno_email ? window.location.href=`mailto:${r.aluno_email}` : null}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function MetricBox({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          {icon} {label}
        </p>
        <p className={`text-xl font-bold ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
