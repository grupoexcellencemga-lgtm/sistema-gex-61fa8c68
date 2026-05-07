export { formatCurrency, formatDate } from "@/lib/formatters";

export const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pago: "default",
  parcial: "outline",
  pendente: "secondary",
  vencido: "destructive",
  cancelado: "outline",
};
