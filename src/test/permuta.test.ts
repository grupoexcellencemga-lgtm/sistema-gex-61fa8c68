import { describe, expect, it } from "vitest";
import {
  resumirMatriculaV2,
  statusPermutaDerived,
  validarSomaItensPermuta,
  type PermutaItem,
} from "@/lib/alunoFinanceiro";

// ─── Helpers de fixture ───────────────────────────────────────────────────────

type P = Parameters<typeof resumirMatriculaV2>[1][0];

function pix(id: string, status: string, valor: number, valorPago?: number): P {
  return { id, status, valor, forma_pagamento: "pix", gera_caixa: true, valor_pago: valorPago ?? valor };
}

function permuta(id: string, status: string, valor: number): P {
  return { id, status, valor, forma_pagamento: "permuta", gera_caixa: false };
}

function item(pagamento_id: string, valor: number, status: PermutaItem["status"]): PermutaItem {
  return { pagamento_id, valor, status };
}

// ─── Grupo A: resumirMatriculaV2() ───────────────────────────────────────────

describe("resumirMatriculaV2 — pagamentos monetários", () => {
  it("T01 backward-compat: PIX pago conta em quitadoDinheiro e caixa", () => {
    const r = resumirMatriculaV2(1000, [pix("p1", "pago", 500)], {});
    expect(r.quitadoDinheiro).toBe(500);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(500);
    expect(r.saldoFinanceiro).toBe(500);
    expect(r.valorPermutaPendenteEntrega).toBe(0);
    expect(r.saldoDisponivelNovoPagamento).toBe(500);
    expect(r.caixa).toBe(500);
  });

  it("T09 PIX pendente não quita e não entra em caixa", () => {
    const r = resumirMatriculaV2(1000, [pix("p1", "pendente", 500)], {});
    expect(r.quitadoDinheiro).toBe(0);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(0);
    expect(r.saldoFinanceiro).toBe(1000);
    expect(r.valorPermutaPendenteEntrega).toBe(0);
    expect(r.saldoDisponivelNovoPagamento).toBe(1000);
    expect(r.caixa).toBe(0);
  });

  it("T08 pagamento cancelado não conta", () => {
    const r = resumirMatriculaV2(1000, [{ ...pix("p1", "cancelado", 500), status: "cancelado" }], {});
    expect(r.totalQuitado).toBe(0);
    expect(r.saldoFinanceiro).toBe(1000);
    expect(r.caixa).toBe(0);
  });
});

describe("resumirMatriculaV2 — permuta", () => {
  it("T02 permuta toda acordada: quitadoPermuta=0, saldo comprometido inteiro", () => {
    const itens = {
      p1: [item("p1", 1200, "acordado"), item("p1", 800, "acordado")],
    };
    const r = resumirMatriculaV2(2000, [permuta("p1", "pendente_permuta", 2000)], itens);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(0);
    expect(r.saldoFinanceiro).toBe(2000);
    expect(r.valorPermutaPendenteEntrega).toBe(2000);
    expect(r.saldoDisponivelNovoPagamento).toBe(0);
    expect(r.caixa).toBe(0);
  });

  it("T03 entrega parcial + PIX: cálculos corretos", () => {
    const pagamentos = [
      permuta("p1", "pendente_permuta", 2000),
      pix("p2", "pago", 1000),
    ];
    const itens = {
      p1: [item("p1", 1200, "entregue"), item("p1", 800, "acordado")],
    };
    const r = resumirMatriculaV2(5000, pagamentos, itens);
    expect(r.quitadoDinheiro).toBe(1000);
    expect(r.quitadoPermuta).toBe(1200);
    expect(r.totalQuitado).toBe(2200);
    expect(r.saldoFinanceiro).toBe(2800);
    expect(r.valorPermutaPendenteEntrega).toBe(800);
    expect(r.saldoDisponivelNovoPagamento).toBe(2000);
    expect(r.caixa).toBe(1000);
  });

  it("T04 permuta toda entregue: saldo zerado, sem caixa", () => {
    const itens = {
      p1: [item("p1", 1200, "entregue"), item("p1", 800, "entregue")],
    };
    const r = resumirMatriculaV2(2000, [permuta("p1", "pago", 2000)], itens);
    expect(r.quitadoPermuta).toBe(2000);
    expect(r.totalQuitado).toBe(2000);
    expect(r.saldoFinanceiro).toBe(0);
    expect(r.valorPermutaPendenteEntrega).toBe(0);
    expect(r.saldoDisponivelNovoPagamento).toBe(0);
    expect(r.caixa).toBe(0);
  });

  it("T05 item cancelado: não quita, não compromete saldo", () => {
    const itens = { p1: [item("p1", 2000, "cancelado")] };
    const r = resumirMatriculaV2(2000, [permuta("p1", "pendente_permuta", 2000)], itens);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.valorPermutaPendenteEntrega).toBe(0);
    expect(r.saldoDisponivelNovoPagamento).toBe(2000);
    expect(r.caixa).toBe(0);
  });

  it("T06 múltiplos pagamentos de permuta", () => {
    const pagamentos = [
      permuta("p1", "pendente_permuta", 2000),
      permuta("p2", "pendente_permuta", 1000),
    ];
    const itens = {
      p1: [item("p1", 2000, "entregue")],
      p2: [item("p2", 1000, "acordado")],
    };
    const r = resumirMatriculaV2(5000, pagamentos, itens);
    expect(r.quitadoPermuta).toBe(2000);
    expect(r.totalQuitado).toBe(2000);
    expect(r.valorPermutaPendenteEntrega).toBe(1000);
    expect(r.saldoFinanceiro).toBe(3000);
    expect(r.saldoDisponivelNovoPagamento).toBe(2000);
    expect(r.caixa).toBe(0);
  });

  it("T07 arredondamento por centavos: 166.67 + 166.67 = 333.34 (não 333.34000...)", () => {
    const itens = {
      p1: [item("p1", 166.67, "entregue"), item("p1", 166.67, "entregue")],
    };
    const r = resumirMatriculaV2(1000, [permuta("p1", "pendente_permuta", 333.34)], itens);
    expect(r.quitadoPermuta).toBe(333.34);
    expect(r.saldoFinanceiro).toBe(666.66);
  });
});

// ─── Grupo B: statusPermutaDerived() ─────────────────────────────────────────

describe("statusPermutaDerived", () => {
  it("T10 lista vazia → cancelado", () => {
    expect(statusPermutaDerived([])).toBe("cancelado");
  });

  it("T11 todos acordados → pendente_permuta", () => {
    expect(statusPermutaDerived([
      item("p1", 1000, "acordado"),
      item("p1", 500, "acordado"),
    ])).toBe("pendente_permuta");
  });

  it("T12 todos entregues → pago", () => {
    expect(statusPermutaDerived([
      item("p1", 1000, "entregue"),
      item("p1", 500, "entregue"),
    ])).toBe("pago");
  });

  it("T13 mix acordado+entregue → pendente_permuta (acordado tem prioridade)", () => {
    expect(statusPermutaDerived([
      item("p1", 500, "entregue"),
      item("p1", 500, "acordado"),
    ])).toBe("pendente_permuta");
  });

  it("T14 todos cancelados → cancelado", () => {
    expect(statusPermutaDerived([
      item("p1", 1000, "cancelado"),
    ])).toBe("cancelado");
  });

  it("T15 entregue + cancelado (sem acordado) → pago", () => {
    expect(statusPermutaDerived([
      item("p1", 500, "entregue"),
      item("p1", 500, "cancelado"),
    ])).toBe("pago");
  });
});

// ─── Grupo C: validarSomaItensPermuta() ──────────────────────────────────────

describe("validarSomaItensPermuta", () => {
  it("T16 soma correta → valido:true, diferenca:0", () => {
    const r = validarSomaItensPermuta(2000, [{ valor: 1200 }, { valor: 800 }]);
    expect(r.valido).toBe(true);
    expect(r.soma).toBe(2000);
    expect(r.diferenca).toBe(0);
  });

  it("T17 soma incorreta → valido:false, diferenca:100", () => {
    const r = validarSomaItensPermuta(2000, [{ valor: 1200 }, { valor: 900 }]);
    expect(r.valido).toBe(false);
    expect(r.soma).toBe(2100);
    expect(r.diferenca).toBe(100);
  });

  it("T18 arredondamento de centavos: 0.10+0.20=0.30 sem erro de float", () => {
    // Sem comparação em centavos: 0.10 + 0.20 = 0.30000000000000004 ≠ 0.30
    const r = validarSomaItensPermuta(0.30, [{ valor: 0.10 }, { valor: 0.20 }]);
    expect(r.valido).toBe(true);
  });
});

// ─── Grupo D: valor zero — nova regra (Fase 4.7.1) ───────────────────────────

describe("permuta valor zero — nova regra aceita >= 0", () => {
  // A) total R$0 com 1 item R$0 — validarSoma válida
  it("T19 (A) validarSomaItensPermuta(0, [{valor:0}]): válido", () => {
    const r = validarSomaItensPermuta(0, [{ valor: 0 }]);
    expect(r.valido).toBe(true);
    expect(r.soma).toBe(0);
    expect(r.diferenca).toBe(0);
  });

  // B) total R$0 com 3 itens R$0 — validarSoma válida
  it("T20 (B) validarSomaItensPermuta(0, [0,0,0]): válido", () => {
    const r = validarSomaItensPermuta(0, [{ valor: 0 }, { valor: 0 }, { valor: 0 }]);
    expect(r.valido).toBe(true);
    expect(r.soma).toBe(0);
  });

  // C) item com valor negativo: soma diverge do total esperado → rejeita no frontend
  it("T21 (C) item negativo: validarSoma detecta divergência (valido=false)", () => {
    const r = validarSomaItensPermuta(0, [{ valor: -10 }]);
    // soma=-10 ≠ total=0
    expect(r.valido).toBe(false);
    expect(r.soma).toBe(-10);
    expect(r.diferenca).toBe(10);
  });

  // E) permuta R$0 entregue: quitadoPermuta permanece 0
  it("T22 (E) permuta R$0 entregue: quitadoPermuta=0", () => {
    const itens = { p0: [item("p0", 0, "entregue")] };
    const r = resumirMatriculaV2(1000, [permuta("p0", "pago", 0)], itens);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(0);
  });

  // F) permuta R$0 entregue: saldoFinanceiro inalterado
  it("T23 (F) permuta R$0 entregue: saldoFinanceiro = valor_contratado", () => {
    const itens = { p0: [item("p0", 0, "entregue")] };
    const r = resumirMatriculaV2(1000, [permuta("p0", "pago", 0)], itens);
    expect(r.saldoFinanceiro).toBe(1000);
    expect(r.saldoDisponivelNovoPagamento).toBe(1000);
  });

  // G) permuta R$0: caixa=0
  it("T24 (G) permuta R$0: não entra em caixa", () => {
    const itens = { p0: [item("p0", 0, "entregue")] };
    const r = resumirMatriculaV2(500, [permuta("p0", "pago", 0)], itens);
    expect(r.caixa).toBe(0);
  });

  // E+F mix: permuta R$0 com PIX pago — saldo e caixa refletem só o PIX
  it("T25 permuta R$0 + PIX pago: saldo e caixa refletem só o PIX", () => {
    const itens = { p0: [item("p0", 0, "entregue")] };
    const r = resumirMatriculaV2(1000, [permuta("p0", "pago", 0), pix("pix1", "pago", 400)], itens);
    expect(r.quitadoDinheiro).toBe(400);
    expect(r.quitadoPermuta).toBe(0);
    expect(r.totalQuitado).toBe(400);
    expect(r.saldoFinanceiro).toBe(600);
    expect(r.caixa).toBe(400);
  });

  // I) lista vazia com valor 0: validarSoma retorna valid (a checagem de itens_vazios fica no RPC/Modal)
  it("T26 (I) validarSomaItensPermuta(0, []): soma=0, valido=true (lista vazia checada pelo RPC)", () => {
    const r = validarSomaItensPermuta(0, []);
    // A função de soma não verifica se há itens; essa validação é do RPC e do PermutaModal
    expect(r.valido).toBe(true);
    expect(r.soma).toBe(0);
  });

  // Permuta R$0 acordada: não compromete saldoDisponivel
  it("T27 permuta R$0 acordada: saldoDisponivel não reduzido", () => {
    const itens = { p0: [item("p0", 0, "acordado")] };
    const r = resumirMatriculaV2(1000, [permuta("p0", "pendente_permuta", 0)], itens);
    expect(r.valorPermutaPendenteEntrega).toBe(0);
    expect(r.saldoDisponivelNovoPagamento).toBe(1000);
    expect(r.saldoFinanceiro).toBe(1000);
  });
});
