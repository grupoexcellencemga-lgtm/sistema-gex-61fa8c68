/**
 * Centralized formatting & parsing utilities for the entire application.
 * Import from "@/lib/formatters" instead of defining locally.
 */

// ─── Currency ───

/** Format a number as BRL currency string: R$ 1.234,56 */
export const formatCurrency = (v: number): string =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/** Format nullable number as BRL currency (nulls → R$ 0,00) */
export const formatCurrencyNullable = (v: number | null): string =>
  formatCurrency(v ?? 0);

/** Parse a Brazilian currency string "1.234,56" → 1234.56 */
export const parseCurrencyToNumber = (v: string): number => {
  const clean = v.replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

/** Live mask for currency input fields: digits → "1.234,56" */
export const formatCurrencyInput = (v: string): string => {
  let digits = v.replace(/\D/g, "");
  if (!digits) return "";
  digits = digits.padStart(3, "0");
  const intPart = digits.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const decPart = digits.slice(-2);
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted},${decPart}`;
};

// ─── Dates ───

/** Format ISO date string as dd/mm/yyyy (adds T12:00 to avoid timezone shift). Returns "—" for null. */
export const formatDate = (d: string | null): string => {
  if (!d) return "—";
  try {
    // Extract just the YYYY-MM-DD part to avoid timezone issues
    const dateOnly = d.substring(0, 10);
    const [year, month, day] = dateOnly.split("-").map(Number);
    if (!year || !month || !day) return d;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  } catch {
    return d;
  }
};

// ─── Documents (CPF / CNPJ) ───

/** Mask CPF: 000.000.000-00 */
export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

/** Mask CNPJ: 00.000.000/0000-00 */
export const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

// ─── Phone ───

/** Mask phone: (00) 00000-0000 */
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};
