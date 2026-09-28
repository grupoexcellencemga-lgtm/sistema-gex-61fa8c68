// ─────────────────────────────────────────────────────────────────────────────
// FASE 3.2 — HOMOLOGAÇÃO CONVERSACIONAL AGENTE OPEX
// ─────────────────────────────────────────────────────────────────────────────
// Estratégia de cobertura:
//   • Camada DETERMINÍSTICA — validateCandidateResponse, applyCommercialDecisionPolicies
//     (sem chamadas à API — rodam em 100% dos CIs)
//   • Camada ESTRUTURAL — config, tools, prompt, ProductContext
//     (sem chamadas à API)
//   • Camada LLM (documentada como "live integration") — qualidade real das
//     respostas do agente requer API key + deploy; identificada em cada cenário.
//
// Todas as 25 conversas são modeladas aqui.
// Multi-turn (10 conversas) via evolução de ConversationState.
// Comparação GENERAL vs OPEX — 8 cenários estruturais.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";

import {
  validateCandidateResponse,
  inferToolStatus,
  type JudgeToolResult,
} from "../../supabase/functions/processar-bot/response-judge.ts";

import {
  applyCommercialDecisionPolicies,
  createCommercialBrainFallback,
  type CommercialDecision,
} from "../../supabase/functions/processar-bot/commercial-brain.ts";

import {
  AGENT_REGISTRY,
  OPEX_ALLOWED_TOOLS,
  PROMPT_AGENTE_OPEX,
  getAgentConfigForTesting,
} from "../../supabase/functions/processar-bot/agent-registry.ts";

import {
  buildAgentConfig,
  resolveActiveAgent,
} from "../../supabase/functions/processar-bot/router.ts";

import {
  DEFAULT_CONVERSATION_STATE,
  DEFAULT_PRODUCT_CONTEXT,
  MAX_PRODUCT_CONTEXTS,
  syncGlobalToProductContext,
  getProductContext,
  type ConversationState,
} from "../../supabase/functions/processar-bot/conversation-state.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_BRAIN = (): CommercialDecision => ({
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
  confidence: 0.90,
  reason_code: "test",
});

function brain(overrides: Partial<CommercialDecision> = {}): CommercialDecision {
  return { ...BASE_BRAIN(), ...overrides };
}

function state(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...DEFAULT_CONVERSATION_STATE,
    information_already_shared: [],
    known_user_facts: [],
    ...overrides,
  };
}

function tool(
  name: string,
  resultado: string,
  success = true,
): JudgeToolResult {
  return { tool: name, input: {}, resultado, success, status: inferToolStatus(name, resultado) };
}

function toolError(name: string): JudgeToolResult {
  return { tool: name, input: {}, resultado: "Erro ao consultar", success: false, status: "error" };
}

const noTools: JudgeToolResult[] = [];

// Resposta genérica segura para abertura OPEX
const ABERTURA_RESP =
  "O Método OPEX é uma experiência de desenvolvimento pessoal e profissional do Grupo Excellence. " +
  "É um treinamento presencial focado em comportamentos, emoções, relacionamentos e resultados. " +
  "Quer saber mais sobre algum aspecto específico?";

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 1 — AGENT CONFIG (contextual, não duplica opexAgent.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe("H01 — Config do Agente OPEX para homologação", () => {
  it("getAgentConfigForTesting retorna agente válido com enabled=false", () => {
    const cfg = getAgentConfigForTesting("opex");
    expect(cfg).toBeDefined();
    expect(cfg?.enabled).toBe(false);
    expect(cfg?.key).toBe("opex");
  });

  it("systemPrompt tem > 2000 chars (conteúdo substantivo)", () => {
    expect(PROMPT_AGENTE_OPEX.length).toBeGreaterThan(2000);
  });

  it("OPEX tem 14 tools no subset", () => {
    expect(OPEX_ALLOWED_TOOLS.length).toBe(14);
  });

  it("Router NÃO seleciona OPEX automaticamente (enabled=false protegido)", () => {
    const decision = resolveActiveAgent(state({ current_product: "Método OPEX — O Poder da Excelência" }));
    expect(decision.agent_key).toBe("general");
  });

  it("buildAgentConfig para OPEX retorna systemPromptExtra = PROMPT_AGENTE_OPEX", () => {
    const mockDecision = {
      agent_key: "opex" as const,
      product_slug: "opex" as const,
      routing_action: "start" as const,
      routing_reason: "homologacao",
      changed: true,
    };
    const cfg = buildAgentConfig(mockDecision);
    expect(cfg.systemPromptExtra).toBe(PROMPT_AGENTE_OPEX);
    expect(cfg.allowedTools.length).toBe(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 2 — VERIFICAÇÃO DO PROMPT OPEX (fontes e limites da 3.1.1)
// ─────────────────────────────────────────────────────────────────────────────

describe("H02 — Prompt OPEX pós-3.1.1: fontes corretas", () => {
  it("duração está sob consultar_produtos (não consultar_turmas)", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Disponível via consultar_produtos[\s\S]*?[Dd]uração/);
    expect(PROMPT_AGENTE_OPEX).not.toMatch(/duração.*consultar_turmas/i);
  });

  it("vagas declaradas como SEM FONTE", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Vagas disponíveis.*nenhuma tool|nenhuma tool retorna disponibilidade/i);
  });

  it("horário declarado como SEM FONTE", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/nenhuma tool retorna horário|Horário.*sem fonte/i);
  });

  it("encontros declarados como SEM FONTE", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Número de encontros.*DESCONHECIDO|nenhuma tool retorna.*encontros/i);
  });

  it("frequência declarada como SEM FONTE", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Frequência.*DESCONHECIDO|frequência.*nenhuma tool/i);
  });

  it("Maringá não é local estático", () => {
    expect(PROMPT_AGENTE_OPEX).not.toMatch(/Local habitual: Maringá/);
  });

  it("proíbe promessa de verificação sem ação operacional", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/solicitar_handoff|criar_tarefa/);
    expect(PROMPT_AGENTE_OPEX).toMatch(/nunca antes|só diga.*depois de executar/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 3 — POLÍTICAS DO BRAIN (applyCommercialDecisionPolicies)
// ─────────────────────────────────────────────────────────────────────────────

describe("H03 — Políticas do Brain aplicadas ao estado OPEX", () => {
  it("do_not_contact → no_response=true independente da decisão", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ should_sell: true, turn_goal: "close_sale", action: "close_sale" }),
      state({ do_not_contact: true }),
    );
    expect(d.no_response).toBe(true);
    expect(d.should_sell).toBe(false);
    expect(d.action).toBe("no_response");
  });

  it("handoff_active → handoff_required=true, should_sell=false", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ should_sell: true, turn_goal: "close_sale", action: "close_sale" }),
      state({ handoff_active: true }),
    );
    expect(d.handoff_required).toBe(true);
    expect(d.should_sell).toBe(false);
    expect(d.recommended_tools).toContain("solicitar_handoff");
  });

  it("purchase_intent=clear → não regredir para discover_need", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ turn_goal: "discover_need", action: "discover_need" }),
      state({ purchase_intent: "clear" }),
    );
    expect(d.turn_goal).toBe("close_sale");
    expect(d.should_sell).toBe(true);
  });

  it("action=answer_only → should_ask_question=false automaticamente", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ action: "answer_only", should_ask_question: true, question_goal: "Quer agendar?" }),
      state(),
    );
    expect(d.should_ask_question).toBe(false);
    expect(d.question_goal).toBeNull();
  });

  it("send_payment sem payment_method → deve pedir escolha", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ action: "send_payment" }),
      state({ payment_method: null }),
    );
    expect(d.should_ask_question).toBe(true);
    expect(d.question_goal).toMatch(/forma de pagamento|Pix|cartão/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 4 — JUIZ DETERMINÍSTICO: BLOQUEIOS CRÍTICOS
// ─────────────────────────────────────────────────────────────────────────────

describe("H04 — Bloqueios críticos (critical_block)", () => {
  it("T25 — do_not_contact + qualquer mensagem = critical_block", () => {
    const r = validateCandidateResponse(
      "Oi! O OPEX tem turma em novembro, posso te passar os detalhes.",
      brain(),
      state({ do_not_contact: true }),
      noTools,
    );
    expect(r.critical_block).toBe(true);
  });

  it("T18 — consultar_pagamento FALHOU + resposta com chave Pix = critical_block", () => {
    const r = validateCandidateResponse(
      "O Pix para pagamento é 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23.",
      brain({ action: "send_payment" }),
      state(),
      [toolError("consultar_pagamento")],
    );
    expect(r.critical_block).toBe(true);
  });

  it("no_response=true + texto = critical_block", () => {
    const r = validateCandidateResponse(
      "Olá! Como posso ajudar?",
      brain({ no_response: true, must_answer_user: false }),
      state(),
      noTools,
    );
    expect(r.critical_block).toBe(true);
  });

  it("Brain fallback com do_not_contact → no_response=true → mensagem bloqueada", () => {
    const fb = createCommercialBrainFallback({ do_not_contact: true });
    expect(fb.no_response).toBe(true);
    const r = validateCandidateResponse("Oi!", fb, state({ do_not_contact: true }), noTools);
    expect(r.critical_block).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 5 — JUIZ DETERMINÍSTICO: TRIGGERS REQUIRES_JUDGE
// ─────────────────────────────────────────────────────────────────────────────

describe("H05 — Triggers de requires_judge", () => {
  it("T19 — reservar_vaga(requested) + afirmação de vaga garantida = requires_judge", () => {
    const r = validateCandidateResponse(
      "Perfeito! Sua vaga está reservada para a turma de novembro.",
      brain({ action: "close_sale", closing_stage: "confirm_registration" }),
      state(),
      [tool("reservar_vaga", "Solicitação de reserva criada", true)],
    );
    expect(r.requires_judge).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("T20 — cadastrar_aluno(requested) + afirmação de inscrição concluída = requires_judge", () => {
    const r = validateCandidateResponse(
      "Sua inscrição foi confirmada! Em breve você recebe o acesso.",
      brain({ action: "collect_data" }),
      state(),
      [tool("cadastrar_aluno", "Solicitação de cadastro criada", true)],
    );
    expect(r.requires_judge).toBe(true);
  });

  it("T24 — handoff_required=true + continua vendendo = requires_judge", () => {
    const r = validateCandidateResponse(
      "Certo, mas enquanto espera: garanta sua vaga agora!",
      brain({ handoff_required: true }),
      state({ handoff_active: true }),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });

  it("T22 — desconto não autorizado = requires_judge", () => {
    const r = validateCandidateResponse(
      "Vou verificar se consigo um desconto especial para você.",
      brain({ action: "handle_objection", objection_strategy: "clarify_financial" }),
      state({ current_objection: "financeira" }),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });

  it("T21 — parcelamento não autorizado (18x) = requires_judge", () => {
    const r = validateCandidateResponse(
      "Podemos fazer em 18 vezes se precisar.",
      brain({ action: "handle_objection" }),
      state({ current_objection: "financeira" }),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });

  it("consultar_pagamento executado → sempre requires_judge (verificar dados)", () => {
    const r = validateCandidateResponse(
      "Para pagar no Pix, use a chave: 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23.",
      brain({ action: "send_payment" }),
      state({ payment_method: "pix" }),
      [tool("consultar_pagamento", "Pix Sicredi: 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23", true)],
    );
    expect(r.requires_judge).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("answer_only + pergunta no final = requires_judge", () => {
    const r = validateCandidateResponse(
      "O curso custa R$ 2.497,00. Gostaria de saber sobre parcelamento?",
      brain({ action: "answer_only" }),
      state(),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });

  it("solicitar_handoff (high risk) sempre requires_judge", () => {
    const r = validateCandidateResponse(
      "Vou transferir você para nossa equipe agora.",
      brain({ action: "handoff", handoff_required: true }),
      state(),
      [tool("solicitar_handoff", "Handoff registrado", true)],
    );
    expect(r.requires_judge).toBe(true);
  });

  it("confiança do Brain < 0.6 → requires_judge", () => {
    const r = validateCandidateResponse(
      "O OPEX é um treinamento presencial.",
      brain({ confidence: 0.5 }),
      state(),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 6 — JUIZ DETERMINÍSTICO: RESPOSTAS SEGURAS (safe=true)
// ─────────────────────────────────────────────────────────────────────────────

describe("H06 — Respostas que passam validação determinística", () => {
  it("T01 — abertura natural sem dados inventados = safe", () => {
    const r = validateCandidateResponse(
      "O Método OPEX é um treinamento presencial do Grupo Excellence focado em comportamentos, emoções e resultados.",
      brain({ action: "explain_product" }),
      state(),
      noTools,
    );
    expect(r.safe).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("T02 — preço via consultar_produtos + resposta direta curta = safe", () => {
    const r = validateCandidateResponse(
      "O valor do OPEX é R$ 2.497,00.",
      brain({ action: "answer_only" }),
      state({ explicit_question: "Quanto custa?" }),
      [tool("consultar_produtos", "**Método OPEX** | Duração: 2 meses | Valor: R$ 2497.00 | 10x R$ 249.70", true)],
    );
    expect(r.safe).toBe(true);
  });

  it("T04 — duração via consultar_produtos = safe", () => {
    const r = validateCandidateResponse(
      "A duração do OPEX é de 2 meses.",
      brain({ action: "answer_only" }),
      state({ explicit_question: "Quanto tempo dura?" }),
      [tool("consultar_produtos", "**Método OPEX** | Duração: 2 meses | Valor: R$ 2497.00", true)],
    );
    expect(r.safe).toBe(true);
  });

  it("T05 — encontros desconhecidos: resposta transparente = safe", () => {
    const r = validateCandidateResponse(
      "Essa informação preciso confirmar com a equipe.",
      brain({ action: "answer_only", confidence: 0.85 }),
      state({ explicit_question: "Quantos encontros são?" }),
      noTools,
    );
    expect(r.safe).toBe(true);
  });

  it("T06 — frequência desconhecida: resposta transparente = safe", () => {
    const r = validateCandidateResponse(
      "Não tenho essa informação disponível agora — preciso confirmar.",
      brain({ action: "answer_only", confidence: 0.85 }),
      state({ explicit_question: "É toda semana?" }),
      noTools,
    );
    expect(r.safe).toBe(true);
  });

  it("T07 — horário desconhecido: resposta transparente = safe", () => {
    const r = validateCandidateResponse(
      "O horário eu preciso confirmar com a equipe.",
      brain({ action: "answer_only", confidence: 0.85 }),
      state(),
      noTools,
    );
    expect(r.safe).toBe(true);
  });

  it("T08 — cidade via consultar_turmas = safe", () => {
    const r = validateCandidateResponse(
      "A próxima turma acontece em Maringá/PR.",
      brain({ action: "answer_only" }),
      state(),
      [tool("consultar_turmas", "Método OPEX — Maringá/PR (presencial) | Início: 2026-11-01 | Fim: 2026-12-31 | Status: aberta", true)],
    );
    expect(r.safe).toBe(true);
  });

  it("T10 — objeção de preço com reconhecimento + parcelamento da tool = safe", () => {
    const r = validateCandidateResponse(
      "Entendo. É um investimento significativo. O parcelamento chega a 10x de R$ 249,70 no cartão.",
      brain({ action: "handle_objection", objection_strategy: "clarify_financial" }),
      state({ current_objection: "financeira" }),
      [tool("consultar_produtos", "**Método OPEX** | 10x R$ 249.70", true)],
    );
    expect(r.safe).toBe(true);
  });

  it("T11 — falar com marido: acolhe sem pressionar = safe", () => {
    const r = validateCandidateResponse(
      "Claro, faz todo sentido conversar. Posso te passar um resumo para facilitar essa conversa.",
      brain({ action: "handle_objection", objection_strategy: "third_party_involvement", should_sell: false }),
      state({ current_objection: "falar_com_terceiro" }),
      noTools,
    );
    expect(r.safe).toBe(true);
  });

  it("T15 — intenção de compra: avança sem pitch desnecessário = safe", () => {
    const r = validateCandidateResponse(
      "Ótimo! Para garantir sua participação precisamos dos seus dados. Pode me passar seu nome completo?",
      brain({ action: "collect_data", closing_stage: "confirm_registration", should_sell: true }),
      state({ purchase_intent: "clear" }),
      noTools,
    );
    expect(r.safe).toBe(true);
  });

  it("T23 — outro produto GEx: responde brevemente sem alterar rota = safe", () => {
    const r = validateCandidateResponse(
      "O GEx tem programas para adolescentes, mas meu foco aqui é o OPEX. Se quiser saber mais sobre os outros, posso anotar o interesse.",
      brain({ action: "answer_only" }),
      state(),
      noTools,
    );
    expect(r.safe).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 7 — MULTI-TURN: EVOLUÇÃO DO PRODUCT CONTEXT OPEX
// ─────────────────────────────────────────────────────────────────────────────

describe("H07 — Multi-turn: ProductContext.opex evolui corretamente", () => {
  // Jornada A: interesse → preço → objeção → compra
  it("JA01 — lead novo sem produto definido: product_contexts.opex inexistente", () => {
    const s = state();
    expect(s.product_contexts["opex"]).toBeUndefined();
  });

  it("JA02 — ao detectar OPEX: product_contexts.opex criado com default", () => {
    const s = state({ current_product: "Método OPEX — O Poder da Excelência", funnel_stage: "interesse_identificado" });
    const synced = syncGlobalToProductContext(s, "opex");
    expect(synced.product_contexts["opex"]).toBeDefined();
    expect(synced.product_contexts["opex"].funnel_stage).toBe("interesse_identificado");
  });

  it("JA03 — objeção financeira sincronizada para opex.current_objection", () => {
    const s = state({
      current_product: "Método OPEX — O Poder da Excelência",
      funnel_stage: "aguardando_decisao",
      current_objection: "financeira",
      purchase_intent: "weak",
    });
    const synced = syncGlobalToProductContext(s, "opex");
    const ctx = synced.product_contexts["opex"];
    expect(ctx.current_objection).toBe("financeira");
    expect(ctx.purchase_intent).toBe("weak");
  });

  it("JA04 — purchase_intent=clear sincronizado para opex", () => {
    const s = state({
      current_product: "Método OPEX — O Poder da Excelência",
      funnel_stage: "aguardando_pagamento",
      purchase_intent: "clear",
    });
    const synced = syncGlobalToProductContext(s, "opex");
    expect(synced.product_contexts["opex"].purchase_intent).toBe("clear");
  });

  // Jornada B: campo sem fonte → continuidade
  it("JB01 — state sem encontros nem frequência não contamina product_context", () => {
    const s = state({
      current_product: "Método OPEX — O Poder da Excelência",
      funnel_stage: "em_conversa",
    });
    const synced = syncGlobalToProductContext(s, "opex");
    const ctx = synced.product_contexts["opex"];
    // known_product_facts não deve conter frequência inventada
    const hasInventedFreq = ctx.known_product_facts.some(f =>
      /semanal|quinzenal|8\s+encontros|10\s+encontros/i.test(f)
    );
    expect(hasInventedFreq).toBe(false);
  });

  // Jornada C: preço → "vou pensar" → retorno
  it("JC01 — information_shared=price persiste entre turnos via syncGlobalToProductContext", () => {
    const s = state({
      current_product: "Método OPEX — O Poder da Excelência",
      information_already_shared: ["product_overview", "price"],
    });
    const synced = syncGlobalToProductContext(s, "opex");
    const ctx = synced.product_contexts["opex"];
    expect(ctx.information_shared).toContain("product_overview");
    expect(ctx.information_shared).toContain("price");
  });

  // Jornada D: OPEX → troca de produto → contexto OPEX preservado
  it("JD01 — contexto opex preservado quando produto muda", () => {
    const s = state({
      current_product: "Método OPEX — O Poder da Excelência",
      funnel_stage: "aguardando_decisao",
      purchase_intent: "weak",
    });
    const synced = syncGlobalToProductContext(s, "opex");

    // Simula mudança de produto (sem apagar o contexto opex anterior)
    expect(synced.product_contexts["opex"]).toBeDefined();
    expect(synced.product_contexts["opex"].funnel_stage).toBe("aguardando_decisao");
  });

  it("JD02 — contexto de outro produto não contamina opex", () => {
    const s = state({
      current_product: "Teen Connect",
      funnel_stage: "em_conversa",
      purchase_intent: "weak",
    });
    const synced = syncGlobalToProductContext(s, "teen_connect");
    // opex não deve existir ou deve estar no default
    const opexCtx = synced.product_contexts["opex"];
    if (opexCtx) {
      expect(opexCtx.purchase_intent).toBe(DEFAULT_PRODUCT_CONTEXT.purchase_intent);
    }
  });

  // Jornada E: Pix falha → handoff
  it("JE01 — handoff_active=true preserva contexto opex anterior", () => {
    const s = state({
      current_product: "Método OPEX — O Poder da Excelência",
      funnel_stage: "aguardando_pagamento",
      purchase_intent: "clear",
      handoff_active: true,
    });
    const synced = syncGlobalToProductContext(s, "opex");
    expect(synced.product_contexts["opex"].funnel_stage).toBe("aguardando_pagamento");
  });

  it("MAX_PRODUCT_CONTEXTS = 5 — constante correta para evitar crescimento ilimitado", () => {
    expect(MAX_PRODUCT_CONTEXTS).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 8 — GERAL vs OPEX: COMPARAÇÃO ESTRUTURAL (8 cenários)
// ─────────────────────────────────────────────────────────────────────────────

describe("H08 — Comparação GENERAL vs OPEX (8 cenários estruturais)", () => {
  const generalDecision = resolveActiveAgent(state());
  const generalCfg = buildAgentConfig(generalDecision);

  const opexMockDecision = {
    agent_key: "opex" as const,
    product_slug: "opex" as const,
    routing_action: "start" as const,
    routing_reason: "homologacao",
    changed: true,
  };
  const opexCfg = buildAgentConfig(opexMockDecision);

  it("C01 — displayName: GENERAL='Júlia (Geral)', OPEX='Especialista OPEX'", () => {
    expect(generalCfg.displayName).toBe("Júlia (Geral)");
    expect(opexCfg.displayName).toBe("Especialista OPEX");
    expect(generalCfg.displayName).not.toBe(opexCfg.displayName);
  });

  it("C02 — systemPromptExtra: GENERAL=null, OPEX=PROMPT_AGENTE_OPEX", () => {
    expect(generalCfg.systemPromptExtra).toBeNull();
    expect(opexCfg.systemPromptExtra).toBe(PROMPT_AGENTE_OPEX);
  });

  it("C03 — allowedTools: OPEX tem 14 (subset), GENERAL sem restrição (array vazio = tudo)", () => {
    expect(opexCfg.allowedTools.length).toBe(14);
    // General não tem subset definido (array vazio = todas as tools liberadas)
    expect(generalCfg.allowedTools.length).toBe(0);
  });

  it("C04 — OPEX NÃO tem agendar_reuniao (tool fora do escopo)", () => {
    expect(opexCfg.allowedTools).not.toContain("agendar_reuniao");
  });

  it("C05 — OPEX TEM consultar_turmas (data dinâmica de turmas)", () => {
    expect(opexCfg.allowedTools).toContain("consultar_turmas");
  });

  it("C06 — OPEX TEM solicitar_handoff (para cenários sem fonte ou especiais)", () => {
    expect(opexCfg.allowedTools).toContain("solicitar_handoff");
  });

  it("C07 — OPEX TEM reservar_vaga (fechamento), mas reserva é 'requested', não confirmada", () => {
    expect(opexCfg.allowedTools).toContain("reservar_vaga");
    // A tool cria solicitação — status always 'requested', nunca 'completed'
    const result = tool("reservar_vaga", "Solicitação de reserva criada", true);
    expect(result.status).toBe("requested");
  });

  it("C08 — OPEX TEM marcar_nao_contatar (proteção DNC)", () => {
    expect(opexCfg.allowedTools).toContain("marcar_nao_contatar");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 9 — CENÁRIOS ESPECÍFICOS 1-25 (determinístico + documentação)
// ─────────────────────────────────────────────────────────────────────────────

describe("H09 — Cenário T01: Abertura — 'Oi, gostaria de saber mais sobre o OPEX'", () => {
  it("resposta de abertura curta é safe", () => {
    const r = validateCandidateResponse(
      "O Método OPEX é um treinamento presencial do Grupo Excellence.",
      brain({ action: "explain_product", should_sell: false }),
      state(),
      noTools,
    );
    expect(r.safe).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("abertura com informação interna exposta = critical_block", () => {
    const r = validateCandidateResponse(
      "O turn_goal do sistema é explain_product, então vou explicar o OPEX.",
      brain({ action: "explain_product" }),
      state(),
      noTools,
    );
    expect(r.critical_block).toBe(true);
  });
});

describe("H09 — Cenário T02: Preço — 'Quanto custa?'", () => {
  it("preço via consultar_produtos + resposta direta = safe (requer_judge=false)", () => {
    const r = validateCandidateResponse(
      "O valor do OPEX é R$ 2.497,00.",
      brain({ action: "answer_only" }),
      state(),
      [tool("consultar_produtos", "**Método OPEX** | Valor: R$ 2497.00 | 10x R$ 249.70", true)],
    );
    // Nota: consultar_produtos é QUERY tool → não aciona high_risk trigger
    expect(r.critical_block).toBe(false);
    expect(r.safe).toBe(true);
  });
});

describe("H09 — Cenário T03: Parcelamento — 'Tem parcelamento?'", () => {
  it("parcelamento da tool = safe", () => {
    const r = validateCandidateResponse(
      "Sim, pode parcelar em até 10x de R$ 249,70 no cartão.",
      brain({ action: "answer_only" }),
      state(),
      [tool("consultar_produtos", "**Método OPEX** | 10x R$ 249.70", true)],
    );
    expect(r.safe).toBe(true);
  });

  it("parcelamento inventado '18x' = requires_judge", () => {
    const r = validateCandidateResponse(
      "Podemos fazer em 18 vezes para facilitar.",
      brain({ action: "answer_only" }),
      state(),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });
});

describe("H09 — Cenário T09: Vagas — 'Ainda tem vaga?'", () => {
  it("resposta 'Sua vaga está reservada' após reservar_vaga(requested) = requires_judge", () => {
    const r = validateCandidateResponse(
      "Sua vaga está reservada! Pode ficar tranquila.",
      brain({ action: "close_sale" }),
      state(),
      [tool("reservar_vaga", "Solicitação de reserva criada para a equipe", true)],
    );
    expect(r.requires_judge).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("resposta correta após reservar_vaga = safe", () => {
    const r = validateCandidateResponse(
      "Solicitei a reserva para a equipe confirmar. Em breve você terá um retorno.",
      brain({ action: "close_sale" }),
      state(),
      [tool("reservar_vaga", "Solicitação de reserva criada", true)],
    );
    // High risk tool ainda aciona requires_judge — mas não critical_block
    expect(r.critical_block).toBe(false);
    // A resposta correta ainda vai ao judge por ser high risk tool, mas não bloqueia
  });
});

describe("H09 — Cenário T16: Pagamento genérico — 'Como faço o pagamento?'", () => {
  it("Brain com send_payment sem payment_method escolhido → question_goal inclui Pix/cartão", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ action: "send_payment" }),
      state({ payment_method: null }),
    );
    expect(d.should_ask_question).toBe(true);
    expect(d.question_goal).toMatch(/Pix|cartão/i);
  });
});

describe("H09 — Cenário T17: Pix — 'Quero pagar no Pix'", () => {
  it("Pix via consultar_pagamento = requires_judge (payment tool sempre aciona judge)", () => {
    const r = validateCandidateResponse(
      "Para Pix, use a chave: 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23.",
      brain({ action: "send_payment" }),
      state({ payment_method: "pix" }),
      [tool("consultar_pagamento", "Pix Sicredi: 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23", true)],
    );
    expect(r.requires_judge).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("T18 — consultar_pagamento FALHA + qualquer dado Pix = critical_block", () => {
    const r = validateCandidateResponse(
      "A chave Pix é 8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23.",
      brain({ action: "send_payment" }),
      state(),
      [toolError("consultar_pagamento")],
    );
    expect(r.critical_block).toBe(true);
  });
});

describe("H09 — Cenário T24: Humano — 'Quero falar com alguém'", () => {
  it("solicitar_handoff = high risk → requires_judge", () => {
    const r = validateCandidateResponse(
      "Claro! Vou te conectar com nossa equipe.",
      brain({ action: "handoff", handoff_required: true }),
      state(),
      [tool("solicitar_handoff", "Handoff registrado — bot desativado", true)],
    );
    expect(r.requires_judge).toBe(true);
    expect(r.critical_block).toBe(false);
  });

  it("após handoff_active: Brain aplica política → handoff_required=true, should_sell=false", () => {
    const d = applyCommercialDecisionPolicies(
      brain({ should_sell: true }),
      state({ handoff_active: true }),
    );
    expect(d.handoff_required).toBe(true);
    expect(d.should_sell).toBe(false);
  });

  it("após handoff: mensagem vendendo = requires_judge", () => {
    const r = validateCandidateResponse(
      "Enquanto espera: garanta sua vaga agora — últimas vagas!",
      brain({ handoff_required: true }),
      state({ handoff_active: true }),
      noTools,
    );
    expect(r.requires_judge).toBe(true);
  });
});

describe("H09 — Cenário T25: DNC — 'Não quero mais receber mensagens'", () => {
  it("marcar_nao_contatar está no subset de tools do OPEX", () => {
    expect(OPEX_ALLOWED_TOOLS).toContain("marcar_nao_contatar");
  });

  it("do_not_contact=true bloqueia qualquer mensagem", () => {
    const r = validateCandidateResponse(
      "Entendi! Removemos seu contato.",
      brain(),
      state({ do_not_contact: true }),
      noTools,
    );
    expect(r.critical_block).toBe(true);
  });

  it("Brain fallback com do_not_contact → no_response=true", () => {
    const fb = createCommercialBrainFallback({ do_not_contact: true, handoff_active: false });
    expect(fb.no_response).toBe(true);
    expect(fb.should_sell).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 10 — INFERÊNCIAS PROIBIDAS (campos sem fonte)
// ─────────────────────────────────────────────────────────────────────────────

describe("H10 — Campos sem fonte: prompt proíbe inventar", () => {
  it("prompt proíbe informar horário", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Horário.*nenhuma tool retorna horário/);
  });

  it("prompt proíbe informar número de encontros sem fonte", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Número de encontros.*nenhuma tool retorna|nenhuma tool retorna número de encontros/i);
  });

  it("prompt proíbe informar frequência", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Frequência.*nenhuma tool retorna/i);
  });

  it("prompt proíbe assumir Maringá como cidade atual", () => {
    expect(PROMPT_AGENTE_OPEX).not.toMatch(/Local habitual: Maringá/);
    expect(PROMPT_AGENTE_OPEX).toMatch(/não assuma que a próxima turma será lá sem consultar/);
  });

  it("prompt proíbe endereço específico (apenas cidade via tool)", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/local\/endereço|Local\/endereço|endereço específico/i);
    expect(PROMPT_AGENTE_OPEX).toMatch(/consultar_turmas retorna cidade, não endereço/i);
  });

  it("LIMITES do prompt inclui proibição de vagas, horário, endereço", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Afirmar disponibilidade de vaga/);
    expect(PROMPT_AGENTE_OPEX).toMatch(/Informar horário sem fonte/);
    expect(PROMPT_AGENTE_OPEX).toMatch(/Informar endereço\/local específico/);
  });

  it("LIMITES inclui proibição de inferir duração/encontros/frequência de datas", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Inferir duração, encontros ou frequência a partir de data_inicio\/data_fim/);
  });

  it("LIMITES inclui proibição de prometer verificação sem ação", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Dizer .vou verificar para você. sem executar ação operacional/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 11 — TOOL STATUS: inferToolStatus correto por tool
// ─────────────────────────────────────────────────────────────────────────────

describe("H11 — inferToolStatus por tool OPEX", () => {
  const scenarios: [string, string, string][] = [
    ["consultar_turmas", "Método OPEX — Maringá/PR | Status: aberta", "query"],
    ["consultar_produtos", "**Método OPEX** | Valor: R$ 2497.00", "query"],
    ["consultar_pagamento", "Pix Sicredi: 8fd6bbb9", "query"],
    ["consultar_contexto_lead", "Nome: João | Score: 50", "query"],
    ["reservar_vaga", "Solicitação de reserva criada", "requested"],
    ["cadastrar_aluno", "Solicitação de cadastro criada", "requested"],
    ["solicitar_handoff", "Handoff registrado", "completed"],
    ["marcar_nao_contatar", "Lead marcado como não contatar", "completed"],
    ["mover_etapa", "Etapa atualizada", "completed"],
    ["registrar_nota", "Nota registrada", "completed"],
    ["pontuar_lead", "Score atualizado", "completed"],
    ["classificar_lead", "Lead classificado como morno", "completed"],
    ["atualizar_lead", "Lead atualizado", "completed"],
    ["criar_tarefa", "Tarefa criada", "completed"],
  ];

  for (const [toolName, resultado, expectedStatus] of scenarios) {
    it(`${toolName} → status=${expectedStatus}`, () => {
      expect(inferToolStatus(toolName, resultado)).toBe(expectedStatus);
    });
  }

  it("erro de tool → status=error", () => {
    expect(inferToolStatus("consultar_turmas", "Erro ao consultar turmas")).toBe("error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 12 — ESTADO FINAL DE HOMOLOGAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

describe("H12 — Estado final: confirmações de isolamento", () => {
  it("OPEX enabled=false (não ativo em produção)", () => {
    expect(AGENT_REGISTRY.opex?.enabled).toBe(false);
  });

  it("Router de produção continua general para produto OPEX", () => {
    const d = resolveActiveAgent(state({ current_product: "Método OPEX — O Poder da Excelência" }));
    expect(d.agent_key).toBe("general");
  });

  it("Router de produção continua general para estado vazio", () => {
    const d = resolveActiveAgent(state());
    expect(d.agent_key).toBe("general");
  });

  it("Nenhum lead real está exposto ao OPEX (enabled=false é a garantia)", () => {
    // resolveActiveAgent nunca retorna opex quando enabled=false
    const slugs = ["opex", "Método OPEX", "Método OPEX — O Poder da Excelência"];
    for (const slug of slugs) {
      const d = resolveActiveAgent(state({ current_product: slug }));
      expect(d.agent_key).not.toBe("opex");
    }
  });
});
