import { Badge } from "@/components/ui/badge";
import { getFormaPagamentoLabel } from "@/hooks/useFormasPagamento";
import { toast } from "sonner";

// Remove acentos e baixa caixa para comparações tolerantes ("joao" acha "João").
export const normalizarBusca = (valor?: string | null) =>
  (valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const normalizarTexto = (valor?: string | null) =>
  (valor || "").trim().toLowerCase();

export const normalizarTelefone = (valor?: string | null) =>
  (valor || "").replace(/\D/g, "");

export const getComprovantesParticipante = (participante: any) => {
  const lista = Array.isArray(participante?.comprovantes_urls)
    ? participante.comprovantes_urls
    : [];
  if (lista.length > 0) return lista;
  if (participante?.comprovante_url)
    return [{ url: participante.comprovante_url, nome: "Comprovante anexado" }];
  return [];
};

export const getStatusBadge = (status: string) => {
  switch (status) {
    case "pago":
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">Pago</Badge>;
    case "pendente":
      return <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">Pendente</Badge>;
    case "vencido":
      return <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Vencido</Badge>;
    case "gratuito":
      return <Badge variant="secondary">Gratuito</Badge>;
    case "isento":
      return <Badge variant="secondary">Isento</Badge>;
    case "permuta":
      return <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Permuta</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export const tipoLabelFn = (t: string | null) =>
  t === "comunidade"
    ? "Comunidade"
    : t === "convidado"
      ? "Convidado(a)"
      : t === "divulgacao"
        ? "Divulgação"
        : "";

export const statusLabelFn = (s: string) =>
  s === "pago"
    ? "Pago"
    : s === "pendente"
      ? "Pendente"
      : s === "gratuito"
        ? "Gratuito"
        : s === "isento"
          ? "Isento"
          : s === "permuta"
            ? "Permuta"
            : s;

export const exportParticipantes = (
  participantes: any[],
  evento: any,
  formasPagamento: any[],
) => {
  if (participantes.length === 0) {
    toast.error("Nenhum participante para exportar.");
    return;
  }
  import("xlsx").then((XLSX) => {
    const statusLabel = (s: string) =>
      s === "pago"
        ? "Pago"
        : s === "gratuito"
          ? "Gratuito"
          : s === "permuta"
            ? "Permuta"
            : "Pendente";
    const wsData = [
      [
        "Nome",
        "Email",
        "Telefone",
        "Tipo",
        "Presença",
        "Status Pagamento",
        "Forma Pagamento",
        "Valor",
        "Convidado por",
        "Adicionado por",
        "Observações",
      ],
      ...participantes.map((p: any) => [
        p.nome || "",
        p.email || "",
        p.telefone || "",
        p.tipo_participante || "",
        p.presenca ? "Presente" : "Ausente",
        statusLabel(p.status_pagamento),
        getFormaPagamentoLabel(p.forma_pagamento, formasPagamento),
        p.valor ?? 0,
        p.convidado_por || "",
        p.adicionado_por_nome || "",
        p.observacoes || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    XLSX.writeFile(
      wb,
      `participantes_${evento.nome.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30)}.xlsx`,
    );
    toast.success("Planilha exportada com sucesso!");
  });
};
