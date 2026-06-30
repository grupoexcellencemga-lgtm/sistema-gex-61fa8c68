import { describe, it, expect } from "vitest";
import { calcTaxaMaquina } from "../lib/taxaMaquina";

describe("calcTaxaMaquina", () => {
  it("repasse usa gross-up por dentro (bate com a maquininha)", () => {
    // 1499 / (1 - 0,1666) = 1798,66 — mesmo valor da maquininha em 12x
    const r = calcTaxaMaquina(1499, 16.66, true);
    expect(r.valorCobrado).toBe(1798.66);
    expect(r.valorTaxa).toBe(299.66);
    expect(r.valorLiquido).toBe(1499);
  });

  it("sem repasse desconta a taxa do valor (cliente paga o valor cheio)", () => {
    const r = calcTaxaMaquina(1000, 10, false);
    expect(r.valorCobrado).toBe(1000);
    expect(r.valorTaxa).toBe(100);
    expect(r.valorLiquido).toBe(900);
  });

  it("não repassar nunca deixa o líquido negativo", () => {
    const r = calcTaxaMaquina(50, 200, false);
    expect(r.valorLiquido).toBe(0);
  });

  it("valor zero ou taxa zero não altera nada", () => {
    expect(calcTaxaMaquina(0, 16.66, true).valorCobrado).toBe(0);
    expect(calcTaxaMaquina(1000, 0, true)).toEqual({
      valorTaxa: 0,
      valorCobrado: 1000,
      valorLiquido: 1000,
    });
  });
});
