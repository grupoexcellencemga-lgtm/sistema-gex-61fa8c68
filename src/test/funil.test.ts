import { describe, it, expect } from "vitest";
import { calcularTaxaConversao, calcularTempoMedioConversao } from "../components/funil/funilUtils";

describe("calcularTaxaConversao", () => {
  it("calculates correct conversion rate", () => {
    expect(calcularTaxaConversao(100, 25)).toBe("25.0");
  });

  it("handles decimal results correctly", () => {
    expect(calcularTaxaConversao(3, 1)).toBe("33.3");
  });

  it("returns zero when no total leads", () => {
    expect(calcularTaxaConversao(0, 0)).toBe("0.0");
    expect(calcularTaxaConversao(-5, 2)).toBe("0.0");
  });

  it("handles cases where converted is zero", () => {
    expect(calcularTaxaConversao(100, 0)).toBe("0.0");
  });

  it("handles more converted than total gracefully", () => {
    expect(calcularTaxaConversao(50, 100)).toBe("200.0");
  });
});

describe("calcularTempoMedioConversao", () => {
  it("calculates average time correctly", () => {
    expect(calcularTempoMedioConversao([2, 4, 6])).toBe(4);
  });

  it("rounds values to nearest integer", () => {
    expect(calcularTempoMedioConversao([1, 2])).toBe(2); // 1.5 -> 2
    expect(calcularTempoMedioConversao([1, 1, 2])).toBe(1); // 1.33 -> 1
  });

  it("returns zero for empty array", () => {
    expect(calcularTempoMedioConversao([])).toBe(0);
  });

  it("calculates time for single item", () => {
    expect(calcularTempoMedioConversao([5])).toBe(5);
  });

  it("handles zero times", () => {
    expect(calcularTempoMedioConversao([0, 0, 0])).toBe(0);
  });
});
