import { describe, it, expect } from "vitest";
import { calcularPrazoTarefa } from "../lib/checklistEvento";

describe("calcularPrazoTarefa", () => {
  it("pre_evento em dias subtrai da data do evento", () => {
    const r = calcularPrazoTarefa("2026-07-08", "pre_evento", 3, "dias");
    expect(r).toEqual({ data_vencimento: "2026-07-05", hora: null });
  });

  it("dia_evento com offset 0 cai no próprio dia", () => {
    const r = calcularPrazoTarefa("2026-07-08", "dia_evento", 0, "dias");
    expect(r).toEqual({ data_vencimento: "2026-07-08", hora: null });
  });

  it("pos_evento em dias soma à data do evento", () => {
    const r = calcularPrazoTarefa("2026-07-08", "pos_evento", 2, "dias");
    expect(r).toEqual({ data_vencimento: "2026-07-10", hora: null });
  });

  it("offset em horas gera hora no relógio de São Paulo", () => {
    // âncora 09:00 - 3h = 06:00 do mesmo dia
    const r = calcularPrazoTarefa("2026-07-08", "dia_evento", 3, "horas");
    expect(r).toEqual({ data_vencimento: "2026-07-08", hora: "06:00" });
  });

  it("offset em horas que cruza a meia-noite volta um dia", () => {
    // âncora 09:00 - 12h = 21:00 do dia anterior
    const r = calcularPrazoTarefa("2026-07-08", "pre_evento", 12, "horas");
    expect(r).toEqual({ data_vencimento: "2026-07-07", hora: "21:00" });
  });

  it("offset em minutos", () => {
    // âncora 09:00 - 30min = 08:30
    const r = calcularPrazoTarefa("2026-07-08", "pre_evento", 30, "minutos");
    expect(r).toEqual({ data_vencimento: "2026-07-08", hora: "08:30" });
  });

  it("virada de mês e ano funciona", () => {
    const r = calcularPrazoTarefa("2027-01-01", "pre_evento", 2, "dias");
    expect(r).toEqual({ data_vencimento: "2026-12-30", hora: null });
  });
});
