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

export function calcularTempoMedioConversao(tempos: number[]): number {
  if (tempos.length === 0) return 0;
  return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
}
