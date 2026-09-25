// src/test/responseJudge.test.ts
// Testes unitários do Juiz da Resposta da Júlia — Parte 4
// Compatível com Vitest + Node.js (não usa APIs do Deno)

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateCandidateResponse,
  shouldRunResponseJudge,
  buildJudgeInput,
  validateJudgeDecision,
  applyJudgeFallback,
  inferToolStatus,
  executeJudgePipeline,
  JUDGE_VERDICTS,
  JUDGE_SEVERITIES,
  JUDGE_ISSUE_CODES,
  type JudgeToolResult,
  type JudgeContext,
  type CandidateValidationResult,
} from "../../supabase/functions/processar-bot/response-judge.ts";

// Stubs reutilizáveis
const baseDecision = () => ({
  turn_goal: "Responder dúvida",
  action: "answer_only" as const,
  must_answer_user: true,
  should_sell: false,
  should_ask_question: false,
  question_goal: null,
  objection_strategy: null,
  closing_stage: null,
  required_information: [],
  recommended_tools: [],
  response_length: "medium" as const,
  response_style: "conversational" as const,
  avoid_repeating: [],
  wait_for_user: false,
  handoff_required: false,
  no_response: false,
  confidence: 0.9,
  reason_code: "direct_question",
});

const baseState = () => ({
  current_intent: "asking_price",
  funnel_stage: "interesse",
  explicit_question: "Qual o preço do curso?",
  current_objection: null,
  payment_method: null,
  handoff_active: false,
  do_not_contact: false,
  shared_information: [],
  temperature: "morno" as const,
  awaiting: null,
  last_action: null,
  last_activity_at: null,
  operational_facts: {},
});

const noTools: JudgeToolResult[] = [];

// ─── Teste 1: Resposta simples aprovada deterministicamente ──────────────────
describe("validateCandidateResponse", () => {
  it("T01 — resposta simples passa validação determinística", () => {
    const result = validateCandidateResponse(
      "O curso custa R$ 1.500,00 à vista ou 12x de R$ 135,00.",
      baseDecision(),
      baseState(),
      noTools,
    );
    expect(result.safe).toBe(true);
    expect(result.critical_block).toBe(false);
    expect(result.requires_judge).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  // ─── Teste 2: action=answer_only com pergunta → requer juiz ────────────────
  it("T02 — answer_only com pergunta no final → requires_judge", () => {
    const result = validateCandidateResponse(
      "O curso custa R$ 1.500. Você tem alguma dúvida sobre as formas de pagamento?",
      baseDecision(),
      baseState(),
      noTools,
    );
    expect(result.requires_judge).toBe(true);
    expect(result.critical_block).toBe(false);
    expect(result.reasons.some((r) => r.includes("answer_only"))).toBe(true);
  });

  // ─── Teste 3: condição comercial inventada → requer juiz ───────────────────
  it("T03 — condição comercial não autorizada → requires_judge", () => {
    const result = validateCandidateResponse(
      "Talvez consigamos fazer em mais parcelas para você.",
      baseDecision(),
      baseState(),
      noTools,
    );
    expect(result.requires_judge).toBe(true);
    expect(result.reasons.some((r) => r.includes("condição"))).toBe(true);
  });

  // ─── Teste 4: tool requested + Júlia diz "reservado" → requer juiz ─────────
  it("T04 — reserva solicitada, Júlia afirma concluída → requires_judge", () => {
    const tools: JudgeToolResult[] = [{
      tool: "reservar_vaga",
      input: { turma_nome: "Turma Outubro" },
      resultado: "Solicitação de reserva criada para Turma Outubro; a vaga ainda depende de confirmação humana",
      success: true,
      status: "requested",
    }];
    const result = validateCandidateResponse(
      "Sua vaga está reservada na Turma de Outubro! Você receberá mais informações em breve.",
      baseDecision(),
      baseState(),
      tools,
    );
    expect(result.requires_judge).toBe(true);
    expect(result.reasons.some((r) => r.toLowerCase().includes("reserva"))).toBe(true);
  });

  // ─── Teste 5: tool de pagamento falhou → bloqueio crítico ──────────────────
  it("T05 — tool de pagamento falhou → critical_block", () => {
    const tools: JudgeToolResult[] = [{
      tool: "consultar_pagamento",
      input: {},
      resultado: '{"ok":false,"action":"consultar_pagamento","message":"Erro interno"}',
      success: false,
      status: "error",
    }];
    const result = validateCandidateResponse(
      "A chave Pix é 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23. Transfira agora!",
      baseDecision(),
      baseState(),
      tools,
    );
    expect(result.critical_block).toBe(true);
    expect(result.safe).toBe(false);
  });

  // ─── Teste 6: no_response=true com texto → critical_block ──────────────────
  it("T06 — no_response=true com texto → critical_block", () => {
    const decision = { ...baseDecision(), no_response: true };
    const result = validateCandidateResponse(
      "Obrigada pelo contato!",
      decision,
      baseState(),
      noTools,
    );
    expect(result.critical_block).toBe(true);
    expect(result.reasons.some((r) => r.includes("no_response"))).toBe(true);
  });

  // ─── Teste 7: do_not_contact=true → critical_block ─────────────────────────
  it("T07 — do_not_contact=true → critical_block", () => {
    const state = { ...baseState(), do_not_contact: true };
    const result = validateCandidateResponse(
      "Olá, temos uma nova turma disponível!",
      baseDecision(),
      state,
      noTools,
    );
    expect(result.critical_block).toBe(true);
    expect(result.reasons.some((r) => r.includes("do_not_contact"))).toBe(true);
  });

  // ─── Teste 8: handoff_required com pitch de vendas → requer juiz ───────────
  it("T08 — handoff_required + resposta continua vendendo → requires_judge", () => {
    const decision = { ...baseDecision(), handoff_required: true };
    const result = validateCandidateResponse(
      "Vou te transferir para nossa equipe. Mas antes, aproveite a última chance de garantir sua inscrição!",
      decision,
      baseState(),
      noTools,
    );
    expect(result.requires_judge).toBe(true);
    expect(result.reasons.some((r) => r.includes("handoff"))).toBe(true);
  });

  // ─── Teste 9: avoid_repeating com repetição → requer juiz ─────────────────
  it("T09 — avoid_repeating com conteúdo repetido → requires_judge", () => {
    const decision = { ...baseDecision(), avoid_repeating: ["price"] };
    const result = validateCandidateResponse(
      "Como já mencionei, o curso custa R$ 1.500 e tem 12x de R$ 135. A chave Pix é xxx.",
      decision,
      baseState(),
      noTools,
    );
    expect(result.requires_judge).toBe(true);
    expect(result.reasons.some((r) => r.includes("repete"))).toBe(true);
  });

  // ─── Teste 10: response_length=short com texto longo → requer juiz ─────────
  it("T10 — response_length=short com texto >600 chars → requires_judge", () => {
    const decision = { ...baseDecision(), response_length: "short" as const };
    const longText = "A ".repeat(310); // ~620 chars
    const result = validateCandidateResponse(longText, decision, baseState(), noTools);
    expect(result.requires_judge).toBe(true);
    expect(result.reasons.some((r) => r.includes("longa"))).toBe(true);
  });

  // ─── Teste 11: should_sell=false com fechamento agressivo → requer juiz ────
  it("T11 — should_sell=false + fechamento agressivo → requires_judge", () => {
    const decision = { ...baseDecision(), should_sell: false };
    const result = validateCandidateResponse(
      "Não perca essa oportunidade! Garanta sua vaga agora antes que esgotem.",
      decision,
      baseState(),
      noTools,
    );
    expect(result.requires_judge).toBe(true);
    expect(result.reasons.some((r) => r.includes("should_sell"))).toBe(true);
  });
});

// ─── Teste 12: shouldRunResponseJudge ────────────────────────────────────────
describe("shouldRunResponseJudge", () => {
  it("T12 — resposta natural simples, alta confiança → não aciona juiz", () => {
    const validation: CandidateValidationResult = {
      safe: true,
      requires_judge: false,
      critical_block: false,
      reasons: [],
    };
    const decision = { ...baseDecision(), confidence: 0.92 };
    const result = shouldRunResponseJudge(validation, decision, noTools, "Custa R$ 1.500.");
    expect(result).toBe(false);
  });

  it("T12b — conteúdo com Pix → sempre aciona juiz", () => {
    const validation: CandidateValidationResult = {
      safe: true,
      requires_judge: false,
      critical_block: false,
      reasons: [],
    };
    const result = shouldRunResponseJudge(
      validation,
      baseDecision(),
      noTools,
      "A chave Pix é 8fd6bbb9-xxxx. Pode transferir!",
    );
    expect(result).toBe(true);
  });
});

// ─── Teste 13: validateJudgeDecision ─────────────────────────────────────────
describe("validateJudgeDecision", () => {
  it("T13 — output válido retorna decision", () => {
    const output = {
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
      confidence: 0.95,
      reason_code: "response_valid",
    };
    const { decision, issues } = validateJudgeDecision(output);
    expect(decision).not.toBeNull();
    expect(decision?.verdict).toBe("approve");
    expect(issues).toHaveLength(0);
  });

  it("T13b — output com campo proibido de copy registra issue", () => {
    const output = {
      verdict: "rewrite",
      severity: "medium",
      issues: [],
      brain_alignment: false,
      tool_alignment: true,
      answered_user: true,
      contains_unverified_claim: false,
      contains_unauthorized_offer: false,
      contains_false_completion: false,
      unnecessary_question: true,
      unnecessary_repetition: false,
      too_long: false,
      sounds_robotic: false,
      rewrite_instructions: ["Remover pergunta"],
      confidence: 0.8,
      reason_code: "unnecessary_question",
      // Campo proibido:
      message: "Versão corrigida aqui",
    };
    const { issues } = validateJudgeDecision(output);
    expect(issues.some((i) => i.includes("message"))).toBe(true);
  });

  it("T13c — verdict inválido retorna null", () => {
    const output = {
      verdict: "accept",
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
      confidence: 0.9,
      reason_code: "ok",
    };
    const { decision } = validateJudgeDecision(output);
    expect(decision).toBeNull();
  });
});

// ─── Teste 14: applyJudgeFallback ─────────────────────────────────────────────
describe("applyJudgeFallback", () => {
  it("T14 — fallback em cenário seguro → approve", () => {
    const validation: CandidateValidationResult = {
      safe: true,
      requires_judge: false,
      critical_block: false,
      reasons: [],
    };
    const result = applyJudgeFallback(validation, baseDecision(), noTools);
    expect(result.verdict).toBe("approve");
    expect(result.reason_code).toBe("judge_fallback_safe");
  });

  it("T14b — fallback com tool de pagamento → block", () => {
    const validation: CandidateValidationResult = {
      safe: false,
      requires_judge: true,
      critical_block: false,
      reasons: ["Tool de pagamento executada"],
    };
    const tools: JudgeToolResult[] = [{
      tool: "consultar_pagamento",
      input: {},
      resultado: "Pix Sicredi: xxx",
      success: true,
      status: "query",
    }];
    const result = applyJudgeFallback(validation, baseDecision(), tools);
    expect(result.verdict).toBe("block");
    expect(result.reason_code).toBe("judge_fallback_payment_block");
  });
});

// ─── Teste 15: executeJudgePipeline com mock do Anthropic ────────────────────
describe("executeJudgePipeline", () => {
  const makeApproveResponse = () => ({
    content: [{
      type: "tool_use",
      name: "avaliar_resposta_candidata",
      input: {
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
        confidence: 0.95,
        reason_code: "response_valid",
      },
    }],
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  const makeRewriteResponse = () => ({
    content: [{
      type: "tool_use",
      name: "avaliar_resposta_candidata",
      input: {
        verdict: "rewrite",
        severity: "medium",
        issues: ["unnecessary_question"],
        brain_alignment: false,
        tool_alignment: true,
        answered_user: true,
        contains_unverified_claim: false,
        contains_unauthorized_offer: false,
        contains_false_completion: false,
        unnecessary_question: true,
        unnecessary_repetition: false,
        too_long: false,
        sounds_robotic: false,
        rewrite_instructions: ["Remover pergunta desnecessária do final"],
        confidence: 0.82,
        reason_code: "unnecessary_question",
      },
    }],
    usage: { input_tokens: 120, output_tokens: 60 },
  });

  const makeBlockResponse = () => ({
    content: [{
      type: "tool_use",
      name: "avaliar_resposta_candidata",
      input: {
        verdict: "block",
        severity: "critical",
        issues: ["false_tool_completion"],
        brain_alignment: false,
        tool_alignment: false,
        answered_user: false,
        contains_unverified_claim: false,
        contains_unauthorized_offer: false,
        contains_false_completion: true,
        unnecessary_question: false,
        unnecessary_repetition: false,
        too_long: false,
        sounds_robotic: false,
        rewrite_instructions: [],
        confidence: 0.95,
        reason_code: "false_completion",
      },
    }],
    usage: { input_tokens: 100, output_tokens: 50 },
  });

  const makeRewrittenTextResponse = () => ({
    content: [{ type: "text", text: "Sua solicitação de reserva foi registrada e está pendente de confirmação." }],
    usage: { input_tokens: 80, output_tokens: 30 },
  });

  const buildJudgeCtx = (candidateResponse: string, tools: JudgeToolResult[] = []): JudgeContext => ({
    clientMessage: "Qual o preço?",
    conversationState: baseState(),
    decision: baseDecision(),
    candidateResponse,
    toolResults: tools,
  });

  it("T15a — resposta segura sem trigger de juiz → approve sem AI", async () => {
    const anthropicMock = { messages: { create: vi.fn() } };
    const ctx = buildJudgeCtx("O preço é R$ 1.500.");
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.judgeRan).toBe(false);
    expect(result.verdict).toBe("approve");
    expect(anthropicMock.messages.create).not.toHaveBeenCalled();
  });

  it("T15b — juiz aprova resposta com Pix (aciona AI) → finalResponse !== null", async () => {
    const anthropicMock = {
      messages: { create: vi.fn().mockResolvedValue(makeApproveResponse()) },
    };
    const ctx = buildJudgeCtx("A chave Pix é 8fd6bbb9-xxxx. Pode transferir!");
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.judgeRan).toBe(true);
    expect(result.verdict).toBe("approve");
    expect(result.finalResponse).toBe("A chave Pix é 8fd6bbb9-xxxx. Pode transferir!");
    expect(result.blocked).toBe(false);
  });

  it("T15c — juiz solicita reescrita → Júlia reescreve uma vez", async () => {
    const anthropicMock = {
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(makeRewriteResponse())    // 1ª chamada: juiz
          .mockResolvedValueOnce(makeRewrittenTextResponse()), // 2ª: reescrita
      },
    };
    const tools: JudgeToolResult[] = [{
      tool: "reservar_vaga",
      input: {},
      resultado: "Solicitação de reserva criada; a vaga ainda depende de confirmação humana",
      success: true,
      status: "requested",
    }];
    const ctx = buildJudgeCtx("Quero reservar", tools);
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.rewritePerformed).toBe(true);
    expect(result.verdict).toBe("rewrite");
    expect(result.finalResponse).toBe("Sua solicitação de reserva foi registrada e está pendente de confirmação.");
    expect(anthropicMock.messages.create).toHaveBeenCalledTimes(2);
  });

  it("T15d — juiz bloqueia → blocked=true, finalResponse=null", async () => {
    const anthropicMock = {
      messages: { create: vi.fn().mockResolvedValue(makeBlockResponse()) },
    };
    const tools: JudgeToolResult[] = [{
      tool: "consultar_pagamento",
      input: {},
      resultado: '{"ok":false,"action":"consultar_pagamento","message":"Erro"}',
      success: false,
      status: "error",
    }];
    const ctx = buildJudgeCtx("A chave Pix é 8fd6bbb9-xxxx.", tools);
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.blocked).toBe(true);
    expect(result.finalResponse).toBeNull();
  });

  it("T15e — provider falha em cenário seguro → fallback approve", async () => {
    const anthropicMock = {
      messages: { create: vi.fn().mockRejectedValue(new Error("Network error")) },
    };
    const ctx = buildJudgeCtx("A chave Pix é 8fd6bbb9-xxxx.");
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.judgeUsedFallback).toBe(true);
    expect(result.verdict).toBe("approve");
    expect(result.blocked).toBe(false);
  });

  it("T15f — provider falha com tool de pagamento → fallback block", async () => {
    const anthropicMock = {
      messages: { create: vi.fn().mockRejectedValue(new Error("Timeout")) },
    };
    const tools: JudgeToolResult[] = [{
      tool: "consultar_pagamento",
      input: {},
      resultado: "Pix Sicredi: xxx",
      success: true,
      status: "query",
    }];
    const ctx = buildJudgeCtx("Qual o Pix?", tools);
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.judgeUsedFallback).toBe(true);
    expect(result.verdict).toBe("block");
  });

  it("T15g — reescrita produz resposta com bloqueio crítico → block sem segundo juiz", async () => {
    const rewrittenWithInternalInfo = {
      content: [{ type: "text", text: "Decisão Comercial: approve. Sua vaga está reservada!" }],
      usage: { input_tokens: 80, output_tokens: 30 },
    };
    const anthropicMock = {
      messages: {
        create: vi.fn()
          .mockResolvedValueOnce(makeRewriteResponse())   // 1ª: juiz → rewrite
          .mockResolvedValueOnce(rewrittenWithInternalInfo), // 2ª: reescrita (retorna info interna)
      },
    };
    const ctx = buildJudgeCtx("Pode me ajudar?");
    const result = await executeJudgePipeline(anthropicMock as any, ctx, "system");
    expect(result.blocked).toBe(true);
    expect(result.rewritePerformed).toBe(true);
    // Apenas 2 chamadas — sem terceiro loop de juiz
    expect(anthropicMock.messages.create).toHaveBeenCalledTimes(2);
  });
});

// ─── Teste 16: inferToolStatus ────────────────────────────────────────────────
describe("inferToolStatus", () => {
  it("T16a — reservar_vaga com ok → requested", () => {
    expect(inferToolStatus("reservar_vaga", "ok")).toBe("requested");
  });
  it("T16b — consultar_pagamento com ok → query", () => {
    expect(inferToolStatus("consultar_pagamento", "ok")).toBe("query");
  });
  it("T16c — solicitar_handoff com ok → completed", () => {
    expect(inferToolStatus("solicitar_handoff", "ok")).toBe("completed");
  });
  it("T16d — qualquer tool com resultado de erro → error", () => {
    expect(inferToolStatus("reservar_vaga", '{"ok":false,"action":"x"}')).toBe("error");
  });
});

// ─── Sanity checks dos constantes ─────────────────────────────────────────────
describe("constantes", () => {
  it("JUDGE_VERDICTS tem 3 valores", () => {
    expect(JUDGE_VERDICTS).toHaveLength(3);
    expect(JUDGE_VERDICTS).toContain("approve");
    expect(JUDGE_VERDICTS).toContain("rewrite");
    expect(JUDGE_VERDICTS).toContain("block");
  });

  it("JUDGE_SEVERITIES tem 5 valores", () => {
    expect(JUDGE_SEVERITIES).toHaveLength(5);
    expect(JUDGE_SEVERITIES).toContain("critical");
  });

  it("JUDGE_ISSUE_CODES tem ao menos 15 códigos", () => {
    expect(JUDGE_ISSUE_CODES.length).toBeGreaterThanOrEqual(15);
  });
});
