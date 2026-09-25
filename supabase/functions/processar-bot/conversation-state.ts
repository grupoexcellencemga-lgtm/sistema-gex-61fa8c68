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
export const AGENT_KEYS = [
  "general", "opex", "teen_connect", "mulheres_excelencia",
  "workshop_elevate", "metodo_cis", "pgl", "workshop_pais",
  "workshop_gestao", "workshop_homens",
] as const;
export type AgentKey = typeof AGENT_KEYS[number] | null;

export const MAX_PRODUCT_CONTEXTS = 5;
export const MAX_PRODUCT_FACTS = 20;
export const PRODUCT_SUMMARY_LIMIT = 2_000;

export interface ProductContext {
  funnel_stage: typeof FUNNEL_STAGES[number];
  current_objection: typeof OBJECTIONS[number] | null;
  purchase_intent: typeof PURCHASE_INTENTS[number];
  information_shared: typeof SHARED_INFORMATION[number][];
  known_product_facts: string[];
  last_agent_question: string | null;
  payment_method: typeof PAYMENT_METHODS[number] | null;
  promised_payment_at: string | null;
  agreed_next_action: string | null;
  product_summary: string;
}

export const DEFAULT_PRODUCT_CONTEXT: ProductContext = {
  funnel_stage: "novo_lead",
  current_objection: null,
  purchase_intent: "none",
  information_shared: [],
  known_product_facts: [],
  last_agent_question: null,
  payment_method: null,
  promised_payment_at: null,
  agreed_next_action: null,
  product_summary: "",
};

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
  current_agent: AgentKey;
  previous_agent: AgentKey;
  previous_product: string | null;
  routing_reason: string | null;
  product_contexts: Record<string, ProductContext>;
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
  current_agent: null,
  previous_agent: null,
  previous_product: null,
  routing_reason: null,
  product_contexts: {},
};

const STATE_KEYS = Object.keys(DEFAULT_CONVERSATION_STATE) as (keyof ConversationState)[];
const STATE_KEY_SET = new Set<string>(STATE_KEYS);
const NULLABLE_STRINGS = new Set<keyof ConversationState>([
  "preferred_name", "current_product", "origin", "city", "explicit_question", "main_need",
  "last_julia_question", "agreed_next_action", "promised_payment_at",
  "previous_product", "routing_reason",
]);

const ROUTER_CONTROLLED_KEYS = new Set<keyof ConversationState>([
  "current_agent", "previous_agent", "previous_product", "routing_reason",
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

function mergeProductContext(
  previous: ProductContext,
  raw: unknown,
): { context: ProductContext; issues: string[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { context: previous, issues: ["esperado objeto"] };
  }
  const src = raw as Record<string, unknown>;
  const issues: string[] = [];
  const ctx: ProductContext = { ...previous };

  if ("funnel_stage" in src) {
    if (typeof src.funnel_stage === "string" && (FUNNEL_STAGES as readonly string[]).includes(src.funnel_stage)) {
      ctx.funnel_stage = src.funnel_stage as typeof FUNNEL_STAGES[number];
    } else { issues.push("funnel_stage: valor inválido ignorado"); }
  }
  if ("current_objection" in src) {
    if (src.current_objection === null) { ctx.current_objection = null; }
    else if (typeof src.current_objection === "string" && (OBJECTIONS as readonly string[]).includes(src.current_objection)) {
      ctx.current_objection = src.current_objection as typeof OBJECTIONS[number];
    } else { issues.push("current_objection: valor inválido ignorado"); }
  }
  if ("purchase_intent" in src) {
    if (typeof src.purchase_intent === "string" && (PURCHASE_INTENTS as readonly string[]).includes(src.purchase_intent)) {
      ctx.purchase_intent = src.purchase_intent as typeof PURCHASE_INTENTS[number];
    } else { issues.push("purchase_intent: valor inválido ignorado"); }
  }
  if ("information_shared" in src) {
    if (!Array.isArray(src.information_shared)) { issues.push("information_shared: esperado array"); }
    else {
      const accepted = (src.information_shared as unknown[]).filter(
        (item): item is typeof SHARED_INFORMATION[number] =>
          typeof item === "string" && (SHARED_INFORMATION as readonly string[]).includes(item),
      );
      ctx.information_shared = unique([...previous.information_shared, ...accepted]);
    }
  }
  if ("known_product_facts" in src) {
    if (!Array.isArray(src.known_product_facts)) { issues.push("known_product_facts: esperado array"); }
    else {
      const accepted = (src.known_product_facts as unknown[])
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim().slice(0, FACT_LIMIT));
      ctx.known_product_facts = unique([...previous.known_product_facts, ...accepted]).slice(-MAX_PRODUCT_FACTS);
    }
  }
  if ("last_agent_question" in src) {
    if (src.last_agent_question === null || src.last_agent_question === "") { ctx.last_agent_question = null; }
    else if (typeof src.last_agent_question === "string") {
      ctx.last_agent_question = src.last_agent_question.trim().slice(0, STRING_LIMIT);
    } else { issues.push("last_agent_question: esperado texto ou null"); }
  }
  if ("payment_method" in src) {
    if (src.payment_method === null) { ctx.payment_method = null; }
    else if (typeof src.payment_method === "string" && (PAYMENT_METHODS as readonly string[]).includes(src.payment_method)) {
      ctx.payment_method = src.payment_method as typeof PAYMENT_METHODS[number];
    } else { issues.push("payment_method: valor inválido ignorado"); }
  }
  if ("promised_payment_at" in src) {
    if (src.promised_payment_at === null || src.promised_payment_at === "") { ctx.promised_payment_at = null; }
    else if (typeof src.promised_payment_at === "string") {
      ctx.promised_payment_at = src.promised_payment_at.trim().slice(0, STRING_LIMIT);
    } else { issues.push("promised_payment_at: esperado texto ou null"); }
  }
  if ("agreed_next_action" in src) {
    if (src.agreed_next_action === null || src.agreed_next_action === "") { ctx.agreed_next_action = null; }
    else if (typeof src.agreed_next_action === "string") {
      ctx.agreed_next_action = src.agreed_next_action.trim().slice(0, STRING_LIMIT);
    } else { issues.push("agreed_next_action: esperado texto ou null"); }
  }
  if ("product_summary" in src) {
    if (typeof src.product_summary === "string") {
      ctx.product_summary = src.product_summary.trim().slice(0, PRODUCT_SUMMARY_LIMIT);
    } else { issues.push("product_summary: esperado texto"); }
  }

  return { context: ctx, issues };
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

    if (ROUTER_CONTROLLED_KEYS.has(key)) {
      if (value !== (previous as Record<string, unknown>)[key]) {
        issues.push(`${key}: campo controlado pelo Router — ignorado`);
      }
      continue;
    }

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

    if (key === "product_contexts") {
      if (!allowProtectedChanges) continue; // AI não pode escrever diretamente; sync via postMerge
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        issues.push(`${key}: esperado objeto`);
        continue;
      }
      const merged: Record<string, ProductContext> = { ...previous.product_contexts };
      for (const [slug, rawCtx] of Object.entries(value as Record<string, unknown>)) {
        if (!(AGENT_KEYS as readonly string[]).includes(slug)) {
          issues.push(`${key}.${slug}: slug inválido ignorado`);
          continue;
        }
        const base = merged[slug] ?? { ...DEFAULT_PRODUCT_CONTEXT, information_shared: [], known_product_facts: [] };
        const validated = mergeProductContext(base, rawCtx);
        merged[slug] = validated.context;
        if (validated.issues.length) issues.push(...validated.issues.map((i) => `${key}.${slug}: ${i}`));
      }
      (patch as Record<string, unknown>)[key] = merged;
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
  postMerge?: (state: ConversationState) => ConversationState;
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
  const firstState = input.postMerge ? input.postMerge(firstMerge.state) : firstMerge.state;

  if (input.mode !== "ativo") {
    return {
      kind: "memory_only",
      state: firstState,
      version: input.expectedVersion,
      persisted: false,
      issues: firstMerge.issues,
    };
  }

  const first = await input.repository.compareAndSwap(
    input.leadId,
    input.expectedVersion,
    firstState,
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
      state: firstState,
      version: input.expectedVersion,
      persisted: false,
      issues: firstMerge.issues,
      error: first.error,
    };
  }

  try {
    const latest = await input.repository.load(input.leadId);
    const retryMerge = mergeConversationState(latest.state, input.updaterOutput, mergeOptions);
    const retryState = input.postMerge ? input.postMerge(retryMerge.state) : retryMerge.state;
    const retry = await input.repository.compareAndSwap(input.leadId, latest.version, retryState);
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
      state: retryState,
      version: latest.version,
      persisted: false,
      issues: unique([...firstMerge.issues, ...retryMerge.issues]),
      error: retry.kind === "error" ? retry.error : "conflito de versão após uma nova tentativa",
      conflictRetried: true,
    };
  } catch (error) {
    return {
      kind: "failed",
      state: firstState,
      version: input.expectedVersion,
      persisted: false,
      issues: firstMerge.issues,
      error: error instanceof Error ? error.message : String(error),
      conflictRetried: true,
    };
  }
}

// ─── ProductContext helpers ───────────────────────────────────────────────────

export function getProductContext(state: ConversationState, slug: string): ProductContext {
  return state.product_contexts[slug] ?? { ...DEFAULT_PRODUCT_CONTEXT, information_shared: [], known_product_facts: [] };
}

export function syncGlobalToProductContext(state: ConversationState, slug: string): ConversationState {
  if (!(AGENT_KEYS as readonly string[]).includes(slug)) return state;

  const exists = slug in state.product_contexts;
  const contextCount = Object.keys(state.product_contexts).length;
  if (!exists && contextCount >= MAX_PRODUCT_CONTEXTS) return state; // limite atingido

  const existing = getProductContext(state, slug);
  const updated: ProductContext = {
    funnel_stage: state.funnel_stage,
    current_objection: state.current_objection,
    purchase_intent: state.purchase_intent,
    information_shared: unique([...existing.information_shared, ...state.information_already_shared]),
    known_product_facts: unique([...existing.known_product_facts]).slice(-MAX_PRODUCT_FACTS),
    last_agent_question: state.last_julia_question,
    payment_method: state.payment_method,
    promised_payment_at: state.promised_payment_at,
    agreed_next_action: state.agreed_next_action,
    product_summary: state.conversation_summary.slice(0, PRODUCT_SUMMARY_LIMIT),
  };

  return {
    ...state,
    product_contexts: { ...state.product_contexts, [slug]: updated },
  };
}

export function hydrateFromProductContext(state: ConversationState, slug: string): ConversationState {
  if (!(AGENT_KEYS as readonly string[]).includes(slug)) return state;
  if (!(slug in state.product_contexts)) return state;

  const ctx = state.product_contexts[slug];
  return {
    ...state,
    funnel_stage: ctx.funnel_stage,
    current_objection: ctx.current_objection,
    purchase_intent: ctx.purchase_intent,
    information_already_shared: [...ctx.information_shared],
    last_julia_question: ctx.last_agent_question,
    payment_method: ctx.payment_method,
    promised_payment_at: ctx.promised_payment_at,
    agreed_next_action: ctx.agreed_next_action,
  };
}
