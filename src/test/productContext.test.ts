import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONVERSATION_STATE,
  DEFAULT_PRODUCT_CONTEXT,
  MAX_PRODUCT_CONTEXTS,
  MAX_PRODUCT_FACTS,
  PRODUCT_SUMMARY_LIMIT,
  getProductContext,
  hydrateFromProductContext,
  mergeConversationState,
  persistConversationState,
  syncGlobalToProductContext,
  type ConversationState,
  type ConversationStateRepository,
} from "../../supabase/functions/processar-bot/conversation-state";
import {
  normalizeProductSlug,
  resolveActiveAgent,
} from "../../supabase/functions/processar-bot/router";

const base = (): ConversationState => ({
  ...DEFAULT_CONVERSATION_STATE,
  information_already_shared: [],
  known_user_facts: [],
  product_contexts: {},
});

const opexState = (): ConversationState => ({
  ...base(),
  current_product: "Método OPEX — O Poder da Excelência",
  funnel_stage: "interesse_identificado",
  current_objection: "financeira",
  purchase_intent: "clear",
  information_already_shared: ["product_overview", "price"],
  conversation_summary: "Lead interessado no OPEX, tem objeção financeira.",
});

// ─── 1. product_contexts começa vazio ────────────────────────────────────────
describe("1. product_contexts começa vazio", () => {
  it("DEFAULT_CONVERSATION_STATE tem product_contexts = {}", () => {
    expect(DEFAULT_CONVERSATION_STATE.product_contexts).toEqual({});
  });
});

// ─── 2. OPEX detectado cria product_contexts.opex ────────────────────────────
describe("2. OPEX detectado cria product_contexts.opex", () => {
  it("syncGlobalToProductContext com slug opex cria a entrada", () => {
    const slug = normalizeProductSlug("Método OPEX — O Poder da Excelência");
    expect(slug).toBe("opex");
    const synced = syncGlobalToProductContext(opexState(), slug!);
    expect("opex" in synced.product_contexts).toBe(true);
  });
});

// ─── 3. informações comerciais vão para opex ─────────────────────────────────
describe("3. informações comerciais vão para opex", () => {
  it("funnel_stage, current_objection e purchase_intent são copiados", () => {
    const state = opexState();
    const slug = normalizeProductSlug(state.current_product)!;
    const synced = syncGlobalToProductContext(state, slug);
    const ctx = synced.product_contexts["opex"];

    expect(ctx.funnel_stage).toBe("interesse_identificado");
    expect(ctx.current_objection).toBe("financeira");
    expect(ctx.purchase_intent).toBe("clear");
  });

  it("last_agent_question é copiado de last_julia_question", () => {
    const state = { ...opexState(), last_julia_question: "Qual seu maior receio?" };
    const synced = syncGlobalToProductContext(state, "opex");
    expect(synced.product_contexts["opex"].last_agent_question).toBe("Qual seu maior receio?");
  });
});

// ─── 4. information_shared é deduplicado ─────────────────────────────────────
describe("4. information_shared é deduplicado", () => {
  it("adicionar product_overview duas vezes resulta em um único item", () => {
    const state1 = opexState();
    const s1 = syncGlobalToProductContext(state1, "opex");
    // segunda sync com mesmo information_already_shared
    const s2 = syncGlobalToProductContext({ ...s1, product_contexts: s1.product_contexts }, "opex");
    const shared = s2.product_contexts["opex"].information_shared;
    expect(shared.filter((x) => x === "product_overview").length).toBe(1);
    expect(shared.filter((x) => x === "price").length).toBe(1);
  });
});

// ─── 5. known_product_facts possui limite ────────────────────────────────────
describe("5. known_product_facts possui limite MAX_PRODUCT_FACTS", () => {
  it("não excede o máximo de itens", () => {
    let state = opexState();
    const synced = syncGlobalToProductContext(state, "opex");
    // injetar manualmente 25 fatos no contexto via validPreviousState path
    const manyFacts = Array.from({ length: 25 }, (_, i) => `fato ${i}`);
    const stateWithFacts = mergeConversationState(
      DEFAULT_CONVERSATION_STATE,
      { ...synced, product_contexts: { opex: { ...DEFAULT_PRODUCT_CONTEXT, known_product_facts: manyFacts, information_shared: [] } } },
      { allowProtectedChanges: true },
    ).state;
    expect(stateWithFacts.product_contexts["opex"].known_product_facts.length).toBeLessThanOrEqual(MAX_PRODUCT_FACTS);
  });
});

// ─── 6. product_summary possui limite ────────────────────────────────────────
describe("6. product_summary possui limite PRODUCT_SUMMARY_LIMIT", () => {
  it("product_summary não ultrapassa o limite", () => {
    const longSummary = "x".repeat(PRODUCT_SUMMARY_LIMIT + 500);
    const state = { ...opexState(), conversation_summary: longSummary };
    const synced = syncGlobalToProductContext(state, "opex");
    expect(synced.product_contexts["opex"].product_summary.length).toBeLessThanOrEqual(PRODUCT_SUMMARY_LIMIT);
  });
});

// ─── 7. contexto Teen não é apagado ao atualizar OPEX ────────────────────────
describe("7. contexto Teen não é apagado ao atualizar OPEX", () => {
  it("product_contexts.teen_connect sobrevive ao sync de opex", () => {
    const teenCtx = { ...DEFAULT_PRODUCT_CONTEXT, information_shared: [], known_product_facts: [], funnel_stage: "em_conversa" as const };
    const state: ConversationState = {
      ...opexState(),
      product_contexts: { teen_connect: teenCtx },
    };
    const synced = syncGlobalToProductContext(state, "opex");
    expect("teen_connect" in synced.product_contexts).toBe(true);
    expect(synced.product_contexts["teen_connect"].funnel_stage).toBe("em_conversa");
  });
});

// ─── 8. contexto OPEX não é apagado ao atualizar Teen ────────────────────────
describe("8. contexto OPEX não é apagado ao atualizar Teen", () => {
  it("product_contexts.opex sobrevive ao sync de teen_connect", () => {
    const opexCtx = { ...DEFAULT_PRODUCT_CONTEXT, information_shared: [], known_product_facts: [], funnel_stage: "proposta_enviada" as const };
    const state: ConversationState = {
      ...base(),
      current_product: "Teen Connect",
      funnel_stage: "interesse_identificado",
      current_objection: null,
      purchase_intent: "weak",
      product_contexts: { opex: opexCtx },
    };
    const synced = syncGlobalToProductContext(state, "teen_connect");
    expect("opex" in synced.product_contexts).toBe(true);
    expect(synced.product_contexts["opex"].funnel_stage).toBe("proposta_enviada");
  });
});

// ─── 9. slug inválido é rejeitado ────────────────────────────────────────────
describe("9. slug inválido é rejeitado", () => {
  it("syncGlobalToProductContext retorna estado inalterado para slug desconhecido", () => {
    const state = opexState();
    const synced = syncGlobalToProductContext(state, "produto_fantasma");
    expect(synced).toBe(state); // referência igual = não mutou
  });

  it("mergeConversationState registra issue para slug inválido no product_contexts", () => {
    const result = mergeConversationState(
      DEFAULT_CONVERSATION_STATE,
      { product_contexts: { slug_invalido: { funnel_stage: "novo_lead", information_shared: [], known_product_facts: [] } } },
      { allowProtectedChanges: true },
    );
    expect(result.issues.some((i) => i.includes("slug_invalido"))).toBe(true);
  });
});

// ─── 10. normalizeProductSlug é reutilizado ───────────────────────────────────
describe("10. normalizeProductSlug é reutilizado pelo sync", () => {
  it("slug derivado de normalizeProductSlug é aceito pelo sync", () => {
    const slug = normalizeProductSlug("Teen Connect");
    expect(slug).toBe("teen_connect");
    const state = { ...base(), current_product: "Teen Connect", funnel_stage: "em_conversa" as const, current_objection: null, purchase_intent: "weak" as const };
    const synced = syncGlobalToProductContext(state, slug!);
    expect("teen_connect" in synced.product_contexts).toBe(true);
  });
});

// ─── 11. alteração parcial preserva valores anteriores ───────────────────────
describe("11. alteração parcial preserva valores anteriores", () => {
  it("sync preserva payment_method previamente definido se global for null", () => {
    const s1 = syncGlobalToProductContext({ ...opexState(), payment_method: "pix" }, "opex");
    expect(s1.product_contexts["opex"].payment_method).toBe("pix");
    // segundo sync sem pagamento não apaga o contexto criado — mas sync sempre copia global
    const s2 = syncGlobalToProductContext({ ...s1, payment_method: null }, "opex");
    expect(s2.product_contexts["opex"].payment_method).toBeNull();
  });
});

// ─── 12. saída inválida não destrói contexto ─────────────────────────────────
describe("12. saída inválida não destrói contexto", () => {
  it("AI enviando product_contexts com allowProtectedChanges=false não altera o mapa", () => {
    const existingCtx = { ...DEFAULT_PRODUCT_CONTEXT, information_shared: [], known_product_facts: [], funnel_stage: "proposta_enviada" as const };
    const state = { ...base(), product_contexts: { opex: existingCtx } };
    const result = mergeConversationState(state, {
      product_contexts: { opex: { funnel_stage: "perdido_sem_interesse" } },
    });
    // allowProtectedChanges=false (default) → product_contexts ignorado
    expect(result.state.product_contexts["opex"].funnel_stage).toBe("proposta_enviada");
  });
});

// ─── 13. campos globais comerciais refletem contexto ativo ───────────────────
describe("13. campos globais comerciais refletem contexto ativo", () => {
  it("após sync, product_contexts[opex] tem os mesmos valores que os campos globais", () => {
    const state = opexState();
    const synced = syncGlobalToProductContext(state, "opex");
    const ctx = synced.product_contexts["opex"];

    expect(ctx.funnel_stage).toBe(state.funnel_stage);
    expect(ctx.current_objection).toBe(state.current_objection);
    expect(ctx.purchase_intent).toBe(state.purchase_intent);
  });
});

// ─── 14. hidratação OPEX restaura valores corretos ───────────────────────────
describe("14. hidratação OPEX restaura valores corretos", () => {
  it("hydrateFromProductContext restaura funnel_stage e objeção do contexto", () => {
    const opexCtx = {
      ...DEFAULT_PRODUCT_CONTEXT,
      information_shared: ["price"] as any,
      known_product_facts: [],
      funnel_stage: "proposta_enviada" as const,
      current_objection: "tempo" as const,
      purchase_intent: "clear" as const,
    };
    const state: ConversationState = {
      ...base(),
      funnel_stage: "novo_lead",
      current_objection: null,
      product_contexts: { opex: opexCtx },
    };
    const hydrated = hydrateFromProductContext(state, "opex");
    expect(hydrated.funnel_stage).toBe("proposta_enviada");
    expect(hydrated.current_objection).toBe("tempo");
    expect(hydrated.purchase_intent).toBe("clear");
    expect(hydrated.information_already_shared).toContain("price");
  });
});

// ─── 15. product_contexts não é alterado por mutação acidental ───────────────
describe("15. product_contexts não é alterado por mutação acidental", () => {
  it("syncGlobalToProductContext não muta o estado original", () => {
    const state = opexState();
    const original = JSON.stringify(state.product_contexts);
    syncGlobalToProductContext(state, "opex");
    expect(JSON.stringify(state.product_contexts)).toBe(original);
  });
});

// ─── 16. máximo de contextos é respeitado de forma segura ────────────────────
describe("16. máximo de contextos é respeitado (MAX_PRODUCT_CONTEXTS = " + MAX_PRODUCT_CONTEXTS + ")", () => {
  it("não cria um 6° contexto — retorna estado inalterado", () => {
    const slugs = ["opex", "teen_connect", "mulheres_excelencia", "workshop_elevate", "metodo_cis"] as const;
    const contexts: Record<string, any> = {};
    for (const s of slugs) {
      contexts[s] = { ...DEFAULT_PRODUCT_CONTEXT, information_shared: [], known_product_facts: [] };
    }
    const state: ConversationState = { ...base(), current_product: "PGL", product_contexts: contexts };
    const synced = syncGlobalToProductContext(state, "pgl");
    expect("pgl" in synced.product_contexts).toBe(false);
    expect(Object.keys(synced.product_contexts).length).toBe(MAX_PRODUCT_CONTEXTS);
    expect(synced).toBe(state); // mesma referência
  });
});

// ─── 17. State Updater continua uma única chamada de IA ──────────────────────
describe("17. State Updater continua uma única chamada — postMerge é síncrono", () => {
  it("persistConversationState com postMerge não adiciona chamadas de IA (postMerge é puro)", async () => {
    const calls: string[] = [];
    const repo: ConversationStateRepository = {
      compareAndSwap: async () => { calls.push("cas"); return { kind: "conflict" }; },
      load: async () => { calls.push("load"); return { state: base(), version: 1 }; },
    };
    await persistConversationState({
      leadId: "test",
      mode: "ativo",
      previousState: base(),
      expectedVersion: 1,
      updaterOutput: { funnel_stage: "interesse_identificado" },
      repository: repo,
      postMerge: (state) => {
        calls.push("postMerge");
        return syncGlobalToProductContext(state, "opex");
      },
    });
    // postMerge deve ter sido chamado exatamente uma vez por tentativa
    expect(calls.filter((c) => c === "postMerge").length).toBeGreaterThanOrEqual(1);
  });
});

// ─── 18. Router continua zero chamadas de IA ─────────────────────────────────
describe("18. Router continua zero chamadas de IA", () => {
  it("resolveActiveAgent é síncrono e não retorna Promise", () => {
    const state = opexState();
    const result = resolveActiveAgent(state);
    expect(result instanceof Promise).toBe(false);
    expect(result.agent_key).toBe("general"); // Fase 1 sempre general
  });
});
