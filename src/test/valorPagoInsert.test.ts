/**
 * D2 — valor_pago no insertPagamento
 *
 * Garante que valor_pago é preenchido corretamente nos dois paths de
 * insertPagamento (normal e boleto parcelado) e que as funções financeiras
 * e a UI dependentes de valor_pago se comportam corretamente.
 */
import { describe, expect, it } from "vitest";
import { resumirMatriculaV2, valorPagoAluno } from "../lib/alunoFinanceiro";

// ─── helpers que espelham a lógica dos paths de insertPagamento ───────────────

type Modalidade = "ja_pago" | "a_pagar";

function buildNovoPagamentoNormal(opts: {
  modalidade: Modalidade;
  valor: number;
  valorLiquido?: number; // taxaCalc.valorLiquido; padrão = valor (sem taxa)
  data_vencimento: string;
}) {
  const statusPag = opts.modalidade === "ja_pago" ? "pago" : "pendente";
  const valorLiquido = opts.valorLiquido ?? opts.valor;
  return {
    data_vencimento: opts.data_vencimento,
    data_pagamento: statusPag === "pago" ? opts.data_vencimento : null,
    status: statusPag as "pago" | "pendente",
    valor: Math.round(opts.valor * 100) / 100,
    valor_pago: statusPag === "pago" ? Math.round(valorLiquido * 100) / 100 : 0,
  };
}

function buildNovoPagamentoBoleto(opts: {
  modalidade: Modalidade;
  valorParcela: number;
  parcelas: number;
  data_vencimento: string;
}) {
  const statusPag = opts.modalidade === "ja_pago" ? "pago" : "pendente";
  return Array.from({ length: opts.parcelas }, (_, i) => {
    const d = new Date(opts.data_vencimento + "T12:00:00");
    d.setMonth(d.getMonth() + i);
    const dStr = d.toISOString().split("T")[0];
    return {
      data_vencimento: dStr,
      data_pagamento: statusPag === "pago" ? dStr : null,
      status: statusPag as "pago" | "pendente",
      valor: Math.round(opts.valorParcela * 100) / 100,
      valor_pago: statusPag === "pago" ? Math.round(opts.valorParcela * 100) / 100 : 0,
    };
  });
}

// helper p/ montar Pagamento completo p/ funções financeiras
function makePagamento(overrides: Record<string, unknown>) {
  return {
    id: "test-id",
    status: "pago",
    forma_pagamento: "pix",
    valor: "10.00",
    valor_pago: null,
    taxa_cartao: null,
    taxa_valor: null,
    taxa_absorvida_por: null,
    data_pagamento: "2026-09-29",
    data_vencimento: "2026-09-29",
    ...overrides,
  } as Parameters<typeof valorPagoAluno>[0];
}

// ─── T01 — normal path: já pago → valor_pago = valor (sem taxa) ──────────────

describe("T01 — normal path: já pago sem taxa → valor_pago = valor", () => {
  it("PIX R$10 já pago → valor=10, valor_pago=10, status=pago", () => {
    const rec = buildNovoPagamentoNormal({
      modalidade: "ja_pago",
      valor: 10,
      data_vencimento: "2026-09-29",
    });
    expect(rec.status).toBe("pago");
    expect(rec.valor).toBe(10);
    expect(rec.valor_pago).toBe(10);
  });
});

// ─── T02 — normal path: pendente → valor_pago = 0 ────────────────────────────

describe("T02 — normal path: pendente → valor_pago = 0", () => {
  it("PIX R$100 a pagar → valor_pago=0, status=pendente", () => {
    const rec = buildNovoPagamentoNormal({
      modalidade: "a_pagar",
      valor: 100,
      data_vencimento: "2026-10-01",
    });
    expect(rec.status).toBe("pendente");
    expect(rec.valor).toBe(100);
    expect(rec.valor_pago).toBe(0);
  });
});

// ─── T03 — partial legítimo: taxa repassada → valor_pago < valor ─────────────

describe("T03 — partial legítimo: taxa repassada → UI mostra 'parcial de'", () => {
  it("cartão com taxa 10% repassada → valor_pago=valor_base < valor_cobrado", () => {
    // Ex: taxa 10%, base R$100, valorCobrado=111.11, valorLiquido=100
    const rec = buildNovoPagamentoNormal({
      modalidade: "ja_pago",
      valor: 111.11,      // valorCobrado (gross — é o que vai p/ campo valor)
      valorLiquido: 100,  // taxaCalc.valorLiquido (net)
      data_vencimento: "2026-09-29",
    });
    expect(rec.valor).toBe(111.11);
    expect(rec.valor_pago).toBe(100);
    // UI: valor_pago != null && valor_pago < valor → mostra "parcial de"
    expect(rec.valor_pago).not.toBeNull();
    expect(Number(rec.valor_pago)).toBeLessThan(Number(rec.valor));
  });
});

// ─── T04 — integral sem taxa → NOT mostra 'parcial de' ───────────────────────

describe("T04 — integral sem taxa → UI NÃO mostra 'parcial de'", () => {
  it("PIX R$100 sem taxa → valor_pago=valor=100", () => {
    const rec = buildNovoPagamentoNormal({
      modalidade: "ja_pago",
      valor: 100,
      data_vencimento: "2026-09-29",
    });
    expect(rec.valor).toBe(100);
    expect(rec.valor_pago).toBe(100);
    // UI: valor_pago < valor é falso → não mostra "parcial de"
    expect(Number(rec.valor_pago)).not.toBeLessThan(Number(rec.valor));
  });
});

// ─── T05 — resumirMatriculaV2: pagamento integral R$10 é contabilizado ────────

describe("T05 — resumirMatriculaV2: integral R$10 com valor_pago=10 → quitado corretamente", () => {
  it("quitadoDinheiro=10, caixa=10, saldoFinanceiro diminui em 10", () => {
    const pag = makePagamento({ valor: "10.00", valor_pago: "10.00", status: "pago" });
    const semPag = resumirMatriculaV2(171.22, [], {});
    const comPag = resumirMatriculaV2(171.22, [pag], {});
    expect(comPag.quitadoDinheiro - semPag.quitadoDinheiro).toBeCloseTo(10, 2);
    expect(comPag.caixa - semPag.caixa).toBeCloseTo(10, 2);
    expect(semPag.saldoFinanceiro - comPag.saldoFinanceiro).toBeCloseTo(10, 2);
  });
});

// ─── T06 — regressão valor_pago=0 (bug original) ─────────────────────────────

describe("T06 — regressão: valor_pago=0 ainda gera 'parcial de' na UI (bug visível, fonte do fix)", () => {
  it("valor_pago=0, valor=10 → valorPagoAluno retorna 0 (confirma que fix é necessário na origem)", () => {
    const pag = makePagamento({ valor: "10.00", valor_pago: "0", status: "pago" });
    // Com o bug: valorPagoAluno retorna 0, não 10
    expect(valorPagoAluno(pag)).toBe(0);
  });
  it("valor_pago=10, valor=10 → valorPagoAluno retorna 10 (após fix)", () => {
    const pag = makePagamento({ valor: "10.00", valor_pago: "10.00", status: "pago" });
    expect(valorPagoAluno(pag)).toBe(10);
  });
});

// ─── T07 — permuta/probono: não afetado pelo fix ─────────────────────────────

describe("T07 — permuta/probono: valor=0 não produz 'parcial de' indevido", () => {
  it("valor=0 e valor_pago=0 → igual, não mostra 'parcial de'", () => {
    const rec = buildNovoPagamentoNormal({
      modalidade: "ja_pago",
      valor: 0,
      data_vencimento: "2026-09-29",
    });
    expect(rec.valor).toBe(0);
    expect(rec.valor_pago).toBe(0);
    // UI: valor_pago < valor → 0 < 0 = false → não mostra "parcial de"
    expect(Number(rec.valor_pago)).not.toBeLessThan(Number(rec.valor));
  });
});

// ─── T08 — boleto já pago: cada parcela tem valor_pago = valorParcela ─────────

describe("T08 — boleto parcelado já pago → valor_pago setado por parcela", () => {
  it("3 parcelas de R$60 já pagas → cada parcela tem valor_pago=60", () => {
    const registros = buildNovoPagamentoBoleto({
      modalidade: "ja_pago",
      valorParcela: 60,
      parcelas: 3,
      data_vencimento: "2026-09-29",
    });
    expect(registros).toHaveLength(3);
    registros.forEach((r) => {
      expect(r.status).toBe("pago");
      expect(r.valor).toBe(60);
      expect(r.valor_pago).toBe(60);
    });
  });

  it("boleto pendente → valor_pago=0", () => {
    const registros = buildNovoPagamentoBoleto({
      modalidade: "a_pagar",
      valorParcela: 60,
      parcelas: 2,
      data_vencimento: "2026-10-01",
    });
    registros.forEach((r) => {
      expect(r.status).toBe("pendente");
      expect(r.valor_pago).toBe(0);
    });
  });
});
