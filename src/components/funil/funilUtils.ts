export interface LeadForm {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  produto_interesse: string;
  origem: string;
  observacoes: string;
  responsavel_id: string;
  quadro_id: string;
  etapa_id: string;
  valor: string;
}

export const emptyLeadForm: LeadForm = {
  nome: "", email: "", telefone: "", cidade: "",
  produto_interesse: "", origem: "", observacoes: "", responsavel_id: "",
  quadro_id: "", etapa_id: "", valor: "",
};

// Uma etapa (coluna) do funil — configurável em Configurações → Funil.
export interface FunilEtapa {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tipo: "em_andamento" | "ganho" | "perdido";
  observacoes?: string | null;
  quadro_id?: string;
  meta_valor?: number | null;
}

export const origens = [
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

export const cidades = ["Maringá", "Mandaguari", "Online"];

export const TIPO_ETAPA_LABELS: Record<string, string> = {
  em_andamento: "Em andamento",
  ganho: "Ganho (matrícula)",
  perdido: "Perdido",
};

// Classes Tailwind literais (não interpoladas) para o color-picker das etapas —
// precisam existir como string exata no código para o Tailwind incluir no build.
export const ETAPA_CORES: Record<string, { badge: string; dot: string }> = {
  slate: { badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  yellow: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  orange: { badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-400" },
  blue: { badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-400" },
  green: { badge: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-400" },
  red: { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400" },
  purple: { badge: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-400" },
  pink: { badge: "bg-pink-100 text-pink-700 border-pink-200", dot: "bg-pink-400" },
  teal: { badge: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-400" },
  indigo: { badge: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-400" },
};
export const ETAPA_CORES_LIST = Object.keys(ETAPA_CORES);

export function calcularTaxaConversao(total: number, convertidos: number): string {
  if (total <= 0) return "0.0";
  return ((convertidos / total) * 100).toFixed(1);
}

// ── Tipo de contato e ficha da IA ────────────────────────────────────────────

// O mesmo WhatsApp atende clientes, fornecedores e equipe. Só lead e aluno
// entram no painel de pendências, no alerta de SLA e no agente de vendas.
export const TIPOS_CONTATO = [
  { value: "lead", label: "Lead" },
  { value: "aluno", label: "Aluno / cliente" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "parceiro", label: "Parceiro" },
  { value: "equipe", label: "Equipe" },
  { value: "outro", label: "Outro" },
] as const;

export type TipoContato = (typeof TIPOS_CONTATO)[number]["value"];

export const TIPOS_CLIENTE: TipoContato[] = ["lead", "aluno"];

export function ehTipoCliente(tipo: string | null | undefined): boolean {
  return (TIPOS_CLIENTE as readonly string[]).includes(tipo ?? "lead");
}

export function rotuloTipoContato(tipo: string | null | undefined): string {
  return TIPOS_CONTATO.find((t) => t.value === tipo)?.label ?? "Lead";
}

export interface FichaLead {
  tipo_contato: TipoContato;
  resumo: string;
  necessidade: string;
  dores: string[];
  momento: string;
  perfil: string;
  objecoes: string[];
  interesses: string[];
  temperatura: "quente" | "morno" | "frio" | "indefinido";
  proximo_passo: string;
  alertas: string[];
}

export const TEMPERATURA_LEAD: Record<FichaLead["temperatura"], { label: string; classe: string }> = {
  quente: { label: "Quente", classe: "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400" },
  morno: { label: "Morno", classe: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400" },
  frio: { label: "Frio", classe: "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400" },
  indefinido: { label: "Indefinido", classe: "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400" },
};

// ── SLA de atendimento ───────────────────────────────────────────────────────

export interface LeadSla {
  ultima_mensagem_direcao?: string | null;
  ultima_mensagem_em?: string | null;
  sla_minutos?: number | null;
}

export const SLA_MINUTOS_PADRAO = 60;

/** Minutos desde a última mensagem do lead. null se a bola não está com a gente. */
export function minutosAguardando(lead: LeadSla): number | null {
  if (lead.ultima_mensagem_direcao !== "entrada" || !lead.ultima_mensagem_em) return null;
  return Math.floor((Date.now() - new Date(lead.ultima_mensagem_em).getTime()) / 60000);
}

export function formatDuracao(min: number): string {
  if (min < 60) return `${min}m`;
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
  return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
}

export function slaLabel(lead: LeadSla): { text: string; color: string } | null {
  const minutos = minutosAguardando(lead);
  if (minutos === null) return null;
  const limite = lead.sla_minutos ?? SLA_MINUTOS_PADRAO;
  const text = formatDuracao(minutos);
  if (minutos < 30) return { text, color: "text-green-600 dark:text-green-400" };
  if (minutos < limite) return { text, color: "text-amber-600 dark:text-amber-400" };
  return { text, color: "text-red-600 dark:text-red-400 font-bold" };
}

export function calcularTempoMedioConversao(tempos: number[]): number {
  if (tempos.length === 0) return 0;
  return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
}
