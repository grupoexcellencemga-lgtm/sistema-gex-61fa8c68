type Pagamento = {
  status: string;
  valor: number | string;
  valor_pago?: number | string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  taxa_valor?: number | string | null;
  taxa_absorvida_por?: string | null;
};

const centavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);

/** Quitação da dívida: taxas da adquirente não reduzem o valor pago pelo aluno. */
export function valorPagoAluno(p: Pagamento): number {
  return p.status === "pago" ? Number(p.valor_pago ?? p.valor) : 0;
}

export function temTaxaSeparada(p: Pagamento): boolean {
  return p.status === "pago" && ["aluno", "empresa"].includes(p.taxa_absorvida_por || "") && p.valor_pago != null &&
    centavos(Number(p.valor)) > centavos(Number(p.valor_pago)) &&
    centavos(Number(p.valor)) - centavos(Number(p.valor_pago)) === centavos(Number(p.taxa_valor || 0));
}

export function resumirMatricula(total: number, pagamentos: Pagamento[]) {
  const pago = pagamentos.reduce((s, p) => s + centavos(valorPagoAluno(p)), 0);
  return { total, pago: pago / 100, pendente: Math.max(0, centavos(total) - pago) / 100 };
}

export function calcularPagamentoParcial(saldo: number, recebido: number) {
  if (!Number.isFinite(saldo) || !Number.isFinite(recebido) || centavos(recebido) <= 0 || centavos(recebido) > centavos(saldo)) {
    throw new Error("Informe um valor recebido maior que zero e menor ou igual ao saldo pendente.");
  }
  return { pago: centavos(recebido) / 100, restante: (centavos(saldo) - centavos(recebido)) / 100 };
}

/** Recebido inclui a taxa repassada; somente o principal quita a matrícula. */
export function calcularPagamentoComTaxa(saldo: number, recebido: number, taxa: number, absorvidaPor: string) {
  if (!Number.isFinite(taxa) || taxa < 0) throw new Error("A taxa deve ser um valor válido maior ou igual a zero.");
  const principal = ["aluno", "empresa"].includes(absorvidaPor) ? (centavos(recebido) - centavos(taxa)) / 100 : recebido;
  const comTaxa = taxa > 0 && ["aluno", "empresa"].includes(absorvidaPor);
  const resultado = comTaxa
    ? calcularPagamentoParcial(Math.max(saldo, principal), principal)
    : calcularPagamentoParcial(saldo, principal);
  return { ...resultado, recebido: centavos(recebido) / 100, taxa: centavos(taxa) / 100 };
}

export function ordenarPagamentos<T extends Pagamento>(pagamentos: T[]): T[] {
  return [...pagamentos].sort((a, b) => {
    const aPago = a.status === "pago";
    const bPago = b.status === "pago";
    if (aPago !== bPago) return aPago ? 1 : -1;
    return aPago
      ? (b.data_pagamento ?? "").localeCompare(a.data_pagamento ?? "")
      : (a.data_vencimento ?? "9999").localeCompare(b.data_vencimento ?? "9999");
  });
}
