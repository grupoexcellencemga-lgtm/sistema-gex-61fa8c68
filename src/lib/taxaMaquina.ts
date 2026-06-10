// A taxa da maquininha/link incide sobre o valor total cobrado do cliente.
// Ao repassar a taxa, o valor cobrado precisa de gross-up "por dentro":
// cobrado = base / (1 - taxa%), e não base * (1 + taxa%) — assim, após a
// operadora descontar taxa% do cobrado, sobra exatamente o valor base.
export function calcTaxaMaquina(
  valorBase: number,
  taxaPercentual: number,
  repassar: boolean
): { valorTaxa: number; valorCobrado: number; valorLiquido: number } {
  if (valorBase <= 0 || taxaPercentual <= 0) {
    return { valorTaxa: 0, valorCobrado: valorBase, valorLiquido: valorBase };
  }

  if (repassar) {
    const valorCobrado =
      Math.round((valorBase / (1 - taxaPercentual / 100)) * 100) / 100;

    return {
      valorTaxa: Math.round((valorCobrado - valorBase) * 100) / 100,
      valorCobrado,
      valorLiquido: valorBase,
    };
  }

  const valorTaxa = Math.round(valorBase * taxaPercentual) / 100;

  return {
    valorTaxa,
    valorCobrado: valorBase,
    valorLiquido: Math.max(valorBase - valorTaxa, 0),
  };
}
