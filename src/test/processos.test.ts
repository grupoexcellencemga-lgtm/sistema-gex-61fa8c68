import { describe, it, expect } from "vitest";
import { calcularProgressoFinanceiro, formatarProgressoSessoes, getDateRange } from "../components/processos/processosUtils";

describe("calcularProgressoFinanceiro", () => {
  it("calculates percentage correctly", () => {
    expect(calcularProgressoFinanceiro(1000, 250)).toBe(25);
  });

  it("does not exceed 100%", () => {
    expect(calcularProgressoFinanceiro(1000, 1500)).toBe(100);
  });

  it("returns zero if total is zero or negative", () => {
    expect(calcularProgressoFinanceiro(0, 100)).toBe(0);
    expect(calcularProgressoFinanceiro(-500, 100)).toBe(0);
  });

  it("returns zero if received is zero", () => {
    expect(calcularProgressoFinanceiro(1000, 0)).toBe(0);
  });

  it("rounds the percentage to nearest integer", () => {
    expect(calcularProgressoFinanceiro(33, 11)).toBe(33); // 33.333 -> 33
  });
});

describe("formatarProgressoSessoes", () => {
  it("formats text correctly", () => {
    expect(formatarProgressoSessoes(3, 10)).toBe("3/10");
  });

  it("forces minimum of zero for realizadas", () => {
    expect(formatarProgressoSessoes(-2, 10)).toBe("0/10");
  });

  it("forces minimum of one for total", () => {
    expect(formatarProgressoSessoes(0, 0)).toBe("0/1");
    expect(formatarProgressoSessoes(0, -5)).toBe("0/1");
  });

  it("handles larger realize than total", () => {
    expect(formatarProgressoSessoes(12, 10)).toBe("12/10");
  });

  it("handles zeroes", () => {
    expect(formatarProgressoSessoes(0, 5)).toBe("0/5");
  });
});

describe("getDateRange", () => {
  const currentYear = new Date().getFullYear();

  it("returns null for 'todos'", () => {
    expect(getDateRange("todos")).toBeNull();
  });

  it("returns start and end for 'ano_atual'", () => {
    const range = getDateRange("ano_atual");
    expect(range?.start).toBe(`${currentYear}-01-01`);
    expect(range?.end).toBe(`${currentYear}-12-31`);
  });

  it("returns fallback null for unknown period", () => {
    expect(getDateRange("invalid_period")).toBeNull();
  });
});
