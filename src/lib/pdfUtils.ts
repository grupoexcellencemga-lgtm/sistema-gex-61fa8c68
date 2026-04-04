import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/formatters";

// Brand colors
const PRIMARY = [22, 78, 138] as [number, number, number]; // deep blue
const DARK = [30, 41, 59] as [number, number, number];
const GRAY = [100, 116, 139] as [number, number, number];
const LIGHT_BG = [241, 245, 249] as [number, number, number];

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pw = doc.internal.pageSize.getWidth();
  // Blue header band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pw, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GRUPO EXCELLENCE", 20, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 20, 30);
  if (subtitle) {
    doc.setFontSize(9);
    doc.text(subtitle, pw - 20, 30, { align: "right" });
  }
  doc.setTextColor(...DARK);
}

function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`Grupo Excellence — Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 20, ph - 10);
    doc.text(`Página ${i} de ${pages}`, pw - 20, ph - 10, { align: "right" });
  }
}

// ─── RECIBO DE PAGAMENTO ───

interface ReciboData {
  alunoNome: string;
  alunoCpf?: string;
  produtoNome?: string;
  valor: number;
  dataPagamento?: string;
  formaPagamento?: string;
  parcela?: string;
  reciboId: string;
}

export function gerarReciboPagamento(data: ReciboData) {
  const doc = new jsPDF({ format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const hoje = new Date().toLocaleDateString("pt-BR");

  addHeader(doc, "RECIBO DE PAGAMENTO", `Nº ${data.reciboId.substring(0, 8).toUpperCase()}`);

  let y = 52;

  // Info box
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(15, y, pw - 30, 50, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("DADOS DO ALUNO", 22, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Nome: ${data.alunoNome}`, 22, y + 22);
  if (data.alunoCpf) doc.text(`CPF: ${data.alunoCpf}`, 22, y + 30);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("DADOS DO PAGAMENTO", pw / 2 + 5, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Produto: ${data.produtoNome || "—"}`, pw / 2 + 5, y + 22);
  doc.text(`Forma: ${data.formaPagamento || "—"}`, pw / 2 + 5, y + 30);
  if (data.parcela) doc.text(`Parcela: ${data.parcela}`, pw / 2 + 5, y + 38);

  y += 62;

  // Valor highlight
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(15, y, pw - 30, 24, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`VALOR: ${formatCurrency(data.valor)}`, pw / 2, y + 16, { align: "center" });

  y += 36;

  // Declaration text
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const valorExtenso = formatCurrency(data.valor);
  const text = `Declaramos que recebemos de ${data.alunoNome} a quantia de ${valorExtenso} referente a ${data.produtoNome || "serviços prestados"}.`;
  const lines = doc.splitTextToSize(text, pw - 40);
  doc.text(lines, 20, y);

  y += lines.length * 7 + 10;

  if (data.dataPagamento) {
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text(`Data do pagamento: ${data.dataPagamento}`, 20, y);
    y += 8;
  }

  doc.text(`Data de emissão: ${hoje}`, 20, y);
  y += 30;

  // Signature line
  doc.setDrawColor(...GRAY);
  doc.line(pw / 2 - 60, y, pw / 2 + 60, y);
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Assinatura e Carimbo — Grupo Excellence", pw / 2, y + 6, { align: "center" });

  addFooter(doc);
  doc.output("dataurlnewwindow");
}

// ─── RELATÓRIO FINANCEIRO MENSAL ───

interface RelatorioData {
  periodo: string;
  receitaTotal: number;
  despesaTotal: number;
  lucro: number;
  receitaPorProduto: { nome: string; valor: number }[];
  despesaPorCategoria: { nome: string; valor: number }[];
  comissoesPorVendedor: { nome: string; pago: number; pendente: number }[];
}

export function gerarRelatorioFinanceiro(data: RelatorioData) {
  const doc = new jsPDF({ format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  addHeader(doc, "RELATÓRIO FINANCEIRO", data.periodo);

  let y = 50;

  // Summary boxes
  const boxW = (pw - 50) / 3;
  const boxes = [
    { label: "Receita Total", value: formatCurrency(data.receitaTotal), color: [22, 163, 74] as [number, number, number] },
    { label: "Despesas Total", value: formatCurrency(data.despesaTotal), color: [220, 38, 38] as [number, number, number] },
    { label: "Lucro Líquido", value: formatCurrency(data.lucro), color: PRIMARY },
  ];
  boxes.forEach((box, i) => {
    const x = 15 + i * (boxW + 10);
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(x, y, boxW, 30, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(box.label, x + boxW / 2, y + 10, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...box.color);
    doc.text(box.value, x + boxW / 2, y + 23, { align: "center" });
    doc.setFont("helvetica", "normal");
  });

  y += 42;

  // Receita por Produto
  if (data.receitaPorProduto.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Receita por Produto", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Produto", "Valor"]],
      body: data.receitaPorProduto.map((r) => [r.nome, formatCurrency(r.valor)]),
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: LIGHT_BG },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Despesas por Categoria
  if (data.despesaPorCategoria.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Despesas por Categoria", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Categoria", "Valor"]],
      body: data.despesaPorCategoria.map((d) => [d.nome, formatCurrency(d.valor)]),
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: LIGHT_BG },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // Comissões por Vendedor
  if (data.comissoesPorVendedor.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("Comissões por Vendedor", 15, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Vendedor", "Pago", "Pendente", "Total"]],
      body: data.comissoesPorVendedor.map((c) => [c.nome, formatCurrency(c.pago), formatCurrency(c.pendente), formatCurrency(c.pago + c.pendente)]),
      headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: LIGHT_BG },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 },
    });
  }

  addFooter(doc);
  doc.output("dataurlnewwindow");
}

// ─── CONTRATO DE MATRÍCULA ───

interface ContratoData {
  alunoNome: string;
  alunoCpf?: string;
  alunoEmail?: string;
  alunoTelefone?: string;
  produtoNome?: string;
  turmaNome?: string;
  valorTotal: number;
  desconto: number;
  valorFinal: number;
  parcelas: number;
  dataInicio?: string;
  dataFim?: string;
  formaPagamento?: string;
  clausulas?: string;
}

const defaultClausulas = `1. O presente contrato tem por objeto a prestação de serviços educacionais conforme o programa descrito acima.

2. O CONTRATANTE se compromete a efetuar o pagamento das parcelas nas datas acordadas, sob pena de incidência de multa de 2% e juros de 1% ao mês.

3. Em caso de desistência, o CONTRATANTE deverá comunicar com antecedência mínima de 30 dias, ficando responsável pelo pagamento das parcelas vencidas.

4. O CONTRATADO se compromete a ministrar o conteúdo programático com qualidade e profissionalismo.

5. Este contrato é regido pelas leis brasileiras, ficando eleito o foro da comarca de domicílio do CONTRATADO para dirimir quaisquer questões.`;

export function gerarContratoMatricula(data: ContratoData) {
  const doc = new jsPDF({ format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const hoje = new Date().toLocaleDateString("pt-BR");

  addHeader(doc, "CONTRATO DE MATRÍCULA", hoje);

  let y = 52;

  // Parties
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text("PARTES", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);

  const contratado = "CONTRATADO: Grupo Excellence, empresa prestadora de serviços educacionais.";
  doc.text(contratado, 20, y);
  y += 8;

  let contratante = `CONTRATANTE: ${data.alunoNome}`;
  if (data.alunoCpf) contratante += ` — CPF: ${data.alunoCpf}`;
  doc.text(contratante, 20, y);
  y += 6;
  if (data.alunoEmail) { doc.text(`E-mail: ${data.alunoEmail}`, 20, y); y += 6; }
  if (data.alunoTelefone) { doc.text(`Telefone: ${data.alunoTelefone}`, 20, y); y += 6; }

  y += 8;

  // Program details box
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(15, y, pw - 30, 42, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.text("PROGRAMA", 22, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`Produto: ${data.produtoNome || "—"}`, 22, y + 22);
  if (data.turmaNome) doc.text(`Turma: ${data.turmaNome}`, 22, y + 30);
  doc.text(`Período: ${data.dataInicio || "—"} a ${data.dataFim || "—"}`, pw / 2 + 5, y + 22);

  y += 54;

  // Financial details box
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(15, y, pw - 30, 36, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("VALORES", 22, y + 12);
  doc.setFont("helvetica", "normal");
  doc.text(`Valor Total: ${formatCurrency(data.valorTotal)}`, 22, y + 22);
  if (data.desconto > 0) doc.text(`Desconto: ${formatCurrency(data.desconto)}`, 22, y + 30);
  doc.text(`Valor Final: ${formatCurrency(data.valorFinal)}`, pw / 2 - 15, y + 22);
  doc.text(`${data.parcelas}x de ${formatCurrency(data.valorFinal / data.parcelas)}`, pw / 2 - 15, y + 30);
  if (data.formaPagamento) doc.text(`Forma: ${data.formaPagamento}`, pw - 70, y + 22);

  y += 48;

  // Clauses
  doc.setTextColor(...DARK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CLÁUSULAS", 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);

  const clausulaText = data.clausulas || defaultClausulas;
  const clausulaLines = doc.splitTextToSize(clausulaText, pw - 40);
  
  for (const line of clausulaLines) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(line, 20, y);
    y += 5;
  }

  y += 15;
  if (y > 240) { doc.addPage(); y = 30; }

  // Date and location
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`Local e Data: ___________________, ${hoje}`, 20, y);
  y += 20;

  // Signature lines
  const sigY = y;
  doc.setDrawColor(...GRAY);
  doc.line(20, sigY, pw / 2 - 15, sigY);
  doc.line(pw / 2 + 15, sigY, pw - 20, sigY);
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("CONTRATANTE", (20 + pw / 2 - 15) / 2, sigY + 6, { align: "center" });
  doc.text(data.alunoNome, (20 + pw / 2 - 15) / 2, sigY + 12, { align: "center" });
  doc.text("CONTRATADO", (pw / 2 + 15 + pw - 20) / 2, sigY + 6, { align: "center" });
  doc.text("Grupo Excellence", (pw / 2 + 15 + pw - 20) / 2, sigY + 12, { align: "center" });

  addFooter(doc);
  doc.output("dataurlnewwindow");
}
