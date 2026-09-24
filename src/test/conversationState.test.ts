import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONVERSATION_STATE,
  applyOperationalConversationState,
  buildConversationStateContext,
  mergeConversationState,
  persistConversationState,
  prepareStateUpdaterConversation,
  type ConversationState,
  type ConversationStateRepository,
} from "../../supabase/functions/processar-bot/conversation-state";

const baseState = (): ConversationState => ({
  ...DEFAULT_CONVERSATION_STATE,
  information_already_shared: [],
  known_user_facts: [],
});

describe("conversation_state da Júlia", () => {
  it("preserva o produto quando a atualização seguinte só muda a intenção", () => {
    const primeiro = mergeConversationState(baseState(), {
      current_product: "OPEX",
      current_intent: "informacao_produto",
    });
    const segundo = mergeConversationState(primeiro.state, { current_intent: "preco" });

    expect(segundo.state.current_product).toBe("OPEX");
    expect(segundo.state.current_intent).toBe("preco");
  });

  it("acumula informações apresentadas sem duplicar nem apagar as anteriores", () => {
    const primeiro = mergeConversationState(baseState(), {
      information_already_shared: ["product_overview"],
    });
    const segundo = mergeConversationState(primeiro.state, {
      information_already_shared: ["price", "product_overview"],
    });

    expect(segundo.state.information_already_shared).toEqual(["product_overview", "price"]);
  });

  it("aceita objeção financeira com intenção clara de compra", () => {
    const result = mergeConversationState(baseState(), {
      current_objection: "financeira",
      purchase_intent: "clear",
    });

    expect(result.state.current_objection).toBe("financeira");
    expect(result.state.purchase_intent).toBe("clear");
  });

  it("preserva a última pergunta ao compreender uma resposta curta", () => {
    const previous = {
      ...baseState(),
      last_julia_question: "Você prefere à vista ou parcelado?",
      awaiting: "payment_choice" as const,
    };
    const result = mergeConversationState(previous, { payment_method: "card", awaiting: "payment" });

    expect(result.state.last_julia_question).toBe("Você prefere à vista ou parcelado?");
    expect(result.state.payment_method).toBe("card");
  });

  it("preserva uma promessa sem inventar horário", () => {
    const result = mergeConversationState(baseState(), { promised_payment_at: "amanhã" });
    expect(result.state.promised_payment_at).toBe("amanhã");
  });

  it("não permite que a IA reverta handoff nem não-contatar verdadeiros", () => {
    const previous = { ...baseState(), handoff_active: true, do_not_contact: true };
    const result = mergeConversationState(previous, {
      handoff_active: false,
      do_not_contact: false,
    });

    expect(result.state.handoff_active).toBe(true);
    expect(result.state.do_not_contact).toBe(true);
  });

  it("reserva flags operacionais para tools e humanos", () => {
    const result = mergeConversationState(baseState(), {
      handoff_active: true,
      do_not_contact: true,
    });

    expect(result.state.handoff_active).toBe(false);
    expect(result.state.do_not_contact).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("handoff_active"),
      expect.stringContaining("do_not_contact"),
    ]));
  });

  it("faz o estado de handoff seguir a fonte operacional do CRM", () => {
    const stale = { ...baseState(), handoff_active: true };
    const reconciled = applyOperationalConversationState(stale, { handoffActive: false });
    expect(reconciled.handoff_active).toBe(false);
  });

  it("ignora campos inválidos e inesperados sem apagar o estado anterior", () => {
    const previous = {
      ...baseState(),
      current_product: "OPEX",
      temperature: "morno" as const,
      known_user_facts: ["Prefere atendimento pela manhã"],
    };
    const result = mergeConversationState(previous, {
      temperature: "fervendo",
      current_product: 42,
      campo_inventado: "não pode entrar",
      conversation_summary: "x".repeat(3_000),
    });

    expect(result.state.current_product).toBe("OPEX");
    expect(result.state.temperature).toBe("morno");
    expect(result.state.known_user_facts).toEqual(["Prefere atendimento pela manhã"]);
    expect(result.state.conversation_summary).toHaveLength(2_000);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("temperature"),
      expect.stringContaining("current_product"),
      expect.stringContaining("campo_inventado"),
    ]));
  });

  it("detecta conflito, recarrega e tenta compare-and-swap somente mais uma vez", async () => {
    const calls: number[] = [];
    const repository: ConversationStateRepository = {
      compareAndSwap: async (_leadId, version, state) => {
        calls.push(version);
        if (calls.length === 1) return { kind: "conflict" };
        return { kind: "updated", version: version + 1, state };
      },
      load: async () => ({
        state: { ...baseState(), current_product: "OPEX" },
        version: 8,
      }),
    };

    const result = await persistConversationState({
      leadId: "lead-1",
      mode: "ativo",
      previousState: baseState(),
      expectedVersion: 7,
      updaterOutput: { current_intent: "preco" },
      repository,
    });

    expect(calls).toEqual([7, 8]);
    expect(result.kind).toBe("persisted");
    expect(result.state.current_product).toBe("OPEX");
    expect(result.state.current_intent).toBe("preco");
  });

  it("não registra persistência quando o banco retorna erro", async () => {
    const repository: ConversationStateRepository = {
      compareAndSwap: async () => ({ kind: "error", error: "database unavailable" }),
      load: async () => ({ state: baseState(), version: 1 }),
    };

    const result = await persistConversationState({
      leadId: "lead-1",
      mode: "ativo",
      previousState: baseState(),
      expectedVersion: 1,
      updaterOutput: { current_product: "OPEX" },
      repository,
    });

    expect(result.kind).toBe("failed");
    expect(result.persisted).toBe(false);
  });

  it.each(["sombra", "teste"] as const)("modo %s calcula em memória sem persistir", async (mode) => {
    let writes = 0;
    const repository: ConversationStateRepository = {
      compareAndSwap: async () => {
        writes += 1;
        return { kind: "error", error: "não deveria escrever" };
      },
      load: async () => ({ state: baseState(), version: 1 }),
    };

    const result = await persistConversationState({
      leadId: "lead-1",
      mode,
      previousState: baseState(),
      expectedVersion: 1,
      updaterOutput: { current_product: "OPEX" },
      repository,
    });

    expect(result.kind).toBe("memory_only");
    expect(result.state.current_product).toBe("OPEX");
    expect(writes).toBe(0);
  });

  it("separa a última mensagem do histórico e representa mídia sem texto", () => {
    const prepared = prepareStateUpdaterConversation([
      { direction: "saida", content: "Você prefere à vista ou parcelado?", mediaType: null },
      { direction: "entrada", content: "Parcelado", mediaType: null },
      { direction: "entrada", content: "", mediaType: "imagem" },
    ]);

    expect(prepared.history).not.toContain("[A pessoa enviou uma imagem]");
    expect(prepared.latestUserMessage).toBe("[A pessoa enviou uma imagem]");
  });

  it("injeta todos os campos críticos no contexto da Júlia", () => {
    const context = buildConversationStateContext({
      ...baseState(),
      origin: "Instagram",
      payment_method: "pix",
      promised_payment_at: "amanhã",
      handoff_active: true,
      do_not_contact: true,
    });

    expect(context).toContain("Origem: Instagram");
    expect(context).toContain("Forma de pagamento: pix");
    expect(context).toContain("Promessa de pagamento: amanhã");
    expect(context).toContain("Handoff ativo: sim");
    expect(context).toContain("Não contatar: sim");
  });
});
