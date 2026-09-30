import { resumirMatriculaV2, PermutaItem } from "@/lib/alunoFinanceiro";

export type MetricasTurmaInput = {
  matriculas: { id: string; valor_final?: number | string | null }[];
  pagamentos: Array<{ matricula_id?: string | null; [key: string]: any }>;
  itensPorPagamento: Record<string, PermutaItem[]>;
  despesas: { valor?: number | string | null }[];
};

export type MetricasTurmaFinanceiro = {
  contratado: number;
  quitadoDinheiro: number;
  quitadoPermuta: number;
  quitadoNaoMonetario: number;
  totalQuitado: number;
  saldoFinanceiro: number;
  permutaPendente: number;
  totalDespesas: number;
  liquidoCaixa: number;
};

/**
 * Agrega os resumos de todas as matrículas da turma em um único objeto financeiro.
 * Usa resumirMatriculaV2 como fonte canônica — mesma semântica do TurmaFinanceiroTab.
 *
 * liquidoCaixa = quitadoDinheiro − despesas  (permuta NÃO entra no caixa)
 */
export function agregarMetricasTurma(input: MetricasTurmaInput): MetricasTurmaFinanceiro {
  let contratado = 0;
  let quitadoDinheiro = 0;
  let quitadoPermuta = 0;
  let quitadoNaoMonetario = 0;
  let totalQuitado = 0;
  let saldoFinanceiro = 0;
  let permutaPendente = 0;

  for (const mat of input.matriculas) {
    const total = Number(mat.valor_final || 0);
    const pgtos = input.pagamentos.filter((p) => p.matricula_id === mat.id);
    const resumo = resumirMatriculaV2(total, pgtos, input.itensPorPagamento);
    contratado        += resumo.total;
    quitadoDinheiro   += resumo.quitadoDinheiro;
    quitadoPermuta    += resumo.quitadoPermuta;
    quitadoNaoMonetario += resumo.quitadoNaoMonetario;
    totalQuitado      += resumo.totalQuitado;
    saldoFinanceiro   += resumo.saldoFinanceiro;
    permutaPendente   += resumo.valorPermutaPendenteEntrega;
  }

  const totalDespesas = input.despesas.reduce((s, d) => s + Number(d.valor || 0), 0);
  const liquidoCaixa  = quitadoDinheiro - totalDespesas;

  return {
    contratado,
    quitadoDinheiro,
    quitadoPermuta,
    quitadoNaoMonetario,
    totalQuitado,
    saldoFinanceiro,
    permutaPendente,
    totalDespesas,
    liquidoCaixa,
  };
}
