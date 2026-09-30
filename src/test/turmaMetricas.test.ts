import { describe, it, expect } from "vitest";
import { agregarMetricasTurma } from "@/lib/turmaMetricas";
import { resumirMatriculaV2 } from "@/lib/alunoFinanceiro";

// ─── Helpers ───────────────────────────────────────────────────────────────

function pag(id: string, matriculaId: string, overrides: Record<string, unknown> = {}): any {
  return {
    id,
    matricula_id: matriculaId,
    valor: 0,
    valor_pago: null,
    forma_pagamento: "pix",
    taxa_absorvida_por: null,
    taxa_valor: null,
    gera_caixa: true,
    status: "pago",
    deleted_at: null,
    ...overrides,
  };
}

function item(pagId: string, valor: number, status: "entregue" | "acordado" | "cancelado"): any {
  return { id: `item-${pagId}-${status}`, pagamento_id: pagId, valor, status, deleted_at: null };
}

// ─── Testes ────────────────────────────────────────────────────────────────

describe("agregarMetricasTurma", () => {
  /**
   * T01 — somente dinheiro
   * 1 matrícula de R$1.000, 1 pagamento pago em dinheiro de R$1.000.
   * quitadoDinheiro = 1000, quitadoPermuta = 0, saldo = 0, líquido = 1000.
   */
  it("T01 — somente dinheiro", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 1000 }],
      pagamentos: [pag("p1", "m1", { valor: 1000, valor_pago: 1000 })],
      itensPorPagamento: {},
      despesas: [],
    });
    expect(r.contratado).toBe(1000);
    expect(r.quitadoDinheiro).toBe(1000);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(1000);
    expect(r.saldoFinanceiro).toBe(0);
    expect(r.liquidoCaixa).toBe(1000);
  });

  /**
   * T02 — somente permuta entregue
   * 1 matrícula de R$500, 1 pagamento-permuta com item entregue de R$500.
   * quitadoDinheiro = 0, quitadoPermuta = 500, líquido = 0 (permuta não é caixa).
   */
  it("T02 — somente permuta entregue", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 500 }],
      pagamentos: [pag("p1", "m1", { valor: 500, forma_pagamento: "permuta", status: "pago" })],
      itensPorPagamento: { p1: [item("p1", 500, "entregue")] },
      despesas: [],
    });
    expect(r.quitadoDinheiro).toBe(0);
    expect(r.quitadoPermuta).toBe(500);
    expect(r.totalQuitado).toBe(500);
    expect(r.saldoFinanceiro).toBe(0);
    expect(r.liquidoCaixa).toBe(0);
  });

  /**
   * T03 — dinheiro + permuta
   * Matrícula R$1.000: R$600 dinheiro + R$400 permuta entregue.
   * totalQuitado = 1000, saldo = 0, líquido = 600 (só dinheiro conta como caixa).
   */
  it("T03 — dinheiro + permuta", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 1000 }],
      pagamentos: [
        pag("p1", "m1", { valor: 600, valor_pago: 600 }),
        pag("p2", "m1", { valor: 400, forma_pagamento: "permuta", status: "pago" }),
      ],
      itensPorPagamento: { p2: [item("p2", 400, "entregue")] },
      despesas: [],
    });
    expect(r.quitadoDinheiro).toBe(600);
    expect(r.quitadoPermuta).toBe(400);
    expect(r.totalQuitado).toBe(1000);
    expect(r.saldoFinanceiro).toBe(0);
    expect(r.liquidoCaixa).toBe(600);
  });

  /**
   * T04 — permuta acordada NÃO entra em quitado
   * Item com status "acordado" não quita a dívida; saldo permanece integral.
   */
  it("T04 — permuta acordada não entra em quitado", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 500 }],
      pagamentos: [pag("p1", "m1", { valor: 500, forma_pagamento: "permuta", status: "pendente" })],
      itensPorPagamento: { p1: [item("p1", 500, "acordado")] },
      despesas: [],
    });
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(0);
    expect(r.saldoFinanceiro).toBe(500);
    expect(r.permutaPendente).toBe(500);
    expect(r.liquidoCaixa).toBe(0);
  });

  /**
   * T05 — probono não entra em caixa
   * Pagamento probono quita a obrigação mas NÃO gera caixa monetário.
   * quitadoDinheiro = 0, quitadoNaoMonetario = 300, líquido = 0.
   */
  it("T05 — probono não entra em caixa", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 300 }],
      pagamentos: [pag("p1", "m1", { valor: 300, valor_pago: 300, forma_pagamento: "probono" })],
      itensPorPagamento: {},
      despesas: [],
    });
    expect(r.quitadoDinheiro).toBe(0);
    expect(r.quitadoNaoMonetario).toBe(300);
    expect(r.totalQuitado).toBe(300);
    expect(r.saldoFinanceiro).toBe(0);
    expect(r.liquidoCaixa).toBe(0);
  });

  /**
   * T06 — despesa reduz líquido
   * R$1.000 recebido − R$200 despesa = R$800 líquido.
   */
  it("T06 — despesa reduz líquido", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 1000 }],
      pagamentos: [pag("p1", "m1", { valor: 1000, valor_pago: 1000 })],
      itensPorPagamento: {},
      despesas: [{ valor: 200 }],
    });
    expect(r.quitadoDinheiro).toBe(1000);
    expect(r.totalDespesas).toBe(200);
    expect(r.liquidoCaixa).toBe(800);
  });

  /**
   * T07 — permuta não altera líquido
   * R$700 dinheiro + R$300 permuta − R$100 despesa = líquido R$600.
   * Líquido é Recebido − Despesas, NÃO TotalQuitado − Despesas.
   */
  it("T07 — permuta não altera líquido", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 1000 }],
      pagamentos: [
        pag("p1", "m1", { valor: 700, valor_pago: 700 }),
        pag("p2", "m1", { valor: 300, forma_pagamento: "permuta", status: "pago" }),
      ],
      itensPorPagamento: { p2: [item("p2", 300, "entregue")] },
      despesas: [{ valor: 100 }],
    });
    expect(r.totalQuitado).toBe(1000);
    expect(r.totalDespesas).toBe(100);
    // Líquido = dinheiro (700) - despesa (100) = 600, NÃO total_quitado (1000) - 100
    expect(r.liquidoCaixa).toBe(600);
  });

  /**
   * T08 — soft deleted não participa
   * Pagamento com deleted_at definido é ignorado por resumirMatriculaV2.
   */
  it("T08 — soft deleted não participa", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m1", valor_final: 1000 }],
      pagamentos: [
        pag("p1", "m1", { valor: 1000, valor_pago: 1000, deleted_at: "2026-01-01T00:00:00Z" }),
      ],
      itensPorPagamento: {},
      despesas: [],
    });
    expect(r.quitadoDinheiro).toBe(0);
    expect(r.totalQuitado).toBe(0);
    expect(r.saldoFinanceiro).toBe(1000);
    expect(r.liquidoCaixa).toBe(0);
  });

  /**
   * T09 — caso Douglas
   * Matrícula R$1.970, dinheiro = R$0, permuta entregue = R$60.
   * totalQuitado = 60, saldo = 1910, líquido = 0 (sem dinheiro).
   */
  it("T09 — Douglas: 1970 contratado, 0 dinheiro, 60 permuta, 60 quitado, 1910 receber", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m-douglas", valor_final: 1970 }],
      pagamentos: [
        pag("p-perm", "m-douglas", { valor: 60, forma_pagamento: "permuta", status: "pago" }),
      ],
      itensPorPagamento: { "p-perm": [item("p-perm", 60, "entregue")] },
      despesas: [],
    });
    expect(r.contratado).toBe(1970);
    expect(r.quitadoDinheiro).toBe(0);
    expect(r.quitadoPermuta).toBe(60);
    expect(r.totalQuitado).toBe(60);
    expect(r.saldoFinanceiro).toBe(1910);
    expect(r.liquidoCaixa).toBe(0);
  });

  /**
   * T09b — Douglas com permuta acordada adicional
   * Além dos R$60 entregues, R$50 acordados mas não entregues.
   * saldoFinanceiro permanece 1910 (acordado não quita).
   * permutaPendente = 50.
   */
  it("T09b — Douglas com permuta acordada: saldo não diminui", () => {
    const r = agregarMetricasTurma({
      matriculas: [{ id: "m-douglas", valor_final: 1970 }],
      pagamentos: [
        pag("p-perm1", "m-douglas", { valor: 60, forma_pagamento: "permuta", status: "pago" }),
        pag("p-perm2", "m-douglas", { valor: 50, forma_pagamento: "permuta", status: "pendente" }),
      ],
      itensPorPagamento: {
        "p-perm1": [item("p-perm1", 60, "entregue")],
        "p-perm2": [item("p-perm2", 50, "acordado")],
      },
      despesas: [],
    });
    expect(r.quitadoPermuta).toBe(60);
    expect(r.permutaPendente).toBe(50);
    expect(r.saldoFinanceiro).toBe(1910); // 1970 − 60 entregues; 50 acordados não reduz saldo
    expect(r.liquidoCaixa).toBe(0);
  });

  /**
   * T10 — totais da aba Métricas batem com resumirMatriculaV2 por matrícula
   * Garante que agregarMetricasTurma é exatamente a soma dos resumos individuais.
   */
  it("T10 — totais batem com resumirMatriculaV2 por matrícula", () => {
    const mat1 = { id: "m1", valor_final: 1000 };
    const mat2 = { id: "m2", valor_final: 500 };
    const pags = [
      pag("p1", "m1", { valor: 800, valor_pago: 800 }),
      pag("p2", "m1", { valor: 200, forma_pagamento: "permuta", status: "pago" }),
      pag("p3", "m2", { valor: 300, valor_pago: 300 }),
    ];
    const itens: Record<string, any[]> = { p2: [item("p2", 200, "entregue")] };
    const despesasArr = [{ valor: 150 }];

    const agg = agregarMetricasTurma({
      matriculas: [mat1, mat2],
      pagamentos: pags,
      itensPorPagamento: itens,
      despesas: despesasArr,
    });

    const r1 = resumirMatriculaV2(1000, pags.filter((p) => p.matricula_id === "m1"), itens);
    const r2 = resumirMatriculaV2(500,  pags.filter((p) => p.matricula_id === "m2"), itens);

    expect(agg.contratado).toBe(r1.total        + r2.total);
    expect(agg.quitadoDinheiro).toBe(r1.quitadoDinheiro + r2.quitadoDinheiro);
    expect(agg.quitadoPermuta).toBe(r1.quitadoPermuta  + r2.quitadoPermuta);
    expect(agg.totalQuitado).toBe(r1.totalQuitado   + r2.totalQuitado);
    expect(agg.saldoFinanceiro).toBe(r1.saldoFinanceiro + r2.saldoFinanceiro);
    expect(agg.totalDespesas).toBe(150);
    expect(agg.liquidoCaixa).toBe(agg.quitadoDinheiro - 150);
  });
});
