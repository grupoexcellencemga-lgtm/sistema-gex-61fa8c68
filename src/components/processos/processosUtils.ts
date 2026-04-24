// Re-export all formatters from centralized location
export { formatCurrency, formatDate, formatCPF, formatPhone, parseCurrencyToNumber, formatCurrencyInput } from "@/lib/formatters";

export const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  aberto: { label: "Aberto", variant: "default" },
  finalizado: { label: "Finalizado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  pausado: { label: "Pausado", variant: "outline" },
};

export const periodoLabels: Record<string, string> = {
  mes_atual: "Mês Atual",
  mes_passado: "Mês Passado",
  trimestre: "Últimos 3 Meses",
  semestre: "Últimos 6 Meses",
  ano_atual: "Ano Atual",
  todos: "Todo Período",
};

export const getDateRange = (periodo: string): { start: string; end: string } | null => {
  const now = new Date();
  if (periodo === "todos") return null;
  if (periodo === "mes_atual") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return { start, end };
  }
  if (periodo === "mes_passado") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];
    return { start, end };
  }
  if (periodo === "trimestre") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return { start, end };
  }
  if (periodo === "semestre") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    return { start, end };
  }
  if (periodo === "ano_atual") {
    const start = `${now.getFullYear()}-01-01`;
    const end = `${now.getFullYear()}-12-31`;
    return { start, end };
  }
  return null;
};

export function calcularProgressoFinanceiro(total: number, recebido: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((recebido / total) * 100));
}

export function formatarProgressoSessoes(realizadas: number, total: number): string {
  return `${Math.max(0, realizadas)}/${Math.max(1, total)}`;
}
