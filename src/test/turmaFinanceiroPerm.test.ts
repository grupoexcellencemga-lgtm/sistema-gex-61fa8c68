/**
 * TurmaFinanceiroTab — permuta na tabela
 *
 * Verifica que quitadoPermuta, totalQuitado e saldoFinanceiro são
 * computados corretamente por resumirMatriculaV2 nos 5 cenários da tabela
 * e que getSituacao retorna o status correto para cada um.
 */
import { describe, expect, it } from "vitest";
import { resumirMatriculaV2 } from "../lib/alunoFinanceiro";
import type { PermutaItem } from "../lib/alunoFinanceiro";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makePix(valor: number, status: "pago" | "pendente" = "pago") {
  return {
    id: `pix-${valor}`,
    status,
    forma_pagamento: "pix",
    valor: String(valor),
    valor_pago: status === "pago" ? String(valor) : null,
    taxa_cartao: null,
    taxa_valor: null,
    taxa_absorvida_por: null,
    data_pagamento: status === "pago" ? "2026-09-29" : null,
    data_vencimento: "2026-09-29",
    deleted_at: null,
  };
}

function makePermuta(id: string, valor: number) {
  return {
    id,
    status: "pago" as const,
    forma_pagamento: "permuta",
    valor: String(valor),
    valor_pago: null,
    taxa_cartao: null,
    taxa_valor: null,
    taxa_absorvida_por: null,
    data_pagamento: "2026-09-29",
    data_vencimento: "2026-09-29",
    deleted_at: null,
  };
}

function makePermutaItens(pagId: string, valor: number): Record<string, PermutaItem[]> {
  return {
    [pagId]: [
      {
        id: `item-${pagId}`,
        pagamento_id: pagId,
        valor: String(valor),
        status: "entregue",
        deleted_at: null,
      },
    ],
  };
}

// getSituacao inline (espelha a implementação do componente)
type SituacaoAluno = "gratuito" | "pago" | "parcial" | "pendente" | "vencido";
function getSituacao(pago: number, pendente: number, vencido: number, contratado: number): SituacaoAluno {
  if (contratado === 0 && pago === 0) return "gratuito";
  if (vencido > 0) return "vencido";
  if (contratado > 0 && pago >= contratado) return "pago";
  if (pago > 0 && pago < contratado) return "parcial";
  if (pendente > 0 || vencido > 0) return "pendente";
  return "pendente";
}

// ─── Caso Douglas: contratado=1970, só permuta R$60 ──────────────────────────

describe("Douglas Kolodziej — só permuta R$60, contratado R$1970", () => {
  it("quitadoDinheiro=0, quitadoPermuta=60, totalQuitado=60, saldoFinanceiro=1910", () => {
    const pagPermuta = makePermuta("perm-douglas", 60);
    const itens = makePermutaItens("perm-douglas", 60);
    const resumo = resumirMatriculaV2(1970, [pagPermuta], itens);

    expect(resumo.quitadoDinheiro).toBe(0);
    expect(resumo.quitadoPermuta).toBe(60);
    expect(resumo.totalQuitado).toBe(60);
    expect(resumo.saldoFinanceiro).toBe(1910);
  });

  it("getSituacao(60, pendente, 0, 1970) → parcial", () => {
    expect(getSituacao(60, 1910, 0, 1970)).toBe("parcial");
  });
});

// ─── T01: Cenário A — só dinheiro ─────────────────────────────────────────────

describe("Cenário A — só dinheiro R$100, contratado R$1970", () => {
  it("quitadoDinheiro=100, quitadoPermuta=0, totalQuitado=100, saldoFinanceiro=1870", () => {
    const pag = makePix(100);
    const resumo = resumirMatriculaV2(1970, [pag], {});

    expect(resumo.quitadoDinheiro).toBe(100);
    expect(resumo.quitadoPermuta).toBe(0);
    expect(resumo.totalQuitado).toBe(100);
    expect(resumo.saldoFinanceiro).toBe(1870);
  });

  it("getSituacao(100, 1870, 0, 1970) → parcial", () => {
    expect(getSituacao(100, 1870, 0, 1970)).toBe("parcial");
  });
});

// ─── T02: Cenário B — dinheiro + permuta ──────────────────────────────────────

describe("Cenário B — dinheiro R$100 + permuta R$60, contratado R$1970", () => {
  it("quitadoDinheiro=100, quitadoPermuta=60, totalQuitado=160, saldoFinanceiro=1810", () => {
    const pagPix = makePix(100);
    const pagPerm = makePermuta("perm-b", 60);
    const itens = makePermutaItens("perm-b", 60);
    const resumo = resumirMatriculaV2(1970, [pagPix, pagPerm], itens);

    expect(resumo.quitadoDinheiro).toBe(100);
    expect(resumo.quitadoPermuta).toBe(60);
    expect(resumo.totalQuitado).toBe(160);
    expect(resumo.saldoFinanceiro).toBe(1810);
  });

  it("getSituacao(160, 1810, 0, 1970) → parcial", () => {
    expect(getSituacao(160, 1810, 0, 1970)).toBe("parcial");
  });
});

// ─── T03: Cenário C — só permuta ──────────────────────────────────────────────

describe("Cenário C — só permuta R$60, contratado R$1970 (regressão Douglas)", () => {
  it("quitadoDinheiro=0, quitadoPermuta=60, totalQuitado=60", () => {
    const pagPerm = makePermuta("perm-c", 60);
    const itens = makePermutaItens("perm-c", 60);
    const resumo = resumirMatriculaV2(1970, [pagPerm], itens);

    expect(resumo.quitadoDinheiro).toBe(0);
    expect(resumo.quitadoPermuta).toBe(60);
    expect(resumo.totalQuitado).toBe(60);
    expect(resumo.saldoFinanceiro).toBe(1910);
  });
});

// ─── T04: Cenário D — nada pago ───────────────────────────────────────────────

describe("Cenário D — nada pago, contratado R$1970", () => {
  it("tudo zero, saldoFinanceiro=1970", () => {
    const resumo = resumirMatriculaV2(1970, [], {});

    expect(resumo.quitadoDinheiro).toBe(0);
    expect(resumo.quitadoPermuta).toBe(0);
    expect(resumo.totalQuitado).toBe(0);
    expect(resumo.saldoFinanceiro).toBe(1970);
  });

  it("getSituacao(0, 1970, 0, 1970) → pendente", () => {
    expect(getSituacao(0, 1970, 0, 1970)).toBe("pendente");
  });
});

// ─── T05: Cenário E — quitado total com dinheiro ──────────────────────────────

describe("Cenário E — quitado total dinheiro R$1970", () => {
  it("saldoFinanceiro=0, status=pago", () => {
    const pag = makePix(1970);
    const resumo = resumirMatriculaV2(1970, [pag], {});

    expect(resumo.quitadoDinheiro).toBe(1970);
    expect(resumo.quitadoPermuta).toBe(0);
    expect(resumo.totalQuitado).toBe(1970);
    expect(resumo.saldoFinanceiro).toBe(0);
  });

  it("getSituacao(1970, 0, 0, 1970) → pago", () => {
    expect(getSituacao(1970, 0, 0, 1970)).toBe("pago");
  });
});

// ─── T06: Cenário E2 — quitado total via permuta ─────────────────────────────

describe("Cenário E2 — quitado total só permuta R$1970", () => {
  it("saldoFinanceiro=0, quitadoDinheiro=0, status=pago", () => {
    const pagPerm = makePermuta("perm-e2", 1970);
    const itens = makePermutaItens("perm-e2", 1970);
    const resumo = resumirMatriculaV2(1970, [pagPerm], itens);

    expect(resumo.quitadoDinheiro).toBe(0);
    expect(resumo.quitadoPermuta).toBe(1970);
    expect(resumo.totalQuitado).toBe(1970);
    expect(resumo.saldoFinanceiro).toBe(0);
  });

  it("getSituacao(1970, 0, 0, 1970) → pago (permuta como totalQuitado)", () => {
    expect(getSituacao(1970, 0, 0, 1970)).toBe("pago");
  });
});

// ─── T07: Permuta parcialmente entregue ──────────────────────────────────────

describe("T07 — permuta parcialmente entregue: acordado não conta como quitado", () => {
  it("item 'acordado' não incrementa quitadoPermuta", () => {
    const pagPerm = makePermuta("perm-t7", 60);
    const itensAcordado: Record<string, PermutaItem[]> = {
      "perm-t7": [
        {
          id: "item-t7",
          pagamento_id: "perm-t7",
          valor: "60",
          status: "acordado",
          deleted_at: null,
        },
      ],
    };
    const resumo = resumirMatriculaV2(1970, [pagPerm], itensAcordado);

    expect(resumo.quitadoPermuta).toBe(0);
    expect(resumo.valorPermutaPendenteEntrega).toBe(60);
    expect(resumo.totalQuitado).toBe(0);
    expect(resumo.saldoFinanceiro).toBe(1970);
  });
});
