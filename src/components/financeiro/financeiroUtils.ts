export { formatCurrency, formatDate } from "@/lib/formatters";

export const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pago: "default",
  pendente: "secondary",
  vencido: "destructive",
  cancelado: "outline",
};
