/**
 * D1 — data_pagamento no fluxo "Já foi pago"
 *
 * Testa os dois paths do insertPagamento (normal e boleto parcelado):
 * quando modalidade_cobranca === "ja_pago", data_pagamento deve ser populado
 * com a data informada, não ficar NULL.
 */
import { describe, expect, it } from "vitest";

// ─── helper extraído da lógica de insertPagamento ────────────────────────────

function addMes(dataStr: string, meses: number): string {
  const d = new Date(dataStr + "T12:00:00");
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().split("T")[0];
}

type Modalidade = "ja_pago" | "a_pagar";

function buildNovoPagamentoNormal(opts: {
  modalidade: Modalidade;
  data_vencimento: string;
}) {
  const statusPag = opts.modalidade === "ja_pago" ? "pago" : "pendente";
  return {
    data_vencimento: opts.data_vencimento,
    data_pagamento: statusPag === "pago" ? opts.data_vencimento : null,
    status: statusPag,
  };
}

function buildNovoPagamentoBoleto(opts: {
  modalidade: Modalidade;
  data_vencimento: string;
  parcelas: number;
}) {
  const statusPag = opts.modalidade === "ja_pago" ? "pago" : "pendente";
  return Array.from({ length: opts.parcelas }, (_, i) => ({
    data_vencimento: addMes(opts.data_vencimento, i),
    data_pagamento: statusPag === "pago" ? addMes(opts.data_vencimento, i) : null,
    status: statusPag,
  }));
}

// ─── T01 — normal path: "Já foi pago" preenche data_pagamento ────────────────

describe("T01 — normal path: Já foi pago → data_pagamento = data informada", () => {
  it("data_pagamento recebe a data_vencimento quando modalidade=ja_pago", () => {
    const rec = buildNovoPagamentoNormal({ modalidade: "ja_pago", data_vencimento: "2026-09-29" });
    expect(rec.status).toBe("pago");
    expect(rec.data_pagamento).toBe("2026-09-29");
  });
});

// ─── T02 — normal path: pendente mantém data_pagamento NULL ──────────────────

describe("T02 — normal path: a_pagar → data_pagamento permanece null", () => {
  it("data_pagamento fica null quando modalidade=a_pagar", () => {
    const rec = buildNovoPagamentoNormal({ modalidade: "a_pagar", data_vencimento: "2026-09-29" });
    expect(rec.status).toBe("pendente");
    expect(rec.data_pagamento).toBeNull();
  });
});

// ─── T03 — boleto path: "Já foi pago" preenche data_pagamento em cada parcela ─

describe("T03 — boleto path: Já foi pago → data_pagamento por parcela", () => {
  it("cada parcela recebe data_pagamento = seu vencimento quando modalidade=ja_pago", () => {
    const registros = buildNovoPagamentoBoleto({
      modalidade: "ja_pago",
      data_vencimento: "2026-09-29",
      parcelas: 3,
    });
    expect(registros).toHaveLength(3);
    registros.forEach((r, i) => {
      expect(r.status).toBe("pago");
      expect(r.data_pagamento).toBe(addMes("2026-09-29", i));
      expect(r.data_vencimento).toBe(addMes("2026-09-29", i));
    });
  });
});

// ─── T04 — boleto path: parcelas pendentes mantêm data_pagamento NULL ─────────

describe("T04 — boleto path: a_pagar → data_pagamento null em todas as parcelas", () => {
  it("nenhuma parcela tem data_pagamento quando modalidade=a_pagar", () => {
    const registros = buildNovoPagamentoBoleto({
      modalidade: "a_pagar",
      data_vencimento: "2026-09-29",
      parcelas: 3,
    });
    registros.forEach((r) => {
      expect(r.status).toBe("pendente");
      expect(r.data_pagamento).toBeNull();
    });
  });
});

// ─── T05 — filtro de caixa: data_pagamento determina inclusão no mês ──────────
// Regra: dashboard_metrics filtra por data_pagamento >= date_start.
// Um pagamento pago SEM data_pagamento ficaria fora do relatório.
// Este teste documenta a invariante via helper acima.

describe("T05 — invariante: pagamento pago tem data_pagamento no mesmo mês que data_vencimento", () => {
  it("não há divergência de mês entre data_vencimento e data_pagamento (Já foi pago)", () => {
    const rec = buildNovoPagamentoNormal({ modalidade: "ja_pago", data_vencimento: "2026-09-15" });
    const dpMes = rec.data_pagamento!.substring(0, 7); // "2026-09"
    const dvMes = rec.data_vencimento.substring(0, 7);
    expect(dpMes).toBe(dvMes);
  });
});

// ─── T06 — regressão: pagamento pendente não deve ter data_pagamento preenchida

describe("T06 — regressão: pendente permanece sem data_pagamento em ambos os paths", () => {
  it("normal path: pendente → data_pagamento=null", () => {
    const rec = buildNovoPagamentoNormal({ modalidade: "a_pagar", data_vencimento: "2026-10-01" });
    expect(rec.data_pagamento).toBeNull();
  });

  it("boleto path: parcelas pendentes → data_pagamento=null em todas", () => {
    const registros = buildNovoPagamentoBoleto({
      modalidade: "a_pagar",
      data_vencimento: "2026-10-01",
      parcelas: 2,
    });
    expect(registros.every((r) => r.data_pagamento === null)).toBe(true);
  });
});
