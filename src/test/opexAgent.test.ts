import { describe, expect, it } from "vitest";
import {
  AGENT_REGISTRY,
  OPEX_ALLOWED_TOOLS,
  PROMPT_AGENTE_OPEX,
  getAgentConfigForTesting,
  getAgentFromRegistry,
} from "../../supabase/functions/processar-bot/agent-registry";
import {
  resolveActiveAgent,
  buildAgentConfig,
  normalizeProductSlug,
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

// ─── Registry ─────────────────────────────────────────────────────────────────

describe("AGENT_REGISTRY — Agente OPEX", () => {
  it("registry contém entry opex", () => {
    expect(AGENT_REGISTRY.opex).toBeDefined();
  });

  it("key = opex", () => {
    expect(AGENT_REGISTRY.opex?.key).toBe("opex");
  });

  it("productSlug = opex", () => {
    expect(AGENT_REGISTRY.opex?.productSlug).toBe("opex");
  });

  it("displayName definido", () => {
    expect(AGENT_REGISTRY.opex?.displayName).toBeTruthy();
  });

  it("enabled = false (Fase 3 — isolado, não conectado ao routing real)", () => {
    expect(AGENT_REGISTRY.opex?.enabled).toBe(false);
  });

  it("phase = 3", () => {
    expect(AGENT_REGISTRY.opex?.metadata.phase).toBe(3);
  });
});

// ─── Tool subset ──────────────────────────────────────────────────────────────

describe("OPEX_ALLOWED_TOOLS — subset explícito", () => {
  const required = [
    "consultar_contexto_lead",
    "consultar_produtos",
    "consultar_turmas",
    "consultar_pagamento",
    "atualizar_lead",
    "registrar_nota",
    "mover_etapa",
    "pontuar_lead",
    "classificar_lead",
    "reservar_vaga",
    "cadastrar_aluno",
    "marcar_nao_contatar",
    "criar_tarefa",
    "solicitar_handoff",
  ];

  it("contém todas as tools obrigatórias", () => {
    for (const tool of required) {
      expect(OPEX_ALLOWED_TOOLS).toContain(tool);
    }
  });

  it("NÃO contém tools não autorizadas ao OPEX", () => {
    // Estas tools não fazem sentido no escopo OPEX isolado desta fase
    expect(OPEX_ALLOWED_TOOLS).not.toContain("agendar_reuniao");
    expect(OPEX_ALLOWED_TOOLS).not.toContain("adicionar_grupo_turma");
    expect(OPEX_ALLOWED_TOOLS).not.toContain("enviar_material");
  });

  it("14 tools permitidas", () => {
    expect(OPEX_ALLOWED_TOOLS.length).toBe(14);
  });

  it("registry.opex.allowedTools bate com OPEX_ALLOWED_TOOLS", () => {
    const registryTools = AGENT_REGISTRY.opex?.allowedTools ?? [];
    expect(registryTools.length).toBe(OPEX_ALLOWED_TOOLS.length);
    for (const tool of OPEX_ALLOWED_TOOLS) {
      expect(registryTools).toContain(tool);
    }
  });
});

// ─── Prompt ───────────────────────────────────────────────────────────────────

describe("PROMPT_AGENTE_OPEX — conteúdo e limites", () => {
  it("prompt definido e não vazio", () => {
    expect(PROMPT_AGENTE_OPEX.length).toBeGreaterThan(500);
  });

  it("menciona Método OPEX", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/OPEX/);
  });

  it("contém seção de limites", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/LIMITES|NUNCA/i);
  });

  it("proíbe inventar desconto", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/Inventar desconto|inventar desconto/i);
  });

  it("proíbe confirmar ação antes da tool", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/antes do retorno|antes de.*tool|operacional antes/i);
  });

  it("NÃO contém preço hardcoded (R$ seguido de número)", () => {
    // Preço deve ser consultado via tool, não estar no prompt
    expect(PROMPT_AGENTE_OPEX).not.toMatch(/R\$\s*\d+[\d.,]*/);
  });

  it("instrui uso de consultar_pagamento antes de enviar Pix", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/consultar_pagamento/);
  });

  it("contém seção de objeções", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/OBJ[EÇ]/i);
  });

  it("contém instrução de handoff", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/solicitar_handoff/);
  });

  it("instrui sobre troca de produto sem alterar current_agent", () => {
    expect(PROMPT_AGENTE_OPEX).toMatch(/current_agent/);
  });

  it("NÃO apresenta agente como 'Agente OPEX' para o cliente", () => {
    // Deve instruir a NÃO se apresentar como "Agente OPEX"
    expect(PROMPT_AGENTE_OPEX).toMatch(/não se apresente|nao se apresente/i);
  });

  it("registry.opex.systemPrompt bate com PROMPT_AGENTE_OPEX", () => {
    expect(AGENT_REGISTRY.opex?.systemPrompt).toBe(PROMPT_AGENTE_OPEX);
  });
});

// ─── getAgentConfigForTesting ─────────────────────────────────────────────────

describe("getAgentConfigForTesting — acesso direto para homologação", () => {
  it("retorna config OPEX quando key=opex", () => {
    const config = getAgentConfigForTesting("opex");
    expect(config).toBeDefined();
    expect(config?.key).toBe("opex");
  });

  it("retorna config mesmo com enabled=false", () => {
    // Propositalmente ignora o flag enabled para permitir testes isolados
    const config = getAgentConfigForTesting("opex");
    expect(config?.enabled).toBe(false);
    expect(config).toBeDefined(); // ainda retorna
  });

  it("retorna undefined para agente inexistente", () => {
    expect(getAgentConfigForTesting("general")).toBeUndefined();
  });
});

// ─── getAgentFromRegistry ─────────────────────────────────────────────────────

describe("getAgentFromRegistry", () => {
  it("retorna entry opex", () => {
    const entry = getAgentFromRegistry("opex");
    expect(entry).toBeDefined();
    expect(entry?.key).toBe("opex");
  });
});

// ─── Router de produção — isolamento garantido ────────────────────────────────

describe("Router produção — OPEX NÃO é selecionado automaticamente", () => {
  it("produto OPEX → Router retorna general (Fase 1/2/3 inalterada)", () => {
    const state = { ...baseState(), current_product: "Método OPEX — O Poder da Excelência" };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBe("general");
  });

  it("slug opex normalizado → Router retorna general", () => {
    const state = { ...baseState(), current_product: "opex" };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBe("general");
  });

  it("produto null → Router retorna general", () => {
    const decision = resolveActiveAgent(baseState());
    expect(decision.agent_key).toBe("general");
  });

  it("handoff_active → ainda bloqueia (não cria rota OPEX)", () => {
    const state = { ...baseState(), handoff_active: true };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBeNull();
    expect(decision.routing_action).toBe("handoff_block");
  });

  it("do_not_contact → ainda bloqueia", () => {
    const state = { ...baseState(), do_not_contact: true };
    const decision = resolveActiveAgent(state);
    expect(decision.agent_key).toBeNull();
    expect(decision.routing_action).toBe("do_not_contact_block");
  });
});

// ─── buildAgentConfig com Registry ───────────────────────────────────────────

describe("buildAgentConfig — integração com registry", () => {
  it("agente general NÃO está no registry → usa fallback displayName", () => {
    const state = baseState();
    const decision = resolveActiveAgent(state);
    const config = buildAgentConfig(decision);
    expect(config.key).toBe("general");
    expect(config.displayName).toBe("Júlia (Geral)");
    // general não tem entry no registry, então systemPromptExtra fica null
    expect(config.systemPromptExtra).toBeNull();
  });

  it("agente opex — buildAgentConfig direto retorna systemPrompt do registry", () => {
    // Simula o que acontecerá quando o Router for ativado para OPEX no futuro
    const mockDecision = {
      agent_key: "opex" as const,
      product_slug: "opex" as const,
      routing_action: "start" as const,
      routing_reason: "teste direto",
      changed: true,
    };
    const config = buildAgentConfig(mockDecision);
    expect(config.key).toBe("opex");
    expect(config.displayName).toBe("Especialista OPEX");
    expect(config.systemPromptExtra).toBe(PROMPT_AGENTE_OPEX);
    expect(config.allowedTools).toEqual(expect.arrayContaining([...OPEX_ALLOWED_TOOLS]));
  });

  it("allowedTools do agente opex têm 14 itens", () => {
    const mockDecision = {
      agent_key: "opex" as const,
      product_slug: "opex" as const,
      routing_action: "start" as const,
      routing_reason: "teste direto",
      changed: true,
    };
    const config = buildAgentConfig(mockDecision);
    expect(config.allowedTools.length).toBe(14);
  });
});

// ─── ProductSlug OPEX ─────────────────────────────────────────────────────────

describe("normalizeProductSlug — OPEX", () => {
  it("normaliza 'Método OPEX — O Poder da Excelência' para opex", () => {
    expect(normalizeProductSlug("Método OPEX — O Poder da Excelência")).toBe("opex");
  });

  it("normaliza variações de OPEX", () => {
    expect(normalizeProductSlug("OPEX")).toBe("opex");
    expect(normalizeProductSlug("opex")).toBe("opex");
    expect(normalizeProductSlug("Método OPEX")).toBe("opex");
  });

  it("productSlug OPEX bate com registry key", () => {
    const slug = normalizeProductSlug("Método OPEX — O Poder da Excelência");
    expect(AGENT_REGISTRY[slug!]).toBeDefined();
  });
});

// ─── Fluxo visual e estado — sem alterações ───────────────────────────────────

describe("Isolamento — sem alteração de comportamento em produção", () => {
  it("resolveActiveAgent não altera o objeto de estado", () => {
    const state = { ...baseState(), current_product: "opex" };
    const before = JSON.stringify(state);
    resolveActiveAgent(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("buildAgentConfig não altera o objeto de decisão", () => {
    const decision = resolveActiveAgent(baseState());
    const before = JSON.stringify(decision);
    buildAgentConfig(decision);
    expect(JSON.stringify(decision)).toBe(before);
  });
});
