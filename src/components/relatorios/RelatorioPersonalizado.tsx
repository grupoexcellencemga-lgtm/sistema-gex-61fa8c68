import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Filter, FileText, FileSpreadsheet, FileDown, Search, X, SlidersHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Column definitions ───

interface ColDef {
  key: string;
  label: string;
  group: string;
  format?: "currency" | "date" | "text";
  default?: boolean;
}

const ALL_COLUMNS: ColDef[] = [
  // Aluno
  { key: "aluno_nome", label: "Aluno", group: "Aluno", format: "text", default: true },
  { key: "aluno_email", label: "E-mail", group: "Aluno", format: "text" },
  { key: "aluno_telefone", label: "Telefone", group: "Aluno", format: "text" },
  { key: "aluno_cidade", label: "Cidade", group: "Aluno", format: "text" },
  // Produto
  { key: "produto_nome", label: "Produto", group: "Produto", format: "text", default: true },
  { key: "produto_tipo", label: "Tipo Produto", group: "Produto", format: "text" },
  // Turma / Evento
  { key: "turma_nome", label: "Turma", group: "Turma", format: "text" },
  { key: "evento_nome", label: "Evento", group: "Evento", format: "text" },
  // Vendedor
  { key: "vendedor_nome", label: "Vendedor", group: "Vendedor", format: "text" },
  // Financeiro
  { key: "valor", label: "Valor Bruto", group: "Financeiro", format: "currency", default: true },
  { key: "taxa_cartao", label: "Taxa Maquininha", group: "Financeiro", format: "currency" },
  { key: "valor_liquido", label: "Valor Líquido", group: "Financeiro", format: "currency", default: true },
  { key: "forma_pagamento", label: "Forma Pgto", group: "Financeiro", format: "text", default: true },
  { key: "parcela_info", label: "Parcela", group: "Financeiro", format: "text" },
  { key: "status", label: "Status", group: "Financeiro", format: "text", default: true },
  { key: "data_pagamento", label: "Data Pgto", group: "Financeiro", format: "date" },
  { key: "data_vencimento", label: "Data Vencimento", group: "Financeiro", format: "date", default: true },
  { key: "conta_banco", label: "Banco", group: "Financeiro", format: "text" },
  // Tipo
  { key: "tipo_lancamento", label: "Tipo (Entrada/Saída)", group: "Geral", format: "text", default: true },
  { key: "categoria", label: "Categoria", group: "Geral", format: "text" },
  { key: "descricao", label: "Descrição", group: "Geral", format: "text" },
];

const formasPgto = ["Pix", "Dinheiro", "Débito", "Cartão de crédito", "Link", "Boleto", "Cheque", "Cartão recorrente"];
const statusPgto = ["pago", "pendente", "vencido", "cancelado"];

export function RelatorioPersonalizado() {
  // Filters
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
  const [alunoId, setAlunoId] = useState("todos");
  const [alunoSearch, setAlunoSearch] = useState("");
  const [formaPgto, setFormaPgto] = useState("todos");
  const [statusPgtoFilter, setStatusPgtoFilter] = useState("todos");
  const [tipoLanc, setTipoLanc] = useState("todos"); // entrada / saida
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);

  // Selected columns
  const [selectedCols, setSelectedCols] = useState<string[]>(
    ALL_COLUMNS.filter(c => c.default).map(c => c.key)
  );

  // ─── Fetch reference data ───
  const { data: produtos } = useQuery({
    queryKey: ["rel-produtos"],
    queryFn: async () => { const { data } = await supabase.from("produtos").select("id, nome, tipo").is("deleted_at", null); return data || []; },
  });

  const { data: turmasAll } = useQuery({
    queryKey: ["rel-turmas"],
    queryFn: async () => { const { data } = await supabase.from("turmas" as any).select("id, nome, produto_id").is("deleted_at", null); return (data || []) as any[]; },
  });

  const { data: eventosAll } = useQuery({
    queryKey: ["rel-eventos"],
    queryFn: async () => { const { data } = await supabase.from("eventos").select("id, nome, produto_id").is("deleted_at", null); return data || []; },
  });

  const { data: comerciais } = useQuery({
    queryKey: ["rel-comerciais"],
    queryFn: async () => { const { data } = await supabase.from("comerciais").select("id, nome").eq("ativo", true); return data || []; },
  });

  const { data: alunosAll } = useQuery({
    queryKey: ["rel-alunos"],
    queryFn: async () => { const { data } = await supabase.from("alunos").select("id, nome").is("deleted_at", null).order("nome").limit(500); return data || []; },
  });

  // Cascade: filter turmas/eventos by selected product
  const turmas = useMemo(() => {
    if (!turmasAll) return [];
    if (produtoId === "todos") return turmasAll;
    return turmasAll.filter((t: any) => t.produto_id === produtoId);
  }, [turmasAll, produtoId]);

  const eventos = useMemo(() => {
    if (!eventosAll) return [];
    if (produtoId === "todos") return eventosAll;
    return eventosAll.filter(e => e.produto_id === produtoId);
  }, [eventosAll, produtoId]);

  const filteredAlunos = useMemo(() => {
    if (!alunosAll) return [];
    if (!alunoSearch) return alunosAll.slice(0, 20);
    const s = alunoSearch.toLowerCase();
    return alunosAll.filter(a => a.nome.toLowerCase().includes(s)).slice(0, 20);
  }, [alunosAll, alunoSearch]);

  // ─── Fetch report data ───
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ["relatorio-personalizado", dataInicio, dataFim, produtoId, turmaId, eventoId, vendedorId, alunoId, formaPgto, statusPgtoFilter, tipoLanc],
    queryFn: async () => {
      const rows: any[] = [];

      // Entradas (pagamentos)
      if (tipoLanc === "todos" || tipoLanc === "entrada") {
        let q = supabase.from("pagamentos").select(`
          id, valor, data_pagamento, data_vencimento, forma_pagamento, status, parcela_atual, parcelas, taxa_cartao,
          aluno_id, produto_id, matricula_id, conta_bancaria_id,
          alunos!inner(nome, email, telefone, cidade),
          produtos(nome, tipo),
          contas_bancarias(nome, banco),
          matriculas(comercial_id, turma_id, comerciais(nome))
        `).is("deleted_at", null)
          .gte("data_vencimento", dataInicio)
          .lte("data_vencimento", dataFim);

        if (produtoId !== "todos") q = q.eq("produto_id", produtoId);
        if (alunoId !== "todos") q = q.eq("aluno_id", alunoId);
        if (formaPgto !== "todos") q = q.eq("forma_pagamento", formaPgto);
        if (statusPgtoFilter !== "todos") q = q.eq("status", statusPgtoFilter);

        const { data } = await q.limit(1000);
        (data || []).forEach((p: any) => {
          const mat = p.matriculas;
          const vendNome = mat?.comerciais?.nome || "—";
          const turmaIdVal = mat?.turma_id;
          if (vendedorId !== "todos" && mat?.comercial_id !== vendedorId) return;
          if (turmaId !== "todos" && turmaIdVal !== turmaId) return;

          rows.push({
            tipo_lancamento: "Entrada",
            aluno_nome: p.alunos?.nome || "—",
            aluno_email: p.alunos?.email || "",
            aluno_telefone: p.alunos?.telefone || "",
            aluno_cidade: p.alunos?.cidade || "",
            produto_nome: p.produtos?.nome || "—",
            produto_tipo: p.produtos?.tipo || "",
            turma_nome: "",
            evento_nome: "",
            vendedor_nome: vendNome,
            valor: Number(p.valor || 0),
            taxa_cartao: Number(p.taxa_cartao || 0),
            valor_liquido: Number(p.valor || 0) - Number(p.taxa_cartao || 0),
            forma_pagamento: p.forma_pagamento || "—",
            parcela_info: p.parcelas ? `${p.parcela_atual}/${p.parcelas}` : "—",
            status: p.status || "—",
            data_pagamento: p.data_pagamento,
            data_vencimento: p.data_vencimento,
            conta_banco: p.contas_bancarias?.banco || "—",
            categoria: "Pagamento",
            descricao: "",
          });
        });

        // Receitas avulsas
        let qa = supabase.from("receitas_avulsas").select("id, valor, data, forma_pagamento, categoria, descricao, observacoes, conta_bancaria_id, contas_bancarias(nome, banco)")
          .is("deleted_at", null).gte("data", dataInicio).lte("data", dataFim);
        if (formaPgto !== "todos") qa = qa.eq("forma_pagamento", formaPgto);
        const { data: avulsas } = await qa.limit(500);
        (avulsas || []).forEach((r: any) => {
          rows.push({
            tipo_lancamento: "Entrada",
            aluno_nome: "—", aluno_email: "", aluno_telefone: "", aluno_cidade: "",
            produto_nome: "—", produto_tipo: "",
            turma_nome: "", evento_nome: "", vendedor_nome: "—",
            valor: Number(r.valor || 0), taxa_cartao: 0, valor_liquido: Number(r.valor || 0),
            forma_pagamento: r.forma_pagamento || "—",
            parcela_info: "—", status: "pago",
            data_pagamento: r.data, data_vencimento: r.data,
            conta_banco: r.contas_bancarias?.banco || "—",
            categoria: r.categoria || "Receita Avulsa",
            descricao: r.descricao || "",
          });
        });
      }

      // Saídas (despesas)
      if (tipoLanc === "todos" || tipoLanc === "saida") {
        let qd = supabase.from("despesas").select(`
          id, valor, data, forma_pagamento, descricao, observacoes, fornecedor, turma_id, produto_id, evento_id,
          categorias_despesas(nome), contas_bancarias(nome, banco), produtos(nome), turmas:turma_id(nome), eventos:evento_id(nome)
        `).is("deleted_at", null).gte("data", dataInicio).lte("data", dataFim);

        if (produtoId !== "todos") qd = qd.eq("produto_id", produtoId);
        if (turmaId !== "todos") qd = qd.eq("turma_id", turmaId);
        if (eventoId !== "todos") qd = qd.eq("evento_id", eventoId);

        const { data: desp } = await qd.limit(1000);
        (desp || []).forEach((d: any) => {
          rows.push({
            tipo_lancamento: "Saída",
            aluno_nome: "—", aluno_email: "", aluno_telefone: "", aluno_cidade: "",
            produto_nome: (d.produtos as any)?.nome || "—",
            produto_tipo: "",
            turma_nome: (d as any).turmas?.nome || "",
            evento_nome: (d as any).eventos?.nome || "",
            vendedor_nome: "—",
            valor: Number(d.valor || 0), taxa_cartao: 0, valor_liquido: Number(d.valor || 0),
            forma_pagamento: d.forma_pagamento || "—",
            parcela_info: "—", status: "pago",
            data_pagamento: d.data, data_vencimento: d.data,
            conta_banco: d.contas_bancarias?.banco || "—",
            categoria: (d.categorias_despesas as any)?.nome || "—",
            descricao: d.descricao || "",
          });
        });
      }

      return rows;
    },
  });

  const rows = reportData || [];

  // Totals
  const totals = useMemo(() => {
    const entradas = rows.filter(r => r.tipo_lancamento === "Entrada");
    const saidas = rows.filter(r => r.tipo_lancamento === "Saída");
    return {
      totalEntradas: entradas.reduce((s, r) => s + r.valor, 0),
      totalSaidas: saidas.reduce((s, r) => s + r.valor, 0),
      totalTaxa: entradas.reduce((s, r) => s + r.taxa_cartao, 0),
      totalLiquido: entradas.reduce((s, r) => s + r.valor_liquido, 0),
      count: rows.length,
    };
  }, [rows]);

  const visibleCols = ALL_COLUMNS.filter(c => selectedCols.includes(c.key));

  const toggleCol = (key: string) => {
    setSelectedCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const formatCell = (row: any, col: ColDef) => {
    const v = row[col.key];
    if (v === null || v === undefined) return "—";
    if (col.format === "currency") return formatCurrency(Number(v));
    if (col.format === "date") return formatDate(v);
    return String(v);
  };

  // Reset cascade on product change
  const handleProdutoChange = (v: string) => {
    setProdutoId(v);
    setTurmaId("todos");
    setEventoId("todos");
  };

  // ─── Exports ───

  const handleExportExcel = () => {
    const data = rows.map(r => {
      const obj: any = {};
      visibleCols.forEach(c => { obj[c.label] = c.format === "currency" ? Number(r[c.key] || 0) : (c.format === "date" ? formatDate(r[c.key]) : (r[c.key] || "")); });
      return obj;
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Relatório");
    XLSX.writeFile(wb, `relatorio-personalizado-${dataInicio}-${dataFim}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ format: "a4", orientation: visibleCols.length > 8 ? "landscape" : "portrait" });
    const pw = doc.internal.pageSize.getWidth();
    // Header
    doc.setFillColor(22, 78, 138);
    doc.rect(0, 0, pw, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("GRUPO EXCELLENCE", 15, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório Personalizado — ${dataInicio} a ${dataFim}`, 15, 25);
    doc.setTextColor(30, 41, 59);

    // Summary
    let y = 40;
    doc.setFontSize(9);
    doc.text(`Total Entradas: ${formatCurrency(totals.totalEntradas)}   |   Total Saídas: ${formatCurrency(totals.totalSaidas)}   |   Líquido: ${formatCurrency(totals.totalLiquido)}   |   Registros: ${totals.count}`, 15, y);
    y += 8;

    // Table
    autoTable(doc, {
      startY: y,
      head: [visibleCols.map(c => c.label)],
      body: rows.map(r => visibleCols.map(c => formatCell(r, c))),
      headStyles: { fillColor: [22, 78, 138], textColor: [255, 255, 255], fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      margin: { left: 10, right: 10 },
    });

    // Footer
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

  const handleExportWord = async () => {
    // Generate a simple HTML-based Word doc with brand formatting
    const tableRows = rows.map(r =>
      `<tr>${visibleCols.map(c => `<td style="border:1px solid #ccc;padding:4px;font-size:9pt">${formatCell(r, c)}</td>`).join("")}</tr>`
    ).join("");

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
        <div class="header">
          <h1>GRUPO EXCELLENCE</h1>
          <p>Relatório Personalizado — ${dataInicio} a ${dataFim}</p>
        </div>
        <div class="summary">
          <strong>Entradas:</strong> ${formatCurrency(totals.totalEntradas)} &nbsp;|&nbsp;
          <strong>Saídas:</strong> ${formatCurrency(totals.totalSaidas)} &nbsp;|&nbsp;
          <strong>Líquido:</strong> ${formatCurrency(totals.totalLiquido)} &nbsp;|&nbsp;
          <strong>Registros:</strong> ${totals.count}
        </div>
        <table>
          <thead><tr>${visibleCols.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="footer">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</div>
      </body></html>
    `;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-personalizado-${dataInicio}-${dataFim}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const colGroups = [...new Set(ALL_COLUMNS.map(c => c.group))];

  return (
    <div className="space-y-4">
      {/* ═══ FILTROS ═══ */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros do Relatório
                <Badge variant="secondary" className="ml-auto text-xs">{rows.length} registros</Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4">
              {/* Row 1: Dates + Type */}
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-[150px] h-9" />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-[150px] h-9" />
                </div>
                <div className="w-[140px]">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={tipoLanc} onValueChange={setTipoLanc}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="entrada">Entradas</SelectItem>
                      <SelectItem value="saida">Saídas</SelectItem>
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
                <div className="w-[130px]">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusPgtoFilter} onValueChange={setStatusPgtoFilter}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {statusPgto.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Product → Turma → Evento (cascade) */}
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
                      {eventos.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[160px]">
                  <Label className="text-xs">Vendedor</Label>
                  <Select value={vendedorId} onValueChange={setVendedorId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {(comerciais || []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Aluno search */}
              <div className="flex flex-wrap gap-3 items-end">
                <div className="w-[300px]">
                  <Label className="text-xs">Aluno/Cliente</Label>
                  <Select value={alunoId} onValueChange={setAlunoId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input placeholder="Buscar aluno..." className="pl-7 h-8 text-xs" value={alunoSearch} onChange={e => setAlunoSearch(e.target.value)} />
                        </div>
                      </div>
                      <SelectItem value="todos">Todos</SelectItem>
                      {filteredAlunos.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {alunoId !== "todos" && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={() => { setAlunoId("todos"); setAlunoSearch(""); }}>
                    <X className="h-3.5 w-3.5 mr-1" /> Limpar aluno
                  </Button>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══ COLUMN SELECTOR ═══ */}
      <Collapsible open={columnsOpen} onOpenChange={setColumnsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Colunas visíveis
                <Badge variant="outline" className="ml-auto text-xs">{selectedCols.length} de {ALL_COLUMNS.length}</Badge>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="space-y-3">
                {colGroups.map(group => (
                  <div key={group}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group}</p>
                    <div className="flex flex-wrap gap-3">
                      {ALL_COLUMNS.filter(c => c.group === group).map(col => (
                        <label key={col.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox checked={selectedCols.includes(col.key)} onCheckedChange={() => toggleCol(col.key)} />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══ SUMMARY + EXPORT ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm">
          <div><span className="text-muted-foreground">Entradas:</span> <span className="font-semibold text-success">{formatCurrency(totals.totalEntradas)}</span></div>
          <div><span className="text-muted-foreground">Saídas:</span> <span className="font-semibold text-destructive">{formatCurrency(totals.totalSaidas)}</span></div>
          <div><span className="text-muted-foreground">Taxas:</span> <span className="font-semibold">{formatCurrency(totals.totalTaxa)}</span></div>
          <div><span className="text-muted-foreground">Líquido:</span> <span className="font-bold">{formatCurrency(totals.totalLiquido)}</span></div>
        </div>
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
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhum registro encontrado para os filtros selecionados</div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleCols.map(c => (
                      <TableHead key={c.key} className="text-xs whitespace-nowrap sticky top-0 bg-background z-10">{c.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i} className={row.tipo_lancamento === "Saída" ? "bg-destructive/5" : ""}>
                      {visibleCols.map(c => (
                        <TableCell key={c.key} className="text-xs whitespace-nowrap py-2">{formatCell(row, c)}</TableCell>
                      ))}
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
