// Tipos, constantes e helpers compartilhados pelo módulo de consórcio.

export type Segmento = "imoveis" | "veiculos" | "servicos";
export type Origem = "whatsapp" | "facebook" | "indicacao" | "site" | "ligacao" | "outro";
export type EtapaConsorcio =
  | "novo_lead"
  | "em_contato"
  | "reuniao_agendada"
  | "proposta_enviada"
  | "contrato_fechado"
  | "perdido";
export type InteracaoTipo = "ligacao" | "whatsapp" | "email" | "reuniao" | "visita" | "nota";

export interface ConsorcioLead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  segmento: Segmento;
  valor_credito: number | null;
  prazo: number | null;
  origem: Origem | null;
  indicado_por: string | null;
  etapa: EtapaConsorcio | null;
  etapa_id: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  cidade: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsorcioInteracao {
  id: string;
  lead_id: string;
  tipo: InteracaoTipo;
  descricao: string;
  created_at: string;
}

export interface LeadConsorcioForm {
  nome: string;
  telefone: string;
  email: string;
  cpf_cnpj: string;
  segmento: Segmento;
  valor_credito: string;
  prazo: string;
  origem: Origem | "";
  indicado_por: string;
  etapa_id: string;
  responsavel_id: string;
  observacoes: string;
  cidade: string;
}

export const EMPTY_LEAD_FORM: LeadConsorcioForm = {
  nome: "",
  telefone: "",
  email: "",
  cpf_cnpj: "",
  segmento: "imoveis",
  valor_credito: "",
  prazo: "",
  origem: "",
  indicado_por: "",
  etapa_id: "",
  responsavel_id: "",
  observacoes: "",
  cidade: "",
};

export const ETAPA_LIST: Array<{ id: EtapaConsorcio; label: string }> = [
  { id: "novo_lead", label: "Novo Lead" },
  { id: "em_contato", label: "Em Contato" },
  { id: "reuniao_agendada", label: "Reunião Agendada" },
  { id: "proposta_enviada", label: "Proposta Enviada" },
  { id: "contrato_fechado", label: "Contrato Fechado" },
  { id: "perdido", label: "Perdido" },
];

export const SEGMENTOS: Array<{ id: Segmento; label: string; emoji: string; className: string }> = [
  { id: "imoveis", label: "Imóveis", emoji: "🏠", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { id: "veiculos", label: "Veículos", emoji: "🚗", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { id: "servicos", label: "Serviços", emoji: "⚙️", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
];

export const ORIGENS: Array<{ id: Origem; label: string }> = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook" },
  { id: "indicacao", label: "Indicação" },
  { id: "site", label: "Site" },
  { id: "ligacao", label: "Ligação" },
  { id: "outro", label: "Outro" },
];

export const INTERACAO_TIPOS: Array<{ id: InteracaoTipo; label: string }> = [
  { id: "ligacao", label: "Ligação" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "E-mail" },
  { id: "reuniao", label: "Reunião" },
  { id: "visita", label: "Visita" },
  { id: "nota", label: "Nota" },
];

export function formatCurrency(v: number | null | undefined): string | null {
  if (!v) return null;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function whatsappHref(tel: string): string {
  return `https://wa.me/55${tel.replace(/\D/g, "")}`;
}

export function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formToPayload(form: LeadConsorcioForm) {
  return {
    nome: form.nome.trim(),
    telefone: form.telefone.trim() || null,
    email: form.email.trim() || null,
    cpf_cnpj: form.cpf_cnpj.trim() || null,
    segmento: form.segmento,
    valor_credito: form.valor_credito ? parseFloat(form.valor_credito.replace(/\./g, "").replace(",", ".")) : null,
    prazo: form.prazo ? parseInt(form.prazo) : null,
    origem: form.origem || null,
    indicado_por: form.indicado_por.trim() || null,
    etapa_id: form.etapa_id || null,
    responsavel_id: form.responsavel_id || null,
    observacoes: form.observacoes.trim() || null,
    cidade: form.cidade.trim() || null,
  };
}
