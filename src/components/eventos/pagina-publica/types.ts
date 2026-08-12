export type SecaoTipo =
  | "hero"
  | "sobre"
  | "palestrantes"
  | "agenda"
  | "depoimentos"
  | "local"
  | "faq"
  | "beneficios"
  | "garantias";

export interface Palestrante {
  id: string;
  nome: string;
  cargo: string;
  bio: string;
  foto_url: string;
}

export interface AgendaItem {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  titulo: string;
  descricao: string;
}

export interface Depoimento {
  id: string;
  nome: string;
  cargo: string;
  texto: string;
  foto_url: string;
}

export interface FaqItem {
  id: string;
  pergunta: string;
  resposta: string;
}

export interface Beneficio {
  id: string;
  icone: string;
  titulo: string;
  texto: string;
}

export interface Garantia {
  id: string;
  icone: string;
  texto: string;
}

export interface SecaoEstilo {
  bg_color?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export interface SecaoDados {
  // hero
  variante?: string;
  titulo_override?: string;
  subtitulo?: string;
  cta_texto?: string;
  eyebrow?: string;
  // sobre
  texto?: string;
  imagem_url?: string;
  // palestrantes
  palestrantes?: Palestrante[];
  // agenda
  itens?: AgendaItem[];
  // depoimentos
  depoimentos?: Depoimento[];
  // local
  endereco?: string;
  link_mapa?: string;
  // faq
  faqs?: FaqItem[];
  // beneficios
  titulo_secao?: string;
  beneficios?: Beneficio[];
  // garantias
  garantias?: Garantia[];
}

export interface Secao {
  id: string;
  tipo: SecaoTipo;
  ativo: boolean;
  ordem: number;
  dados: SecaoDados;
  estilo?: SecaoEstilo;
}

export const SECAO_LABELS: Record<SecaoTipo, string> = {
  hero:         "Capa do evento",
  sobre:        "Sobre o evento",
  palestrantes: "Palestrantes",
  agenda:       "Programação",
  depoimentos:  "Depoimentos",
  local:        "Local",
  faq:          "Perguntas frequentes",
  beneficios:   "Benefícios",
  garantias:    "Garantias",
};

export const SECAO_ICONS: Record<SecaoTipo, string> = {
  hero:         "🎯",
  sobre:        "📝",
  palestrantes: "🎤",
  agenda:       "📅",
  depoimentos:  "💬",
  local:        "📍",
  faq:          "❓",
  beneficios:   "✅",
  garantias:    "🔒",
};
