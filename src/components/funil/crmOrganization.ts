export type CrmQueue = "fila" | "ia" | "minhas" | "todos" | "finalizadas";
type Conversation = { status_atendimento?: string | null; bot_ativo?: boolean | null; atendente_id?: string | null; ultima_mensagem_direcao?: string | null };

export function matchesCrmQueue(lead: Conversation, queue: CrmQueue, userId?: string) {
  if (lead.status_atendimento === "finalizado") return false;
  if (queue === "ia") return lead.bot_ativo === true;
  if (queue === "minhas") return !!userId && lead.atendente_id === userId && !lead.bot_ativo;
  if (queue === "fila") return !lead.bot_ativo && (lead.status_atendimento === "fila" || lead.ultima_mensagem_direcao === "entrada");
  return queue === "todos";
}

export function crmResponsibility(lead: Conversation, names: Record<string, string> = {}) {
  if (lead.bot_ativo) return "IA autorizada";
  if (lead.atendente_id) return `Com ${names[lead.atendente_id] || "atendente"}`;
  return "Aguardando atendimento";
}
