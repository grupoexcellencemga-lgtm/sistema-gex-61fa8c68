// ────────────────────────────────────────────────────────────────────────────
// JUIZ DA RESPOSTA DA JÚLIA — response-judge.ts
// Avalia a resposta candidata antes do envio.
// NÃO conversa com o cliente. NÃO executa tools. NÃO altera CRM.
// Responde apenas: aprovar | reescrever | bloquear.
// ────────────────────────────────────────────────────────────────────────────

import type { CommercialDecision } from "./commercial-brain.ts";
import type { ConversationState } from "./conversation-state.ts";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const JUDGE_VERDICTS = ["approve", "rewrite", "block"] as const;
export const JUDGE_SEVERITIES = ["none", "low", "medium", "high", "critical"] as const;

export type JudgeVerdict = typeof JUDGE_VERDICTS[number];
export type JudgeSeverity = typeof JUDGE_SEVERITIES[number];

export const JUDGE_ISSUE_CODES = [
  "unverified_claim",
  "unauthorized_payment_condition",
  "false_tool_completion",
  "brain_mismatch",
  "ignored_explicit_question",
  "unnecessary_question",
  "repeated_information",
  "too_verbose",
  "robotic_language",
  "premature_sale",
  "handoff_violation",
  "do_not_contact_violation",
  "tool_failure_ignored",
  "internal_information_exposed",
  "no_response_violated",
  "pressure_tactics",
  "missing_required_response",
] as const;

export type JudgeIssueCode = typeof JUDGE_ISSUE_CODES[number];

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface JudgeToolResult {
  tool: string;
  input: Record<string, unknown>;
  resultado: string;
  success: boolean;
  // "completed" = ação real executada / "requested" = apenas solicitação criada / "query" = leitura
  status: "completed" | "requested" | "query" | "error";
}

export interface JudgeDecision {
  verdict: JudgeVerdict;
  severity: JudgeSeverity;
  issues: JudgeIssueCode[];
  brain_alignment: boolean;
  tool_alignment: boolean;
  answered_user: boolean;
  contains_unverified_claim: boolean;
  contains_unauthorized_offer: boolean;
  contains_false_completion: boolean;
  unnecessary_question: boolean;
  unnecessary_repetition: boolean;
  too_long: boolean;
  sounds_robotic: boolean;
  rewrite_instructions: string[];
  confidence: number;
  reason_code: string;
}

export interface CandidateValidationResult {
  safe: boolean;
  requires_judge: boolean;
  critical_block: boolean;
  reasons: string[];
}

export interface JudgeContext {
  clientMessage: string;
  conversationState: ConversationState;
  decision: CommercialDecision;
  candidateResponse: string;
  toolResults: JudgeToolResult[];
  previousMessages?: Array<{ role: "client" | "julia"; content: string }>;
}

export interface JudgePipelineResult {
  finalResponse: string | null;
  blocked: boolean;
  verdict: JudgeVerdict;
  judgeRan: boolean;
  rewritePerformed: boolean;
  validation: CandidateValidationResult;
  judgeDecision: JudgeDecision | null;
  judgeUsedFallback: boolean;
  metrics: {
    judgeInputTokens: number;
    judgeOutputTokens: number;
    rewriteInputTokens: number;
    rewriteOutputTokens: number;
    judgeMs: number;
    rewriteMs: number;
  };
}

// ─── Classificação de status das tools ───────────────────────────────────────

// Tools que apenas criam solicitações (não executam a ação diretamente)
const REQUEST_ONLY_TOOLS = new Set([
  "reservar_vaga",
  "cadastrar_aluno",
  "agendar_reuniao",
  "adicionar_grupo_turma",
  "enviar_material",
]);

// Tools de leitura (não alteram estado)
const QUERY_TOOLS = new Set([
  "consultar_contexto_lead",
  "consultar_produtos",
  "consultar_turmas",
  "consultar_pagamento",
]);

// Tools de alto risco comercial (sempre rodar juiz)
const HIGH_RISK_TOOLS = new Set([
  "reservar_vaga",
  "cadastrar_aluno",
  "solicitar_handoff",
  "agendar_reuniao",
  "adicionar_grupo_turma",
  "enviar_material",
]);

// Tools relacionadas a pagamento
const PAYMENT_TOOLS = new Set(["consultar_pagamento"]);

export function inferToolStatus(toolName: string, resultado: string): JudgeToolResult["status"] {
  if (resultado.includes('"ok":false') || resultado.includes("Erro ao") || resultado.includes("não foi confirmada")) {
    return "error";
  }
  if (REQUEST_ONLY_TOOLS.has(toolName)) return "requested";
  if (QUERY_TOOLS.has(toolName)) return "query";
  return "completed";
}

// ─── Padrões de falsas conclusões ─────────────────────────────────────────────

const FALSE_COMPLETION_PATTERNS = [
  /\b(sua\s+)?(vaga\s+(está|foi|já\s+(foi|está))\s*(reservada|confirmada|garantida))/i,
  /\b(a\s+)?(inscrição\s+(está|foi|já\s+foi)\s*(confirmada|realizada|efetuada|concluída))/i,
  /\b(o\s+)?(pagamento\s+(foi|já\s+foi)\s*(confirmado|recebido|processado|efetuado))/i,
  /\b(você\s+(já\s+está|foi)\s*cadastrad[oa])/i,
  /\b(a\s+)?(reunião\s+(foi|já\s+foi|está)\s*(agendada|marcada|confirmada))/i,
  /\b(o\s+)?(material\s+(foi|já\s+foi)\s*(enviado|encaminhado))/i,
  /\b(você\s+(foi|já\s+foi)\s*adicionad[oa]\s+ao\s+grupo)/i,
  /\b(o\s+)?(aluno\s+(foi|já\s+foi)\s*cadastrad[oa])/i,
];

function containsFalseCompletion(text: string, toolResults: JudgeToolResult[]): boolean {
  const hasRequestedTool = toolResults.some((t) => t.status === "requested");
  if (!hasRequestedTool) return false;
  return FALSE_COMPLETION_PATTERNS.some((p) => p.test(text));
}

// ─── Padrões de linguagem robótica ────────────────────────────────────────────

const ROBOTIC_PATTERNS = [
  /entendo\s+perfeitamente/i,
  /será\s+um\s+prazer\s+ajud/i,
  /excelente\s+pergunta/i,
  /ótima\s+pergunta/i,
  /como\s+posso\s+te\s+ajudar\s+(hoje|mais)/i,
  /estou\s+aqui\s+para\s+ajud/i,
  /\bclaro\s*[!,]\s*(com\s+certeza|claro\s+que\s+sim)/i,
  /não\s+se\s+preocupe,\s+estou\s+aqui/i,
  /absolutamente,\s+(entendo|compreendo)/i,
  /ficaria\s+muito\s+feliz\s+em/i,
];

function countRoboticPhrases(text: string): number {
  return ROBOTIC_PATTERNS.filter((p) => p.test(text)).length;
}

// ─── Padrões de informação interna ────────────────────────────────────────────

const INTERNAL_PATTERNS = [
  /\bdecisão\s+comercial\b/i,
  /\bcérebro\s+comercial\b/i,
  /\bstate\s+updater\b/i,
  /\bconversation[_\s]state\b/i,
  /\bcommercial[_\s]decision\b/i,
  /\bturn[_\s]goal\b/i,
  /\banswer[_\s]only\b/i,
  /\bguardrails\b/i,
  /\bprompt\s+do\s+sistema\b/i,
];

function containsInternalInfo(text: string): boolean {
  return INTERNAL_PATTERNS.some((p) => p.test(text));
}

// ─── Verificação de pergunta desnecessária ────────────────────────────────────

function hasTrailingQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

const COMMERCIAL_QUESTION_PATTERNS = [
  /você\s+(mora|é)\s+de\s+(qual|onde)/i,
  /qual\s+(cidade|estado|região)/i,
  /tem\s+mais\s+alguma\s+dúvida/i,
  /posso\s+te\s+ajudar\s+(em|com)\s+mais\s+algo/i,
  /quer\s+saber\s+mais/i,
  /o\s+que\s+acha/i,
  /quando\s+seria\s+melhor\s+para\s+você/i,
  /já\s+pensou\s+em\s+se\s+inscrever/i,
  /gostaria\s+de\s+garantir\s+sua\s+vaga/i,
];

function hasUnnecessaryCommercialQuestion(text: string): boolean {
  return COMMERCIAL_QUESTION_PATTERNS.some((p) => p.test(text));
}

// ─── Verificação de condição comercial não autorizada ─────────────────────────

const UNAUTHORIZED_OFFER_PATTERNS = [
  /\b(talvez|possivelmente|quem\s+sabe)\s+(consigamos?|dê|seja\s+possível)\s+(fazer|pagar|parcelar)/i,
  /\bpodemos?\s+fazer\s+em\s+(mais\s+vezes|mais\s+parcelas|\d{2,}\s+vezes)/i,
  /\b(desconto|bolsa|isenção|cortesia)\s+especial/i,
  /\bpossibilidade\s+de\s+(negociar|parcelar\s+mais|desconto)/i,
  /\bvou\s+verificar\s+se\s+(consigo|tem)\s+(desconto|condição\s+especial)/i,
  /\bvermelho\s+está\s+caro,\s+posso\s+ver\s+um\s+desconto/i,
];

function containsUnauthorizedOffer(text: string): boolean {
  return UNAUTHORIZED_OFFER_PATTERNS.some((p) => p.test(text));
}

// ─── Verificação de repetição ─────────────────────────────────────────────────

function hasRepetition(text: string, avoidRepeating: string[]): boolean {
  if (!avoidRepeating.length) return false;
  const textLower = text.toLowerCase();
  const repeatKeywords: Record<string, string[]> = {
    price: ["r$", "1.500", "1500", "parcelas", "12x", "135"],
    schedule: ["15 de outubro", "15/10", "turma de outubro"],
    product_overview: ["método opex", "desenvolvimento pessoal", "3 dias intensivos"],
    location: ["maringá", "grupo excellence"],
    payment_terms: ["sicredi", "chave pix", "pix:"],
  };
  for (const item of avoidRepeating) {
    const keywords = repeatKeywords[item];
    if (!keywords) continue;
    const matchCount = keywords.filter((kw) => textLower.includes(kw.toLowerCase())).length;
    if (matchCount >= 2) return true;
  }
  return false;
}

// ─── Validação determinística ─────────────────────────────────────────────────

export function validateCandidateResponse(
  candidateResponse: string,
  decision: CommercialDecision,
  state: ConversationState,
  toolResults: JudgeToolResult[],
): CandidateValidationResult {
  const reasons: string[] = [];
  let criticalBlock = false;
  let requiresJudge = false;

  const text = candidateResponse.trim();

  // ── Bloqueios críticos determinísticos ──────────────────────────────────────

  // 1. no_response: qualquer texto é bloqueado
  if (decision.no_response && text.length > 0) {
    reasons.push("no_response=true mas existe resposta de texto");
    criticalBlock = true;
  }

  // 2. do_not_contact
  if (state.do_not_contact && text.length > 0) {
    reasons.push("do_not_contact=true — nenhuma mensagem comercial permitida");
    criticalBlock = true;
  }

  // 3. Tool falhou mas Júlia afirma sucesso
  const failedTools = toolResults.filter((t) => t.status === "error");
  if (failedTools.length > 0) {
    const paymentFailed = failedTools.some((t) => PAYMENT_TOOLS.has(t.tool));
    if (paymentFailed) {
      reasons.push(`Tool de pagamento falhou (${failedTools.map((t) => t.tool).join(", ")}) — não enviar dados financeiros`);
      criticalBlock = true;
    } else {
      reasons.push(`Tools falharam: ${failedTools.map((t) => t.tool).join(", ")}`);
      requiresJudge = true;
    }
  }

  // 4. Informação interna exposta
  if (containsInternalInfo(text)) {
    reasons.push("Resposta contém referência a sistemas internos");
    criticalBlock = true;
  }

  // ── Triggers que exigem Juiz de IA ─────────────────────────────────────────

  // 5. Falsa conclusão de tool
  if (containsFalseCompletion(text, toolResults)) {
    reasons.push("Possível afirmação de conclusão de ação que foi apenas solicitada");
    requiresJudge = true;
  }

  // 6. Condição comercial não autorizada
  if (containsUnauthorizedOffer(text)) {
    reasons.push("Possível oferta de condição não autorizada");
    requiresJudge = true;
  }

  // 7. Tools de alto risco executadas
  const highRiskExecuted = toolResults.filter((t) => HIGH_RISK_TOOLS.has(t.tool));
  if (highRiskExecuted.length > 0) {
    reasons.push(`Tools de alto risco: ${highRiskExecuted.map((t) => t.tool).join(", ")}`);
    requiresJudge = true;
  }

  // 8. Pagamento envolvido
  const paymentExecuted = toolResults.some((t) => PAYMENT_TOOLS.has(t.tool));
  if (paymentExecuted) {
    reasons.push("Tool de pagamento executada — verificar dados");
    requiresJudge = true;
  }

  // 9. answer_only com pergunta no final
  if (decision.action === "answer_only" && hasTrailingQuestion(text)) {
    reasons.push("action=answer_only mas resposta contém pergunta");
    requiresJudge = true;
  }

  // 10. should_ask_question=false mas há pergunta comercial
  if (!decision.should_ask_question && hasUnnecessaryCommercialQuestion(text)) {
    reasons.push("should_ask_question=false mas resposta contém pergunta comercial");
    requiresJudge = true;
  }

  // 11. handoff_required mas resposta continua vendendo
  if (decision.handoff_required) {
    const pitchKeywords = ["inscrição", "vaga", "garanta", "aproveite", "última chance", "desconto"];
    if (pitchKeywords.some((kw) => text.toLowerCase().includes(kw))) {
      reasons.push("handoff_required=true mas resposta continua vendendo");
      requiresJudge = true;
    }
  }

  // 12. Confiança baixa do Cérebro
  if (decision.confidence < 0.6) {
    reasons.push(`Confiança do Cérebro baixa: ${decision.confidence}`);
    requiresJudge = true;
  }

  // 13. Resposta muito longa para short
  if (decision.response_length === "short" && text.length > 600) {
    reasons.push(`Resposta muito longa (${text.length} chars) para response_length=short`);
    requiresJudge = true;
  }

  // 14. Repetição
  if (hasRepetition(text, decision.avoid_repeating)) {
    reasons.push("Resposta repete informações já apresentadas");
    requiresJudge = true;
  }

  // 15. Fechamento agressivo com should_sell=false
  if (!decision.should_sell) {
    const closingKeywords = ["garanta sua vaga", "últimas vagas", "vagas limitadas", "inscreva-se agora", "não perca"];
    if (closingKeywords.some((kw) => text.toLowerCase().includes(kw))) {
      reasons.push("should_sell=false mas resposta contém fechamento agressivo");
      requiresJudge = true;
    }
  }

  return {
    safe: !criticalBlock && !requiresJudge && reasons.length === 0,
    requires_judge: !criticalBlock && requiresJudge,
    critical_block: criticalBlock,
    reasons,
  };
}

// ─── Seletor do Juiz ──────────────────────────────────────────────────────────

export function shouldRunResponseJudge(
  validation: CandidateValidationResult,
  decision: CommercialDecision,
  toolResults: JudgeToolResult[],
  candidateResponse: string,
): boolean {
  // Bloqueio crítico já foi decidido deterministicamente
  if (validation.critical_block) return false;

  // Validador sinalizou necessidade
  if (validation.requires_judge) return true;

  // Cenários que SEMPRE exigem juiz, independente do validador:
  // a) Envolvimento com pagamento/Pix/cartão
  const hasPaymentContent = /\b(pix|chave|banco|titular|r\$|parcel|cartão|pagamento|sicredi|sicoob)\b/i.test(candidateResponse);
  if (hasPaymentContent) return true;

  // b) Inscrição ou reserva na resposta
  const hasRegistrationContent = /\b(inscri[çc]|vaga|reserv|cadastr|matr[ií]cul)\b/i.test(candidateResponse);
  if (hasRegistrationContent) return true;

  // c) Handoff na resposta
  const hasHandoffContent = /\b(equipe|humano|atend|chamar|transferir|encaminhar)\b/i.test(candidateResponse);
  if (hasHandoffContent && decision.handoff_required) return true;

  // d) Qualquer tool que modifica estado foi executada
  const stateChangingTools = ["mover_etapa", "classificar_lead", "pontuar_lead", "atualizar_lead", "marcar_nao_contatar"];
  if (toolResults.some((t) => stateChangingTools.includes(t.tool))) return true;

  // e) Confiança borderline
  if (decision.confidence < 0.75) return true;

  // f) handle_objection — verificar se objeção foi tratada
  if (decision.action === "handle_objection") return true;

  // g) close_sale — sempre verificar fechamento
  if (decision.action === "close_sale") return true;

  // Pode dispensar para respostas simples com alta confiança
  return false;
}

// ─── Prompt e tool do Juiz ────────────────────────────────────────────────────

export const RESPONSE_JUDGE_PROMPT = `# JUIZ DA JÚLIA — GEx

Você é um módulo interno de controle de qualidade.

Você NÃO conversa com o cliente.
Você NÃO escreve a resposta final.
Você NÃO executa ferramentas.
Você NÃO altera banco ou CRM.

Sua função é avaliar uma resposta que a Júlia pretende enviar.

Você receberá:
- mensagem atual do cliente
- estado relevante da conversa
- CommercialDecision (decisão do turno)
- resposta candidata da Júlia
- tools realmente executadas e seus resultados

## PRIORIDADES

1. Verdade factual — a resposta não inventa dados.
2. Coerência com resultados das tools — o que foi apenas "solicitado" não pode ser dito como "concluído".
3. Coerência com CommercialDecision — a resposta segue o que foi decidido.
4. Responder ao que o cliente realmente perguntou — pergunta explícita deve ser respondida.
5. Não prometer ação que não foi concluída — verificar status real da tool.
6. Não inventar condições comerciais — apenas valores/condições confirmados pelas tools.
7. Não pressionar desnecessariamente — sem urgência artificial.
8. Não repetir informações já apresentadas — respeitar avoid_repeating.
9. Não fazer perguntas sem necessidade — se action=answer_only, sem perguntas.
10. Manter linguagem natural de WhatsApp — sem corporativismo.

## REGRAS DE STATUS DAS TOOLS

- status=completed → ação real executada. Pode falar no passado.
- status=requested → apenas solicitação criada. Dizer "solicitei" / "registrei", NUNCA "está reservado"/"foi confirmado".
- status=query → consulta de dados. Use os dados retornados.
- status=error → falha. NÃO afirmar sucesso. NÃO enviar dados que dependiam dessa tool.

## ALINHAMENTO COM COMMERCIAL DECISION

- action=answer_only → sem pergunta adicional. Sem pitch.
- action=no_response → não deve haver texto de resposta ao cliente.
- action=handoff → não continuar vendendo. Chamar solicitar_handoff.
- should_sell=false → sem CTA de fechamento.
- should_ask_question=false → sem pergunta comercial nova.
- handoff_required=true → não continuar venda.
- avoid_repeating → verificar se itens listados aparecem claramente na resposta.

## NATURALIDADE

Marque sounds_robotic=true apenas quando houver padrões claros:
- "Entendo perfeitamente" em contexto desnecessário
- "Será um prazer ajudá-lo"
- "Excelente pergunta"
- Excesso de estrutura/formatação para mensagem simples de WhatsApp
- Recapitulação de tudo que já foi dito
- Frases corporativas genéricas
- Resposta excessivamente perfeita para mensagem simples

NÃO marque como robótico apenas porque o português está correto.

## SOBRE REWRITE_INSTRUCTIONS

Se verdict=rewrite, liste instruções claras e objetivas de correção.
Cada instrução deve ser uma frase curta dizendo O QUE corrigir.
NÃO escreva a mensagem corrigida. NÃO inclua texto sugerido.

## CAMPOS PROIBIDOS

NÃO inclua na saída: message, response, text, copy, rewritten_message, final_message.

Use a ferramenta avaliar_resposta_candidata para retornar a avaliação.`;

export const RESPONSE_JUDGE_TOOL = {
  name: "avaliar_resposta_candidata",
  description: "Avalia a resposta candidata da Júlia e retorna o veredito estruturado.",
  input_schema: {
    type: "object" as const,
    properties: {
      verdict: {
        type: "string",
        enum: [...JUDGE_VERDICTS],
        description: "approve=pode enviar, rewrite=corrigir, block=não enviar",
      },
      severity: {
        type: "string",
        enum: [...JUDGE_SEVERITIES],
        description: "Gravidade dos problemas encontrados",
      },
      issues: {
        type: "array",
        items: { type: "string", enum: [...JUDGE_ISSUE_CODES] },
        description: "Códigos dos problemas encontrados",
      },
      brain_alignment: { type: "boolean", description: "Resposta alinhada com CommercialDecision" },
      tool_alignment: { type: "boolean", description: "Resposta alinhada com resultados reais das tools" },
      answered_user: { type: "boolean", description: "Resposta responde o que o cliente perguntou" },
      contains_unverified_claim: { type: "boolean", description: "Contém afirmação não verificável pelas tools" },
      contains_unauthorized_offer: { type: "boolean", description: "Contém condição comercial não autorizada" },
      contains_false_completion: { type: "boolean", description: "Afirma conclusão de ação apenas solicitada" },
      unnecessary_question: { type: "boolean", description: "Contém pergunta desnecessária dado o action do turno" },
      unnecessary_repetition: { type: "boolean", description: "Repete informações já apresentadas" },
      too_long: { type: "boolean", description: "Excessivamente longa para o response_length recomendado" },
      sounds_robotic: { type: "boolean", description: "Linguagem robótica ou corporativa" },
      rewrite_instructions: {
        type: "array",
        items: { type: "string" },
        description: "Instruções de correção (somente se verdict=rewrite). Máximo 5 itens.",
      },
      confidence: { type: "number", description: "Confiança na avaliação (0.0 a 1.0)" },
      reason_code: { type: "string", description: "Código curto da razão (ex: response_valid, false_completion)" },
    },
    required: [
      "verdict", "severity", "issues", "brain_alignment", "tool_alignment",
      "answered_user", "contains_unverified_claim", "contains_unauthorized_offer",
      "contains_false_completion", "unnecessary_question", "unnecessary_repetition",
      "too_long", "sounds_robotic", "rewrite_instructions", "confidence", "reason_code",
    ],
  },
};

// ─── Validação da saída do Juiz ────────────────────────────────────────────────

export function validateJudgeDecision(output: unknown): { decision: JudgeDecision | null; issues: string[] } {
  const issues: string[] = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { decision: null, issues: ["output: esperado objeto"] };
  }
  const src = output as Record<string, unknown>;

  // Campos proibidos de copy
  for (const f of ["message", "response", "text", "copy", "rewritten_message", "final_message"]) {
    if (f in src) issues.push(`${f}: campo de copy proibido no Juiz`);
  }

  const required = [
    "verdict", "severity", "issues", "brain_alignment", "tool_alignment",
    "answered_user", "contains_unverified_claim", "contains_unauthorized_offer",
    "contains_false_completion", "unnecessary_question", "unnecessary_repetition",
    "too_long", "sounds_robotic", "rewrite_instructions", "confidence", "reason_code",
  ];
  for (const f of required) {
    if (!(f in src)) issues.push(`${f}: campo ausente`);
  }
  if (issues.some((i) => i.includes("campo ausente"))) return { decision: null, issues };

  const verdict = src.verdict;
  if (!JUDGE_VERDICTS.includes(verdict as JudgeVerdict)) {
    issues.push(`verdict: valor inválido "${verdict}"`);
    return { decision: null, issues };
  }
  const severity = src.severity;
  if (!JUDGE_SEVERITIES.includes(severity as JudgeSeverity)) {
    issues.push(`severity: valor inválido "${severity}"`);
  }

  const confidence = Number(src.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    issues.push(`confidence: esperado 0-1, recebido "${src.confidence}"`);
  }

  const rawIssues = Array.isArray(src.issues)
    ? (src.issues as unknown[]).filter((i): i is JudgeIssueCode =>
        typeof i === "string" && JUDGE_ISSUE_CODES.includes(i as JudgeIssueCode)
      )
    : [];

  const rewriteInstructions = Array.isArray(src.rewrite_instructions)
    ? (src.rewrite_instructions as unknown[])
        .filter((i): i is string => typeof i === "string")
        .slice(0, 5)
    : [];

  const decision: JudgeDecision = {
    verdict: verdict as JudgeVerdict,
    severity: JUDGE_SEVERITIES.includes(severity as JudgeSeverity) ? (severity as JudgeSeverity) : "medium",
    issues: rawIssues,
    brain_alignment: Boolean(src.brain_alignment),
    tool_alignment: Boolean(src.tool_alignment),
    answered_user: Boolean(src.answered_user),
    contains_unverified_claim: Boolean(src.contains_unverified_claim),
    contains_unauthorized_offer: Boolean(src.contains_unauthorized_offer),
    contains_false_completion: Boolean(src.contains_false_completion),
    unnecessary_question: Boolean(src.unnecessary_question),
    unnecessary_repetition: Boolean(src.unnecessary_repetition),
    too_long: Boolean(src.too_long),
    sounds_robotic: Boolean(src.sounds_robotic),
    rewrite_instructions: rewriteInstructions,
    confidence: Math.max(0, Math.min(1, isNaN(confidence) ? 0.5 : confidence)),
    reason_code: typeof src.reason_code === "string" ? src.reason_code.trim().slice(0, 50) : "judge_result",
  };

  return { decision, issues };
}

// ─── Construir input do Juiz ───────────────────────────────────────────────────

export function buildJudgeInput(ctx: JudgeContext): string {
  const lines: string[] = [];

  lines.push("## MENSAGEM DO CLIENTE");
  lines.push(ctx.clientMessage);

  lines.push("\n## ESTADO RELEVANTE");
  lines.push(`Intenção: ${ctx.conversationState.current_intent}`);
  lines.push(`Funil: ${ctx.conversationState.funnel_stage}`);
  if (ctx.conversationState.explicit_question) {
    lines.push(`Pergunta explícita: ${ctx.conversationState.explicit_question}`);
  }
  if (ctx.conversationState.current_objection) {
    lines.push(`Objeção ativa: ${ctx.conversationState.current_objection}`);
  }
  if (ctx.conversationState.payment_method) {
    lines.push(`Forma de pagamento escolhida: ${ctx.conversationState.payment_method}`);
  }
  lines.push(`Handoff ativo: ${ctx.conversationState.handoff_active}`);
  lines.push(`Não contatar: ${ctx.conversationState.do_not_contact}`);

  lines.push("\n## COMMERCIAL DECISION");
  lines.push(`Objetivo: ${ctx.decision.turn_goal}`);
  lines.push(`Ação: ${ctx.decision.action}`);
  lines.push(`Deve responder: ${ctx.decision.must_answer_user}`);
  lines.push(`Deve vender: ${ctx.decision.should_sell}`);
  lines.push(`Deve perguntar: ${ctx.decision.should_ask_question}`);
  if (ctx.decision.question_goal) lines.push(`Objetivo da pergunta: ${ctx.decision.question_goal}`);
  lines.push(`Tamanho esperado: ${ctx.decision.response_length}`);
  lines.push(`Handoff obrigatório: ${ctx.decision.handoff_required}`);
  lines.push(`no_response: ${ctx.decision.no_response}`);
  if (ctx.decision.avoid_repeating.length) {
    lines.push(`Não repetir: ${ctx.decision.avoid_repeating.join(", ")}`);
  }
  if (ctx.decision.objection_strategy) {
    lines.push(`Estratégia de objeção: ${ctx.decision.objection_strategy}`);
  }
  lines.push(`Confiança do Cérebro: ${ctx.decision.confidence}`);

  if (ctx.toolResults.length > 0) {
    lines.push("\n## TOOLS EXECUTADAS");
    for (const t of ctx.toolResults) {
      lines.push(`- ${t.tool} → status: ${t.status} | resultado: ${t.resultado.slice(0, 200)}`);
    }
  } else {
    lines.push("\n## TOOLS EXECUTADAS");
    lines.push("Nenhuma tool foi executada neste turno.");
  }

  if (ctx.previousMessages?.length) {
    lines.push("\n## CONTEXTO ANTERIOR (últimas mensagens)");
    for (const m of ctx.previousMessages.slice(-4)) {
      lines.push(`${m.role === "client" ? "Cliente" : "Júlia"}: ${m.content.slice(0, 150)}`);
    }
  }

  lines.push("\n## RESPOSTA CANDIDATA DA JÚLIA");
  lines.push(ctx.candidateResponse);

  return lines.join("\n");
}

// ─── Fallback do Juiz ──────────────────────────────────────────────────────────

export function applyJudgeFallback(
  validation: CandidateValidationResult,
  decision: CommercialDecision,
  toolResults: JudgeToolResult[],
): JudgeDecision {
  // Se validação determinística diz safe: aprovar conservadoramente
  if (validation.safe) {
    return {
      verdict: "approve",
      severity: "none",
      issues: [],
      brain_alignment: true,
      tool_alignment: true,
      answered_user: true,
      contains_unverified_claim: false,
      contains_unauthorized_offer: false,
      contains_false_completion: false,
      unnecessary_question: false,
      unnecessary_repetition: false,
      too_long: false,
      sounds_robotic: false,
      rewrite_instructions: [],
      confidence: 0.5,
      reason_code: "judge_fallback_safe",
    };
  }

  // Se há risk crítico: bloquear
  const hasPaymentTool = toolResults.some((t) => PAYMENT_TOOLS.has(t.tool));
  const hasFailedTool = toolResults.some((t) => t.status === "error");
  if (hasPaymentTool || hasFailedTool || decision.action === "send_payment") {
    return {
      verdict: "block",
      severity: "critical",
      issues: ["tool_failure_ignored"],
      brain_alignment: false,
      tool_alignment: false,
      answered_user: false,
      contains_unverified_claim: true,
      contains_unauthorized_offer: false,
      contains_false_completion: false,
      unnecessary_question: false,
      unnecessary_repetition: false,
      too_long: false,
      sounds_robotic: false,
      rewrite_instructions: [],
      confidence: 0.5,
      reason_code: "judge_fallback_payment_block",
    };
  }

  // Caso médio: bloquear conservadoramente quando há razões de risco
  if (validation.reasons.length > 0) {
    return {
      verdict: "block",
      severity: "medium",
      issues: [],
      brain_alignment: true,
      tool_alignment: false,
      answered_user: true,
      contains_unverified_claim: false,
      contains_unauthorized_offer: false,
      contains_false_completion: false,
      unnecessary_question: false,
      unnecessary_repetition: false,
      too_long: false,
      sounds_robotic: false,
      rewrite_instructions: [],
      confidence: 0.3,
      reason_code: "judge_fallback_conservative_block",
    };
  }

  // Sem evidência de risco: aprovar
  return {
    verdict: "approve",
    severity: "none",
    issues: [],
    brain_alignment: true,
    tool_alignment: true,
    answered_user: true,
    contains_unverified_claim: false,
    contains_unauthorized_offer: false,
    contains_false_completion: false,
    unnecessary_question: false,
    unnecessary_repetition: false,
    too_long: false,
    sounds_robotic: false,
    rewrite_instructions: [],
    confidence: 0.4,
    reason_code: "judge_fallback_no_risk",
  };
}

// ─── Chamada principal ao Juiz de IA ─────────────────────────────────────────

export interface AnthropicClientForJudge {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      tools: typeof RESPONSE_JUDGE_TOOL[];
      tool_choice: { type: string };
      messages: { role: "user"; content: string }[];
    }): Promise<{
      content: Array<{ type: string; name?: string; input?: unknown }>;
      usage?: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export async function runResponseJudge(
  anthropic: AnthropicClientForJudge,
  ctx: JudgeContext,
  model = "claude-haiku-4-5-20251001",
): Promise<{ decision: JudgeDecision; usedFallback: boolean; inputTokens: number; outputTokens: number }> {
  const userContent = buildJudgeInput(ctx);
  const validation = validateCandidateResponse(
    ctx.candidateResponse,
    ctx.decision,
    ctx.conversationState,
    ctx.toolResults,
  );

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 512,
      system: RESPONSE_JUDGE_PROMPT,
      tools: [RESPONSE_JUDGE_TOOL],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: userContent }],
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    const toolBlock = response.content.find(
      (b) => b.type === "tool_use" && b.name === "avaliar_resposta_candidata",
    );
    if (!toolBlock?.input) {
      return {
        decision: applyJudgeFallback(validation, ctx.decision, ctx.toolResults),
        usedFallback: true,
        inputTokens,
        outputTokens,
      };
    }

    const { decision, issues } = validateJudgeDecision(toolBlock.input);
    if (!decision) {
      return {
        decision: applyJudgeFallback(validation, ctx.decision, ctx.toolResults),
        usedFallback: true,
        inputTokens,
        outputTokens,
      };
    }

    if (issues.length > 0) {
      console.warn(`[response-judge] issues na validação:`, issues);
    }

    return { decision, usedFallback: false, inputTokens, outputTokens };
  } catch (err) {
    console.error("[response-judge] erro na chamada:", err);
    return {
      decision: applyJudgeFallback(validation, ctx.decision, ctx.toolResults),
      usedFallback: true,
      inputTokens: 0,
      outputTokens: 0,
    };
  }
}

// ─── Instrução de reescrita para Júlia ────────────────────────────────────────

export function buildRewriteInstruction(
  judgeDecision: JudgeDecision,
  originalCandidate: string,
): string {
  const instructions = judgeDecision.rewrite_instructions.join("\n- ");
  return `# CORREÇÃO OBRIGATÓRIA

A resposta anterior foi reprovada pelo controle de qualidade.

Resposta anterior:
${originalCandidate}

Corrija SOMENTE os problemas abaixo:
- ${instructions}

REGRAS DA CORREÇÃO:
- Preserve o objetivo comercial definido para este turno.
- Não acrescente novas informações além das já disponíveis.
- Não invente dados, condições ou valores.
- Não execute novas ações operacionais (não chame tools) — apenas corrija o texto.
- Resposta deve ser natural e direta, como WhatsApp.
- Se o problema envolve afirmação de conclusão, substitua por "solicitei" / "registrei".`;
}

// ─── Pipeline principal do Juiz ───────────────────────────────────────────────

export interface JuliaRewriteClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export async function executeJudgePipeline(
  anthropic: AnthropicClientForJudge & JuliaRewriteClient,
  ctx: JudgeContext,
  juliaSystemPrompt: string,
  judgeModel = "claude-haiku-4-5-20251001",
  juliaModel = "claude-haiku-4-5-20251001",
): Promise<JudgePipelineResult> {
  const metrics = {
    judgeInputTokens: 0,
    judgeOutputTokens: 0,
    rewriteInputTokens: 0,
    rewriteOutputTokens: 0,
    judgeMs: 0,
    rewriteMs: 0,
  };

  // 1. Validação determinística
  const validation = validateCandidateResponse(
    ctx.candidateResponse,
    ctx.decision,
    ctx.conversationState,
    ctx.toolResults,
  );

  // 2. Bloqueio crítico determinístico
  if (validation.critical_block) {
    console.log("[response-judge] bloqueio determinístico:", validation.reasons.join("; "));
    return {
      finalResponse: null,
      blocked: true,
      verdict: "block",
      judgeRan: false,
      rewritePerformed: false,
      validation,
      judgeDecision: null,
      judgeUsedFallback: false,
      metrics,
    };
  }

  // 3. Verificar se precisa do Juiz de IA
  const needsJudge = shouldRunResponseJudge(
    validation,
    ctx.decision,
    ctx.toolResults,
    ctx.candidateResponse,
  );

  if (!needsJudge) {
    return {
      finalResponse: ctx.candidateResponse,
      blocked: false,
      verdict: "approve",
      judgeRan: false,
      rewritePerformed: false,
      validation,
      judgeDecision: null,
      judgeUsedFallback: false,
      metrics,
    };
  }

  // 4. Rodar Juiz de IA
  const t1 = Date.now();
  const { decision: judgeDecision, usedFallback, inputTokens, outputTokens } = await runResponseJudge(
    anthropic,
    ctx,
    judgeModel,
  );
  metrics.judgeMs = Date.now() - t1;
  metrics.judgeInputTokens = inputTokens;
  metrics.judgeOutputTokens = outputTokens;

  console.log(`[response-judge] verdict=${judgeDecision.verdict} severity=${judgeDecision.severity} reason=${judgeDecision.reason_code} fallback=${usedFallback}`);

  // 5. Approve: enviar
  if (judgeDecision.verdict === "approve") {
    return {
      finalResponse: ctx.candidateResponse,
      blocked: false,
      verdict: "approve",
      judgeRan: true,
      rewritePerformed: false,
      validation,
      judgeDecision,
      judgeUsedFallback: usedFallback,
      metrics,
    };
  }

  // 6. Block: não enviar
  if (judgeDecision.verdict === "block") {
    return {
      finalResponse: null,
      blocked: true,
      verdict: "block",
      judgeRan: true,
      rewritePerformed: false,
      validation,
      judgeDecision,
      judgeUsedFallback: usedFallback,
      metrics,
    };
  }

  // 7. Rewrite: Júlia reescreve 1 vez (sem tools)
  if (judgeDecision.verdict === "rewrite" && judgeDecision.rewrite_instructions.length > 0) {
    const rewriteInstruction = buildRewriteInstruction(judgeDecision, ctx.candidateResponse);

    const t2 = Date.now();
    let rewrittenResponse: string | null = null;
    try {
      const rewriteResp = await (anthropic as JuliaRewriteClient).messages.create({
        model: juliaModel,
        max_tokens: 512,
        system: juliaSystemPrompt,
        messages: [
          { role: "user", content: ctx.clientMessage },
          { role: "assistant", content: ctx.candidateResponse },
          { role: "user", content: rewriteInstruction },
        ],
      });
      metrics.rewriteMs = Date.now() - t2;
      metrics.rewriteInputTokens = rewriteResp.usage?.input_tokens ?? 0;
      metrics.rewriteOutputTokens = rewriteResp.usage?.output_tokens ?? 0;

      const textBlock = rewriteResp.content.find((b) => b.type === "text");
      rewrittenResponse = textBlock?.text?.trim() ?? null;
    } catch (err) {
      console.error("[response-judge] erro na reescrita:", err);
      metrics.rewriteMs = Date.now() - t2;
    }

    if (!rewrittenResponse) {
      // Reescrita falhou — bloquear conservadoramente
      return {
        finalResponse: null,
        blocked: true,
        verdict: "block",
        judgeRan: true,
        rewritePerformed: false,
        validation,
        judgeDecision,
        judgeUsedFallback: usedFallback,
        metrics,
      };
    }

    // 8. Validação determinística da reescrita (sem segundo Juiz de IA)
    const rewriteValidation = validateCandidateResponse(
      rewrittenResponse,
      ctx.decision,
      ctx.conversationState,
      ctx.toolResults,
    );

    if (rewriteValidation.critical_block) {
      return {
        finalResponse: null,
        blocked: true,
        verdict: "block",
        judgeRan: true,
        rewritePerformed: true,
        validation: rewriteValidation,
        judgeDecision,
        judgeUsedFallback: usedFallback,
        metrics,
      };
    }

    return {
      finalResponse: rewrittenResponse,
      blocked: false,
      verdict: "rewrite",
      judgeRan: true,
      rewritePerformed: true,
      validation,
      judgeDecision,
      judgeUsedFallback: usedFallback,
      metrics,
    };
  }

  // Fallback: rewrite sem instruções → aprovar (não foi possível reescrever)
  return {
    finalResponse: ctx.candidateResponse,
    blocked: false,
    verdict: "approve",
    judgeRan: true,
    rewritePerformed: false,
    validation,
    judgeDecision,
    judgeUsedFallback: usedFallback,
    metrics,
  };
}

// ─── Log do Juiz (sem dados sensíveis) ───────────────────────────────────────

export function toJudgeLog(result: JudgePipelineResult): object {
  return {
    judge_ran: result.judgeRan,
    verdict: result.verdict,
    severity: result.judgeDecision?.severity ?? "none",
    reason_code: result.judgeDecision?.reason_code ?? (result.judgeRan ? "judge_ran" : "skipped"),
    issues: result.judgeDecision?.issues ?? [],
    confidence: result.judgeDecision?.confidence ?? null,
    rewrite_performed: result.rewritePerformed,
    blocked: result.blocked,
    judge_fallback: result.judgeUsedFallback,
    deterministic_reasons: result.validation.reasons,
  };
}
