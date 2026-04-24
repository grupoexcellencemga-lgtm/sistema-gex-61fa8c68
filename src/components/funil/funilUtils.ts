export interface LeadForm {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  produto_interesse: string;
  origem: string;
  observacoes: string;
  responsavel_id: string;
}

export const emptyLeadForm: LeadForm = {
  nome: "", email: "", telefone: "", cidade: "",
  produto_interesse: "", origem: "", observacoes: "", responsavel_id: "",
};

export const etapas = [
  { key: "lead", label: "Lead", color: "bg-muted text-muted-foreground" },
  { key: "contato", label: "Contato", color: "bg-warning/10 text-warning border-warning/20" },
  { key: "negociacao", label: "Negociação", color: "bg-primary/10 text-primary border-primary/20" },
  { key: "matricula", label: "Matrícula", color: "bg-success/10 text-success border-success/20" },
  { key: "perdido", label: "Perdido", color: "bg-destructive/10 text-destructive border-destructive/20" },
];

export const etapaOrder = ["lead", "contato", "negociacao", "matricula"];

export const etapaLabels: Record<string, string> = {
  lead: "Lead", contato: "Contato", negociacao: "Negociação", matricula: "Matrícula", perdido: "Perdido",
};

export const origens = [
  { value: "site", label: "Site" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];

export const cidades = ["Maringá", "Mandaguari", "Online"];

export function calcularTaxaConversao(total: number, convertidos: number): string {
  if (total <= 0) return "0.0";
  return ((convertidos / total) * 100).toFixed(1);
}

export function calcularTempoMedioConversao(tempos: number[]): number {
  if (tempos.length === 0) return 0;
  return Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
}
