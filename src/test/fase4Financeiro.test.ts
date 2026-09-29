import { describe, it, expect } from "vitest";
import { resumirMatriculaV2, PermutaItem } from "@/lib/alunoFinanceiro";

// Cenário canônico Fase 4:
// contrato=5000, PIX pago=1000, permuta entregue=1200, permuta acordada=800
// Esperado:
//   caixa=1000, quitado_dinheiro=1000, quitado_permuta=1200
//   total_quitado=2200, permuta_pendente=800
//   saldo_financeiro=2800, saldo_disponivel=2000

function makePix(id: string, valor: number): any {
  return {
    id,
    forma_pagamento: "pix",
    status: "pago",
    valor,
    valor_pago: valor,
    taxa_absorvida_por: null,
    taxa_valor: null,
    gera_caixa: true,
    deleted_at: null,
  };
}

function makePermuta(id: string, valor: number): any {
  return {
    id,
    forma_pagamento: "permuta",
    status: "pendente_permuta",
    valor,
    valor_pago: null,
    gera_caixa: false,
    deleted_at: null,
  };
}

describe("resumirMatriculaV2 — Fase 4 cenário canônico", () => {
  const pix = makePix("pag-pix-1", 1000);
  const permEntregue = makePermuta("pag-perm-1", 1200);
  const permAcordada = makePermuta("pag-perm-2", 800);

  const itens: Record<string, PermutaItem[]> = {
    "pag-perm-1": [
      { id: "item-1", pagamento_id: "pag-perm-1", valor: 1200, status: "entregue" },
    ],
    "pag-perm-2": [
      { id: "item-2", pagamento_id: "pag-perm-2", valor: 800, status: "acordado" },
    ],
  };

  const resumo = resumirMatriculaV2(5000, [pix, permEntregue, permAcordada], itens);

  it("quitadoDinheiro = 1000 (só PIX)", () => {
    expect(resumo.quitadoDinheiro).toBe(1000);
  });

  it("caixa = 1000 (gera_caixa=true)", () => {
    expect(resumo.caixa).toBe(1000);
  });

  it("quitadoPermuta = 1200 (só entregue)", () => {
    expect(resumo.quitadoPermuta).toBe(1200);
  });

  it("totalQuitado = 2200 (dinheiro + permuta entregue)", () => {
    expect(resumo.totalQuitado).toBe(2200);
  });

  it("valorPermutaPendenteEntrega = 800 (acordado não entregue)", () => {
    expect(resumo.valorPermutaPendenteEntrega).toBe(800);
  });

  it("saldoFinanceiro = 2800 (5000 - 2200)", () => {
    expect(resumo.saldoFinanceiro).toBe(2800);
  });

  it("saldoDisponivelNovoPagamento = 2000 (2800 - 800 acordado)", () => {
    expect(resumo.saldoDisponivelNovoPagamento).toBe(2000);
  });
});

describe("resumirMatriculaV2 — edge cases", () => {
  it("probono não entra no caixa e não entra em quitadoDinheiro", () => {
    const probono: any = {
      id: "pag-pb-1",
      forma_pagamento: "probono",
      status: "pago",
      valor: 500,
      valor_pago: 500,
      gera_caixa: false,
      deleted_at: null,
    };
    const resumo = resumirMatriculaV2(500, [probono], {});
    expect(resumo.caixa).toBe(0);
    expect(resumo.quitadoDinheiro).toBe(0);       // não é monetário
    expect(resumo.quitadoNaoMonetario).toBe(500); // gratuidade quita a obrigação
    expect(resumo.totalQuitado).toBe(500);
    expect(resumo.saldoFinanceiro).toBe(0);
  });

  it("permuta acordada não entra em quitadoPermuta", () => {
    const perm: any = makePermuta("pag-perm-x", 300);
    const itens: Record<string, PermutaItem[]> = {
      "pag-perm-x": [
        { id: "item-x", pagamento_id: "pag-perm-x", valor: 300, status: "acordado" },
      ],
    };
    const resumo = resumirMatriculaV2(1000, [perm], itens);
    expect(resumo.quitadoPermuta).toBe(0);
    expect(resumo.valorPermutaPendenteEntrega).toBe(300);
  });

  it("PIX pendente não entra no caixa", () => {
    const pixPendente: any = {
      id: "pag-pix-pend",
      forma_pagamento: "pix",
      status: "pendente",
      valor: 800,
      valor_pago: null,
      gera_caixa: true,
      deleted_at: null,
    };
    const resumo = resumirMatriculaV2(800, [pixPendente], {});
    expect(resumo.caixa).toBe(0);
    expect(resumo.quitadoDinheiro).toBe(0);
    expect(resumo.saldoFinanceiro).toBe(800);
  });

  it("duas matrículas não se contaminam (V2 é por chamada)", () => {
    const pix1 = makePix("m1-pix", 500);
    const resumo1 = resumirMatriculaV2(1000, [pix1], {});

    const pix2 = makePix("m2-pix", 200);
    const perm2 = makePermuta("m2-perm", 400);
    const itens2: Record<string, PermutaItem[]> = {
      "m2-perm": [{ id: "m2-item", pagamento_id: "m2-perm", valor: 400, status: "entregue" }],
    };
    const resumo2 = resumirMatriculaV2(1000, [pix2, perm2], itens2);

    expect(resumo1.caixa).toBe(500);
    expect(resumo2.caixa).toBe(200);
    expect(resumo2.totalQuitado).toBe(600);
    // Verificar que resumo1 não foi afetado
    expect(resumo1.totalQuitado).toBe(500);
  });

  it("pagamentos legados monetários (sem gera_caixa explícito) ainda entram no caixa", () => {
    const legado: any = {
      id: "pag-legado",
      forma_pagamento: "cartao",
      status: "pago",
      valor: 700,
      valor_pago: 700,
      gera_caixa: undefined, // legado sem o campo
      deleted_at: null,
    };
    const resumo = resumirMatriculaV2(700, [legado], {});
    // gera_caixa=undefined (não é false), logo entra no caixa
    expect(resumo.caixa).toBe(700);
    expect(resumo.quitadoDinheiro).toBe(700);
  });
});
