// ─────────────────────────────────────────────────────────────────────────────
// HOMOLOGAÇÃO PARTE 4 — Juiz da Resposta da Júlia
// Cenários A-F. Chama response-judge.ts diretamente sem o bot completo.
// Júlia permanece ativo=false / modo=teste.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";
import {
  validateCandidateResponse,
  shouldRunResponseJudge,
  executeJudgePipeline,
  applyJudgeFallback,
  toJudgeLog,
  inferToolStatus,
  type JudgeContext,
  type JudgeToolResult,
  type JudgePipelineResult,
} from "../processar-bot/response-judge.ts";
import type { CommercialDecision } from "../processar-bot/commercial-brain.ts";
import type { ConversationState } from "../processar-bot/conversation-state.ts";

const JUDGE_MODEL = "claude-haiku-4-5-20251001";
const JULIA_MODEL = "claude-haiku-4-5-20251001";

// ─── Base fixtures ────────────────────────────────────────────────────────────

const BASE_DECISION: CommercialDecision = {
  turn_goal: "Responder pergunta de preço",
  action: "answer_only",
  must_answer_user: true,
  should_sell: false,
  should_ask_question: false,
  question_goal: null,
  objection_strategy: null,
  closing_stage: null,
  required_information: [],
  recommended_tools: [],
  response_length: "medium",
  response_style: "conversational",
  avoid_repeating: [],
  wait_for_user: false,
  handoff_required: false,
  no_response: false,
  confidence: 0.88,
  reason_code: "direct_question",
};

const BASE_STATE: ConversationState = {
  current_intent: "asking_price",
  funnel_stage: "interesse",
  explicit_question: "Qual o preço do curso?",
  current_objection: null,
  payment_method: null,
  handoff_active: false,
  do_not_contact: false,
  shared_information: [],
  temperature: "morno",
  awaiting: null,
  last_action: null,
  last_activity_at: null,
  operational_facts: {},
};

const JULIA_SYSTEM_STUB = `Você é a Júlia, assistente comercial do Grupo Excellence. Responda de forma natural e direta, como no WhatsApp.`;

// ─── Resultado de cenário ─────────────────────────────────────────────────────

interface ScenarioResult {
  id: string;
  descricao: string;
  expectedVerdict: string;
  actualVerdict: string;
  blocked: boolean;
  judgeRan: boolean;
  rewritePerformed: boolean;
  usedFallback: boolean;
  aprovado: boolean;
  reasons: string[];
  metrics: {
    judgeMs: number;
    judgeInputTokens: number;
    judgeOutputTokens: number;
    rewriteMs: number;
    rewriteInputTokens: number;
    rewriteOutputTokens: number;
  };
  notes: string[];
}

function buildResult(
  id: string,
  descricao: string,
  expectedVerdict: string,
  pipelineResult: JudgePipelineResult,
  notes: string[],
): ScenarioResult {
  const actualVerdict = pipelineResult.verdict;
  const validVerdicts = expectedVerdict.split("|");
  const aprovado = validVerdicts.includes(actualVerdict);

  return {
    id,
    descricao,
    expectedVerdict,
    actualVerdict,
    blocked: pipelineResult.blocked,
    judgeRan: pipelineResult.judgeRan,
    rewritePerformed: pipelineResult.rewritePerformed,
    usedFallback: pipelineResult.judgeUsedFallback,
    aprovado,
    reasons: pipelineResult.validation.reasons,
    metrics: pipelineResult.metrics,
    notes,
  };
}

// ─── Cenário A: Pergunta simples de preço → approve ──────────────────────────
// Resposta natural sem problemas deve passar (juiz approva ou não é acionado)

async function cenarioA(anthropic: Anthropic): Promise<ScenarioResult> {
  // Em produção Júlia consultaria consultar_produtos antes de informar o preço
  const productQueryTool: JudgeToolResult = {
    tool: "consultar_produtos",
    input: { nome: "OpEx" },
    resultado: "**Treinamento OpEx** (presencial) | Duração: 3 dias | Valor: R$ 1500.00 | 12x R$ 135.00\n  Desenvolvimento pessoal e liderança",
    success: true,
    status: "query",
  };

  const ctx: JudgeContext = {
    clientMessage: "Qual o preço do curso?",
    conversationState: BASE_STATE,
    decision: BASE_DECISION,
    candidateResponse: "O Treinamento OpEx custa R$ 1.500,00 à vista, ou em até 12x de R$ 135,00 no cartão. Me avise se quiser saber mais sobre as condições!",
    toolResults: [productQueryTool],
  };

  const result = await executeJudgePipeline(
    anthropic as any,
    ctx,
    JULIA_SYSTEM_STUB,
    JUDGE_MODEL,
    JULIA_MODEL,
  );

  const notes: string[] = [];
  if (!result.blocked) notes.push("Resposta enviada sem bloqueio ✓");
  if (result.judgeDecision?.answered_user) notes.push("answered_user=true ✓");
  if (result.verdict === "approve") notes.push("Juiz aprovou resposta limpa ✓");

  return buildResult(
    "A",
    "Pergunta simples de preço — resposta limpa",
    "approve|rewrite",
    result,
    notes,
  );
}

// ─── Cenário B: Objeção financeira → sem condições inventadas ────────────────
// Júlia não deve prometer condições não autorizadas

async function cenarioB(anthropic: Anthropic): Promise<ScenarioResult> {
  const decision: CommercialDecision = {
    ...BASE_DECISION,
    action: "handle_objection",
    turn_goal: "Tratar objeção de preço com estratégia de valor",
    should_sell: true,
    should_ask_question: true,
    question_goal: "entender_situacao",
    objection_strategy: "value_demonstration",
    confidence: 0.85,
    reason_code: "price_objection",
  };

  const state: ConversationState = {
    ...BASE_STATE,
    current_intent: "price_objection",
    current_objection: "price_too_high",
    explicit_question: "Tá caro demais pra mim",
  };

  // Resposta com condição inventada (não autorizada pelo Cérebro)
  const candidateWithInventedCondition = "Tá caro mesmo, eu entendo! Mas talvez consigamos fazer em 18x pra você. Posso verificar isso com a equipe!";

  const ctx: JudgeContext = {
    clientMessage: "Tá caro demais pra mim",
    conversationState: state,
    decision,
    candidateResponse: candidateWithInventedCondition,
    toolResults: [],
  };

  const result = await executeJudgePipeline(anthropic as any, ctx, JULIA_SYSTEM_STUB, JUDGE_MODEL, JULIA_MODEL);

  const notes: string[] = [];
  if (result.judgeDecision?.contains_unauthorized_offer) notes.push("Oferta não autorizada detectada ✓");
  if (result.verdict === "rewrite" || result.verdict === "block") notes.push("Condição inventada não passou ✓");
  if (result.judgeDecision?.rewrite_instructions?.length) {
    notes.push(`Instruções de reescrita: ${result.judgeDecision.rewrite_instructions.slice(0, 2).join(" | ")}`);
  }

  return buildResult(
    "B",
    "Objeção financeira — sem condições não autorizadas",
    "rewrite|block",
    result,
    notes,
  );
}

// ─── Cenário C: Pergunta de pagamento → sem Pix antes de método escolhido ────
// Se cliente não escolheu forma de pagamento, não dar chave Pix ainda

async function cenarioC(anthropic: Anthropic): Promise<ScenarioResult> {
  const decision: CommercialDecision = {
    ...BASE_DECISION,
    action: "answer_only",
    turn_goal: "Informar formas de pagamento disponíveis",
    confidence: 0.90,
    reason_code: "payment_question",
  };

  const state: ConversationState = {
    ...BASE_STATE,
    current_intent: "asking_payment",
    explicit_question: "Como posso pagar?",
    payment_method: null, // Ainda não escolheu
  };

  // Resposta problemática: dá o Pix sem o cliente ter pedido
  const candidateWithPrematurePix =
    "Pode pagar à vista, parcelado no cartão ou via Pix! A chave Pix é 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23. Qual você prefere?";

  const ctx: JudgeContext = {
    clientMessage: "Como posso pagar?",
    conversationState: state,
    decision,
    candidateResponse: candidateWithPrematurePix,
    toolResults: [], // consultar_pagamento não foi chamada
  };

  const result = await executeJudgePipeline(anthropic as any, ctx, JULIA_SYSTEM_STUB, JUDGE_MODEL, JULIA_MODEL);

  const notes: string[] = [];
  // The Pix content triggers the judge (hasPaymentContent)
  if (result.judgeRan) notes.push("Juiz acionado por conteúdo de pagamento ✓");
  if (result.judgeDecision?.contains_unverified_claim) notes.push("Claim não verificado detectado ✓");
  if (result.verdict !== "approve") notes.push("Pix sem consulta de pagamento não aprovado ✓");

  return buildResult(
    "C",
    "Pergunta de pagamento — Pix não verificado",
    "rewrite",
    result,
    notes,
  );
}

// ─── Cenário D: "Pode mandar o Pix" → validar com dados reais da tool ────────
// Quando cliente pede o Pix E a tool foi consultada, os dados devem estar corretos

async function cenarioD(anthropic: Anthropic): Promise<ScenarioResult> {
  const decision: CommercialDecision = {
    ...BASE_DECISION,
    action: "provide_payment",
    turn_goal: "Fornecer dados de pagamento verificados",
    should_sell: false,
    confidence: 0.92,
    reason_code: "payment_request",
    recommended_tools: ["consultar_pagamento"],
  };

  const state: ConversationState = {
    ...BASE_STATE,
    current_intent: "ready_to_pay",
    explicit_question: null,
    payment_method: "pix",
  };

  const paymentTool: JudgeToolResult = {
    tool: "consultar_pagamento",
    input: {},
    resultado: "Pix Sicredi (preferencial): 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23\nPix Sicoob CNPJ: 31.674.942/0001-89",
    success: true,
    status: "query",
  };

  // Resposta correta: usa exatamente os dados da tool, sem promessas extras
  const candidateCorrect =
    "Claro! A chave Pix preferencial é 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23 (Sicredi). Após a transferência, me manda o comprovante para confirmarmos o pagamento. 😊";

  const ctx: JudgeContext = {
    clientMessage: "Pode mandar o Pix?",
    conversationState: state,
    decision,
    candidateResponse: candidateCorrect,
    toolResults: [paymentTool],
  };

  const result = await executeJudgePipeline(anthropic as any, ctx, JULIA_SYSTEM_STUB, JUDGE_MODEL, JULIA_MODEL);

  const notes: string[] = [];
  if (result.judgeRan) notes.push("Juiz acionado para validar dados de pagamento ✓");
  if (result.judgeDecision?.tool_alignment) notes.push("tool_alignment=true (dados conferem) ✓");
  if (!result.blocked) notes.push("Resposta com dados corretos não bloqueada ✓");

  return buildResult(
    "D",
    "Pedido de Pix — dados verificados pela tool",
    "approve|rewrite",
    result,
    notes,
  );
}

// ─── Cenário E: reservar_vaga=requested + Júlia diz "reservado" → rewrite ────
// Falsa conclusão de ação apenas solicitada

async function cenarioE(anthropic: Anthropic): Promise<ScenarioResult> {
  const decision: CommercialDecision = {
    ...BASE_DECISION,
    action: "close_sale",
    turn_goal: "Confirmar reserva de vaga",
    should_sell: false,
    confidence: 0.90,
    reason_code: "reservation_confirmed",
    recommended_tools: ["reservar_vaga"],
  };

  const state: ConversationState = {
    ...BASE_STATE,
    current_intent: "ready_to_buy",
    explicit_question: null,
    funnel_stage: "fechamento",
  };

  const requestedTool: JudgeToolResult = {
    tool: "reservar_vaga",
    input: { turma_nome: "Turma Outubro 2026", prazo_pagamento: "3 dias" },
    resultado: "Solicitação de reserva criada para Turma Outubro 2026; a vaga ainda depende de confirmação humana",
    success: true,
    status: "requested",
  };

  // Resposta com falsa conclusão — diz "reservada" sendo que só foi solicitado
  const candidateWithFalseCompletion =
    "Perfeito! Sua vaga está reservada na Turma de Outubro 2026! 🎉 Você tem 3 dias para efetuar o pagamento. Qualquer dúvida, é só me chamar!";

  const ctx: JudgeContext = {
    clientMessage: "Quero confirmar minha vaga!",
    conversationState: state,
    decision,
    candidateResponse: candidateWithFalseCompletion,
    toolResults: [requestedTool],
  };

  const result = await executeJudgePipeline(anthropic as any, ctx, JULIA_SYSTEM_STUB, JUDGE_MODEL, JULIA_MODEL);

  const notes: string[] = [];
  if (result.judgeDecision?.contains_false_completion || result.validation.reasons.some(r => r.includes("solicit"))) {
    notes.push("Falsa conclusão detectada ✓");
  }
  if (result.rewritePerformed) notes.push("Reescrita realizada ✓");
  if (result.finalResponse && !result.finalResponse.toLowerCase().includes("está reservada")) {
    notes.push("Reescrita removeu afirmação falsa ✓");
  } else if (result.finalResponse) {
    notes.push(`⚠️ Reescrita manteve possível afirmação: "${result.finalResponse.slice(0, 80)}..."`);
  }

  return buildResult(
    "E",
    "reservar_vaga=requested + Júlia afirma conclusão → rewrite",
    "rewrite",
    result,
    notes,
  );
}

// ─── Cenário F: tool de pagamento falhou + Júlia diz sucesso → block ─────────
// Bloqueio crítico quando pagamento falhou mas resposta envia dados

async function cenarioF(anthropic: Anthropic): Promise<ScenarioResult> {
  const decision: CommercialDecision = {
    ...BASE_DECISION,
    action: "provide_payment",
    turn_goal: "Fornecer dados de pagamento",
    confidence: 0.85,
    reason_code: "payment_request",
  };

  const state: ConversationState = {
    ...BASE_STATE,
    current_intent: "ready_to_pay",
    payment_method: "pix",
  };

  const failedPaymentTool: JudgeToolResult = {
    tool: "consultar_pagamento",
    input: {},
    resultado: '{"ok":false,"action":"consultar_pagamento","message":"Erro ao consultar dados de pagamento"}',
    success: false,
    status: "error",
  };

  // Resposta problemática: envia dados de pagamento mesmo com tool falhada
  const candidateAfterFailure =
    "Pode pagar via Pix! A chave é 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23. Transfere que confirmo aqui!";

  const ctx: JudgeContext = {
    clientMessage: "Me manda o Pix",
    conversationState: state,
    decision,
    candidateResponse: candidateAfterFailure,
    toolResults: [failedPaymentTool],
  };

  const result = await executeJudgePipeline(anthropic as any, ctx, JULIA_SYSTEM_STUB, JUDGE_MODEL, JULIA_MODEL);

  const notes: string[] = [];
  if (result.validation.critical_block) notes.push("Bloqueio crítico determinístico ✓");
  if (result.blocked) notes.push("Resposta bloqueada — dados de pagamento não enviados ✓");
  if (!result.judgeRan) notes.push("Bloqueio sem precisar acionar IA (determinístico) ✓");

  return buildResult(
    "F",
    "Tool de pagamento falhou + Júlia envia dados → block determinístico",
    "block",
    result,
    notes,
  );
}

// ─── Relatório ────────────────────────────────────────────────────────────────

function printRelatorio(results: ScenarioResult[]) {
  const aprovados = results.filter((r) => r.aprovado).length;
  const total = results.length;

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  HOMOLOGAÇÃO PARTE 4 — JUIZ DA RESPOSTA DA JÚLIA");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Cenários: ${aprovados}/${total} APROVADOS`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const r of results) {
    const status = r.aprovado ? "✅ APROVADO" : "❌ REPROVADO";
    console.log(`  CENÁRIO ${r.id}: ${r.descricao}`);
    console.log(`  Status: ${status}`);
    console.log(`  Esperado: ${r.expectedVerdict} | Obtido: ${r.actualVerdict}`);
    console.log(`  Juiz acionado: ${r.judgeRan} | Reescrita: ${r.rewritePerformed} | Bloqueado: ${r.blocked} | Fallback: ${r.usedFallback}`);

    if (r.notes.length > 0) {
      for (const n of r.notes) console.log(`  → ${n}`);
    }
    if (r.reasons.length > 0) {
      console.log(`  Razões determinísticas: ${r.reasons.slice(0, 3).join(" | ")}`);
    }

    const { judgeMs, judgeInputTokens, judgeOutputTokens, rewriteMs } = r.metrics;
    if (judgeMs > 0 || rewriteMs > 0) {
      console.log(`  Tokens juiz: entrada=${judgeInputTokens} saída=${judgeOutputTokens} | latência=${judgeMs}ms reescrita=${rewriteMs}ms`);
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════════");
  if (aprovados === total) {
    console.log("  PARTE 4 HOMOLOGADA: SIM");
  } else {
    console.log(`  PARTE 4 HOMOLOGADA: NÃO (${total - aprovados} cenário(s) reprovado(s))`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Token totals
  const totalJudgeIn = results.reduce((a, r) => a + r.metrics.judgeInputTokens, 0);
  const totalJudgeOut = results.reduce((a, r) => a + r.metrics.judgeOutputTokens, 0);
  const totalRewriteIn = results.reduce((a, r) => a + r.metrics.rewriteInputTokens, 0);
  const totalRewriteOut = results.reduce((a, r) => a + r.metrics.rewriteOutputTokens, 0);
  console.log(`  Tokens totais — Juiz: entrada=${totalJudgeIn} saída=${totalJudgeOut}`);
  console.log(`  Tokens totais — Reescrita: entrada=${totalRewriteIn} saída=${totalRewriteOut}`);
  console.log();
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

    const anthropic = new Anthropic({ apiKey });

    console.log("\n[homologar-parte4] Iniciando homologação do Juiz da Resposta...");
    console.log("[homologar-parte4] Modelo Juiz:", JUDGE_MODEL);
    console.log("[homologar-parte4] Modelo Júlia:", JULIA_MODEL);

    const t0 = Date.now();

    const results: ScenarioResult[] = [];

    // Cenários A-D e F rodam em sequência para evitar rate limiting
    console.log("[homologar-parte4] Cenário A: pergunta simples de preço...");
    results.push(await cenarioA(anthropic));

    console.log("[homologar-parte4] Cenário B: objeção financeira...");
    results.push(await cenarioB(anthropic));

    console.log("[homologar-parte4] Cenário C: pagamento sem consulta...");
    results.push(await cenarioC(anthropic));

    console.log("[homologar-parte4] Cenário D: Pix com dados verificados...");
    results.push(await cenarioD(anthropic));

    console.log("[homologar-parte4] Cenário E: reserva solicitada + afirmação falsa...");
    results.push(await cenarioE(anthropic));

    console.log("[homologar-parte4] Cenário F: pagamento falhou + Júlia envia dados...");
    results.push(await cenarioF(anthropic));

    const totalMs = Date.now() - t0;
    console.log(`[homologar-parte4] Todos os cenários concluídos em ${totalMs}ms`);

    printRelatorio(results);

    const aprovados = results.filter((r) => r.aprovado).length;
    const homologado = aprovados === results.length;

    return new Response(
      JSON.stringify({
        homologado,
        aprovados,
        total: results.length,
        totalMs,
        cenarios: results.map((r) => ({
          id: r.id,
          aprovado: r.aprovado,
          expectedVerdict: r.expectedVerdict,
          actualVerdict: r.actualVerdict,
          blocked: r.blocked,
          judgeRan: r.judgeRan,
          rewritePerformed: r.rewritePerformed,
          usedFallback: r.usedFallback,
          notes: r.notes,
        })),
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[homologar-parte4] Erro:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
