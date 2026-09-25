// ─────────────────────────────────────────────────────────────────────────────
// CÉREBRO COMERCIAL DA JÚLIA — commercial-brain.ts
// Componente interno: decide a estratégia do turno.
// NÃO conversa com clientes. NÃO executa tools. NÃO escreve copy.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConversationState } from "./conversation-state.ts";

// ─── Enums e constantes ───────────────────────────────────────────────────────

export const TURN_GOALS = [
  "answer_question",    // responder pergunta explícita
  "handle_objection",   // trabalhar objeção identificada
  "close_sale",         // conduzir para fechamento
  "send_payment",       // encaminhar pagamento (Pix, link)
  "registration",       // coleta de dados para matrícula
  "discover_need",      // entender o que a pessoa procura
  "qualify",            // qualificar interesse/perfil
  "explain_product",    // apresentar produto/curso
  "follow_up",          // retornar após silêncio
  "support",            // suporte pós-venda / aluno ativo
  "handoff",            // transferir para humano
  "no_response",        // sem ação neste turno
] as const;

export const ACTIONS = [
  "answer_only",        // responder apenas — sem pitch
  "handle_objection",   // técnica de contorno de objeção
  "close_sale",         // conduzir fechamento
  "send_payment",       // enviar dados de pagamento
  "collect_data",       // coletar dados pessoais/cadastrais
  "explain_product",    // apresentar produto
  "discover_need",      // perguntas de diagnóstico
  "qualify",            // qualificar lead
  "follow_up",          // follow-up contextualizado
  "support",            // suporte aluno
  "handoff",            // transferir para humano
  "no_response",        // nenhuma ação
] as const;

export const CLOSING_STAGES = [
  "none",
  "soft_close",           // perguntar se quer fechar
  "direct_close",         // pedir a inscrição diretamente
  "confirm_registration", // confirmar dados e enviar link
] as const;

export const OBJECTION_STRATEGIES = [
  "acknowledge_and_reframe",   // reconhecer e recontextualizar
  "clarify_financial",         // esclarecer parcelamento/valor
  "schedule_alternative",      // sugerir outra turma/data
  "third_party_involvement",   // envolver quem decide
  "address_trust",             // construir confiança
  "highlight_benefits",        // reforçar benefícios
  "reduce_pressure",           // diminuir pressão de venda
] as const;

export const RESPONSE_LENGTHS = ["short", "medium", "long"] as const;
export const RESPONSE_STYLES = ["direct", "empathetic", "educational", "commercial"] as const;

export type TurnGoal = typeof TURN_GOALS[number];
export type TurnAction = typeof ACTIONS[number];
export type ClosingStage = typeof CLOSING_STAGES[number];
export type ObjectionStrategy = typeof OBJECTION_STRATEGIES[number];
export type ResponseLength = typeof RESPONSE_LENGTHS[number];
export type ResponseStyle = typeof RESPONSE_STYLES[number];

// Lista das tools reais do processar-bot (mantida em sincronia com TOOLS em index.ts)
export const VALID_BRAIN_TOOLS = [
  "atualizar_lead",
  "pontuar_lead",
  "consultar_contexto_lead",
  "consultar_produtos",
  "registrar_nota",
  "mover_etapa",
  "consultar_turmas",
  "consultar_pagamento",
  "classificar_lead",
  "reservar_vaga",
  "cadastrar_aluno",
  "agendar_reuniao",
  "adicionar_grupo_turma",
  "enviar_material",
  "marcar_nao_contatar",
  "criar_tarefa",
  "solicitar_handoff",
] as const;

export type ValidBrainTool = typeof VALID_BRAIN_TOOLS[number];
const VALID_TOOL_SET = new Set<string>(VALID_BRAIN_TOOLS);

// Campos de copy proibidos na decisão (o Cérebro pensa, a Júlia escreve)
const FORBIDDEN_COPY_FIELDS = ["message", "response", "text", "copy", "resposta", "mensagem", "texto"];

// ─── Interface da decisão comercial ──────────────────────────────────────────

export interface CommercialDecision {
  turn_goal: TurnGoal;
  action: TurnAction;
  must_answer_user: boolean;
  should_sell: boolean;
  should_ask_question: boolean;
  question_goal: string | null;
  objection_strategy: ObjectionStrategy | null;
  closing_stage: ClosingStage;
  required_information: string[];
  recommended_tools: ValidBrainTool[];
  response_length: ResponseLength;
  response_style: ResponseStyle;
  avoid_repeating: string[];
  wait_for_user: boolean;
  handoff_required: boolean;
  no_response: boolean;
  confidence: number;
  reason_code: string;
}

export interface CommercialDecisionResult {
  decision: CommercialDecision;
  issues: string[];
  usedFallback: boolean;
}

// ─── Fallback padrão ──────────────────────────────────────────────────────────

export function createCommercialBrainFallback(state?: Pick<ConversationState, "handoff_active" | "do_not_contact">): CommercialDecision {
  const handoff = state?.handoff_active === true;
  const doNotContact = state?.do_not_contact === true;
  return {
    turn_goal: doNotContact ? "no_response" : handoff ? "handoff" : "answer_question",
    action: doNotContact ? "no_response" : handoff ? "handoff" : "answer_only",
    must_answer_user: !doNotContact && !handoff,
    should_sell: false,
    should_ask_question: false,
    question_goal: null,
    objection_strategy: null,
    closing_stage: "none",
    required_information: [],
    recommended_tools: handoff ? ["solicitar_handoff"] : [],
    response_length: "short",
    response_style: "direct",
    avoid_repeating: [],
    wait_for_user: false,
    handoff_required: handoff,
    no_response: doNotContact,
    confidence: 0,
    reason_code: "brain_fallback",
  };
}

// ─── Validação da saída do modelo ────────────────────────────────────────────

export function validateCommercialDecision(output: unknown): { decision: CommercialDecision | null; issues: string[] } {
  const issues: string[] = [];

  if (!output || typeof output !== "object" || Array.isArray(output)) {
    issues.push("output: esperado objeto");
    return { decision: null, issues };
  }

  const src = output as Record<string, unknown>;

  // Verificar campos de copy proibidos
  for (const forbidden of FORBIDDEN_COPY_FIELDS) {
    if (forbidden in src) issues.push(`${forbidden}: campo de copy proibido na decisão do Cérebro`);
  }

  // Campos obrigatórios
  const requiredFields = [
    "turn_goal", "action", "must_answer_user", "should_sell", "should_ask_question",
    "question_goal", "objection_strategy", "closing_stage", "required_information",
    "recommended_tools", "response_length", "response_style", "avoid_repeating",
    "wait_for_user", "handoff_required", "no_response", "confidence", "reason_code",
  ];
  for (const field of requiredFields) {
    if (!(field in src)) issues.push(`${field}: campo obrigatório ausente`);
  }
  if (issues.some(i => i.includes("campo obrigatório ausente"))) {
    return { decision: null, issues };
  }

  // Validar enums
  const turn_goal = src.turn_goal;
  if (!TURN_GOALS.includes(turn_goal as TurnGoal)) {
    issues.push(`turn_goal: valor inválido "${turn_goal}"`);
  }
  const action = src.action;
  if (!ACTIONS.includes(action as TurnAction)) {
    issues.push(`action: valor inválido "${action}"`);
  }
  const closing_stage = src.closing_stage;
  if (!CLOSING_STAGES.includes(closing_stage as ClosingStage)) {
    issues.push(`closing_stage: valor inválido "${closing_stage}"`);
  }
  const response_length = src.response_length;
  if (!RESPONSE_LENGTHS.includes(response_length as ResponseLength)) {
    issues.push(`response_length: valor inválido "${response_length}"`);
  }
  const response_style = src.response_style;
  if (!RESPONSE_STYLES.includes(response_style as ResponseStyle)) {
    issues.push(`response_style: valor inválido "${response_style}"`);
  }
  const objection_strategy = src.objection_strategy;
  if (objection_strategy !== null && !OBJECTION_STRATEGIES.includes(objection_strategy as ObjectionStrategy)) {
    issues.push(`objection_strategy: valor inválido "${objection_strategy}"`);
  }

  // Validar booleanos
  for (const boolField of ["must_answer_user", "should_sell", "should_ask_question", "wait_for_user", "handoff_required", "no_response"]) {
    if (typeof src[boolField] !== "boolean") issues.push(`${boolField}: esperado booleano`);
  }

  // Validar confidence
  const confidence = Number(src.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    issues.push(`confidence: esperado número entre 0 e 1, recebido "${src.confidence}"`);
  }

  // Validar reason_code
  const reason_code = src.reason_code;
  if (typeof reason_code !== "string" || reason_code.trim() === "" || reason_code.length > 50) {
    issues.push(`reason_code: esperado string curto não vazio (máx 50 chars)`);
  }

  // Validar arrays
  const question_goal = src.question_goal;
  if (question_goal !== null && typeof question_goal !== "string") {
    issues.push(`question_goal: esperado string ou null`);
  }
  if (!Array.isArray(src.required_information)) issues.push("required_information: esperado array");
  if (!Array.isArray(src.avoid_repeating)) issues.push("avoid_repeating: esperado array");

  // Validar recommended_tools
  let recommended_tools: ValidBrainTool[] = [];
  if (!Array.isArray(src.recommended_tools)) {
    issues.push("recommended_tools: esperado array");
  } else {
    const invalidTools: string[] = [];
    for (const tool of src.recommended_tools) {
      if (typeof tool === "string" && VALID_TOOL_SET.has(tool)) {
        recommended_tools.push(tool as ValidBrainTool);
      } else {
        invalidTools.push(String(tool));
        issues.push(`recommended_tools: tool inexistente "${tool}" removida`);
      }
    }
  }

  if (issues.some(i => i.includes("valor inválido") && !i.includes("tool inexistente"))) {
    return { decision: null, issues };
  }
  if (issues.some(i => i.includes("esperado booleano") || i.includes("esperado string curto"))) {
    return { decision: null, issues };
  }

  const decision: CommercialDecision = {
    turn_goal: (TURN_GOALS.includes(turn_goal as TurnGoal) ? turn_goal : "answer_question") as TurnGoal,
    action: (ACTIONS.includes(action as TurnAction) ? action : "answer_only") as TurnAction,
    must_answer_user: Boolean(src.must_answer_user),
    should_sell: Boolean(src.should_sell),
    should_ask_question: Boolean(src.should_ask_question),
    question_goal: typeof question_goal === "string" ? question_goal.trim().slice(0, 200) : null,
    objection_strategy: (objection_strategy && OBJECTION_STRATEGIES.includes(objection_strategy as ObjectionStrategy))
      ? objection_strategy as ObjectionStrategy : null,
    closing_stage: (CLOSING_STAGES.includes(closing_stage as ClosingStage) ? closing_stage : "none") as ClosingStage,
    required_information: Array.isArray(src.required_information)
      ? (src.required_information as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 10)
      : [],
    recommended_tools,
    response_length: (RESPONSE_LENGTHS.includes(response_length as ResponseLength) ? response_length : "short") as ResponseLength,
    response_style: (RESPONSE_STYLES.includes(response_style as ResponseStyle) ? response_style : "direct") as ResponseStyle,
    avoid_repeating: Array.isArray(src.avoid_repeating)
      ? (src.avoid_repeating as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 20)
      : [],
    wait_for_user: Boolean(src.wait_for_user),
    handoff_required: Boolean(src.handoff_required),
    no_response: Boolean(src.no_response),
    confidence: Math.max(0, Math.min(1, isNaN(confidence) ? 0 : confidence)),
    reason_code: typeof reason_code === "string" ? reason_code.trim().slice(0, 50) : "brain_fallback",
  };

  return { decision, issues };
}

// ─── Políticas determinísticas ────────────────────────────────────────────────
// Aplicadas APÓS a decisão do modelo. Regras invioláveis.

export function applyCommercialDecisionPolicies(
  decision: CommercialDecision,
  state: ConversationState,
): CommercialDecision {
  const result = { ...decision };

  // 1. do_not_contact: silêncio absoluto
  if (state.do_not_contact) {
    result.no_response = true;
    result.should_sell = false;
    result.should_ask_question = false;
    result.handoff_required = false;
    result.turn_goal = "no_response";
    result.action = "no_response";
    result.recommended_tools = [];
    return result;
  }

  // 2. handoff_active: não continuar venda — apenas concluir handoff
  if (state.handoff_active) {
    result.handoff_required = true;
    result.should_sell = false;
    result.turn_goal = "handoff";
    result.action = "handoff";
    if (!result.recommended_tools.includes("solicitar_handoff")) {
      result.recommended_tools = [...result.recommended_tools, "solicitar_handoff"];
    }
  }

  // 3. handoff_required: garantir tool
  if (result.handoff_required && !result.recommended_tools.includes("solicitar_handoff")) {
    result.recommended_tools = [...result.recommended_tools, "solicitar_handoff"];
  }

  // 4. no_response: coerência total
  if (result.no_response || result.action === "no_response" || result.turn_goal === "no_response") {
    result.no_response = true;
    result.turn_goal = "no_response";
    result.action = "no_response";
    result.must_answer_user = false;
    result.should_sell = false;
    result.should_ask_question = false;
    result.question_goal = null;
    if (!state.handoff_active) result.handoff_required = false;
  }

  // 5. explicit_question: obrigar resposta
  if (state.explicit_question) {
    result.must_answer_user = true;
  }

  // 6. answer_only: nunca acrescentar pergunta — coerência Fix#1
  if (result.action === "answer_only") {
    result.should_ask_question = false;
    result.question_goal = null;
  }

  // 7. should_ask_question sem question_goal: corrigir
  if (result.should_ask_question && !result.question_goal) {
    result.should_ask_question = false;
  }

  // 8. purchase_intent = "clear": não regredir
  if (state.purchase_intent === "clear") {
    const regressiveGoals: TurnGoal[] = ["discover_need", "qualify", "explain_product"];
    if (regressiveGoals.includes(result.turn_goal)) {
      result.turn_goal = "close_sale";
      result.action = "close_sale";
      result.should_sell = true;
    }
  }

  // 9. send_payment sem payment_method escolhido: pedir escolha antes — Fix#6
  if (result.action === "send_payment" && !state.payment_method) {
    result.should_ask_question = true;
    if (!result.question_goal) {
      result.question_goal =
        "Pergunte qual forma de pagamento prefere: à vista (Pix) ou parcelado no cartão. Não envie dados de pagamento antes da escolha explícita.";
    }
  }

  // 10. information_already_shared: alimentar avoid_repeating
  if (state.information_already_shared.length) {
    const existing = new Set(result.avoid_repeating);
    for (const item of state.information_already_shared) {
      existing.add(item);
    }
    result.avoid_repeating = [...existing];
  }

  // 11. Nunca recomendar consultar_contexto_lead: contexto já é injetado — Fix#7
  result.recommended_tools = result.recommended_tools.filter(
    t => t !== "consultar_contexto_lead",
  ) as ValidBrainTool[];

  // 12. follow_up: usar criar_tarefa, não agendar_reuniao — Fix#9
  if (result.action === "follow_up" || result.turn_goal === "follow_up") {
    result.recommended_tools = result.recommended_tools.filter(
      t => t !== "agendar_reuniao",
    ) as ValidBrainTool[];
  }

  // 13. handle_objection financeira: não recomendar pontuar_lead no primeiro turno — Fix#8
  if (
    result.action === "handle_objection" &&
    (result.reason_code.includes("financial") || result.objection_strategy === "clarify_financial")
  ) {
    result.recommended_tools = result.recommended_tools.filter(
      t => t !== "pontuar_lead",
    ) as ValidBrainTool[];
  }

  // 14. Filtrar tools inválidas que possam ter escapado
  result.recommended_tools = result.recommended_tools.filter(t => VALID_TOOL_SET.has(t)) as ValidBrainTool[];

  return result;
}

// ─── Preparar contexto do histórico para o Cérebro ────────────────────────────

export interface BrainMessage {
  direction: "entrada" | "saida";
  content: string | null;
  mediaType?: string | null;
}

function brainMessageText(msg: BrainMessage): string {
  const content = msg.content?.trim();
  if (content && content !== "[Mídia]" && content !== "[Imagem]") return content;
  const type = msg.mediaType?.trim().toLowerCase();
  return type ? `[A pessoa enviou uma ${type}]` : "[A pessoa enviou uma mídia sem descrição disponível]";
}

export function prepareCommercialBrainConversation(messages: BrainMessage[]): {
  history: string;
  lastMessage: string;
} {
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "entrada") { lastUserIndex = i; break; }
  }
  if (lastUserIndex < 0) {
    return { history: "", lastMessage: "[Nenhuma mensagem do usuário disponível]" };
  }
  const history = messages
    .slice(Math.max(0, lastUserIndex - 8), lastUserIndex)
    .map(m => `${m.direction === "saida" ? "Júlia" : "Cliente"}: ${brainMessageText(m)}`)
    .join("\n");
  return { history, lastMessage: brainMessageText(messages[lastUserIndex]) };
}

// ─── Contexto operacional para o Cérebro ─────────────────────────────────────

export interface BrainOperationalContext {
  agentMode: string;
  leadScore?: number | null;
  crmStage?: string | null;
  contactType?: string;
  humanServiceActive?: boolean;
}

// ─── Construir prompt do usuário para o Cérebro ───────────────────────────────

export function buildCommercialBrainInput(
  state: ConversationState,
  history: string,
  lastMessage: string,
  operational: BrainOperationalContext,
): string {
  const lines: string[] = [];
  lines.push("## ESTADO ATUAL DA CONVERSA");
  lines.push(`Funil: ${state.funnel_stage} | Temperatura: ${state.temperature} | Intenção de compra: ${state.purchase_intent}`);
  lines.push(`Intenção detectada: ${state.current_intent}`);
  if (state.explicit_question) lines.push(`Pergunta explícita: ${state.explicit_question}`);
  if (state.main_need) lines.push(`Necessidade principal: ${state.main_need}`);
  if (state.current_objection) lines.push(`Objeção ativa: ${state.current_objection}`);
  if (state.current_product) lines.push(`Produto: ${state.current_product}`);
  if (state.last_julia_question) lines.push(`Última pergunta de Júlia: ${state.last_julia_question}`);
  if (state.awaiting && state.awaiting !== "none") lines.push(`Aguardando: ${state.awaiting}`);
  if (state.information_already_shared.length) {
    lines.push(`Já apresentado: ${state.information_already_shared.join(", ")}`);
  }
  if (state.known_user_facts.length) {
    lines.push(`Fatos conhecidos: ${state.known_user_facts.slice(0, 5).join(" | ")}`);
  }
  lines.push(`Handoff ativo: ${state.handoff_active ? "sim" : "não"}`);
  lines.push(`Não contatar: ${state.do_not_contact ? "sim" : "não"}`);

  lines.push("");
  lines.push("## CONTEXTO OPERACIONAL");
  lines.push(`Modo: ${operational.agentMode}`);
  if (operational.crmStage) lines.push(`Etapa CRM: ${operational.crmStage}`);
  if (operational.leadScore != null) lines.push(`Score: ${operational.leadScore}`);
  if (operational.humanServiceActive) lines.push(`Atendimento humano paralelo: sim`);

  if (history) {
    lines.push("");
    lines.push("## HISTÓRICO RECENTE");
    lines.push(history);
  }

  lines.push("");
  lines.push("## ÚLTIMA MENSAGEM DO CLIENTE");
  lines.push(lastMessage);

  return lines.join("\n");
}

// ─── Log operacional (sem dados pessoais) ────────────────────────────────────

export function toCommercialDecisionLog(decision: CommercialDecision): object {
  return {
    turn_goal: decision.turn_goal,
    action: decision.action,
    reason_code: decision.reason_code,
    confidence: decision.confidence,
    recommended_tools: decision.recommended_tools,
    response_length: decision.response_length,
    handoff_required: decision.handoff_required,
    no_response: decision.no_response,
    should_sell: decision.should_sell,
  };
}

// ─── Formatar bloco de decisão para a Júlia ──────────────────────────────────

export function formatCommercialDecisionContext(decision: CommercialDecision): string {
  if (decision.no_response) return "";

  const lines: string[] = [
    "\n\n---",
    "# DECISÃO COMERCIAL PARA ESTE TURNO",
    "As orientações abaixo são internas. Nunca as cite para o contato.",
    "Elas orientam seu comportamento — não são texto a ser copiado.",
    "",
    `Objetivo do turno: ${decision.turn_goal}`,
    `Ação recomendada: ${decision.action}`,
    `Deve responder diretamente: ${decision.must_answer_user ? "sim" : "não"}`,
    `Deve vender ativamente: ${decision.should_sell ? "sim" : "não"}`,
  ];

  if (decision.should_ask_question && decision.question_goal) {
    lines.push(`Deve fazer uma pergunta: sim — objetivo: ${decision.question_goal}`);
  } else {
    lines.push(`Deve fazer uma pergunta: não`);
  }

  if (decision.objection_strategy) {
    lines.push(`Estratégia de objeção: ${decision.objection_strategy}`);
  }

  if (decision.closing_stage !== "none") {
    lines.push(`Estágio de fechamento: ${decision.closing_stage}`);
  }

  if (decision.recommended_tools.length) {
    lines.push(`Tools recomendadas: ${decision.recommended_tools.join(", ")}`);
  }

  lines.push(`Tamanho da resposta: ${decision.response_length}`);
  lines.push(`Estilo: ${decision.response_style}`);

  if (decision.avoid_repeating.length) {
    lines.push(`Não repetir: ${decision.avoid_repeating.slice(0, 8).join(", ")}`);
  }

  if (decision.handoff_required) {
    lines.push(`Transferência para humano: necessária — use solicitar_handoff`);
  }

  lines.push("");
  lines.push("─── GUARDRAILS PERMANENTES ───");
  lines.push("1. Condições comerciais: só cite valores/condições retornados por consultar_produtos ou consultar_pagamento.");
  lines.push("   NUNCA invente: desconto, extensão de parcelas, bolsa, exceção, negociação especial, condição personalizada.");
  lines.push("   Se a condição oficial é 12x, não sugira 'talvez dê para fazer em mais vezes'.");
  lines.push("2. Tools de solicitação (reservar_vaga, cadastrar_aluno, agendar_reuniao, adicionar_grupo_turma, enviar_material)");
  lines.push("   criam apenas PEDIDOS — não confirmam ação concluída. Diga 'solicitei'/'registrei', NUNCA 'está reservado'/'foi confirmado'.");
  lines.push("3. Tools diretas (mover_etapa, registrar_nota, classificar_lead, marcar_nao_contatar, solicitar_handoff, criar_tarefa)");
  lines.push("   têm efeito imediato — mas só use quando há necessidade operacional clara.");
  lines.push("4. Não altere CRM (classificar_lead, mover_etapa, atualizar_lead, pontuar_lead) como efeito colateral automático.");
  lines.push("5. answer_only = resposta direta sem qualificação, diagnóstico ou perguntas adicionais.");
  lines.push("");
  lines.push("Siga essas orientações. Elas não substituem bom senso, segurança ou as tools.");

  return lines.join("\n");
}

// ─── Prompt do Cérebro Comercial ──────────────────────────────────────────────

export const COMMERCIAL_BRAIN_PROMPT = `# CÉREBRO COMERCIAL — JÚLIA GEx

Você é um componente interno do sistema comercial do Grupo Excellence.
Você NÃO conversa com clientes.
Você NÃO escreve mensagens, copy ou textos de resposta.
Você NÃO executa ferramentas.
Você NÃO altera o banco de dados.
Você NÃO decide o que Júlia vai dizer — você decide O QUE ela deve fazer.

Sua única função é analisar a situação atual e devolver uma DECISÃO ESTRATÉGICA para o próximo turno.

## PRIORIDADES (em ordem decrescente)

1. Responder o que foi perguntado — se há uma pergunta explícita, ela deve ser respondida.
2. Não transformar pergunta simples em pitch — "onde acontece?" não deve gerar uma venda.
3. Não fazer diagnóstico desnecessário — se o produto já é conhecido, não pergunte de novo.
4. Não perguntar sem função — só sugira pergunta se tiver impacto real na conversa.
5. Não repetir informações já apresentadas — use o campo avoid_repeating.
6. Facilitar a compra quando a decisão já foi tomada — remove obstáculos, não cria novos.
7. Trabalhar objeções com estratégia — não ignore, não force.
8. Decidir apenas o PRÓXIMO passo — não tente cobrir vários turnos de uma vez.

## REGRAS ABSOLUTAS

- Não inclua campos de copy (message, response, text, copy, resposta, mensagem, texto).
- Não altere handoff_active nem do_not_contact — esses campos são controlados pelo sistema.
- Se handoff_active = true: turn_goal = handoff, action = handoff, recommended_tools inclui solicitar_handoff.
- Se do_not_contact = true: no_response = true, action = no_response.
- Se handoff_required = true: recommended_tools DEVE incluir solicitar_handoff.
- Se should_ask_question = true: question_goal DEVE ser preenchido.

## SOBRE INTENÇÕES

- "Quero fechar" / "Quanto custa?" / "Tem turma?" → resposta direta, sem pitch desnecessário.
- "Quero muito mas..." → objeção, não recusa.
- "Pode mandar o Pix" → send_payment + consultar_pagamento. payment_method já implícito = pix.
- "Como faço o pagamento?" (sem escolha) → send_payment mas orientar escolha à vista/parcelado antes de enviar Pix.
- "Me chama alguém" / "Quero falar com pessoa" → handoff.
- "Obrigado" sem pendência → no_response ou wait_for_user.
- "Pode me mandar mensagem amanhã" / "Vou pensar" → follow_up: criar_tarefa + registrar_nota. NÃO agendar_reuniao.

## REGRAS DE COERÊNCIA DE AÇÃO

- action = answer_only → should_ask_question = false, question_goal = null. Sem qualificação, sem diagnóstico.
- action = no_response → should_ask_question = false, should_sell = false, handoff_required = false (salvo operacional).
- action = handoff → handoff_required = true, recommended_tools inclui solicitar_handoff.
- action = send_payment + payment_method não definido → orientar escolha de forma de pagamento primeiro.
- action = follow_up → NÃO inclua agendar_reuniao em recommended_tools.
- Objeção financeira (primeiro turno) → recommended_tools não inclui pontuar_lead.
- Nunca inclua consultar_contexto_lead: o contexto já está injetado no prompt.

Use a ferramenta decidir_turno_comercial para retornar a decisão estruturada.`;

// ─── Tool do Cérebro Comercial ────────────────────────────────────────────────

export const COMMERCIAL_BRAIN_TOOL = {
  name: "decidir_turno_comercial",
  description: "Retorna a decisão estratégica para o próximo turno da conversa.",
  input_schema: {
    type: "object" as const,
    properties: {
      turn_goal: {
        type: "string",
        enum: [...TURN_GOALS],
        description: "Objetivo do turno",
      },
      action: {
        type: "string",
        enum: [...ACTIONS],
        description: "Ação recomendada para Júlia",
      },
      must_answer_user: { type: "boolean", description: "Júlia deve responder diretamente ao contato" },
      should_sell: { type: "boolean", description: "Há oportunidade de venda ativa neste turno" },
      should_ask_question: { type: "boolean", description: "Júlia deve fazer uma pergunta" },
      question_goal: { type: ["string", "null"], description: "Objetivo da pergunta (obrigatório se should_ask_question = true)" },
      objection_strategy: {
        type: ["string", "null"],
        enum: [null, ...OBJECTION_STRATEGIES],
        description: "Estratégia para objeção identificada",
      },
      closing_stage: {
        type: "string",
        enum: [...CLOSING_STAGES],
        description: "Estágio de fechamento",
      },
      required_information: {
        type: "array",
        items: { type: "string" },
        description: "Informações ainda necessárias para avançar",
      },
      recommended_tools: {
        type: "array",
        items: { type: "string", enum: [...VALID_BRAIN_TOOLS] },
        description: "Tools que Júlia deve chamar neste turno",
      },
      response_length: {
        type: "string",
        enum: [...RESPONSE_LENGTHS],
        description: "Tamanho esperado da resposta",
      },
      response_style: {
        type: "string",
        enum: [...RESPONSE_STYLES],
        description: "Tom/estilo da resposta",
      },
      avoid_repeating: {
        type: "array",
        items: { type: "string" },
        description: "Informações já apresentadas que não devem ser repetidas",
      },
      wait_for_user: { type: "boolean", description: "Aguardar resposta do usuário antes de agir" },
      handoff_required: { type: "boolean", description: "Transferência para humano necessária" },
      no_response: { type: "boolean", description: "Não responder neste turno" },
      confidence: { type: "number", description: "Confiança na decisão (0.0 a 1.0)" },
      reason_code: { type: "string", description: "Código curto da razão da decisão (ex: direct_question, financial_objection)" },
    },
    required: [
      "turn_goal", "action", "must_answer_user", "should_sell", "should_ask_question",
      "question_goal", "objection_strategy", "closing_stage", "required_information",
      "recommended_tools", "response_length", "response_style", "avoid_repeating",
      "wait_for_user", "handoff_required", "no_response", "confidence", "reason_code",
    ],
  },
};

// ─── Chamada principal ao Cérebro ─────────────────────────────────────────────

export interface AnthropicClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      tools: typeof COMMERCIAL_BRAIN_TOOL[];
      tool_choice: { type: string };
      messages: { role: "user"; content: string }[];
    }): Promise<{
      content: Array<{ type: string; name?: string; input?: unknown }>;
    }>;
  };
}

export async function decideCommercialTurn(
  anthropic: AnthropicClient,
  state: ConversationState,
  messages: BrainMessage[],
  operational: BrainOperationalContext,
): Promise<CommercialDecisionResult> {
  const fallback = createCommercialBrainFallback(state);

  // Casos determinísticos — não chamar o modelo
  if (state.do_not_contact) {
    return { decision: fallback, issues: ["do_not_contact: decisão determinística"], usedFallback: true };
  }

  const { history, lastMessage } = prepareCommercialBrainConversation(messages);
  const userContent = buildCommercialBrainInput(state, history, lastMessage, operational);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: COMMERCIAL_BRAIN_PROMPT,
      tools: [COMMERCIAL_BRAIN_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userContent }],
    });

    const toolBlock = response.content.find(b => b.type === "tool_use" && b.name === "decidir_turno_comercial");
    if (!toolBlock || !toolBlock.input) {
      return { decision: applyCommercialDecisionPolicies(fallback, state), issues: ["brain: sem tool_use na resposta"], usedFallback: true };
    }

    const { decision, issues } = validateCommercialDecision(toolBlock.input);
    if (!decision) {
      return { decision: applyCommercialDecisionPolicies(fallback, state), issues: ["brain: decisão inválida", ...issues], usedFallback: true };
    }

    const enforced = applyCommercialDecisionPolicies(decision, state);
    return { decision: enforced, issues, usedFallback: false };
  } catch (err) {
    return {
      decision: applyCommercialDecisionPolicies(fallback, state),
      issues: [`brain: erro na chamada: ${err instanceof Error ? err.message : String(err)}`],
      usedFallback: true,
    };
  }
}
