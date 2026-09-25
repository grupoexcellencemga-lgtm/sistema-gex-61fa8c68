import { describe, expect, it } from "vitest";
import {
  normalizeProductSlug,
  resolveActiveAgent,
  buildAgentConfig,
} from "../../supabase/functions/processar-bot/router";
import {
  DEFAULT_CONVERSATION_STATE,
  type ConversationState,
} from "../../supabase/functions/processar-bot/conversation-state";

const baseState = (): ConversationState => ({
  ...DEFAULT_CONVERSATION_STATE,
  information_already_shared: [],
  known_user_facts: [],
});

describe("normalizeProductSlug", () => {
  it("retorna null para produto nulo", () => {
    expect(normalizeProductSlug(null)).toBeNull();
  });

  it("normaliza Método OPEX para opex", () => {
    expect(normalizeProductSlug("Método OPEX — O Poder da Excelência")).toBe("opex");
  });

  it("normaliza Teen Connect para teen_connect", () => {
    expect(normalizeProductSlug("Teen Connect")).toBe("teen_connect");
  });

  it("normaliza Comunidade Mulheres de Excelência para mulheres_excelencia", () => {
    expect(normalizeProductSlug("Comunidade Mulheres de Excelência")).toBe("mulheres_excelencia");
  });

  it("normaliza slug já normalizado opex", () => {
    expect(normalizeProductSlug("opex")).toBe("opex");
  });

  it("retorna null para produto desconhecido", () => {
    expect(normalizeProductSlug("Produto Inexistente XYZ")).toBeNull();
  });
});

describe("resolveActiveAgent — Fase 1", () => {
  it("produto nulo → agente geral", () => {
    const decision = resolveActiveAgent(baseState());
    expect(decision.agent_key).toBe("general");
    expect(decision.routing_action).toBe("start");
  });

  it("produto OPEX na Fase 1 → agente geral (sem mudança de comportamento)", () => {
    const state = { ...baseState(), current_product: "Método OPEX — O Poder da Excelência" };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBe("general");
  });

  it("produto desconhecido → agente geral", () => {
    const state = { ...baseState(), current_product: "Produto XYZ Desconhecido" };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBe("general");
  });

  it("handoff_active → bloqueia atendimento com handoff_block", () => {
    const state = { ...baseState(), handoff_active: true };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBeNull();
    expect(decision.routing_action).toBe("handoff_block");
  });

  it("do_not_contact → bloqueia atendimento com do_not_contact_block", () => {
    const state = { ...baseState(), do_not_contact: true };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBeNull();
    expect(decision.routing_action).toBe("do_not_contact_block");
  });

  it("handoff_active tem prioridade sobre do_not_contact", () => {
    const state = { ...baseState(), handoff_active: true, do_not_contact: true };
    const decision = resolveActiveAgent(state);
    expect(decision.routing_action).toBe("handoff_block");
  });

  it("changed=true quando agente anterior era null", () => {
    const state = { ...baseState(), current_agent: null };
    const decision = resolveActiveAgent(state);
    expect(decision.changed).toBe(true);
  });

  it("changed=false quando agente anterior já era general", () => {
    const state = { ...baseState(), current_agent: "general" as const };
    const decision = resolveActiveAgent(state);
    expect(decision.changed).toBe(false);
    expect(decision.routing_action).toBe("continue");
  });

  it("não muta o objeto de estado passado como argumento", () => {
    const state = baseState();
    const before = JSON.stringify(state);
    resolveActiveAgent(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("buildAgentConfig", () => {
  it("agente geral tem displayName Júlia (Geral)", () => {
    const state = baseState();
    const decision = resolveActiveAgent(state);
    const config = buildAgentConfig(decision);
    expect(config.key).toBe("general");
    expect(config.displayName).toBe("Júlia (Geral)");
    expect(config.productContext).toBeNull();
  });

  it("agente bloqueado por handoff tem displayName Bloqueado", () => {
    const state = { ...baseState(), handoff_active: true };
    const decision = resolveActiveAgent(state);
    const config = buildAgentConfig(decision);
    expect(config.key).toBeNull();
    expect(config.displayName).toBe("Bloqueado");
  });
});
