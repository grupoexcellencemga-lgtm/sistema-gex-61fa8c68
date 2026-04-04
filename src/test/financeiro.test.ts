import { describe, it, expect } from "vitest";
import { calcularComissao, calcularTaxaMaquininha, calcularValorLiquido } from "../lib/financeiroCalcs";

describe("calcularComissao", () => {
  it("calculates positive values correctly", () => {
    expect(calcularComissao(1000, 5)).toBe(50);
  });

  it("handles decimal values", () => {
    expect(calcularComissao(150.5, 2.5)).toBe(3.76); // 150.5 * 0.025 = 3.7625 -> 3.76
  });

  it("returns zero for zero or negative values", () => {
    expect(calcularComissao(0, 10)).toBe(0);
    expect(calcularComissao(-100, 10)).toBe(0);
  });

  it("returns zero for zero or negative percentage", () => {
    expect(calcularComissao(100, 0)).toBe(0);
    expect(calcularComissao(100, -5)).toBe(0);
  });
});

describe("calcularTaxaMaquininha", () => {
  it("calculates percentage correctly", () => {
    expect(calcularTaxaMaquininha(100, 1.5)).toBe(1.5);
  });

  it("handles zero or negative values gracefully", () => {
    expect(calcularTaxaMaquininha(-50, 2)).toBe(0);
    expect(calcularTaxaMaquininha(100, 0)).toBe(0);
  });
});

describe("calcularValorLiquido", () => {
  it("subtracts taxa correctly", () => {
    expect(calcularValorLiquido(100, 2.5)).toBe(97.5);
  });

  it("returns zero if gross value is zero or negative", () => {
    expect(calcularValorLiquido(0, 10)).toBe(0);
    expect(calcularValorLiquido(-100, 10)).toBe(0);
  });

  it("handles negative taxa (treats as zero tax)", () => {
    expect(calcularValorLiquido(100, -5)).toBe(100);
  });

  it("does not return negative liquid value if tax is greater than gross", () => {
    expect(calcularValorLiquido(50, 100)).toBe(0);
  });
});
