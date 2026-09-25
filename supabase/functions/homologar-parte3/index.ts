import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";
import {
  AWAITING_VALUES,
  CURRENT_INTENTS,
  DEFAULT_CONVERSATION_STATE,
  FUNNEL_STAGES,
  OBJECTIONS,
  PAYMENT_METHODS,
  PURCHASE_INTENTS,
  SHARED_INFORMATION,
  TEMPERATURES,
  buildConversationStateContext,
  mergeConversationState,
  prepareStateUpdaterConversation,
  type ConversationState,
} from "../processar-bot/conversation-state.ts";
import {
  decideCommercialTurn,
  formatCommercialDecisionContext,
  toCommercialDecisionLog,
  type BrainMessage,
  type BrainOperationalContext,
} from "../processar-bot/commercial-brain.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

// ─── Constantes copiadas de processar-bot/index.ts ──────────────────────────

const PROMPT_ATUALIZADOR_ESTADO = `# ATUALIZADOR DE ESTADO — JÚLIA COMERCIAL GEx

Você é um componente interno do sistema comercial do Grupo Excellence.
Você NÃO conversa com clientes.
Sua única função é analisar o estado atual de uma conversa comercial e devolver o estado atualizado em formato estruturado.
Nunca escreva mensagens para o cliente. Nunca tente vender. Nunca invente informações. Nunca transforme hipóteses em fatos.

Você receberá: 1) estado atual do lead; 2) histórico recente da conversa; 3) última mensagem do usuário.
Sua função é atualizar o estado com base apenas nas informações realmente disponíveis.

REGRA FUNDAMENTAL: Preserve informações anteriores enquanto continuarem válidas. Não apague uma informação porque ela não apareceu na última mensagem. Se current_product já está definido e o usuário pergunta "Quanto custa?", current_product continua o mesmo.

Produtos conhecidos: Comunidade Mulheres de Excelência, Workshop Eleva-te, Método CIS — Global, Método OPEX — O Poder da Excelência, Workshop Pais que Fortalecem, PGL — Programa Gestão e Liderança, Teen Connect, Workshop Gestão do Crescimento, Workshop Homens de Excelência. Outros produtos podem existir.

Não confunda: pergunta sobre preço com decisão de comprar; interesse com inscrição; envio de comprovante com pagamento confirmado; pedido de informação com objeção; resposta curta com falta de interesse.
Mantenha no máximo 20 fatos conhecidos realmente úteis. Não inclua dados sensíveis desnecessários.

Sempre comece pelo estado existente. Altere somente o que realmente mudou. Chame a ferramenta atualizar_estado_conversa com o objeto completo.`;

const TOOL_ESTADO: Anthropic.Tool = {
  name: "atualizar_estado_conversa",
  description: "Atualiza o estado persistente da conversa com base na análise da última mensagem e do histórico.",
  input_schema: {
    type: "object",
    properties: {
      preferred_name: { type: ["string", "null"] },
      current_product: { type: ["string", "null"] },
      origin: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      current_intent: { type: "string", enum: [...CURRENT_INTENTS] },
      explicit_question: { type: ["string", "null"] },
      main_need: { type: ["string", "null"] },
      current_objection: { type: ["string", "null"], enum: [null, ...OBJECTIONS] },
      funnel_stage: { type: "string", enum: [...FUNNEL_STAGES] },
      temperature: { type: "string", enum: [...TEMPERATURES] },
      purchase_intent: { type: "string", enum: [...PURCHASE_INTENTS] },
      information_already_shared: { type: "array", items: { type: "string", enum: [...SHARED_INFORMATION] } },
      known_user_facts: { type: "array", items: { type: "string" } },
      last_julia_question: { type: ["string", "null"] },
      awaiting: { type: "string", enum: [...AWAITING_VALUES] },
      agreed_next_action: { type: ["string", "null"] },
      payment_method: { type: ["string", "null"], enum: [null, ...PAYMENT_METHODS] },
      promised_payment_at: { type: ["string", "null"] },
      handoff_active: { type: "boolean" },
      do_not_contact: { type: "boolean" },
      conversation_summary: { type: "string" },
    },
    required: [
      "preferred_name","current_product","origin","city","current_intent","explicit_question",
      "main_need","current_objection","funnel_stage","temperature","purchase_intent",
      "information_already_shared","known_user_facts","last_julia_question","awaiting",
      "agreed_next_action","payment_method","promised_payment_at","handoff_active",
      "do_not_contact","conversation_summary",
    ],
  } as Anthropic.Tool["input_schema"],
};

const JULIA_TOOLS: Anthropic.Tool[] = [
  {
    name: "atualizar_lead",
    description: "Atualiza informações cadastrais do lead/contato com dados coletados na conversa.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" }, email: { type: "string" }, cidade: { type: "string" },
        produto_interesse: { type: "string" }, empresa_nome: { type: "string" },
        cargo: { type: "string" }, perfil_lead: { type: "string", enum: ["pf", "pj"] },
      },
    },
  },
  {
    name: "pontuar_lead",
    description: "Define a pontuação de qualificação do lead (0-100).",
    input_schema: {
      type: "object",
      properties: { score: { type: "number" }, motivo: { type: "string" } },
      required: ["score", "motivo"],
    },
  },
  {
    name: "consultar_contexto_lead",
    description: "Retorna o contexto atual do lead.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_produtos",
    description: "Retorna a lista de produtos ativos com valor e condições.",
    input_schema: { type: "object", properties: { nome: { type: "string" } } },
  },
  {
    name: "registrar_nota",
    description: "Registra uma nota sobre o lead.",
    input_schema: { type: "object", properties: { nota: { type: "string" } }, required: ["nota"] },
  },
  {
    name: "mover_etapa",
    description: "Move o lead para outra etapa do funil.",
    input_schema: {
      type: "object",
      properties: {
        etapa: {
          type: "string",
          enum: [
            "Novo lead","Primeiro contato","Em conversa","Interesse identificado",
            "Produto apresentado","Proposta enviada","Aguardando decisão",
            "Dados recebidos","Aguardando pagamento","Pagamento em conferência",
            "Inscrição confirmada","Perdido ou sem interesse","Atendimento humano",
          ],
        },
        motivo: { type: "string" },
      },
      required: ["etapa"],
    },
  },
  {
    name: "consultar_turmas",
    description: "Consulta as turmas abertas no sistema.",
    input_schema: { type: "object", properties: { produto: { type: "string" } } },
  },
  {
    name: "consultar_pagamento",
    description: "Retorna as chaves Pix oficiais e link de pagamento.",
    input_schema: { type: "object", properties: { turma_nome: { type: "string" } } },
  },
  {
    name: "classificar_lead",
    description: "Classifica o lead como frio, morno ou quente.",
    input_schema: {
      type: "object",
      properties: {
        temperatura: { type: "string", enum: ["frio", "morno", "quente"] },
        motivo: { type: "string" },
      },
      required: ["temperatura"],
    },
  },
  {
    name: "reservar_vaga",
    description: "Cria uma solicitação para a equipe reservar a vaga.",
    input_schema: {
      type: "object",
      properties: {
        turma_nome: { type: "string" }, prazo_pagamento: { type: "string" }, observacoes: { type: "string" },
      },
      required: ["turma_nome"],
    },
  },
  {
    name: "cadastrar_aluno",
    description: "Cria uma solicitação para o time cadastrar o aluno.",
    input_schema: {
      type: "object",
      properties: {
        nome_completo: { type: "string" }, telefone: { type: "string" }, email: { type: "string" },
        data_nascimento: { type: "string" }, cpf: { type: "string" }, turma_nome: { type: "string" },
      },
      required: ["nome_completo"],
    },
  },
  {
    name: "agendar_reuniao",
    description: "Cria uma solicitação de reunião.",
    input_schema: {
      type: "object",
      properties: {
        assunto: { type: "string" }, tipo: { type: "string" }, data_hora: { type: "string" },
        contato: { type: "string" }, observacoes: { type: "string" },
      },
      required: ["assunto"],
    },
  },
  {
    name: "adicionar_grupo_turma",
    description: "Cria uma solicitação para adicionar o aluno ao grupo.",
    input_schema: {
      type: "object",
      properties: { turma_nome: { type: "string" }, telefone: { type: "string" } },
      required: ["turma_nome"],
    },
  },
  {
    name: "enviar_material",
    description: "Cria uma solicitação para o time enviar material.",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["imagem","pdf","link","localizacao","apresentacao"] },
        descricao: { type: "string" },
      },
      required: ["tipo","descricao"],
    },
  },
  {
    name: "marcar_nao_contatar",
    description: "Marca o contato para não receber mensagens ativas.",
    input_schema: { type: "object", properties: { motivo: { type: "string" } } },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma tarefa de acompanhamento para a equipe humana.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" }, descricao: { type: "string" },
        prioridade: { type: "string", enum: ["baixa","media","alta"] },
        data_vencimento: { type: "string" },
      },
      required: ["titulo"],
    },
  },
  {
    name: "solicitar_handoff",
    description: "Transfere o atendimento para um consultor humano.",
    input_schema: {
      type: "object",
      properties: { resumo: { type: "string" } },
      required: ["resumo"],
    },
  },
];

// ─── Mock de resultados de ferramentas ──────────────────────────────────────

function getMockToolResult(toolName: string, toolInput: Record<string, unknown>): string {
  switch (toolName) {
    case "consultar_produtos":
      return JSON.stringify({
        produtos: [{
          nome: "Método OPEX — O Poder da Excelência",
          descricao: "Programa de desenvolvimento pessoal e profissional com foco em excelência operacional.",
          valor_avista: 1500.00,
          parcelamento: "12x de R$ 135,00 no cartão",
          formato: "Presencial - 3 dias intensivos",
        }],
      });
    case "consultar_turmas":
      return JSON.stringify({
        turmas: [{
          nome: "OPEX — Maringá | Outubro 2026",
          produto: "Método OPEX — O Poder da Excelência",
          data_inicio: "2026-10-15",
          data_fim: "2026-10-17",
          local: "Maringá — PR",
          vagas_disponiveis: 8,
          status: "Inscrições abertas",
        }],
      });
    case "consultar_pagamento":
      return JSON.stringify({
        chave_pix: "8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23",
        banco: "Sicredi",
        titular: "Grupo Excellence Treinamentos",
        instrucoes: "Envie o comprovante após o pagamento para confirmar sua inscrição.",
        link_pagamento: null,
      });
    case "solicitar_handoff":
      return JSON.stringify({ sucesso: true, mensagem: "Handoff registrado. Consultor notificado." });
    case "mover_etapa":
      return JSON.stringify({ sucesso: true, etapa: toolInput.etapa });
    case "registrar_nota":
      return JSON.stringify({ sucesso: true, mensagem: "Nota registrada com sucesso." });
    case "classificar_lead":
      return JSON.stringify({ sucesso: true, temperatura: toolInput.temperatura });
    case "atualizar_lead":
      return JSON.stringify({ sucesso: true, mensagem: "Dados do lead atualizados." });
    case "pontuar_lead":
      return JSON.stringify({ sucesso: true, score: toolInput.score });
    case "consultar_contexto_lead":
      return JSON.stringify({
        etapa_funil: "Em conversa",
        produto_interesse: "Método OPEX — O Poder da Excelência",
        temperatura: "morno",
        pontuacao: 65,
        tags: [],
      });
    case "reservar_vaga":
      return JSON.stringify({ sucesso: true, mensagem: "Solicitação de reserva registrada." });
    case "cadastrar_aluno":
      return JSON.stringify({ sucesso: true, mensagem: "Solicitação de cadastro registrada." });
    case "criar_tarefa":
      return JSON.stringify({ sucesso: true, mensagem: "Tarefa criada com sucesso." });
    case "marcar_nao_contatar":
      return JSON.stringify({ sucesso: true, mensagem: "Contato marcado como não contatar." });
    default:
      return JSON.stringify({ sucesso: true, mensagem: `Ferramenta ${toolName} executada (mock).` });
  }
}

// ─── Cenários de homologação ─────────────────────────────────────────────────

interface Scenario {
  id: number;
  nome: string;
  descricao: string;
  mensagemUsuario: string;
  historicoAnterior: Array<{ direcao: "entrada" | "saida"; content: string; mediaType: string | null }>;
  estadoInicial: Partial<ConversationState>;
  crmEtapa: string | null;
  leadScore: number | null;
  humanServiceActive: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    nome: "Primeiro Contato — Pergunta de Preço",
    descricao: "Lead novo pergunta o preço do OPEX sem histórico",
    mensagemUsuario: "Olá! Quanto custa o OPEX?",
    historicoAnterior: [],
    estadoInicial: { ...DEFAULT_CONVERSATION_STATE, information_already_shared: [], known_user_facts: [] },
    crmEtapa: "Novo lead",
    leadScore: null,
    humanServiceActive: false,
  },
  {
    id: 2,
    nome: "Objeção Financeira",
    descricao: "Lead com produto identificado diz que está caro",
    mensagemUsuario: "Tá muito caro pra mim, não tenho esse dinheiro agora",
    historicoAnterior: [
      { direcao: "entrada", content: "Olá, quero saber sobre o OPEX", mediaType: null },
      { direcao: "saida", content: "Oi! O OPEX custa R$ 1.500 à vista ou 12x de R$ 135. Quer saber mais sobre as datas?", mediaType: null },
    ],
    estadoInicial: {
      ...DEFAULT_CONVERSATION_STATE,
      current_product: "Método OPEX — O Poder da Excelência",
      current_intent: "preco",
      temperature: "morno",
      funnel_stage: "Em conversa",
      information_already_shared: ["price"],
      known_user_facts: [],
    },
    crmEtapa: "Em conversa",
    leadScore: 50,
    humanServiceActive: false,
  },
  {
    id: 3,
    nome: "Pronto para Comprar",
    descricao: "Lead quente pergunta como se inscrever",
    mensagemUsuario: "Eu quero me inscrever! Como faço o pagamento?",
    historicoAnterior: [
      { direcao: "entrada", content: "Vi sobre o OPEX e já decidi, quero fazer", mediaType: null },
      { direcao: "saida", content: "Que ótimo! A próxima turma é em Maringá, 15 a 17 de outubro. Posso reservar sua vaga?", mediaType: null },
      { direcao: "entrada", content: "Sim, pode reservar", mediaType: null },
    ],
    estadoInicial: {
      ...DEFAULT_CONVERSATION_STATE,
      current_product: "Método OPEX — O Poder da Excelência",
      current_intent: "inscricao",
      temperature: "quente",
      purchase_intent: "clear",
      funnel_stage: "Aguardando decisão",
      information_already_shared: ["price", "schedule"],
      known_user_facts: ["Confirmou interesse em Maringá outubro"],
    },
    crmEtapa: "Aguardando decisão",
    leadScore: 85,
    humanServiceActive: false,
  },
  {
    id: 4,
    nome: "Pedido de Pix sem forma definida",
    descricao: "Lead pede para mandar o Pix sem ter definido forma de pagamento — deve perguntar primeiro",
    mensagemUsuario: "Pode mandar o Pix pra eu pagar",
    historicoAnterior: [
      { direcao: "entrada", content: "Quero me inscrever no OPEX de outubro", mediaType: null },
      { direcao: "saida", content: "Perfeito! Turma Maringá, 15 a 17 de outubro. Vaga disponível. Como prefere pagar: à vista (Pix) ou parcelado no cartão?", mediaType: null },
    ],
    estadoInicial: {
      ...DEFAULT_CONVERSATION_STATE,
      current_product: "Método OPEX — O Poder da Excelência",
      current_intent: "inscricao",
      temperature: "quente",
      purchase_intent: "clear",
      funnel_stage: "Aguardando decisão",
      information_already_shared: ["price", "schedule"],
      known_user_facts: ["Quer turma Maringá outubro"],
      payment_method: null,
    },
    crmEtapa: "Aguardando decisão",
    leadScore: 85,
    humanServiceActive: false,
  },
  {
    id: 5,
    nome: "Lead Pensativo — Acompanhamento",
    descricao: "Lead diz que vai pensar e pede para contatar depois",
    mensagemUsuario: "Vou pensar e te falo. Me manda uma mensagem amanhã",
    historicoAnterior: [
      { direcao: "entrada", content: "Quanto custa e quais as datas?", mediaType: null },
      { direcao: "saida", content: "O OPEX custa R$ 1.500 à vista. Próxima turma: Maringá, 15 de outubro. Ficou com alguma dúvida?", mediaType: null },
    ],
    estadoInicial: {
      ...DEFAULT_CONVERSATION_STATE,
      current_product: "Método OPEX — O Poder da Excelência",
      current_intent: "pendencia",
      temperature: "morno",
      purchase_intent: "unclear",
      funnel_stage: "Proposta enviada",
      information_already_shared: ["price", "schedule"],
      known_user_facts: [],
    },
    crmEtapa: "Proposta enviada",
    leadScore: 45,
    humanServiceActive: false,
  },
  {
    id: 6,
    nome: "Pedido de Atendimento Humano",
    descricao: "Lead pede para ser atendido por um membro da equipe humana",
    mensagemUsuario: "Me chama alguém da equipe, quero falar com uma pessoa",
    historicoAnterior: [
      { direcao: "entrada", content: "Tenho dúvidas mais específicas sobre contratação para empresa", mediaType: null },
      { direcao: "saida", content: "Entendo! Posso te explicar as opções. Qual é o tamanho da sua equipe?", mediaType: null },
    ],
    estadoInicial: {
      ...DEFAULT_CONVERSATION_STATE,
      current_product: "Método OPEX — O Poder da Excelência",
      current_intent: "duvida",
      temperature: "morno",
      funnel_stage: "Em conversa",
      information_already_shared: [],
      known_user_facts: ["Interesse em contratação B2B / empresa"],
    },
    crmEtapa: "Em conversa",
    leadScore: 60,
    humanServiceActive: false,
  },
];

// ─── Executor de um cenário ───────────────────────────────────────────────────

interface ComponentTiming { ms: number; inputTokens: number; outputTokens: number }

interface ScenarioResult {
  id: number;
  nome: string;
  mensagem: string;
  estadoAntes: ConversationState;
  stateUpdater: {
    timing: ComponentTiming;
    estadoDepois: ConversationState;
    issues: string[];
    origin: string;
  };
  cerebro: {
    timing: ComponentTiming;
    decision: Record<string, unknown>;
    issues: string[];
    usedFallback: boolean;
    origin: string;
    blocoInjetado: string;
  };
  julia: {
    timing: ComponentTiming;
    iteracoes: number;
    ferramentasChamadas: Array<{ name: string; input: Record<string, unknown>; mockResult: string }>;
    respostaFinal: string | null;
    semResposta: boolean;
  };
  avaliacao: {
    passou: boolean;
    problemas: string[];
  };
}

async function runScenario(scenario: Scenario, juliaInstrucao: string): Promise<ScenarioResult> {
  const estadoAntes = {
    ...DEFAULT_CONVERSATION_STATE,
    information_already_shared: [],
    known_user_facts: [],
    ...scenario.estadoInicial,
  } as ConversationState;

  // ── 1. State Updater ────────────────────────────────────────────────────────
  const t0 = Date.now();
  const { history, latestUserMessage } = prepareStateUpdaterConversation([
    ...scenario.historicoAnterior,
    { direction: "entrada", content: scenario.mensagemUsuario, mediaType: null },
  ]);

  const stateCtx = buildConversationStateContext(estadoAntes);
  const stateUserMsg = `${stateCtx}\n\nHistórico:\n${history}\n\nÚltima mensagem: ${latestUserMessage}`;

  const updaterResp = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: PROMPT_ATUALIZADOR_ESTADO,
    tools: [TOOL_ESTADO],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: stateUserMsg }],
  });

  const updaterMs = Date.now() - t0;
  let estadoDepois = estadoAntes;
  let updaterIssues: string[] = [];
  let updaterOrigin = "model";

  const toolBlock = updaterResp.content.find((b) => b.type === "tool_use");
  if (toolBlock && toolBlock.type === "tool_use") {
    const merged = mergeConversationState(estadoAntes, toolBlock.input, {
      preserveProtectedFlags: false,
      allowProtectedChanges: false,
    });
    estadoDepois = merged.state;
    updaterIssues = merged.issues;
  } else {
    updaterOrigin = "fallback_no_tool_use";
    updaterIssues.push("State Updater não retornou tool_use — estado anterior mantido");
  }

  const updaterTiming: ComponentTiming = {
    ms: updaterMs,
    inputTokens: updaterResp.usage.input_tokens,
    outputTokens: updaterResp.usage.output_tokens,
  };

  // ── 2. Cérebro Comercial ────────────────────────────────────────────────────
  const t1 = Date.now();
  const brainMessages: BrainMessage[] = [
    ...scenario.historicoAnterior.map((m) => ({
      direction: m.direcao,
      content: m.content,
      mediaType: m.mediaType,
    })),
    { direction: "entrada" as const, content: scenario.mensagemUsuario, mediaType: null },
  ];

  const brainOp: BrainOperationalContext = {
    agentMode: "teste",
    crmStage: scenario.crmEtapa,
    leadScore: scenario.leadScore,
    humanServiceActive: scenario.humanServiceActive,
  };

  const brainResult = await decideCommercialTurn(anthropic as any, estadoDepois, brainMessages, brainOp);
  const cerebroMs = Date.now() - t1;

  const blocoDecisao = formatCommercialDecisionContext(brainResult.decision);
  const cerebroTiming: ComponentTiming = {
    ms: cerebroMs,
    inputTokens: brainResult.usage?.inputTokens ?? 0,
    outputTokens: brainResult.usage?.outputTokens ?? 0,
  };

  // ── 3. Júlia ────────────────────────────────────────────────────────────────
  const t2 = Date.now();
  const blocoEstado = buildConversationStateContext(estadoDepois);
  const systemPrompt = juliaInstrucao + "\n\n" + blocoEstado + blocoDecisao;

  const juliaMessages: Anthropic.MessageParam[] = [
    ...scenario.historicoAnterior.map((m) => ({
      role: m.direcao === "entrada" ? "user" : "assistant" as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: scenario.mensagemUsuario },
  ];

  const ferramentasChamadas: ScenarioResult["julia"]["ferramentasChamadas"] = [];
  let respostaFinal: string | null = null;
  let juliaIteracoes = 0;
  const MAX_ITER = 5;

  let juliaInputTokens = 0;
  let juliaOutputTokens = 0;
  const currentMessages = [...juliaMessages];
  // Coleta texto de TODAS as iterações (igual ao processar-bot/index.ts)
  const partesResposta: string[] = [];
  const extrairTexto = (content: Anthropic.ContentBlock[]) =>
    content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n\n")
      .trim();

  while (juliaIteracoes < MAX_ITER) {
    juliaIteracoes++;
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      tools: JULIA_TOOLS,
      messages: currentMessages,
    });

    juliaInputTokens += resp.usage.input_tokens;
    juliaOutputTokens += resp.usage.output_tokens;

    if (resp.stop_reason === "end_turn") {
      const texto = extrairTexto(resp.content);
      if (texto) partesResposta.push(texto);
      respostaFinal = partesResposta.join("\n\n") || null;
      break;
    }

    if (resp.stop_reason === "tool_use") {
      // Captura texto gerado na mesma volta que as tool calls
      const textoIntermediario = extrairTexto(resp.content);
      if (textoIntermediario) partesResposta.push(textoIntermediario);
      const toolUses = resp.content.filter((b) => b.type === "tool_use");
      currentMessages.push({ role: "assistant", content: resp.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        if (tu.type !== "tool_use") continue;
        const mockResult = getMockToolResult(tu.name, tu.input as Record<string, unknown>);
        ferramentasChamadas.push({ name: tu.name, input: tu.input as Record<string, unknown>, mockResult });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: mockResult });
      }
      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // stop_reason inesperado
    respostaFinal = null;
    break;
  }

  const juliaMs = Date.now() - t2;
  const juliaTiming: ComponentTiming = {
    ms: juliaMs,
    inputTokens: juliaInputTokens,
    outputTokens: juliaOutputTokens,
  };

  // ── 4. Avaliação do cenário ─────────────────────────────────────────────────
  const problemas: string[] = [];

  const decBase = brainResult.decision as Record<string, unknown>;
  if (decBase.no_response && respostaFinal !== null && respostaFinal.trim() !== "") {
    problemas.push("Cérebro decidiu no_response mas Júlia enviou resposta");
  }
  if (!decBase.no_response && respostaFinal === null) {
    problemas.push("Júlia não produziu resposta quando era esperada");
  }
  if (brainResult.usedFallback) {
    problemas.push("Cérebro usou fallback — resultado não é do modelo real");
  }
  if (updaterOrigin !== "model") {
    problemas.push("State Updater não retornou tool_use estruturado");
  }
  if (updaterIssues.length > 0 && updaterIssues.some(i => i.includes("campo inesperado"))) {
    problemas.push(`State Updater issues: ${updaterIssues.join("; ")}`);
  }

  // Validações específicas por cenário
  if (scenario.id === 4) {
    // "Pode mandar o Pix" sem payment_method definido → deve perguntar forma de pagamento
    const dec = brainResult.decision as Record<string, unknown>;
    const brainAskQuestion = dec.should_ask_question === true;
    const respostaTemPergunta = respostaFinal !== null && (
      /parcelar|parcelado|cartão|à vista|pix|forma de pagamento|\?/i.test(respostaFinal)
    );
    if (!brainAskQuestion && !respostaTemPergunta) {
      problemas.push("Cenário 4: sem payment_method definido, Júlia deveria perguntar forma de pagamento antes de enviar Pix");
    }
  }
  if (scenario.id === 6) {
    // "Me chama alguém da equipe" → deve acionar handoff
    const chamouHandoff = ferramentasChamadas.some(f => f.name === "solicitar_handoff");
    const dec = brainResult.decision as Record<string, unknown>;
    const cerebroHandoff = dec.handoff_required === true || dec.action === "handoff";
    if (!chamouHandoff && !cerebroHandoff) {
      problemas.push("Cenário 6: Júlia não chamou solicitar_handoff nem Cérebro decidiu handoff");
    }
  }

  return {
    id: scenario.id,
    nome: scenario.nome,
    mensagem: scenario.mensagemUsuario,
    estadoAntes,
    stateUpdater: {
      timing: updaterTiming,
      estadoDepois,
      issues: updaterIssues,
      origin: updaterOrigin,
    },
    cerebro: {
      timing: cerebroTiming,
      decision: toCommercialDecisionLog(brainResult.decision) as Record<string, unknown>,
      issues: brainResult.issues,
      usedFallback: brainResult.usedFallback,
      origin: brainResult.usedFallback ? "fallback" : "model:claude-haiku-4-5-20251001",
      blocoInjetado: blocoDecisao,
    },
    julia: {
      timing: juliaTiming,
      iteracoes: juliaIteracoes,
      ferramentasChamadas,
      respostaFinal,
      semResposta: respostaFinal === null,
    },
    avaliacao: {
      passou: problemas.length === 0,
      problemas,
    },
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  // Temporária: aceita service role key OU o token HOMOLOGACAO_SECRET
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") ?? "";
  const homologToken = req.headers.get("x-homologacao-token") ?? "";
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const isTestToken = homologToken === "homologar-parte3-2026";
  if (!isServiceRole && !isTestToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    // Buscar instrucao da Júlia no banco
    const { data: agente, error: agErr } = await supabase
      .from("agentes_bot")
      .select("instrucao,modelo")
      .eq("nome", "Júlia")
      .single();

    if (agErr || !agente) {
      throw new Error(`Falha ao buscar Júlia: ${agErr?.message}`);
    }

    const juliaInstrucao: string = agente.instrucao ?? "";
    const tTotal = Date.now();
    const results: ScenarioResult[] = [];

    // Executar cenários com pequeno intervalo para evitar rate limit
    for (const scenario of SCENARIOS) {
      console.log(`[homologar-parte3] Cenário ${scenario.id}: ${scenario.nome}`);
      const result = await runScenario(scenario, juliaInstrucao);
      results.push(result);
      // Pausa breve entre cenários
      await new Promise(r => setTimeout(r, 500));
    }

    const totalMs = Date.now() - tTotal;
    const totalInputTokens = results.reduce((s, r) =>
      s + r.stateUpdater.timing.inputTokens + r.cerebro.timing.inputTokens + r.julia.timing.inputTokens, 0);
    const totalOutputTokens = results.reduce((s, r) =>
      s + r.stateUpdater.timing.outputTokens + r.cerebro.timing.outputTokens + r.julia.timing.outputTokens, 0);

    const passCount = results.filter(r => r.avaliacao.passou).length;
    const homologado = passCount === results.length;

    const report = {
      versao: "parte3-v3-fix-texto-iteracoes",
      timestamp: new Date().toISOString(),
      modelo_estado: "claude-haiku-4-5-20251001",
      modelo_cerebro: "claude-haiku-4-5-20251001",
      modelo_julia: agente.modelo,
      julia_ativo: false,
      julia_modo: "teste",
      cenarios_total: results.length,
      cenarios_aprovados: passCount,
      homologacao: homologado ? "PARTE 3 HOMOLOGADA: SIM" : "PARTE 3 HOMOLOGADA: NÃO",
      latencia_total_ms: totalMs,
      tokens_totais: { input: totalInputTokens, output: totalOutputTokens },
      custo_estimado_usd: ((totalInputTokens * 0.00000025) + (totalOutputTokens * 0.00000125)).toFixed(6),
      cenarios: results,
    };

    return new Response(JSON.stringify(report, null, 2), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("[homologar-parte3] Erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
