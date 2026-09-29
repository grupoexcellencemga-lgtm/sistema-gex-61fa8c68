type Pagamento = {
  id?: string;
  status: string;
  valor: number | string;
  valor_pago?: number | string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  forma_pagamento?: string | null;
  taxa_valor?: number | string | null;
  taxa_absorvida_por?: string | null;
  gera_caixa?: boolean | null;
  deleted_at?: string | null;
};

export type PermutaItem = {
  id?: string;
  pagamento_id: string;
  valor: number | string;
  status: 'acordado' | 'entregue' | 'cancelado';
  deleted_at?: string | null;
};

export type ResumoMatriculaV2 = {
  total:                         number;
  quitadoDinheiro:               number; // pagamentos monetários reais (pix, cartao, boleto…)
  quitadoPermuta:                number; // itens de permuta entregues
  quitadoNaoMonetario:           number; // gratuidades/probono (quita obrigação sem gerar caixa)
  totalQuitado:                  number; // = quitadoDinheiro + quitadoPermuta + quitadoNaoMonetario
  valorPermutaPendenteEntrega:   number;
  saldoFinanceiro:               number;
  saldoDisponivelNovoPagamento:  number;
  caixa:                         number;
};

const centavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);

/** Quitação da dívida: taxas da adquirente não reduzem o valor pago pelo aluno. */
export function valorPagoAluno(p: Pagamento): number {
  if (p.status !== "pago") return 0;
  // Quando a empresa absorve a taxa, o aluno pagou o valor bruto integralmente — a taxa é despesa da empresa
  if (p.taxa_absorvida_por === "empresa" && p.valor_pago != null) return Number(p.valor);
  return Number(p.valor_pago ?? p.valor);
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

export function resumirMatriculaV2(
  total: number,
  pagamentos: Pagamento[],
  itensPorPagamento: Record<string, PermutaItem[]>
): ResumoMatriculaV2 {
  let pagoDinhCents = 0, pagoPermCents = 0, pendPermCents = 0, caixaCents = 0, naoMonetarioCents = 0;
  for (const p of pagamentos) {
    if (p.deleted_at || p.status === "cancelado") continue;
    if (p.forma_pagamento === "permuta") {
      const itens = (itensPorPagamento[p.id ?? ""] ?? []).filter(i => !i.deleted_at);
      for (const item of itens) {
        if (item.status === "entregue") pagoPermCents += centavos(Number(item.valor));
        else if (item.status === "acordado") pendPermCents += centavos(Number(item.valor));
      }
    } else if (p.forma_pagamento === "probono") {
      // Probono quita a obrigação sem gerar caixa monetário
      if (p.status !== "pago") continue;
      naoMonetarioCents += centavos(valorPagoAluno(p));
    } else {
      if (p.status !== "pago") continue;
      const v = centavos(valorPagoAluno(p));
      pagoDinhCents += v;
      if (p.gera_caixa !== false) caixaCents += v;
    }
  }
  const totalQuitCents = pagoDinhCents + pagoPermCents + naoMonetarioCents;
  const saldoFinCents = Math.max(0, centavos(total) - totalQuitCents);
  const saldoDispCents = Math.max(0, saldoFinCents - pendPermCents);
  return {
    total,
    quitadoDinheiro: pagoDinhCents / 100,
    quitadoPermuta: pagoPermCents / 100,
    quitadoNaoMonetario: naoMonetarioCents / 100,
    totalQuitado: totalQuitCents / 100,
    valorPermutaPendenteEntrega: pendPermCents / 100,
    saldoFinanceiro: saldoFinCents / 100,
    saldoDisponivelNovoPagamento: saldoDispCents / 100,
    caixa: caixaCents / 100,
  };
}

export function statusPermutaDerived(
  itens: PermutaItem[]
): "pendente_permuta" | "pago" | "cancelado" {
  const ativos = itens.filter(i => !i.deleted_at);
  if (ativos.some(i => i.status === "acordado")) return "pendente_permuta";
  if (ativos.some(i => i.status === "entregue")) return "pago";
  return "cancelado";
}

export function validarSomaItensPermuta(
  valorPermuta: number,
  itens: { valor: number | string }[]
): { valido: boolean; soma: number; diferenca: number } {
  const somaCents = itens.reduce((s, i) => s + centavos(Number(i.valor)), 0);
  const diferenca = Math.abs(somaCents - centavos(valorPermuta)) / 100;
  return { valido: diferenca < 0.005, soma: somaCents / 100, diferenca };
}
