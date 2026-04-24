/**
 * Utilitários para cálculos financeiros padronizados.
 */

/**
 * Calcula o valor da comissão com base no valor e percentual.
 * @param valor Valor base
 * @param percentual Percentual de comissão (ex: 5 para 5%)
 */
export function calcularComissao(valor: number, percentual: number): number {
  if (valor <= 0 || percentual <= 0) return 0;
  return Number(((valor * percentual) / 100).toFixed(2));
}

/**
 * Calcula a taxa da maquininha de cartão.
 * @param valor Valor total da transação
 * @param percentualTaxa Percentual cobrado pela adquirente
 */
export function calcularTaxaMaquininha(valor: number, percentualTaxa: number): number {
  if (valor <= 0 || percentualTaxa <= 0) return 0;
  return Number(((valor * percentualTaxa) / 100).toFixed(2));
}

/**
 * Calcula o valor líquido subtraindo a taxa do valor bruto.
 * @param valorBruto Valor total sem descontos
 * @param taxa Valor monetário da taxa
 */
export function calcularValorLiquido(valorBruto: number, taxa: number): number {
  if (valorBruto <= 0) return 0;
  const liquido = valorBruto - Math.max(0, taxa);
  return Number(Math.max(0, liquido).toFixed(2));
}
