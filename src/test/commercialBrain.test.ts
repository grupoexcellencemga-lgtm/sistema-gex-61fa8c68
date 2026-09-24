import { describe, expect, it, vi } from "vitest";
import {
  VALID_BRAIN_TOOLS,
  applyCommercialDecisionPolicies,
  buildCommercialBrainInput,
  createCommercialBrainFallback,
  decideCommercialTurn,
  formatCommercialDecisionContext,
  prepareCommercialBrainConversation,
  toCommercialDecisionLog,
  validateCommercialDecision,
  type AnthropicClient,
  type BrainMessage,
  type BrainOperationalContext,
  type CommercialDecision,
} from "../../supabase/functions/processar-bot/commercial-brain";
import { DEFAULT_CONVERSATION_STATE, type ConversationState } from "../../supabase/functions/processar-bot/conversation-state";

// ─── helpers ─────────────────────────────────────────────────────────────────

const baseState = (): ConversationState => ({
  ...DEFAULT_CONVERSATION_STATE,
  information_already_shared: [],
  known_user_facts: [],
});

const validDecision = (): CommercialDecision => ({
  turn_goal: "answer_question",
  action: "answer_only",
  must_answer_user: true,
  should_sell: false,
  should_ask_question: false,
  question_goal: null,
  objection_strategy: null,
  closing_stage: "none",
  required_information: [],
  recommended_tools: [],
  response_length: "short",
  response_style: "direct",
  avoid_repeating: [],
  wait_for_user: false,
  handoff_required: false,
  no_response: false,
  confidence: 0.95,
  reason_code: "direct_question",
});

const operationalCtx = (): BrainOperationalContext => ({ agentMode: "teste" });

function mockAnthropicReturning(toolInput: Record<string, unknown>): AnthropicClient {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "tool_use", name: "decidir_turno_comercial", input: toolInput }],
      }),
    },
  };
}

// ─── 1. Validação ─────────────────────────────────────────────────────────────

describe("validateCommercialDecision", () => {
  it("aceita decisão válida sem issues", () => {
    const { decision, issues } = validateCommercialDecision(validDecision());
    expect(decision).not.toBeNull();
    expect(issues.filter(i => !i.includes("tool inexistente"))).toHaveLength(0);
  });

  it("rejeita objeto nulo", () => {
    const { decision } = validateCommercialDecision(null);
    expect(decision).toBeNull();
  });

  it("rejeita turn_goal inválido", () => {
    const { decision, issues } = validateCommercialDecision({ ...validDecision(), turn_goal: "inventado" });
    expect(decision).toBeNull();
    expect(issues.some(i => i.includes("turn_goal"))).toBe(true);
  });

  it("rejeita action inválida", () => {
    const { decision, issues } = validateCommercialDecision({ ...validDecision(), action: "xyz" });
    expect(decision).toBeNull();
    expect(issues.some(i => i.includes("action"))).toBe(true);
  });

  it("rejeita confidence fora do intervalo 0-1", () => {
    const { issues } = validateCommercialDecision({ ...validDecision(), confidence: 1.5 });
    expect(issues.some(i => i.includes("confidence"))).toBe(true);
  });

  it("rejeita confidence negativo", () => {
    const { issues } = validateCommercialDecision({ ...validDecision(), confidence: -0.1 });
    expect(issues.some(i => i.includes("confidence"))).toBe(true);
  });

  it("rejeita reason_code vazio", () => {
    const { decision, issues } = validateCommercialDecision({ ...validDecision(), reason_code: "" });
    expect(decision).toBeNull();
    expect(issues.some(i => i.includes("reason_code"))).toBe(true);
  });

  it("rejeita reason_code maior que 50 chars", () => {
    const { decision, issues } = validateCommercialDecision({
      ...validDecision(), reason_code: "a".repeat(51),
    });
    expect(decision).toBeNull();
    expect(issues.some(i => i.includes("reason_code"))).toBe(true);
  });

  it("remove tool inexistente de recommended_tools e registra issue", () => {
    const { decision, issues } = validateCommercialDecision({
      ...validDecision(),
      recommended_tools: ["consultar_pagamento", "ferramenta_inventada"],
    });
    expect(issues.some(i => i.includes("ferramenta_inventada"))).toBe(true);
    expect(decision?.recommended_tools).not.toContain("ferramenta_inventada");
    expect(decision?.recommended_tools).toContain("consultar_pagamento");
  });

  it("rejeita campos de copy (message, response, text, copy)", () => {
    const { issues } = validateCommercialDecision({ ...validDecision(), message: "Olá!" });
    expect(issues.some(i => i.includes("message") && i.includes("copy proibido"))).toBe(true);
  });

  it("rejeita campo 'resposta' (copy em português)", () => {
    const { issues } = validateCommercialDecision({ ...validDecision(), resposta: "blah" });
    expect(issues.some(i => i.includes("resposta") && i.includes("copy proibido"))).toBe(true);
  });

  it("rejeita campo 'texto'", () => {
    const { issues } = validateCommercialDecision({ ...validDecision(), texto: "blah" });
    expect(issues.some(i => i.includes("texto") && i.includes("copy proibido"))).toBe(true);
  });

  it("rejeita booleano inválido em must_answer_user", () => {
    const { decision, issues } = validateCommercialDecision({ ...validDecision(), must_answer_user: "yes" });
    expect(decision).toBeNull();
    expect(issues.some(i => i.includes("must_answer_user"))).toBe(true);
  });

  it("todos os campos obrigatórios ausentes retornam decision = null", () => {
    const { decision, issues } = validateCommercialDecision({});
    expect(decision).toBeNull();
    expect(issues.length).toBeGreaterThan(0);
  });
});

// ─── 2. Políticas determinísticas ─────────────────────────────────────────────

describe("applyCommercialDecisionPolicies", () => {
  it("do_not_contact: força no_response independente do modelo", () => {
    const state = { ...baseState(), do_not_contact: true };
    const decision = applyCommercialDecisionPolicies({ ...validDecision(), should_sell: true }, state);
    expect(decision.no_response).toBe(true);
    expect(decision.should_sell).toBe(false);
    expect(decision.action).toBe("no_response");
    expect(decision.turn_goal).toBe("no_response");
    expect(decision.recommended_tools).toHaveLength(0);
  });

  it("handoff_active: força handoff e adiciona solicitar_handoff", () => {
    const state = { ...baseState(), handoff_active: true };
    const decision = applyCommercialDecisionPolicies({ ...validDecision(), recommended_tools: [] }, state);
    expect(decision.handoff_required).toBe(true);
    expect(decision.action).toBe("handoff");
    expect(decision.recommended_tools).toContain("solicitar_handoff");
    expect(decision.should_sell).toBe(false);
  });

  it("handoff_required sem solicitar_handoff: a política adiciona a tool", () => {
    const state = baseState();
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      handoff_required: true,
      recommended_tools: [],
    }, state);
    expect(decision.recommended_tools).toContain("solicitar_handoff");
  });

  it("handoff_required com solicitar_handoff já presente: não duplica", () => {
    const state = baseState();
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      handoff_required: true,
      recommended_tools: ["solicitar_handoff"],
    }, state);
    const count = decision.recommended_tools.filter(t => t === "solicitar_handoff").length;
    expect(count).toBe(1);
  });

  it("explicit_question: força must_answer_user = true", () => {
    const state = { ...baseState(), explicit_question: "Onde acontece o curso?" };
    const decision = applyCommercialDecisionPolicies({ ...validDecision(), must_answer_user: false }, state);
    expect(decision.must_answer_user).toBe(true);
  });

  it("should_ask_question sem question_goal: corrige para false", () => {
    const state = baseState();
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      should_ask_question: true,
      question_goal: null,
    }, state);
    expect(decision.should_ask_question).toBe(false);
  });

  it("purchase_intent = clear: não regredir para discover_need", () => {
    const state = { ...baseState(), purchase_intent: "clear" as const };
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      turn_goal: "discover_need",
      action: "discover_need",
    }, state);
    expect(decision.turn_goal).toBe("close_sale");
    expect(decision.action).toBe("close_sale");
    expect(decision.should_sell).toBe(true);
  });

  it("purchase_intent = clear: não regredir para qualify", () => {
    const state = { ...baseState(), purchase_intent: "clear" as const };
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      turn_goal: "qualify",
      action: "qualify",
    }, state);
    expect(decision.turn_goal).toBe("close_sale");
  });

  it("information_already_shared: alimenta avoid_repeating", () => {
    const state = { ...baseState(), information_already_shared: ["price", "dates"] as typeof DEFAULT_CONVERSATION_STATE["information_already_shared"] };
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      avoid_repeating: ["location"],
    }, state);
    expect(decision.avoid_repeating).toContain("price");
    expect(decision.avoid_repeating).toContain("dates");
    expect(decision.avoid_repeating).toContain("location");
  });

  it("no_response: coerce turn_goal e action", () => {
    const state = baseState();
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      no_response: true,
      turn_goal: "close_sale",
      action: "close_sale",
      must_answer_user: true,
    }, state);
    expect(decision.turn_goal).toBe("no_response");
    expect(decision.action).toBe("no_response");
    expect(decision.must_answer_user).toBe(false);
    expect(decision.should_sell).toBe(false);
  });

  it("ferramenta inválida que escape chega filtrada pela política", () => {
    const state = baseState();
    const decision = applyCommercialDecisionPolicies({
      ...validDecision(),
      recommended_tools: ["consultar_pagamento", "ferramenta_fantasma"] as any,
    }, state);
    expect(decision.recommended_tools).not.toContain("ferramenta_fantasma");
    expect(decision.recommended_tools).toContain("consultar_pagamento");
  });
});

// ─── 3. Fallback ──────────────────────────────────────────────────────────────

describe("createCommercialBrainFallback", () => {
  it("fallback padrão tem confidence = 0 e reason_code = brain_fallback", () => {
    const fb = createCommercialBrainFallback();
    expect(fb.confidence).toBe(0);
    expect(fb.reason_code).toBe("brain_fallback");
    expect(fb.should_sell).toBe(false);
  });

  it("fallback com handoff_active = true inclui solicitar_handoff", () => {
    const fb = createCommercialBrainFallback({ handoff_active: true, do_not_contact: false });
    expect(fb.handoff_required).toBe(true);
    expect(fb.recommended_tools).toContain("solicitar_handoff");
    expect(fb.action).toBe("handoff");
  });

  it("fallback com do_not_contact = true retorna no_response", () => {
    const fb = createCommercialBrainFallback({ handoff_active: false, do_not_contact: true });
    expect(fb.no_response).toBe(true);
    expect(fb.action).toBe("no_response");
    expect(fb.recommended_tools).toHaveLength(0);
  });
});

// ─── 4. Preparar conversa ─────────────────────────────────────────────────────

describe("prepareCommercialBrainConversation", () => {
  it("separa histórico da última mensagem sem duplicar", () => {
    const msgs: BrainMessage[] = [
      { direction: "saida", content: "Olá! Posso ajudar?" },
      { direction: "entrada", content: "Quanto custa o OPEX?" },
    ];
    const { history, lastMessage } = prepareCommercialBrainConversation(msgs);
    expect(lastMessage).toBe("Quanto custa o OPEX?");
    expect(history).toContain("Júlia: Olá! Posso ajudar?");
    expect(history).not.toContain("Quanto custa o OPEX?");
  });

  it("mídia sem texto retorna representação segura", () => {
    const msgs: BrainMessage[] = [
      { direction: "entrada", content: null, mediaType: "imagem" },
    ];
    const { lastMessage } = prepareCommercialBrainConversation(msgs);
    expect(lastMessage).toContain("imagem");
    expect(lastMessage).not.toBe("");
  });

  it("sem mensagens de entrada retorna sentinela", () => {
    const msgs: BrainMessage[] = [
      { direction: "saida", content: "Olá!" },
    ];
    const { lastMessage } = prepareCommercialBrainConversation(msgs);
    expect(lastMessage).toBe("[Nenhuma mensagem do usuário disponível]");
  });

  it("array vazio retorna sentinela", () => {
    const { lastMessage } = prepareCommercialBrainConversation([]);
    expect(lastMessage).toBe("[Nenhuma mensagem do usuário disponível]");
  });
});

// ─── 5. Construção do input ────────────────────────────────────────────────────

describe("buildCommercialBrainInput", () => {
  it("inclui explicit_question quando presente", () => {
    const state = { ...baseState(), explicit_question: "Onde fica o curso?" };
    const input = buildCommercialBrainInput(state, "", "última msg", operationalCtx());
    expect(input).toContain("Onde fica o curso?");
  });

  it("inclui informações já apresentadas", () => {
    const state = { ...baseState(), information_already_shared: ["price", "dates"] as any };
    const input = buildCommercialBrainInput(state, "hist", "última msg", operationalCtx());
    expect(input).toContain("price");
    expect(input).toContain("dates");
  });

  it("não inclui prompt V2 completo, RAG ou catálogo", () => {
    const input = buildCommercialBrainInput(baseState(), "", "msg", operationalCtx());
    expect(input).not.toContain("PROMPT-MESTRE");
    expect(input).not.toContain("BASE DE CONHECIMENTO");
  });
});

// ─── 6. Formato do bloco de decisão ──────────────────────────────────────────

describe("formatCommercialDecisionContext", () => {
  it("retorna string vazia quando no_response = true", () => {
    const block = formatCommercialDecisionContext({ ...validDecision(), no_response: true });
    expect(block).toBe("");
  });

  it("inclui turn_goal e action", () => {
    const block = formatCommercialDecisionContext(validDecision());
    expect(block).toContain("answer_question");
    expect(block).toContain("answer_only");
  });

  it("inclui tools recomendadas quando presentes", () => {
    const block = formatCommercialDecisionContext({
      ...validDecision(),
      recommended_tools: ["consultar_pagamento"],
    });
    expect(block).toContain("consultar_pagamento");
  });

  it("instrui a não exibir ao contato", () => {
    const block = formatCommercialDecisionContext(validDecision());
    expect(block.toLowerCase()).toContain("nunca");
  });
});

// ─── 7. Log operacional ────────────────────────────────────────────────────────

describe("toCommercialDecisionLog", () => {
  it("inclui campos operacionais", () => {
    const log = toCommercialDecisionLog(validDecision());
    expect(log).toHaveProperty("turn_goal");
    expect(log).toHaveProperty("action");
    expect(log).toHaveProperty("reason_code");
    expect(log).toHaveProperty("confidence");
  });

  it("não inclui avoid_repeating (pode conter dados pessoais)", () => {
    const log = toCommercialDecisionLog(validDecision()) as Record<string, unknown>;
    expect(log).not.toHaveProperty("avoid_repeating");
  });
});

// ─── 8. VALID_BRAIN_TOOLS inclui todas as tools do processar-bot ─────────────

describe("VALID_BRAIN_TOOLS", () => {
  const expectedTools = [
    "atualizar_lead", "pontuar_lead", "consultar_contexto_lead", "consultar_produtos",
    "registrar_nota", "mover_etapa", "consultar_turmas", "consultar_pagamento",
    "classificar_lead", "reservar_vaga", "cadastrar_aluno", "agendar_reuniao",
    "adicionar_grupo_turma", "enviar_material", "marcar_nao_contatar",
    "criar_tarefa", "solicitar_handoff",
  ];
  for (const tool of expectedTools) {
    it(`inclui ${tool}`, () => {
      expect(VALID_BRAIN_TOOLS).toContain(tool);
    });
  }
});

// ─── 9. decideCommercialTurn — integração com mock ───────────────────────────

describe("decideCommercialTurn — integração", () => {
  const msgs: BrainMessage[] = [{ direction: "entrada", content: "Quanto custa o OPEX?" }];

  it("Cenário 1: preço do OPEX — modelo retorna answer_only, não vende", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "answer_question",
      action: "answer_only",
      should_sell: false,
      recommended_tools: ["consultar_produtos"],
      reason_code: "price_question",
    });
    const state = { ...baseState(), current_intent: "preco" as const };
    const { decision, usedFallback } = await decideCommercialTurn(client, state, msgs, operationalCtx());
    expect(usedFallback).toBe(false);
    expect(decision.action).toBe("answer_only");
    expect(decision.should_sell).toBe(false);
  });

  it("Cenário 2: compra clara — modelo retorna close_sale", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "close_sale",
      action: "close_sale",
      should_sell: true,
      closing_stage: "direct_close",
      recommended_tools: ["consultar_turmas"],
      reason_code: "clear_purchase_intent",
      confidence: 0.95,
    });
    const state = { ...baseState(), purchase_intent: "clear" as const, current_intent: "inscricao" as const };
    const closeMsgs: BrainMessage[] = [{ direction: "entrada", content: "Quero fechar. Como entro?" }];
    const { decision } = await decideCommercialTurn(client, state, closeMsgs, operationalCtx());
    expect(decision.action).toBe("close_sale");
    expect(decision.should_sell).toBe(true);
  });

  it("Cenário 3: objeção financeira — modelo retorna handle_objection", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "handle_objection",
      action: "handle_objection",
      objection_strategy: "clarify_financial",
      should_sell: false,
      reason_code: "financial_objection",
    });
    const state = { ...baseState(), current_objection: "financeira" as const };
    const objMsgs: BrainMessage[] = [{ direction: "entrada", content: "Quero muito mas esse mês estou apertada." }];
    const { decision } = await decideCommercialTurn(client, state, objMsgs, operationalCtx());
    expect(decision.action).toBe("handle_objection");
    expect(decision.objection_strategy).toBe("clarify_financial");
  });

  it("Cenário 4: pergunta de local — answer_only sem venda", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "answer_question",
      action: "answer_only",
      should_sell: false,
      reason_code: "location_question",
    });
    const state = { ...baseState(), current_intent: "local" as const };
    const localMsgs: BrainMessage[] = [{ direction: "entrada", content: "Onde acontece?" }];
    const { decision } = await decideCommercialTurn(client, state, localMsgs, operationalCtx());
    expect(decision.action).toBe("answer_only");
    expect(decision.should_sell).toBe(false);
  });

  it("Cenário 5: pedido de Pix — send_payment + consultar_pagamento", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "send_payment",
      action: "send_payment",
      should_sell: false,
      recommended_tools: ["consultar_pagamento"],
      reason_code: "payment_request",
    });
    const state = { ...baseState(), current_intent: "pagamento" as const };
    const pixMsgs: BrainMessage[] = [{ direction: "entrada", content: "Pode mandar o Pix." }];
    const { decision } = await decideCommercialTurn(client, state, pixMsgs, operationalCtx());
    expect(decision.action).toBe("send_payment");
    expect(decision.recommended_tools).toContain("consultar_pagamento");
  });

  it("Cenário 6: pedido de humano — handoff + solicitar_handoff", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "handoff",
      action: "handoff",
      handoff_required: true,
      recommended_tools: ["solicitar_handoff"],
      reason_code: "human_request",
    });
    const state = { ...baseState(), current_intent: "solicitar_humano" as const };
    const humanMsgs: BrainMessage[] = [{ direction: "entrada", content: "Me chama alguém da equipe." }];
    const { decision } = await decideCommercialTurn(client, state, humanMsgs, operationalCtx());
    expect(decision.action).toBe("handoff");
    expect(decision.handoff_required).toBe(true);
    expect(decision.recommended_tools).toContain("solicitar_handoff");
  });

  it("Cenário 8: agradecimento sem pendência — no_response ou wait_for_user", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "no_response",
      action: "no_response",
      no_response: true,
      should_sell: false,
      reason_code: "conversation_closed",
    });
    const state = { ...baseState(), current_intent: "encerramento" as const };
    const tyMsgs: BrainMessage[] = [{ direction: "entrada", content: "Obrigada!" }];
    const { decision } = await decideCommercialTurn(client, state, tyMsgs, operationalCtx());
    expect(decision.no_response).toBe(true);
    expect(decision.should_sell).toBe(false);
  });

  it("Cenário 12: pedido de humano (cliente explícito) — handoff garantido pela política", async () => {
    // Modelo retorna handoff_required = true mas sem solicitar_handoff
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "handoff",
      action: "handoff",
      handoff_required: true,
      recommended_tools: [],  // sem solicitar_handoff
      reason_code: "human_request",
    });
    const state = baseState();
    const humanMsgs: BrainMessage[] = [{ direction: "entrada", content: "Quero falar com uma pessoa." }];
    const { decision } = await decideCommercialTurn(client, state, humanMsgs, operationalCtx());
    // A política deve adicionar solicitar_handoff
    expect(decision.recommended_tools).toContain("solicitar_handoff");
  });

  it("Cenário 14: pergunta curta não vira fechamento — purchase_intent = none preservado", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "answer_question",
      action: "answer_only",
      should_sell: false,
      reason_code: "simple_question",
    });
    const state = { ...baseState(), purchase_intent: "none" as const };
    const shortMsgs: BrainMessage[] = [{ direction: "entrada", content: "Tem turma em agosto?" }];
    const { decision } = await decideCommercialTurn(client, state, shortMsgs, operationalCtx());
    expect(decision.action).toBe("answer_only");
    expect(decision.should_sell).toBe(false);
  });

  it("Cenário 15: purchase_intent = clear não regride (política sobrepõe modelo)", async () => {
    // Modelo tenta regredir para discover_need
    const client = mockAnthropicReturning({
      ...validDecision(),
      turn_goal: "discover_need",
      action: "discover_need",
      should_sell: false,
      reason_code: "curiosity",
    });
    const state = { ...baseState(), purchase_intent: "clear" as const };
    const msgs: BrainMessage[] = [{ direction: "entrada", content: "Quero saber mais." }];
    const { decision } = await decideCommercialTurn(client, state, msgs, operationalCtx());
    // Política deve corrigir para close_sale
    expect(decision.turn_goal).toBe("close_sale");
    expect(decision.action).toBe("close_sale");
  });

  it("Cenário 16: falha do provider — usa fallback conservador", async () => {
    const failClient: AnthropicClient = {
      messages: { create: vi.fn().mockRejectedValue(new Error("API timeout")) },
    };
    const { decision, usedFallback, issues } = await decideCommercialTurn(failClient, baseState(), msgs, operationalCtx());
    expect(usedFallback).toBe(true);
    expect(issues.some(i => i.includes("API timeout"))).toBe(true);
    expect(decision.confidence).toBe(0);
    expect(decision.reason_code).toBe("brain_fallback");
  });

  it("Cenário 17: ausência de tool_use — usa fallback", async () => {
    const noToolClient: AnthropicClient = {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "resposta direta" }] }) },
    };
    const { decision, usedFallback } = await decideCommercialTurn(noToolClient, baseState(), msgs, operationalCtx());
    expect(usedFallback).toBe(true);
    expect(decision.reason_code).toBe("brain_fallback");
  });

  it("Cenário 18: saída parcial (campos faltando) — usa fallback", async () => {
    const partialClient = mockAnthropicReturning({ turn_goal: "answer_question" }); // campos obrigatórios faltando
    const { decision, usedFallback } = await decideCommercialTurn(partialClient, baseState(), msgs, operationalCtx());
    expect(usedFallback).toBe(true);
  });

  it("Cenário 19: enum inválido — usa fallback", async () => {
    const invalidEnumClient = mockAnthropicReturning({ ...validDecision(), turn_goal: "made_up_goal" });
    const { decision, usedFallback } = await decideCommercialTurn(invalidEnumClient, baseState(), msgs, operationalCtx());
    expect(usedFallback).toBe(true);
  });

  it("Cenário 20: confidence inválido — clampa e preserva decisão", async () => {
    const client = mockAnthropicReturning({ ...validDecision(), confidence: 5.0 });
    const { decision } = await decideCommercialTurn(client, baseState(), msgs, operationalCtx());
    // confidence 5.0 deve ser clamped para 1.0 pela validação
    expect(decision.confidence).toBeLessThanOrEqual(1);
  });

  it("Cenário 21: tool inexistente — filtrada, não quebra o fluxo", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      recommended_tools: ["consultar_pagamento", "ferramenta_que_nao_existe"],
    });
    const { decision, issues } = await decideCommercialTurn(client, baseState(), msgs, operationalCtx());
    expect(decision.recommended_tools).not.toContain("ferramenta_que_nao_existe");
    expect(issues.some(i => i.includes("ferramenta_que_nao_existe"))).toBe(true);
  });

  it("Cenário 22: handoff_required sem solicitar_handoff — política garante a tool", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      handoff_required: true,
      turn_goal: "handoff",
      action: "handoff",
      recommended_tools: [],
      reason_code: "needs_handoff",
    });
    const { decision } = await decideCommercialTurn(client, baseState(), msgs, operationalCtx());
    expect(decision.recommended_tools).toContain("solicitar_handoff");
    expect(decision.handoff_required).toBe(true);
  });

  it("Cenário 23: do_not_contact — decisão determinística sem chamada ao modelo", async () => {
    const client: AnthropicClient = {
      messages: { create: vi.fn() },
    };
    const state = { ...baseState(), do_not_contact: true };
    const { decision, usedFallback } = await decideCommercialTurn(client, state, msgs, operationalCtx());
    expect(usedFallback).toBe(true);
    expect(decision.no_response).toBe(true);
    // modelo não foi chamado
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it("Cenário 24: ausência de copy na decisão — modelo não deve incluir message", async () => {
    const client = mockAnthropicReturning({
      ...validDecision(),
      message: "Olá! O OPEX custa R$ 2.000",
      reason_code: "price_info",
    });
    const { issues } = await decideCommercialTurn(client, baseState(), msgs, operationalCtx());
    expect(issues.some(i => i.includes("message") && i.includes("copy proibido"))).toBe(true);
  });

  it("Cenário 25: última mensagem não aparece no histórico", () => {
    const conversationMsgs: BrainMessage[] = [
      { direction: "saida", content: "Posso ajudar?" },
      { direction: "entrada", content: "Quanto custa o OPEX?" },
    ];
    const { history, lastMessage } = prepareCommercialBrainConversation(conversationMsgs);
    expect(lastMessage).toBe("Quanto custa o OPEX?");
    expect(history).not.toContain("Quanto custa o OPEX?");
  });
});
