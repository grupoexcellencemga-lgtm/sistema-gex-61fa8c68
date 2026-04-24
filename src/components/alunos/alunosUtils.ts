export interface AlunoForm {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
  sexo: string;
  data_nascimento: string;
}

export const emptyForm: AlunoForm = { nome: "", email: "", telefone: "", cpf: "", sexo: "", data_nascimento: "" };
export const PAGE_SIZE = 25;

export const emptyMatriculaForm = {
  produto_id: "", turma_id: "", data_inicio: "", data_fim: "", status: "ativo", observacoes: "",
  valor_total: "", desconto: "", parcelas: "1", forma_pagamento: "", data_vencimento: "", conta_bancaria_id: "",
  comercial_id: "", percentual_comissao: "5", taxa_cartao: "", repassar_taxa: false,
};

// Re-export from centralized formatters
export { formatDate, formatCurrency } from "@/lib/formatters";

export const calcMultaJuros = (p: { status: string; data_vencimento: string | null; valor: number }) => {
  if (p.status === "pago" || !p.data_vencimento) return { multa: 0, juros: 0, total: Number(p.valor) };
  const venc = new Date(p.data_vencimento + "T12:00:00");
  const hoje = new Date();
  if (hoje <= venc) return { multa: 0, juros: 0, total: Number(p.valor) };
  const diasAtraso = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
  const valor = Number(p.valor);
  const multa = valor * 0.02;
  const juros = valor * 0.01 * Math.ceil(diasAtraso / 30);
  return { multa, juros, total: valor + multa + juros, diasAtraso };
};
