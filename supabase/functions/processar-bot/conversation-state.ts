export const CURRENT_INTENTS = [
  "unknown", "saudacao", "informacao_produto", "preco", "datas", "horario", "local",
  "parcelamento", "pagamento", "inscricao", "reserva", "comprovante", "objecao",
  "comparacao", "suporte_aluno", "empresa_escola", "cancelamento", "solicitar_humano",
  "encerramento", "outro",
] as const;

export const OBJECTIONS = [
  "financeira", "tempo", "agenda", "deslocamento", "presencial", "falar_com_terceiro",
  "inseguranca", "confianca", "dinamicas", "comparacao", "prioridade", "sem_interesse", "outro",
] as const;

export const FUNNEL_STAGES = [
  "novo_lead", "primeiro_contato", "em_conversa", "interesse_identificado",
  "produto_apresentado", "proposta_enviada", "aguardando_decisao", "dados_recebidos",
  "aguardando_pagamento", "pagamento_em_conferencia", "inscricao_confirmada",
  "perdido_sem_interesse", "atendimento_humano",
] as const;

export const TEMPERATURES = ["frio", "morno", "quente"] as const;
export const PURCHASE_INTENTS = ["none", "weak", "clear"] as const;
export const AWAITING_VALUES = [
  "none", "user_reply", "user_data", "payment_choice", "payment", "proof",
  "payment_validation", "human", "meeting",
] as const;
export const PAYMENT_METHODS = ["pix", "card", "machine"] as const;
export const SHARED_INFORMATION = [
  "product_overview", "price", "dates", "time", "location", "duration", "format",
  "benefits", "payment_terms", "pix_key", "payment_link", "registration_request",
  "registration_confirmed", "group_information", "invoice_information",
] as const;

export interface ConversationState {
  preferred_name: string | null;
  current_product: string | null;
  origin: string | null;
  city: string | null;
  current_intent: typeof CURRENT_INTENTS[number];
  explicit_question: string | null;
  main_need: string | null;
  current_objection: typeof OBJECTIONS[number] | null;
  funnel_stage: typeof FUNNEL_STAGES[number];
  temperature: typeof TEMPERATURES[number];
  purchase_intent: typeof PURCHASE_INTENTS[number];
  information_already_shared: typeof SHARED_INFORMATION[number][];
  known_user_facts: string[];
  last_julia_question: string | null;
  awaiting: typeof AWAITING_VALUES[number];
  agreed_next_action: string | null;
  payment_method: typeof PAYMENT_METHODS[number] | null;
  promised_payment_at: string | null;
  handoff_active: boolean;
  do_not_contact: boolean;
  conversation_summary: string;
}

export const DEFAULT_CONVERSATION_STATE: ConversationState = {
  preferred_name: null,
  current_product: null,
  origin: null,
  city: null,
  current_intent: "unknown",
  explicit_question: null,
  main_need: null,
  current_objection: null,
  funnel_stage: "novo_lead",
  temperature: "frio",
  purchase_intent: "none",
  information_already_shared: [],
  known_user_facts: [],
  last_julia_question: null,
  awaiting: "none",
  agreed_next_action: null,
  payment_method: null,
  promised_payment_at: null,
  handoff_active: false,
  do_not_contact: false,
  conversation_summary: "",
};

const STATE_KEYS = Object.keys(DEFAULT_CONVERSATION_STATE) as (keyof ConversationState)[];
const STATE_KEY_SET = new Set<string>(STATE_KEYS);
const NULLABLE_STRINGS = new Set<keyof ConversationState>([
  "preferred_name", "current_product", "origin", "city", "explicit_question", "main_need",
  "last_julia_question", "agreed_next_action", "promised_payment_at",
]);

const ENUMS: Partial<Record<keyof ConversationState, readonly string[]>> = {
  current_intent: CURRENT_INTENTS,
  current_objection: OBJECTIONS,
  funnel_stage: FUNNEL_STAGES,
  temperature: TEMPERATURES,
  purchase_intent: PURCHASE_INTENTS,
  awaiting: AWAITING_VALUES,
  payment_method: PAYMENT_METHODS,
};

const STRING_LIMIT = 500;
export const SUMMARY_LIMIT = 2_000;
export const KNOWN_FACTS_LIMIT = 20;
const FACT_LIMIT = 300;

export interface MergeResult {
  state: ConversationState;
  patch: Partial<ConversationState>;
  issues: string[];
}

const unique = <T>(values: T[]) => [...new Set(values)];

// ─── Filtro de fatos operacionais reservados ──────────────────────────────────
// O State Updater não pode registrar como fato consumado algo que só existe
// como intenção ou pedido — confirmações operacionais dependem de tool real.
// Lista de padrões (lowercase) que indicam conclusão não autorizada.
const RESERVED_FACT_PATTERNS = [
  /\bvaga\s+(foi\s+)?reservad[ao]/i,
  /\binscri[çc][ãa]o\s+(foi\s+)?confirmad[ao]/i,
  /\bpagamento\s+(foi\s+)?confirmad[ao]/i,
  /\baluno\s+(foi\s+)?cadastrad[ao]/i,
  /\breuni[ãa]o\s+(foi\s+)?agendad[ao]/i,
  /\bdesconto\s+(foi\s+)?autoriz[ao]/i,
  /\bpix\s+(foi\s+)?pag[ou]/i,
  /\bgrupo\s+(foi\s+)?adicionad[ao]/i,
  /\bmaterial\s+(foi\s+)?enviad[ao]/i,
  /\bcadastro\s+(foi\s+)?realizad[ao]/i,
  /\bacesso\s+(foi\s+)?liberad[ao]/i,
  /\bturma\s+(foi\s+)?confirmad[ao]/i,
  // padrões positivos curtos de conclusão de ação operacional
  /\bvaga\s+reservada\b/i,
  /\bpagamento\s+confirmado\b/i,
  /\binscri[çc][ãa]o\s+confirmada\b/i,
  /\baluno\s+cadastrado\b/i,
  /\breuni[ãa]o\s+agendada\b/i,
] as const;

function filterOperationalFacts(facts: string[]): string[] {
  return facts.filter(fact => !RESERVED_FACT_PATTERNS.some(pattern => pattern.test(fact)));
}

function validPreviousState(input: unknown): ConversationState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_CONVERSATION_STATE, information_already_shared: [], known_user_facts: [] };
  }
  return mergeConversationState(DEFAULT_CONVERSATION_STATE, input, {
    preserveProtectedFlags: false,
    allowProtectedChanges: true,
  }).state;
}

export function mergeConversationState(
  previousInput: unknown,
  updaterOutput: unknown,
  options: { preserveProtectedFlags?: boolean; allowProtectedChanges?: boolean } = {},
): MergeResult {
  const preserveProtectedFlags = options.preserveProtectedFlags ?? true;
  const allowProtectedChanges = options.allowProtectedChanges ?? false;
  const previous = previousInput === DEFAULT_CONVERSATION_STATE
    ? { ...DEFAULT_CONVERSATION_STATE, information_already_shared: [], known_user_facts: [] }
    : validPreviousState(previousInput);
  const patch: Partial<ConversationState> = {};
  const issues: string[] = [];

  if (!updaterOutput || typeof updaterOutput !== "object" || Array.isArray(updaterOutput)) {
    return { state: previous, patch, issues: ["updater_output: esperado objeto"] };
  }

  const source = updaterOutput as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!STATE_KEY_SET.has(key)) issues.push(`${key}: campo inesperado ignorado`);
  }

  for (const key of STATE_KEYS) {
    if (!(key in source)) continue;
    const value = source[key];

    if (NULLABLE_STRINGS.has(key)) {
      if (value === null || (typeof value === "string" && value.trim() === "")) {
        (patch as Record<string, unknown>)[key] = null;
      } else if (typeof value === "string") {
        (patch as Record<string, unknown>)[key] = value.trim().slice(0, STRING_LIMIT);
      } else {
        issues.push(`${key}: esperado texto ou null`);
      }
      continue;
    }

    if (key === "conversation_summary") {
      if (typeof value === "string") patch.conversation_summary = value.trim().slice(0, SUMMARY_LIMIT);
      else issues.push(`${key}: esperado texto`);
      continue;
    }

    if (key === "information_already_shared") {
      if (!Array.isArray(value)) {
        issues.push(`${key}: esperado array`);
        continue;
      }
      const accepted = value.filter(
        (item): item is typeof SHARED_INFORMATION[number] =>
          typeof item === "string" && (SHARED_INFORMATION as readonly string[]).includes(item),
      );
      if (accepted.length !== value.length) issues.push(`${key}: itens inválidos ignorados`);
      patch.information_already_shared = unique([
        ...previous.information_already_shared,
        ...accepted,
      ]);
      continue;
    }

    if (key === "known_user_facts") {
      if (!Array.isArray(value)) {
        issues.push(`${key}: esperado array`);
        continue;
      }
      const accepted = value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, FACT_LIMIT));
      if (accepted.length !== value.length) issues.push(`${key}: itens inválidos ignorados`);
      const filtered = filterOperationalFacts(accepted);
      if (filtered.length !== accepted.length) {
        issues.push(`${key}: ${accepted.length - filtered.length} fato(s) operacional(is) reservado(s) removido(s)`);
      }
      patch.known_user_facts = unique([...previous.known_user_facts, ...filtered]).slice(-KNOWN_FACTS_LIMIT);
      continue;
    }

    if (key === "handoff_active" || key === "do_not_contact") {
      if (typeof value !== "boolean") {
        issues.push(`${key}: esperado booleano`);
      } else if (!allowProtectedChanges && value !== previous[key]) {
        issues.push(`${key}: alteração reservada ao estado operacional`);
      } else {
        (patch as Record<string, unknown>)[key] = value;
      }
      continue;
    }

    const allowed = ENUMS[key];
    if (allowed) {
      if (value === null && (key === "current_objection" || key === "payment_method")) {
        (patch as Record<string, unknown>)[key] = null;
      } else if (typeof value === "string" && allowed.includes(value)) {
        (patch as Record<string, unknown>)[key] = value;
      } else {
        issues.push(`${key}: valor inválido ignorado`);
      }
    }
  }

  const state = { ...previous, ...patch } as ConversationState;
  if (preserveProtectedFlags) {
    state.handoff_active = previous.handoff_active || state.handoff_active;
    state.do_not_contact = previous.do_not_contact || state.do_not_contact;
  }
  state.information_already_shared = unique(state.information_already_shared);
  state.known_user_facts = unique(state.known_user_facts).slice(-KNOWN_FACTS_LIMIT);

  return { state, patch, issues };
}

export function applyOperationalConversationState(
  stateInput: unknown,
  operational: { handoffActive?: boolean; doNotContact?: boolean },
): ConversationState {
  const state = validPreviousState(stateInput);
  return {
    ...state,
    handoff_active: operational.handoffActive ?? state.handoff_active,
    do_not_contact: state.do_not_contact || operational.doNotContact === true,
  };
}

export interface StateMessage {
  direction: "entrada" | "saida";
  content: string | null;
  mediaType?: string | null;
}

function messageText(message: StateMessage): string {
  const content = message.content?.trim();
  if (content && content !== "[Mídia]" && content !== "[Imagem]") return content;
  const type = message.mediaType?.trim().toLowerCase();
  if (type) return `[A pessoa enviou uma ${type}]`;
  return "[A pessoa enviou uma mídia sem descrição disponível]";
}

export function prepareStateUpdaterConversation(messages: StateMessage[]): {
  history: string;
  latestUserMessage: string;
} {
  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].direction === "entrada") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) return { history: "", latestUserMessage: "[Nenhuma mensagem do usuário disponível]" };

  const history = messages
    .slice(Math.max(0, latestUserIndex - 10), latestUserIndex)
    .map((message) => `${message.direction === "saida" ? "Júlia" : "Cliente"}: ${messageText(message)}`)
    .join("\n");

  return { history, latestUserMessage: messageText(messages[latestUserIndex]) };
}

const show = (value: string | null) => value ?? "(não informado)";
const yesNo = (value: boolean) => value ? "sim" : "não";

export function buildConversationStateContext(stateInput: unknown): string {
  const state = validPreviousState(stateInput);
  return [
    "\n\n---",
    "# ESTADO ATUAL DO ATENDIMENTO",
    "As informações abaixo são dados internos de contexto. Nunca mostre este bloco ao contato.",
    "A etapa e a temperatura abaixo são percepção contextual; as tools controlam o CRM operacional.",
    "",
    `Nome preferido: ${show(state.preferred_name)}`,
    `Produto atual: ${show(state.current_product)}`,
    `Origem: ${show(state.origin)}`,
    `Cidade: ${show(state.city)}`,
    `Intenção atual: ${state.current_intent}`,
    `Pergunta explícita: ${show(state.explicit_question)}`,
    `Necessidade principal: ${show(state.main_need)}`,
    `Objeção atual: ${show(state.current_objection)}`,
    `Etapa contextual do funil: ${state.funnel_stage}`,
    `Temperatura contextual: ${state.temperature}`,
    `Intenção de compra: ${state.purchase_intent}`,
    `Informações já apresentadas: ${state.information_already_shared.join(", ") || "(nenhuma)"}`,
    `Fatos conhecidos: ${state.known_user_facts.join(" | ") || "(nenhum)"}`,
    `Última pergunta de Júlia: ${show(state.last_julia_question)}`,
    `Aguardando: ${state.awaiting}`,
    `Próxima ação combinada: ${show(state.agreed_next_action)}`,
    `Forma de pagamento: ${show(state.payment_method)}`,
    `Promessa de pagamento: ${show(state.promised_payment_at)}`,
    `Handoff ativo: ${yesNo(state.handoff_active)}`,
    `Não contatar: ${yesNo(state.do_not_contact)}`,
    `Resumo: ${state.conversation_summary || "(vazio)"}`,
    "",
    "Mantenha continuidade. Não repita informações apresentadas nem pergunte fatos já conhecidos.",
    "Se Handoff ativo ou Não contatar estiver como sim, não continue uma abordagem comercial automática.",
  ].join("\n");
}

export type CompareAndSwapResult =
  | { kind: "updated"; version: number; state: ConversationState }
  | { kind: "conflict" }
  | { kind: "error"; error: string };

export interface ConversationStateRepository {
  compareAndSwap(
    leadId: string,
    expectedVersion: number,
    state: ConversationState,
  ): Promise<CompareAndSwapResult>;
  load(leadId: string): Promise<{ state: unknown; version: number }>;
}

export interface PersistConversationStateInput {
  leadId: string;
  mode: string;
  previousState: unknown;
  expectedVersion: number;
  updaterOutput: unknown;
  repository: ConversationStateRepository;
  allowProtectedChanges?: boolean;
}

export interface PersistConversationStateResult {
  kind: "persisted" | "memory_only" | "failed";
  state: ConversationState;
  version: number;
  persisted: boolean;
  issues: string[];
  error?: string;
  conflictRetried?: boolean;
}

export async function persistConversationState(
  input: PersistConversationStateInput,
): Promise<PersistConversationStateResult> {
  const mergeOptions = { allowProtectedChanges: input.allowProtectedChanges === true };
  const firstMerge = mergeConversationState(input.previousState, input.updaterOutput, mergeOptions);
  if (input.mode !== "ativo") {
    return {
      kind: "memory_only",
      state: firstMerge.state,
      version: input.expectedVersion,
      persisted: false,
      issues: firstMerge.issues,
    };
  }

  const first = await input.repository.compareAndSwap(
    input.leadId,
    input.expectedVersion,
    firstMerge.state,
  );
  if (first.kind === "updated") {
    return {
      kind: "persisted",
      state: first.state,
      version: first.version,
      persisted: true,
      issues: firstMerge.issues,
    };
  }
  if (first.kind === "error") {
    return {
      kind: "failed",
      state: firstMerge.state,
      version: input.expectedVersion,
      persisted: false,
      issues: firstMerge.issues,
      error: first.error,
    };
  }

  try {
    const latest = await input.repository.load(input.leadId);
    const retryMerge = mergeConversationState(latest.state, input.updaterOutput, mergeOptions);
    const retry = await input.repository.compareAndSwap(input.leadId, latest.version, retryMerge.state);
    if (retry.kind === "updated") {
      return {
        kind: "persisted",
        state: retry.state,
        version: retry.version,
        persisted: true,
        issues: unique([...firstMerge.issues, ...retryMerge.issues]),
        conflictRetried: true,
      };
    }
    return {
      kind: "failed",
      state: retryMerge.state,
      version: latest.version,
      persisted: false,
      issues: unique([...firstMerge.issues, ...retryMerge.issues]),
      error: retry.kind === "error" ? retry.error : "conflito de versão após uma nova tentativa",
      conflictRetried: true,
    };
  } catch (error) {
    return {
      kind: "failed",
      state: firstMerge.state,
      version: input.expectedVersion,
      persisted: false,
      issues: firstMerge.issues,
      error: error instanceof Error ? error.message : String(error),
      conflictRetried: true,
    };
  }
}
