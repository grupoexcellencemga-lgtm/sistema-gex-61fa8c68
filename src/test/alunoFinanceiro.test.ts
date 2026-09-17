import { describe, expect, it } from "vitest";
import { calcularPagamentoParcial, resumirMatricula, ordenarPagamentos, valorPagoAluno } from "@/lib/alunoFinanceiro";

describe("financeiro da matrícula", () => {
  it("abate entrada e pagamentos sucessivos até quitar o curso", () => {
    const entrada = calcularPagamentoParcial(1970, 197);
    expect(entrada).toEqual({ pago: 197, restante: 1773 });
    const segundo = calcularPagamentoParcial(entrada.restante, 600);
    expect(segundo).toEqual({ pago: 600, restante: 1173 });
    expect(resumirMatricula(1970, [
      { status: "pago", valor: entrada.pago, forma_pagamento: "credito" },
      { status: "pago", valor: segundo.pago, forma_pagamento: "pix" },
      { status: "pendente", valor: segundo.restante },
    ])).toEqual({ total: 1970, pago: 797, pendente: 1173 });
    expect(calcularPagamentoParcial(segundo.restante, 1173).restante).toBe(0);
  });

  it("não desconta a taxa da empresa do que o aluno quitou", () => {
    expect(valorPagoAluno({ status: "pago", valor: 197, taxa_valor: 5.3, taxa_absorvida_por: "empresa" })).toBe(197);
  });

  it("considera valor_pago em registros antigos de pagamento parcial", () => {
    expect(resumirMatricula(1970, [{ status: "pago", valor: 1970, valor_pago: 197 }]).pendente).toBe(1773);
  });

  it("mantém centavos pendentes e não arredonda dívidas pequenas para zero", () => {
    expect(resumirMatricula(100, [{ status: "pago", valor: 99.95 }]).pendente).toBe(0.05);
    expect(calcularPagamentoParcial(0.3, 0.1).restante).toBe(0.2);
  });

  it.each([0, -1, NaN, Infinity, 1970.01])("rejeita valor recebido inválido: %s", (recebido) => {
    expect(() => calcularPagamentoParcial(1970, recebido)).toThrow();
  });

  it("ordena pendências por vencimento antes de todo o histórico pago sem alterar os dados", () => {
    const rows = [
      { id: "pix", status: "pago", valor: 600, data_pagamento: "2026-08-27" },
      { id: "futuro", status: "pendente", valor: 500, data_vencimento: "2026-10-20" },
      { id: "entrada", status: "pago", valor: 197, data_pagamento: "2026-08-18" },
      { id: "vencido", status: "vencido", valor: 673, data_vencimento: "2026-08-20" },
    ];
    expect(ordenarPagamentos(rows).map(p => p.id)).toEqual(["vencido", "futuro", "pix", "entrada"]);
    expect(rows[0].id).toBe("pix");
  });
});
