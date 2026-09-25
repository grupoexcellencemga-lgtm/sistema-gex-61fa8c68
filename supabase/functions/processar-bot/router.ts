import type { AgentKey, ConversationState } from "./conversation-state.ts";

export type { AgentKey };

export interface RoutingDecision {
  agent_key: AgentKey;
  product_slug: AgentKey;
  routing_action: "continue" | "start" | "handoff_block" | "do_not_contact_block";
  routing_reason: string;
  changed: boolean;
}

export interface AgentConfig {
  key: AgentKey;
  displayName: string;
  productSlug: AgentKey;
  systemPromptExtra: string | null;
  allowedTools: string[];
  productContext: null;
}

// Central product name → agent key mapping. No hardcoding elsewhere.
const PRODUCT_SLUG_MAP: Record<string, AgentKey> = {
  // OPEX
  "opex": "opex",
  "metodo opex": "opex",
  "metodo opex o poder da excelencia": "opex",
  "o poder da excelencia": "opex",
  // Teen Connect
  "teen connect": "teen_connect",
  "teen_connect": "teen_connect",
  // Mulheres de Excelência
  "mulheres de excelencia": "mulheres_excelencia",
  "comunidade mulheres de excelencia": "mulheres_excelencia",
  // Workshop Eleva-te
  "eleva-te": "workshop_elevate",
  "elevate": "workshop_elevate",
  "workshop eleva-te": "workshop_elevate",
  // Método CIS
  "cis": "metodo_cis",
  "metodo cis": "metodo_cis",
  "metodo cis global": "metodo_cis",
  // PGL
  "pgl": "pgl",
  "programa gestao e lideranca": "pgl",
  // Workshop Pais que Fortalecem
  "pais que fortalecem": "workshop_pais",
  "workshop pais que fortalecem": "workshop_pais",
  // Workshop Gestão do Crescimento
  "gestao do crescimento": "workshop_gestao",
  "workshop gestao do crescimento": "workshop_gestao",
  // Workshop Homens de Excelência
  "homens de excelencia": "workshop_homens",
  "workshop homens de excelencia": "workshop_homens",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[—–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProductSlug(productName: string | null): AgentKey {
  if (!productName) return null;
  return PRODUCT_SLUG_MAP[normalize(productName)] ?? null;
}

export function resolveActiveAgent(state: ConversationState): RoutingDecision {
  const previousAgent = state.current_agent ?? null;

  if (state.handoff_active) {
    return {
      agent_key: null,
      product_slug: normalizeProductSlug(state.current_product),
      routing_action: "handoff_block",
      routing_reason: "handoff ativo — atendimento humano em curso",
      changed: previousAgent !== null,
    };
  }

  if (state.do_not_contact) {
    return {
      agent_key: null,
      product_slug: normalizeProductSlug(state.current_product),
      routing_action: "do_not_contact_block",
      routing_reason: "lead marcado como não contatar",
      changed: previousAgent !== null,
    };
  }

  // Phase 1: always general — zero behavior change
  const agentKey: AgentKey = "general";
  const productSlug = normalizeProductSlug(state.current_product);
  const changed = previousAgent !== agentKey;

  return {
    agent_key: agentKey,
    product_slug: productSlug,
    routing_action: changed ? "start" : "continue",
    routing_reason: "fase 1 — agente geral sempre ativo",
    changed,
  };
}

const AGENT_DISPLAY_NAMES: Record<NonNullable<AgentKey>, string> = {
  general: "Júlia (Geral)",
  opex: "Agente OPEX",
  teen_connect: "Agente Teen Connect",
  mulheres_excelencia: "Agente Mulheres de Excelência",
  workshop_elevate: "Agente Workshop Eleva-te",
  metodo_cis: "Agente Método CIS",
  pgl: "Agente PGL",
  workshop_pais: "Agente Pais que Fortalecem",
  workshop_gestao: "Agente Gestão do Crescimento",
  workshop_homens: "Agente Homens de Excelência",
};

export function buildAgentConfig(decision: RoutingDecision): AgentConfig {
  const key = decision.agent_key;
  return {
    key,
    displayName: key ? AGENT_DISPLAY_NAMES[key] : "Bloqueado",
    productSlug: decision.product_slug,
    systemPromptExtra: null,
    allowedTools: [],
    productContext: null,
  };
}
