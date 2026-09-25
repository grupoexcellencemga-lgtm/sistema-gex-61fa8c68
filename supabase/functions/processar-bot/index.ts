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
  applyOperationalConversationState,
  buildConversationStateContext,
  mergeConversationState,
  persistConversationState,
  prepareStateUpdaterConversation,
  syncGlobalToProductContext,
  type ConversationState,
  type ConversationStateRepository,
} from "./conversation-state.ts";
import {
  decideCommercialTurn,
  formatCommercialDecisionContext,
  toCommercialDecisionLog,
  type BrainMessage,
  type BrainOperationalContext,
  type CommercialDecision,
} from "./commercial-brain.ts";
import {
  executeJudgePipeline,
  inferToolStatus,
  toJudgeLog,
  type JudgeContext,
  type JudgeToolResult,
} from "./response-judge.ts";
import { resolveActiveAgent, buildAgentConfig, normalizeProductSlug } from "./router.ts";

declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(input: string, opts?: { mean_pool?: boolean; normalize?: boolean }): Promise<Float32Array>;
    };
  };
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
});

const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Marcador que o prompt manda o agente devolver quando não há o que responder.
const SEM_RESPOSTA = "[SEM_RESPOSTA]";

async function isAuthorizedInternalRequest(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization") ?? "";
  if (Boolean(serviceRoleKey) && authorization === `Bearer ${serviceRoleKey}`) return true;

  const internalSecret = req.headers.get("x-processar-bot-secret");
  if (!internalSecret) return false;
  const result = await supabase.rpc("verify_processar_bot_secret", { p_secret: internalSecret });
  if (result.error) {
    console.error("[processar-bot] falha ao validar credencial interna:", result.error.message);
    return false;
  }
  return result.data === true;
}

function throwOnDatabaseError(
  operation: string,
  result: { error?: { message?: string; code?: string } | null },
): void {
  if (!result.error) return;
  const code = result.error.code ? ` code=${result.error.code}` : "";
  throw new Error(`${operation} falhou.${code} ${result.error.message ?? "Erro de banco sem mensagem."}`);
}

const conversationStateRepository: ConversationStateRepository = {
  async compareAndSwap(leadId, expectedVersion, state) {
    const result = await supabase
      .from("leads")
      .update({
        conversation_state: state,
        conversation_state_version: expectedVersion + 1,
      })
      .eq("id", leadId)
      .eq("conversation_state_version", expectedVersion)
      .select("conversation_state, conversation_state_version")
      .maybeSingle();

    if (result.error) return { kind: "error", error: result.error.message };
    if (!result.data) return { kind: "conflict" };
    return {
      kind: "updated",
      state: mergeConversationState(DEFAULT_CONVERSATION_STATE, result.data.conversation_state, {
        preserveProtectedFlags: false,
        allowProtectedChanges: true,
      }).state,
      version: Number(result.data.conversation_state_version),
    };
  },
  async load(leadId) {
    const result = await supabase
      .from("leads")
      .select("conversation_state, conversation_state_version")
      .eq("id", leadId)
      .single();
    throwOnDatabaseError("recarregar conversation_state", result);
    return {
      state: result.data?.conversation_state,
      version: Number(result.data?.conversation_state_version ?? 1),
    };
  },
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "atualizar_lead",
    description: "Atualiza informações cadastrais do lead/contato com dados coletados na conversa.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome completo" },
        email: { type: "string", description: "E-mail" },
        cidade: { type: "string", description: "Cidade onde mora" },
        produto_interesse: { type: "string", description: "Produto ou curso de interesse" },
        empresa_nome: { type: "string", description: "Nome da empresa onde trabalha (B2B)" },
        cargo: { type: "string", description: "Cargo ou função" },
        perfil_lead: { type: "string", enum: ["pf", "pj"], description: "Pessoa física (pf) ou jurídica (pj)" },
      },
    },
  },
  {
    name: "pontuar_lead",
    description: "Define a pontuação de qualificação do lead (0-100) com base no potencial e interesse demonstrado.",
    input_schema: {
      type: "object",
      properties: {
        score: { type: "number", description: "Pontuação de 0 a 100" },
        motivo: { type: "string", description: "Justificativa da pontuação" },
      },
      required: ["score", "motivo"],
    },
  },
  {
    name: "consultar_contexto_lead",
    description: "Retorna o contexto atual do lead: etapa do funil, produto de interesse, origem, temperatura, tags e observações registradas.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "consultar_produtos",
    description: "Retorna a lista de produtos ativos da empresa com nome, descrição, valor e condições de pagamento.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Filtrar por nome do produto (opcional)" },
      },
    },
  },
  {
    name: "registrar_nota",
    description: "Registra uma nota ou observação relevante sobre o lead no histórico de atividades.",
    input_schema: {
      type: "object",
      properties: {
        nota: { type: "string", description: "Texto da nota a ser registrada" },
      },
      required: ["nota"],
    },
  },
  {
    name: "mover_etapa",
    description: "Move o lead para outra etapa do funil de vendas. Use sempre que o comportamento do contato indicar uma mudança real de estágio.",
    input_schema: {
      type: "object",
      properties: {
        etapa: {
          type: "string",
          enum: [
            "Novo lead", "Primeiro contato", "Em conversa", "Interesse identificado",
            "Produto apresentado", "Proposta enviada", "Aguardando decisão",
            "Dados recebidos", "Aguardando pagamento", "Pagamento em conferência",
            "Inscrição confirmada", "Perdido ou sem interesse", "Atendimento humano",
          ],
          description: "Nova etapa do funil",
        },
        motivo: { type: "string", description: "Motivo da mudança de etapa" },
      },
      required: ["etapa"],
    },
  },
  {
    name: "consultar_turmas",
    description: "Consulta as turmas abertas no sistema com datas, local, status e link de pagamento.",
    input_schema: {
      type: "object",
      properties: {
        produto: { type: "string", description: "Filtrar por nome do produto ou turma (opcional)" },
      },
    },
  },
  {
    name: "consultar_pagamento",
    description: "Retorna as chaves Pix oficiais e link de pagamento da turma indicada.",
    input_schema: {
      type: "object",
      properties: {
        turma_nome: { type: "string", description: "Nome da turma para buscar link e chave específicos (opcional)" },
      },
    },
  },
  {
    name: "classificar_lead",
    description: "Classifica o lead como frio, morno ou quente com base no interesse demonstrado.",
    input_schema: {
      type: "object",
      properties: {
        temperatura: {
          type: "string",
          enum: ["frio", "morno", "quente"],
          description: "Classificação: frio = sem interesse claro, morno = interesse mas sem decisão, quente = pronto para comprar",
        },
        motivo: { type: "string", description: "Justificativa da classificação" },
      },
      required: ["temperatura"],
    },
  },
  {
    name: "reservar_vaga",
    description: "Cria uma solicitação para a equipe reservar a vaga. Não confirma que a vaga já foi reservada.",
    input_schema: {
      type: "object",
      properties: {
        turma_nome: { type: "string", description: "Nome da turma ou produto" },
        prazo_pagamento: { type: "string", description: "Data ou prazo combinado para o pagamento" },
        observacoes: { type: "string", description: "Observações adicionais" },
      },
      required: ["turma_nome"],
    },
  },
  {
    name: "cadastrar_aluno",
    description: "Cria uma solicitação para o time cadastrar o aluno. Não confirma que o cadastro já foi realizado.",
    input_schema: {
      type: "object",
      properties: {
        nome_completo: { type: "string", description: "Nome completo do aluno" },
        telefone: { type: "string", description: "Telefone com DDD" },
        email: { type: "string", description: "E-mail" },
        data_nascimento: { type: "string", description: "Data de nascimento" },
        cpf: { type: "string", description: "CPF" },
        turma_nome: { type: "string", description: "Nome da turma ou produto" },
      },
      required: ["nome_completo"],
    },
  },
  {
    name: "agendar_reuniao",
    description: "Cria uma solicitação de reunião para Laura confirmar. Não confirma que a reunião já foi agendada.",
    input_schema: {
      type: "object",
      properties: {
        assunto: { type: "string", description: "Assunto ou objetivo da reunião" },
        tipo: { type: "string", description: "Tipo da reunião (B2B, apresentação, etc.)" },
        data_hora: { type: "string", description: "Data e hora da reunião" },
        contato: { type: "string", description: "Nome e empresa do contato" },
        observacoes: { type: "string", description: "Detalhes adicionais" },
      },
      required: ["assunto"],
    },
  },
  {
    name: "adicionar_grupo_turma",
    description: "Cria uma solicitação para adicionar o aluno ao grupo. Não confirma que ele já foi adicionado.",
    input_schema: {
      type: "object",
      properties: {
        turma_nome: { type: "string", description: "Nome da turma" },
        telefone: { type: "string", description: "Telefone do aluno a ser adicionado" },
      },
      required: ["turma_nome"],
    },
  },
  {
    name: "enviar_material",
    description: "Cria uma solicitação para o time enviar material. Não confirma que o material já foi enviado.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          enum: ["imagem", "pdf", "link", "localizacao", "apresentacao"],
          description: "Tipo de material a enviar",
        },
        descricao: { type: "string", description: "Descrição do material (nome do arquivo, URL ou endereço)" },
      },
      required: ["tipo", "descricao"],
    },
  },
  {
    name: "marcar_nao_contatar",
    description: "Marca o contato para não receber mensagens ativas e desativa o bot.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Motivo para não contatar (pediu stop, irritação, etc.)" },
      },
    },
  },
  {
    name: "criar_tarefa",
    description: "Cria uma tarefa de acompanhamento para a equipe humana.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título da tarefa" },
        descricao: { type: "string", description: "Descrição detalhada" },
        prioridade: { type: "string", enum: ["baixa", "media", "alta"], description: "Prioridade da tarefa" },
        data_vencimento: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" },
      },
      required: ["titulo"],
    },
  },
  {
    name: "solicitar_handoff",
    description: "Transfere o atendimento para um consultor humano. Use quando o lead solicitar falar com humano, tiver dúvidas complexas que você não consegue resolver, ou quando estiver pronto para fechar negócio e precisar de atenção personalizada.",
    input_schema: {
      type: "object",
      properties: {
        resumo: { type: "string", description: "Resumo da conversa e motivo do handoff para o consultor" },
      },
      required: ["resumo"],
    },
  },
];

// ─── Atualizador de Estado (memória persistente por lead) ────────────────────

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
      current_intent: {
        type: "string",
        enum: [...CURRENT_INTENTS],
      },
      explicit_question: { type: ["string", "null"] },
      main_need: { type: ["string", "null"] },
      current_objection: {
        type: ["string", "null"],
        enum: [null, ...OBJECTIONS],
      },
      funnel_stage: {
        type: "string",
        enum: [...FUNNEL_STAGES],
      },
      temperature: { type: "string", enum: [...TEMPERATURES] },
      purchase_intent: { type: "string", enum: [...PURCHASE_INTENTS] },
      information_already_shared: {
        type: "array",
        items: { type: "string", enum: [...SHARED_INFORMATION] },
      },
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
    required: ["preferred_name","current_product","origin","city","current_intent","explicit_question","main_need","current_objection","funnel_stage","temperature","purchase_intent","information_already_shared","known_user_facts","last_julia_question","awaiting","agreed_next_action","payment_method","promised_payment_at","handoff_active","do_not_contact","conversation_summary"],
  },
};

function horaAtualBrasilia(): { hora: number; minuto: number; diaSemana: number } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return { hora: now.getHours(), minuto: now.getMinutes(), diaSemana: now.getDay() };
}

function dentroDoHorario(agente: any): boolean {
  if (agente.ativo_24h) return true;
  const { hora, minuto, diaSemana } = horaAtualBrasilia();
  if (!agente.dias_semana.includes(diaSemana)) return false;
  const [hIni, mIni] = agente.horario_inicio.split(":").map(Number);
  const [hFim, mFim] = agente.horario_fim.split(":").map(Number);
  const agoraMin = hora * 60 + minuto;
  return agoraMin >= hIni * 60 + mIni && agoraMin < hFim * 60 + mFim;
}

// Quebra respostas em bolhas para envio sequencial.
// [[NOVA_MENSAGEM]] é o separador explícito do prompt (prioridade máxima).
// Fallback: separa por parágrafo duplo quando a resposta é longa.
function splitMensagem(resposta: string): string[] {
  const MARCADOR = "[[NOVA_MENSAGEM]]";

  if (resposta.includes(MARCADOR)) {
    return resposta
      .split(MARCADOR)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const matchAss = resposta.match(/^(\*[^\n*]+\*)\n\n/);
  const assinatura = matchAss ? matchAss[1] : null;
  const corpo = assinatura ? resposta.slice(matchAss?.[0].length ?? 0) : resposta;

  const paragrafos = corpo.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  if (paragrafos.length <= 1 || resposta.length < 300) return [resposta];

  // Move a primeira pergunta intermediária para o final
  for (let i = 0; i < paragrafos.length - 1; i++) {
    if (paragrafos[i].trimEnd().endsWith("?")) {
      paragrafos.push(paragrafos.splice(i, 1)[0]);
      break;
    }
  }

  return paragrafos.map((p, i) =>
    i === 0 && assinatura ? `${assinatura}\n\n${p}` : p
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!(await isAuthorizedInternalRequest(req))) {
    console.warn("[processar-bot] requisição interna não autorizada bloqueada");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Modo direto: webhook passou um leadId específico para resposta imediata
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* body vazio do cron */ }
    const forceLeadId: string | undefined = body?.forceLeadId;
    const delayMs: number = body?.delayMs ?? 0;

    if (forceLeadId) {
      console.log(`[processar-bot] modo direto para lead ${forceLeadId}, delay ${delayMs}ms`);
      // Aguarda o delay (para a pessoa terminar de digitar)
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    } else {
      console.log("[processar-bot] iniciando ciclo cron");
    }

    // Busca todos os agentes ativos
    const { data: agentes, error: agErr } = await supabase
      .from("agentes_bot")
      .select("*")
      .eq("ativo", true);

    if (agErr) throw agErr;
    if (!agentes?.length) {
      console.log("[processar-bot] nenhum agente ativo");
      return new Response(JSON.stringify({ ok: true, processados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processados = 0;

    for (const agente of agentes) {
      // sombra = escreve e nao envia | teste = envia so para o numero do dono
      // copiloto = deixa pronto para o humano | ativo = fala com o cliente
      const modoAgente: string = agente.modo ?? "sombra";

      // Verifica horário
      if (!dentroDoHorario(agente)) {
        console.log(`[processar-bot] agente ${agente.nome} fora do horário`);

        // Se for modo direto (forceLeadId), envia mensagem de fora de horário uma vez.
        // Só no modo ativo: este ramo fala com o cliente de verdade, e nos modos
        // de avaliação nada pode sair — nem o aviso de horário.
        if (modoAgente === "ativo" && forceLeadId && agente.canais_ids?.length) {
          const { data: leadFora } = await supabase
            .from("leads")
            .select("id, nome, contato_id, canal_id, empresa_id")
            .eq("id", forceLeadId)
            .eq("empresa_id", agente.empresa_id)
            .eq("bot_ativo", true)
            .in("canal_id", agente.canais_ids)
            .in("tipo_contato", ["lead", "aluno"])
            .is("deleted_at", null)
            .maybeSingle();

          if (leadFora) {
            // Verifica se já enviou mensagem de fora-de-horário neste mesmo dia
            const hoje = new Date().toISOString().split("T")[0];
            const { data: jaRespondeu } = await supabase
              .from("mensagens_crm")
              .select("id")
              .eq("lead_id", leadFora.id)
              .eq("direcao", "saida")
              .gte("created_at", `${hoje}T00:00:00Z`)
              .ilike("conteudo", "%fora do horário%")
              .limit(1)
              .maybeSingle();

            if (!jaRespondeu) {
              const { data: canalFora } = await supabase
                .from("canais_crm")
                .select("evolution_url, evolution_token, evolution_instancia")
                .eq("id", leadFora.canal_id)
                .maybeSingle();

              if (canalFora?.evolution_instancia) {
                const apiKeyFora = canalFora.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
                const assinatura = `*${agente.nome} - Comercial GEx*`;
                const msgFora = agente.horario_inicio && agente.horario_fim
                  ? `${assinatura}\nOi! Recebi sua mensagem. Nosso atendimento é das ${agente.horario_inicio.substring(0,5)} às ${agente.horario_fim.substring(0,5)}. Em breve um de nossos consultores retorna com você!`
                  : `${assinatura}\nOi! Recebi sua mensagem e retornaremos em breve. Nosso time está fora do horário de atendimento no momento.`;

                await fetch(
                  `${canalFora.evolution_url}/message/sendText/${canalFora.evolution_instancia}`,
                  {
                    method: "POST",
                    headers: { apikey: apiKeyFora!, "Content-Type": "application/json" },
                    body: JSON.stringify({ number: leadFora.contato_id, text: msgFora }),
                  }
                );

                // Busca protocolo ativo para linkar
                const { data: protFora } = await supabase
                  .from("protocolos_atendimento")
                  .select("id").eq("lead_id", leadFora.id).eq("status", "ativo").maybeSingle();

                await supabase.from("mensagens_crm").insert({
                  lead_id: leadFora.id,
                  empresa_id: agente.empresa_id,
                  conteudo: msgFora,
                  direcao: "saida",
                  canal: "whatsapp",
                  protocolo_id: protFora?.id ?? null,
                });
                await supabase.rpc("marcar_bot_respondido", { p_lead_id: leadFora.id });
                console.log(`[processar-bot] mensagem fora-de-horário enviada para lead ${leadFora.id}`);
              }
            }
          }
        }
        continue;
      }

      if (!agente.canais_ids?.length) continue;

      let leads: any[] | null = null;

      // bot_ativo = true significa que o lead ainda não foi atendido por humano.
      // O trigger trg_humano_desativa_bot seta false automaticamente quando
      // qualquer humano responde. Julia só processa leads com bot_ativo = true
      // em todos os modos, inclusive sombra/teste.
      const exigeBotAtivo = true;

      if (forceLeadId) {
        // Modo direto: processa o lead específico sem exigir status "fila"
        let q = supabase
          .from("leads")
          .select("id, nome, contato_id, canal_id, empresa_id, lead_score, produto_interesse, origem, etapa_id, bot_ativo, status_atendimento, atendente_id, conversation_state, conversation_state_version")
          .eq("id", forceLeadId)
          .eq("empresa_id", agente.empresa_id)
          .in("canal_id", agente.canais_ids)
          .in("tipo_contato", ["lead", "aluno"])
          .is("deleted_at", null);
        if (exigeBotAtivo) q = q.eq("bot_ativo", true);
        const { data } = await q.maybeSingle();
        leads = data ? [data] : [];
      } else {
        // Modo cron: busca leads aguardando além do tempo configurado
        const cutoff = new Date(Date.now() - agente.tempo_espera_minutos * 60 * 1000).toISOString();
        let q = supabase
          .from("leads")
          .select("id, nome, contato_id, canal_id, empresa_id, lead_score, produto_interesse, origem, etapa_id, bot_ativo, status_atendimento, atendente_id, conversation_state, conversation_state_version")
          .eq("empresa_id", agente.empresa_id)
          .eq("status_atendimento", "fila")
          .in("canal_id", agente.canais_ids)
          .in("tipo_contato", ["lead", "aluno"])
          .lt("ultima_mensagem_em", cutoff)
          .is("deleted_at", null)
          .not("ultima_mensagem_em", "is", null);
        if (exigeBotAtivo) q = q.eq("bot_ativo", true);
        // Em modos de avaliação limita o volume por rodada.
        if (modoAgente !== "ativo") q = q.limit(15);
        const { data } = await q;
        leads = data;
      }

      if (!leads?.length) continue;

      for (const lead of leads) {
        // Verifica se a última mensagem do lead já foi respondida pelo bot
        const { data: ultimaMensagem } = await supabase
          .from("mensagens_crm")
          .select("id, conteudo, direcao, bot_respondido")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Só responde se a última mensagem foi de entrada (cliente) e ainda não foi respondida pelo bot
        if (!ultimaMensagem || ultimaMensagem.direcao !== "entrada") continue;
        if (ultimaMensagem.bot_respondido) continue;

        // Nos modos de avaliação nada marca bot_respondido, então sem esta
        // checagem a mesma mensagem seria reavaliada a cada rodada do cron —
        // custo de API multiplicado e registros duplicados na revisão.
        if (modoAgente !== "ativo") {
          const { data: jaAvaliada } = await supabase
            .from("respostas_sombra")
            .select("id")
            .eq("mensagem_entrada_id", ultimaMensagem.id)
            .limit(1)
            .maybeSingle();
          if (jaAvaliada) continue;
        }

        // Busca o protocolo ativo para delimitar o histórico da conversa atual
        const { data: protocoloAtual } = await supabase
          .from("protocolos_atendimento")
          .select("id, created_at")
          .eq("lead_id", lead.id)
          .eq("status", "ativo")
          .maybeSingle();

        // Busca o último protocolo FECHADO para dar contexto do atendimento anterior
        let resumoAnterior = "";
        try {
          const { data: protAnterior } = await supabase
            .from("protocolos_atendimento")
            .select("id, created_at")
            .eq("lead_id", lead.id)
            .eq("status", "finalizado")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (protAnterior) {
            const { data: msgsAnteriores } = await supabase
              .from("mensagens_crm")
              .select("conteudo, direcao")
              .eq("lead_id", lead.id)
              .eq("protocolo_id", protAnterior.id)
              .order("created_at", { ascending: true })
              .limit(10);

            if (msgsAnteriores?.length) {
              const trechos = msgsAnteriores
                .filter((m: any) => m.conteudo && m.conteudo !== "[Mídia]")
                .map((m: any) => `${m.direcao === "entrada" ? "Cliente" : "Bot"}: ${m.conteudo}`)
                .join("\n");
              resumoAnterior = `\n\n---\n# CONTEXTO DO ATENDIMENTO ANTERIOR\nEsta pessoa já conversou com você antes. Resumo do último contato:\n${trechos}\n\nUse esse contexto para não repetir perguntas já feitas e para personalizar o atendimento atual.`;
            }
          }
        } catch (_) { /* ignora — contexto anterior é opcional */ }

        // Busca as N mensagens MAIS RECENTES do protocolo atual
        // Filtra por protocolo_id (mensagens inseridas após correção do webhook)
        // com fallback por created_at para mensagens antigas sem protocolo_id
        let historicoDesc: any[] | null = null;
        if (protocoloAtual) {
          const { data: porId } = await supabase
            .from("mensagens_crm")
            .select("conteudo, direcao, created_at, media_url, tipo")
            .eq("lead_id", lead.id)
            .eq("protocolo_id", protocoloAtual.id)
            .order("created_at", { ascending: false })
            .limit(agente.max_mensagens_contexto);
          // Se não encontrou por id, tenta por created_at (mensagens sem protocolo_id)
          if (!porId?.length) {
            const { data: porData } = await supabase
              .from("mensagens_crm")
              .select("conteudo, direcao, created_at, media_url, tipo")
              .eq("lead_id", lead.id)
              .gte("created_at", protocoloAtual.created_at)
              .order("created_at", { ascending: false })
              .limit(agente.max_mensagens_contexto);
            historicoDesc = porData;
          } else {
            historicoDesc = porId;
          }
        } else {
          const { data: semProtocolo } = await supabase
            .from("mensagens_crm")
            .select("conteudo, direcao, created_at, media_url, tipo")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(agente.max_mensagens_contexto);
          historicoDesc = semProtocolo;
        }

        // Reverte para ordem cronológica
        const historico = (historicoDesc ?? []).reverse();

        // Monta mensagens para Anthropic
        // [Mídia] e [Imagem] são preservados como avisos; não fazemos fetch de URLs
        // de imagem pois a API pode travar aguardando o download.
        const TIPOS_IMAGEM = new Set(["imagem", "image", "foto", "sticker"]);
        const rawMsgs: Anthropic.MessageParam[] = historico
          .filter((m: any) => m.conteudo || m.media_url)
          .map((m: any) => {
            const role = (m.direcao === "saida" ? "assistant" : "user") as "user" | "assistant";
            if (role === "assistant") {
              return { role, content: m.conteudo ?? "" };
            }
            const ehImagem = m.media_url && TIPOS_IMAGEM.has((m.tipo ?? "").toLowerCase());
            if (ehImagem) {
              return {
                role,
                content: "[A pessoa enviou uma imagem — você não consegue visualizá-la]",
              };
            }
            return {
              role,
              content: (m.conteudo === "[Mídia]" || m.conteudo === "[Imagem]")
                ? "[A pessoa enviou uma mídia (áudio, foto ou vídeo) — você não consegue visualizá-la]"
                : (m.conteudo ?? ""),
            };
          });

        // Remove mensagens consecutivas com o mesmo role,
        // mantendo a ÚLTIMA (mais recente) de cada sequência consecutiva
        const deduped: Anthropic.MessageParam[] = [];
        for (const m of rawMsgs) {
          if (deduped.length > 0 && deduped[deduped.length - 1].role === m.role) {
            deduped[deduped.length - 1] = m; // substitui pela mais recente
          } else {
            deduped.push(m);
          }
        }

        // Garante que começa com "user" (descarta mensagens de bot no início)
        const firstUserIdx = deduped.findIndex(m => m.role === "user");
        if (firstUserIdx === -1) continue;
        const messages = deduped.slice(firstUserIdx);

        // Monta Base de Conhecimento com produtos, turmas e eventos do sistema
        let baseConhecimento = "";
        try {
          const hoje = new Date().toISOString().split("T")[0];

          const [{ data: produtos }, { data: turmas }, { data: eventos }] = await Promise.all([
            supabase.from("produtos").select("nome, descricao, tipo, valor, parcelas_cartao, valor_parcela, duracao")
              .eq("empresa_id", agente.empresa_id).is("deleted_at", null).order("nome"),
            supabase.from("turmas").select("nome, cidade, modalidade, data_inicio, data_fim, status, produtos(nome)")
              .eq("empresa_id", agente.empresa_id).is("deleted_at", null).gte("data_fim", hoje).order("data_inicio"),
            supabase.from("eventos").select("nome, tipo, data, local, valor, pago, descricao, status, limite_participantes")
              .eq("empresa_id", agente.empresa_id).is("deleted_at", null).gte("data", hoje).order("data"),
          ]);

          const linhas: string[] = ["\n\n---\n# BASE DE CONHECIMENTO ATUAL DO SISTEMA\n"];

          if (produtos?.length) {
            linhas.push("## PRODUTOS / CURSOS");
            for (const p of produtos) {
              let linha = `- **${p.nome}**`;
              if (p.tipo) linha += ` (${p.tipo})`;
              if (p.descricao) linha += `: ${p.descricao}`;
              if (p.valor) linha += ` | Valor: R$ ${Number(p.valor).toFixed(2)}`;
              if (p.parcelas_cartao && p.valor_parcela) linha += ` ou ${p.parcelas_cartao}x R$ ${Number(p.valor_parcela).toFixed(2)}`;
              if (p.duracao) linha += ` | Duração: ${p.duracao}`;
              linhas.push(linha);
            }
          }

          if (turmas?.length) {
            linhas.push("\n## TURMAS ABERTAS");
            for (const t of turmas as any[]) {
              let linha = `- **${(t.produtos as any)?.nome ?? t.nome}**`;
              if (t.cidade) linha += ` — ${t.cidade}`;
              if (t.modalidade) linha += ` (${t.modalidade})`;
              if (t.data_inicio) linha += ` | Início: ${t.data_inicio}`;
              if (t.data_fim) linha += ` | Fim: ${t.data_fim}`;
              if (t.status) linha += ` | Status: ${t.status}`;
              linhas.push(linha);
            }
          }

          if (eventos?.length) {
            linhas.push("\n## EVENTOS PRÓXIMOS");
            for (const e of eventos) {
              let linha = `- **${e.nome}**`;
              if (e.tipo) linha += ` (${e.tipo})`;
              if (e.data) linha += ` | Data: ${e.data}`;
              if (e.local) linha += ` | Local: ${e.local}`;
              if (e.pago && e.valor) linha += ` | R$ ${Number(e.valor).toFixed(2)}`;
              else if (!e.pago) linha += ` | Gratuito`;
              if (e.descricao) linha += ` | ${e.descricao}`;
              linhas.push(linha);
            }
          }

          linhas.push("\n---\nUtilize estas informações para responder perguntas sobre cursos, turmas, datas e eventos. Não invente dados além dos listados acima.");
          baseConhecimento = linhas.join("\n");
        } catch (kbErr) {
          console.error("[processar-bot] erro ao buscar base de conhecimento:", kbErr);
        }

        // Perfil do contato: aluno ativo, ex-aluno ou lead novo
        let perfilContato = "lead novo (nunca matriculado)";
        try {
          const telDigits = lead.contato_id.replace(/\D/g, "");
          const tel10 = telDigits.slice(-10);
          const tel11 = telDigits.slice(-11);
          const { data: alunoEncontrado } = await supabase
            .from("alunos")
            .select("id, nome")
            .eq("empresa_id", agente.empresa_id)
            .is("deleted_at", null)
            .or(`telefone.ilike.%${tel11},telefone.ilike.%${tel10}`)
            .limit(1)
            .maybeSingle();

          if (alunoEncontrado) {
            const { count: matriculasAtivas } = await supabase
              .from("matriculas")
              .select("id", { count: "exact", head: true })
              .eq("aluno_id", alunoEncontrado.id)
              .eq("status", "ativo")
              .is("deleted_at", null);
            perfilContato = (matriculasAtivas ?? 0) > 0
              ? "aluno ativo (já matriculado em pelo menos um curso)"
              : "ex-aluno (já estudou aqui mas sem matrícula ativa no momento)";
          }
        } catch (_) {}

        // Etapa e temperatura do lead injetadas no contexto
        let etapaNome: string | null = null;
        try {
          if ((lead as any).etapa_id) {
            const { data: etapaLead } = await supabase
              .from("funil_etapas")
              .select("nome")
              .eq("id", (lead as any).etapa_id)
              .maybeSingle();
            etapaNome = etapaLead?.nome ?? null;
          }
        } catch (_) {}

        const score = lead.lead_score ?? 0;
        const temperaturaNome = score >= 61 ? "quente" : score >= 31 ? "morno" : score > 0 ? "frio" : null;

        // Contexto do contato (nome + telefone + perfil + dados do funil) injetado no system prompt
        const nomeContato = lead.nome && lead.nome !== lead.contato_id ? lead.nome : null;
        const linhasCtx: string[] = [`\n\n---\n# CONTATO ATUAL`];
        if (nomeContato) linhasCtx.push(`Nome: ${nomeContato}`);
        linhasCtx.push(`Telefone: ${lead.contato_id}`);
        linhasCtx.push(`Perfil: ${perfilContato}`);
        if (etapaNome) linhasCtx.push(`Etapa no funil: ${etapaNome}`);
        if ((lead as any).produto_interesse) linhasCtx.push(`Produto de interesse: ${(lead as any).produto_interesse}`);
        if (temperaturaNome) linhasCtx.push(`Temperatura: ${temperaturaNome} (score ${score})`);
        if ((lead as any).origem) linhasCtx.push(`Origem: ${(lead as any).origem}`);
        if (nomeContato) linhasCtx.push(`Use o nome da pessoa naturalmente na conversa quando fizer sentido.`);
        const contextoContato = linhasCtx.join("\n");

        // Ficha que a IA mantém do contato: dores, momento, objeções e
        // compromissos de conversas anteriores, que o histórico recente sozinho
        // não mostra.
        let fichaContato = "";
        try {
          const { data: fichaSalva } = await supabase
            .from("leads_ficha_ia")
            .select("ficha")
            .eq("lead_id", lead.id)
            .maybeSingle();
          if (fichaSalva?.ficha) {
            fichaContato =
              `\n\n# FICHA DO CONTATO\nResumo interno das conversas anteriores. Use para entender a pessoa; não cite a ficha para ela.\n` +
              JSON.stringify(fichaSalva.ficha, null, 2);
          }
        } catch (_) {}

        // Registra início da sessão na conversas_ia.
        // conversas_ia mede as conversas reais que o bot teve com clientes. Nos
        // modos de avaliação a sessão nunca é finalizada (o fluxo desvia antes),
        // então registrar aqui criaria conversas "abandonadas" que distorcem o
        // Analytics. A avaliação tem a própria tabela, respostas_sombra.
        let conversaId: string | null = null;
        const totalMsgsHistorico = messages.length;
        if (modoAgente === "ativo") try {
          const { data: novaConversa } = await supabase
            .from("conversas_ia")
            .insert({
              empresa_id: agente.empresa_id,
              lead_id: lead.id,
              agente_id: agente.id,
              protocolo_id: protocoloAtual?.id ?? null,
              total_mensagens: totalMsgsHistorico,
              score_inicial: lead.lead_score ?? null,
            })
            .select("id")
            .single();
          conversaId = novaConversa?.id ?? null;
        } catch (_) {}

        // RAG: busca conhecimento semântico relevante para a última mensagem do lead
        let conhecimentoRag = "";
        try {
          const ultimaUserMsg = [...messages].reverse().find((m) => m.role === "user");
          const ultimaMsgTexto = typeof ultimaUserMsg?.content === "string"
            ? ultimaUserMsg.content
            : (ultimaUserMsg?.content as any[])?.find((b: any) => b.type === "text")?.text ?? "";
          if (ultimaMsgTexto) {
            const ragSession = new Supabase.ai.Session("gte-small");
            const queryEmbedding = await ragSession.run(ultimaMsgTexto, { mean_pool: true, normalize: true });
            const { data: chunks } = await supabase.rpc("buscar_conhecimento", {
              p_empresa_id: agente.empresa_id,
              p_agente_id: agente.id,
              p_embedding: Array.from(queryEmbedding),
              p_limite: 3,
              p_limiar: 0.25,
            });
            if (chunks?.length) {
              const linhasRag = (chunks as any[]).map((c) =>
                `### ${c.titulo}${c.categoria ? ` (${c.categoria})` : ""}\n${c.conteudo}`
              ).join("\n\n");
              conhecimentoRag = `\n\n---\n# CONHECIMENTO RELEVANTE\nUse estas informações para embasar sua resposta:\n\n${linhasRag}\n---`;
              console.log(`[processar-bot] RAG: ${chunks.length} chunk(s) encontrado(s)`);
            }
          }
        } catch (ragErr) {
          console.error("[processar-bot] RAG erro:", ragErr);
        }

        // ── Atualizador de Estado ─────────────────────────────────────────────
        // Roda ANTES de Júlia. Analisa a última mensagem e atualiza o estado
        // persistente para dar memória entre conversas.
        const estadoBase = mergeConversationState(
          DEFAULT_CONVERSATION_STATE,
          (lead as any).conversation_state,
          { preserveProtectedFlags: false, allowProtectedChanges: true },
        ).state;
        const estadoInicial = applyOperationalConversationState(estadoBase, {
          handoffActive: (lead as any).bot_ativo === false && (
            Boolean((lead as any).atendente_id) || (lead as any).status_atendimento === "em_atendimento"
          ),
        });
        let estadoAtualizado: ConversationState = estadoInicial;
        let estadoVersionAtual = Number((lead as any).conversation_state_version ?? 1);
        try {
          const preparedStateInput = prepareStateUpdaterConversation(historico.map((m: any) => ({
            direction: m.direcao,
            content: m.conteudo,
            mediaType: m.tipo,
          })));

          const stateResp = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 800,
            system: PROMPT_ATUALIZADOR_ESTADO,
            tools: [TOOL_ESTADO],
            tool_choice: { type: "any" } as any,
            messages: [{
              role: "user",
              content: `ESTADO ATUAL:\n${JSON.stringify(estadoInicial, null, 2)}\n\nHISTÓRICO RECENTE (sem duplicar a última mensagem):\n${preparedStateInput.history || "(sem histórico anterior)"}\n\nÚLTIMA MENSAGEM DO USUÁRIO:\n${preparedStateInput.latestUserMessage}`,
            }],
          });

          const toolBlock = stateResp.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
          if (toolBlock) {
            const persisted = await persistConversationState({
              leadId: lead.id,
              mode: modoAgente,
              previousState: estadoInicial,
              expectedVersion: estadoVersionAtual,
              updaterOutput: toolBlock.input,
              repository: conversationStateRepository,
              postMerge: (state) => {
                const slug = normalizeProductSlug(state.current_product);
                return slug ? syncGlobalToProductContext(state, slug) : state;
              },
            });
            estadoAtualizado = persisted.state;
            estadoVersionAtual = persisted.version;
            if (persisted.issues.length) {
              console.warn(`[processar-bot] state updater normalizado lead=${lead.id} issues=${persisted.issues.join(" | ")}`);
            }
            if (persisted.kind === "persisted") {
              console.log(`[processar-bot] conversation_state confirmado lead=${lead.id} version=${persisted.version} retry=${persisted.conflictRetried === true}`);
            } else if (persisted.kind === "memory_only") {
              console.log(`[processar-bot] conversation_state somente em memória lead=${lead.id} modo=${modoAgente}`);
            } else {
              console.error(`[processar-bot] falha ao persistir conversation_state lead=${lead.id} version=${estadoVersionAtual} retry=${persisted.conflictRetried === true}: ${persisted.error}`);
            }
          } else {
            console.warn(`[processar-bot] state updater sem tool_use lead=${lead.id}; estado anterior preservado`);
          }
        } catch (stateErr) {
          console.error(`[processar-bot] erro no atualizador de estado lead=${lead.id}; estado anterior preservado:`, stateErr);
        }

        const blocoEstado = buildConversationStateContext(estadoAtualizado);

        // ─── Router de Agente ─────────────────────────────────────────────────
        const routingDecision = resolveActiveAgent(estadoAtualizado);
        const _agentConfig = buildAgentConfig(routingDecision);
        estadoAtualizado = {
          ...estadoAtualizado,
          previous_agent: routingDecision.changed ? estadoAtualizado.current_agent : estadoAtualizado.previous_agent,
          previous_product: routingDecision.changed ? estadoAtualizado.current_product : estadoAtualizado.previous_product,
          current_agent: routingDecision.agent_key,
          routing_reason: routingDecision.routing_reason,
        };
        console.log(`[processar-bot] router lead=${lead.id} agent=${routingDecision.agent_key} action=${routingDecision.routing_action} changed=${routingDecision.changed} product_contexts=${Object.keys(estadoAtualizado.product_contexts).join(",") || "∅"}`);
        // ─────────────────────────────────────────────────────────────────────

        // ─── Cérebro Comercial: decide a estratégia antes de Júlia responder ──
        const brainMessages: BrainMessage[] = historico.map((m: any) => ({
          direction: m.direcao as "entrada" | "saida",
          content: m.conteudo as string | null,
          mediaType: m.tipo as string | null,
        }));
        const brainOperational: BrainOperationalContext = {
          agentMode: modoAgente,
          crmStage: (lead as any).etapa_atual ?? null,
          leadScore: (lead as any).pontuacao ?? null,
          humanServiceActive: (lead as any).atendente_id != null,
        };
        let blocoDecisao = "";
        let lastBrainDecision: CommercialDecision | null = null;
        try {
          const brainResult = await decideCommercialTurn(anthropic as any, estadoAtualizado, brainMessages, brainOperational);
          if (brainResult.issues.length) {
            console.warn(`[processar-bot] cerebro-comercial issues lead=${lead.id}: ${brainResult.issues.join(" | ")}`);
          }
          console.log(`[processar-bot] cerebro-comercial lead=${lead.id} fallback=${brainResult.usedFallback}`, toCommercialDecisionLog(brainResult.decision));
          blocoDecisao = formatCommercialDecisionContext(brainResult.decision);
          lastBrainDecision = brainResult.decision;
        } catch (brainErr) {
          console.error(`[processar-bot] cerebro-comercial erro lead=${lead.id}:`, brainErr);
        }
        // ─────────────────────────────────────────────────────────────────────

        // Loop agentic com tool use (máx 5 iterações)
        console.log(`[processar-bot] respondendo lead ${lead.id} com agente ${agente.nome}`);
        const systemPrompt = agente.instrucao + baseConhecimento + conhecimentoRag + resumoAnterior + contextoContato + fichaContato + blocoEstado + blocoDecisao;
        let loopMessages: Anthropic.MessageParam[] = [...messages];
        let resposta: string | null = null;
        let handoff = false;
        let resumoHandoff: string | null = null;
        let totalIteracoes = 0;
        const MAX_ITER = 5;
        // O que o agente TERIA feito, quando ele não está em modo ativo.
        const ferramentasIntencionadas: { nome: string; input: unknown }[] = [];
        // Soma de todas as voltas do laço de ferramentas, para medir o custo
        // real de cada avaliação.
        let tokensEntrada = 0;
        let tokensSaida = 0;
        // O Claude pode escrever a resposta ao cliente E chamar uma ferramenta
        // na mesma volta. Antes esse texto era descartado: o laço executava a
        // ferramenta, e na volta seguinte o modelo — que já tinha dito o que
        // queria — encerrava sem texto novo. A resposta ficava nula e o cliente
        // ficava sem retorno, em silêncio. Juntamos o texto de todas as voltas.
        const partesResposta: string[] = [];
        const judgeToolResults: JudgeToolResult[] = [];
        const extrairTexto = (content: Anthropic.ContentBlock[]) =>
          content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n\n")
            .trim();
        const persistirEstadoOperacional = async (
          patch: Partial<ConversationState>,
          operacao: string,
        ) => {
          const persisted = await persistConversationState({
            leadId: lead.id,
            mode: "ativo",
            previousState: estadoAtualizado,
            expectedVersion: estadoVersionAtual,
            updaterOutput: patch,
            repository: conversationStateRepository,
            allowProtectedChanges: true,
          });
          estadoAtualizado = persisted.state;
          estadoVersionAtual = persisted.version;
          if (!persisted.persisted) {
            throw new Error(`${operacao}: não foi possível confirmar conversation_state: ${persisted.error ?? "erro desconhecido"}`);
          }
          console.log(`[processar-bot] ${operacao} sincronizado lead=${lead.id} state_version=${estadoVersionAtual}`);
        };

        for (let iter = 0; iter < MAX_ITER; iter++) {
          const response = await anthropic.messages.create({
            model: agente.modelo,
            max_tokens: 1024,
            system: systemPrompt,
            tools: TOOLS,
            messages: loopMessages,
          });
          tokensEntrada += response.usage?.input_tokens ?? 0;
          tokensSaida += response.usage?.output_tokens ?? 0;

          if (response.stop_reason === "end_turn") {
            const texto = extrairTexto(response.content);
            if (texto) partesResposta.push(texto);
            resposta = partesResposta.join("\n\n") || null;
            // Fallback legado: [HANDOFF] no texto
            if (resposta?.includes("[HANDOFF]")) {
              resposta = resposta.replace(/\[HANDOFF\]/g, "").trim();
              handoff = true;
              if (modoAgente === "ativo") {
                const legacyHandoff = await supabase.from("leads").update({ bot_ativo: false }).eq("id", lead.id);
                throwOnDatabaseError("handoff por marcador de texto", legacyHandoff);
                await persistirEstadoOperacional({
                  handoff_active: true,
                  funnel_stage: "atendimento_humano",
                  awaiting: "human",
                }, "handoff legado");
              }
              console.log(`[processar-bot] handoff (texto) para lead ${lead.id}`);
            }
            break;
          }

          if (response.stop_reason === "tool_use") {
            totalIteracoes++;
            const textoComFerramenta = extrairTexto(response.content);
            if (textoComFerramenta) partesResposta.push(textoComFerramenta);
            const assistantMessage: Anthropic.MessageParam = { role: "assistant", content: response.content };
            loopMessages = [...loopMessages, assistantMessage];
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
              if (block.type !== "tool_use") continue;
              const input = block.input as Record<string, any>;
              let resultado = "ok";

              // Fora do modo ativo a ferramenta é registrada, nunca executada:
              // mover_etapa, criar_tarefa e solicitar_handoff alteram dados
              // reais, e isso quebraria a promessa de avaliação sem risco.
              // O agente recebe um "ok" para a conversa seguir naturalmente.
              if (modoAgente !== "ativo") {
                ferramentasIntencionadas.push({ nome: block.name, input });
                judgeToolResults.push({
                  tool: block.name,
                  input,
                  resultado: "ok",
                  success: true,
                  status: inferToolStatus(block.name, "ok"),
                });
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: "ok",
                });
                continue;
              }

              try {
                if (block.name === "atualizar_lead") {
                  const campos: Record<string, any> = {};
                  const permitidos = ["nome", "email", "cidade", "produto_interesse", "empresa_nome", "cargo", "perfil_lead"];
                  for (const k of permitidos) if (input[k] !== undefined) campos[k] = input[k];
                  if (Object.keys(campos).length > 0) {
                    const updateLead = await supabase.from("leads").update(campos).eq("id", lead.id);
                    throwOnDatabaseError("atualizar_lead", updateLead);
                    resultado = `Lead atualizado: ${JSON.stringify(campos)}`;
                    console.log(`[processar-bot] atualizar_lead lead=${lead.id}`, campos);
                  }

                } else if (block.name === "pontuar_lead") {
                  const score = Math.max(0, Math.min(100, Math.round(Number(input.score))));
                  const scoreUpdate = await supabase.from("leads").update({ lead_score: score }).eq("id", lead.id);
                  throwOnDatabaseError("pontuar_lead", scoreUpdate);
                  const scoreActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Score definido: ${score}/100 — ${input.motivo}`,
                  });
                  throwOnDatabaseError("registrar atividade de pontuação", scoreActivity);
                  resultado = `Score ${score} registrado`;
                  console.log(`[processar-bot] pontuar_lead lead=${lead.id} score=${score}`);

                } else if (block.name === "consultar_contexto_lead") {
                  try {
                    const { data: leadCtx } = await supabase
                      .from("leads")
                      .select("nome, email, telefone, cidade, produto_interesse, origem, observacoes, lead_score, empresa_nome, cargo, perfil_lead, etapa_id")
                      .eq("id", lead.id)
                      .maybeSingle();
                    let linhas: string[] = [];
                    if (leadCtx) {
                      if (leadCtx.nome) linhas.push(`Nome: ${leadCtx.nome}`);
                      if (leadCtx.email) linhas.push(`E-mail: ${leadCtx.email}`);
                      if (leadCtx.telefone) linhas.push(`Telefone: ${leadCtx.telefone}`);
                      if (leadCtx.cidade) linhas.push(`Cidade: ${leadCtx.cidade}`);
                      if (leadCtx.produto_interesse) linhas.push(`Produto de interesse: ${leadCtx.produto_interesse}`);
                      if (leadCtx.origem) linhas.push(`Origem: ${leadCtx.origem}`);
                      if (leadCtx.empresa_nome) linhas.push(`Empresa: ${leadCtx.empresa_nome}`);
                      if (leadCtx.cargo) linhas.push(`Cargo: ${leadCtx.cargo}`);
                      if (leadCtx.perfil_lead) linhas.push(`Perfil: ${leadCtx.perfil_lead}`);
                      if (leadCtx.lead_score) linhas.push(`Score: ${leadCtx.lead_score}`);
                      if (leadCtx.observacoes) linhas.push(`Observações: ${leadCtx.observacoes}`);
                      if (leadCtx.etapa_id) {
                        const { data: etapaCtx } = await supabase
                          .from("funil_etapas")
                          .select("nome")
                          .eq("id", leadCtx.etapa_id)
                          .maybeSingle();
                        if (etapaCtx?.nome) linhas.push(`Etapa: ${etapaCtx.nome}`);
                      }
                    }
                    const { data: tagsLead } = await supabase
                      .from("lead_tags")
                      .select("tags_crm(nome)")
                      .eq("lead_id", lead.id);
                    if (tagsLead?.length) {
                      const nomesTags = tagsLead.map((t: any) => t.tags_crm?.nome).filter(Boolean);
                      if (nomesTags.length) linhas.push(`Tags: ${nomesTags.join(", ")}`);
                    }
                    resultado = linhas.length ? linhas.join("\n") : "Sem dados adicionais registrados.";
                  } catch (e) {
                    resultado = "Erro ao consultar contexto do lead.";
                  }
                  console.log(`[processar-bot] consultar_contexto_lead lead=${lead.id}`);

                } else if (block.name === "consultar_produtos") {
                  try {
                    let q = supabase
                      .from("produtos")
                      .select("nome, descricao, valor, parcelas_cartao, valor_parcela, tipo, duracao")
                      .eq("empresa_id", agente.empresa_id)
                      .is("deleted_at", null)
                      .order("nome");
                    if (input.nome) {
                      q = q.ilike("nome", `%${input.nome}%`);
                    }
                    const { data: prodList } = await q;
                    if (!prodList?.length) {
                      resultado = "Nenhum produto encontrado.";
                    } else {
                      resultado = prodList.map((p: any) => {
                        let linha = `**${p.nome}**`;
                        if (p.tipo) linha += ` (${p.tipo})`;
                        if (p.duracao) linha += ` | Duração: ${p.duracao}`;
                        if (p.valor) linha += ` | Valor: R$ ${Number(p.valor).toFixed(2)}`;
                        if (p.parcelas_cartao && p.valor_parcela) linha += ` | ${p.parcelas_cartao}x R$ ${Number(p.valor_parcela).toFixed(2)}`;
                        if (p.descricao) linha += `\n  ${p.descricao}`;
                        return linha;
                      }).join("\n");
                    }
                  } catch (e) {
                    resultado = "Erro ao consultar produtos.";
                  }
                  console.log(`[processar-bot] consultar_produtos lead=${lead.id}`);

                } else if (block.name === "registrar_nota") {
                  const notaInsert = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] ${input.nota}`,
                  });
                  throwOnDatabaseError("registrar_nota", notaInsert);
                  resultado = "Nota registrada";
                  console.log(`[processar-bot] registrar_nota lead=${lead.id}`);

                } else if (block.name === "mover_etapa") {
                  // Busca o funil_card do lead para pegar o quadro_id
                  const { data: card } = await supabase
                    .from("funil_cards")
                    .select("id, quadro_id")
                    .eq("lead_id", lead.id)
                    .limit(1)
                    .maybeSingle();

                  const etapaQuery = card?.quadro_id
                    ? supabase.from("funil_etapas").select("id").eq("quadro_id", card.quadro_id).ilike("nome", input.etapa).limit(1)
                    : supabase.from("funil_etapas").select("id").eq("empresa_id", agente.empresa_id).ilike("nome", input.etapa).limit(1);
                  const { data: etapaEncontrada } = await etapaQuery.maybeSingle();

                  if (etapaEncontrada?.id) {
                    const etapaLeadUpdate = await supabase.from("leads").update({ etapa_id: etapaEncontrada.id }).eq("id", lead.id);
                    throwOnDatabaseError("mover etapa do lead", etapaLeadUpdate);
                    if (card?.id) {
                      const etapaCardUpdate = await supabase.from("funil_cards").update({ etapa_id: etapaEncontrada.id }).eq("id", card.id);
                      throwOnDatabaseError("mover card do funil", etapaCardUpdate);
                    }
                    resultado = `Etapa movida para "${input.etapa}"`;
                  } else {
                    resultado = `Etapa "${input.etapa}" não encontrada no funil — registre via nota`;
                  }
                  if (input.motivo) {
                    const etapaActivity = await supabase.from("atividades").insert({
                      lead_id: lead.id,
                      empresa_id: agente.empresa_id,
                      tipo: "nota",
                      descricao: `[IA] Etapa movida para "${input.etapa}": ${input.motivo}`,
                    });
                    throwOnDatabaseError("registrar atividade de mudança de etapa", etapaActivity);
                  }
                  console.log(`[processar-bot] mover_etapa lead=${lead.id} etapa=${input.etapa} etapa_id=${etapaEncontrada?.id ?? "não encontrada"}`);

                } else if (block.name === "criar_tarefa") {
                  const tarefaInsert = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: input.titulo,
                    descricao: input.descricao ?? null,
                    prioridade: input.prioridade ?? "media",
                    data_vencimento: input.data_vencimento ?? null,
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("criar_tarefa", tarefaInsert);
                  resultado = "Tarefa criada";
                  console.log(`[processar-bot] criar_tarefa lead=${lead.id} titulo=${input.titulo}`);

                } else if (block.name === "solicitar_handoff") {
                  handoff = true;
                  resumoHandoff = input.resumo ?? null;
                  const handoffLeadUpdate = await supabase.from("leads").update({ bot_ativo: false }).eq("id", lead.id);
                  throwOnDatabaseError("desativar bot para handoff", handoffLeadUpdate);
                  const handoffActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "alerta",
                    descricao: `[IA] Handoff solicitado — ${input.resumo}`,
                  });
                  throwOnDatabaseError("registrar atividade de handoff", handoffActivity);
                  await persistirEstadoOperacional({
                    handoff_active: true,
                    funnel_stage: "atendimento_humano",
                    awaiting: "human",
                  }, "handoff");

                  // Notifica o comercial responsável via WhatsApp
                  try {
                    const { data: leadResp } = await supabase
                      .from("leads")
                      .select("responsavel_id, nome, contato_id")
                      .eq("id", lead.id)
                      .maybeSingle();

                    if (leadResp?.responsavel_id) {
                      const { data: comercial } = await supabase
                        .from("comerciais")
                        .select("nome, telefone")
                        .eq("id", leadResp.responsavel_id)
                        .maybeSingle();

                      if (comercial?.telefone) {
                        const { data: canalHandoff } = await supabase
                          .from("canais_crm")
                          .select("evolution_url, evolution_token, evolution_instancia")
                          .eq("id", lead.canal_id)
                          .maybeSingle();

                        if (canalHandoff?.evolution_instancia) {
                          const apiKeyHandoff = canalHandoff.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
                          const telefone = comercial.telefone.replace(/\D/g, "");
                          const nomeContato = leadResp.nome || leadResp.contato_id;
                          const msgComercial =
                            `*Handoff — Lead aguardando atendimento humano*\n\n` +
                            `Lead: ${nomeContato}\n` +
                            `Telefone: ${leadResp.contato_id}\n\n` +
                            `Resumo da conversa:\n${input.resumo}\n\n` +
                            `Acesse o CRM para dar continuidade ao atendimento.`;

                          const notificationResponse = await fetch(
                            `${canalHandoff.evolution_url}/message/sendText/${canalHandoff.evolution_instancia}`,
                            {
                              method: "POST",
                              headers: { apikey: apiKeyHandoff!, "Content-Type": "application/json" },
                              body: JSON.stringify({ number: telefone, text: msgComercial }),
                            }
                          );
                          if (!notificationResponse.ok) {
                            throw new Error(`Evolution retornou HTTP ${notificationResponse.status}`);
                          }
                          console.log(`[processar-bot] notificação de handoff confirmada lead=${lead.id}`);
                        }
                      }
                    }
                  } catch (notifErr) {
                    console.error("[processar-bot] erro ao notificar comercial:", notifErr);
                  }

                  resultado = "Handoff registrado — bot desativado";
                  console.log(`[processar-bot] handoff (tool) para lead ${lead.id}`);

                } else if (block.name === "consultar_turmas") {
                  const hoje = new Date().toISOString().split("T")[0];
                  const { data: turmasList } = await supabase
                    .from("turmas")
                    .select("nome, cidade, modalidade, data_inicio, data_fim, status, pix_chave, asaas_link_pagamento, produtos(nome)")
                    .eq("empresa_id", agente.empresa_id)
                    .is("deleted_at", null)
                    .gte("data_fim", hoje)
                    .order("data_inicio");
                  if (!turmasList?.length) {
                    resultado = "Nenhuma turma aberta encontrada.";
                  } else {
                    let filtradas = turmasList as any[];
                    if (input.produto) {
                      const needle = String(input.produto).toLowerCase();
                      filtradas = filtradas.filter((t) =>
                        ((t.produtos as any)?.nome ?? t.nome)?.toLowerCase().includes(needle)
                      );
                    }
                    resultado = filtradas.map((t: any) => {
                      const prod = (t.produtos as any)?.nome ?? t.nome;
                      let linha = `${prod}`;
                      if (t.cidade) linha += ` — ${t.cidade}`;
                      if (t.modalidade) linha += ` (${t.modalidade})`;
                      if (t.data_inicio) linha += ` | Início: ${t.data_inicio}`;
                      if (t.data_fim) linha += ` | Fim: ${t.data_fim}`;
                      if (t.status) linha += ` | Status: ${t.status}`;
                      if (t.asaas_link_pagamento) linha += ` | Link pagamento: ${t.asaas_link_pagamento}`;
                      if (t.pix_chave) linha += ` | Pix específico: ${t.pix_chave}`;
                      return linha;
                    }).join("\n") || "Nenhuma turma corresponde ao filtro.";
                  }
                  console.log(`[processar-bot] consultar_turmas lead=${lead.id}`);

                } else if (block.name === "consultar_pagamento") {
                  const pixSicredi = "8fd6bbb9-89a2-4498-9c2d-01b3a3c3cb23";
                  const pixSicoob = "31.674.942/0001-89";
                  let linhasTurma = "";
                  if (input.turma_nome) {
                    const { data: tPag } = await supabase
                      .from("turmas")
                      .select("nome, pix_chave, asaas_link_pagamento")
                      .eq("empresa_id", agente.empresa_id)
                      .ilike("nome", `%${input.turma_nome}%`)
                      .limit(1)
                      .maybeSingle();
                    if (tPag) {
                      linhasTurma = `\nTurma: ${tPag.nome}`;
                      if (tPag.pix_chave) linhasTurma += ` | Pix específico: ${tPag.pix_chave}`;
                      if (tPag.asaas_link_pagamento) linhasTurma += ` | Link pagamento: ${tPag.asaas_link_pagamento}`;
                    }
                  }
                  resultado = `Pix Sicredi (preferencial): ${pixSicredi}\nPix Sicoob CNPJ: ${pixSicoob}${linhasTurma}`;
                  console.log(`[processar-bot] consultar_pagamento lead=${lead.id}`);

                } else if (block.name === "classificar_lead") {
                  const tempMap: Record<string, number> = { frio: 20, morno: 50, quente: 80 };
                  const score = tempMap[input.temperatura] ?? 50;
                  const classificarUpdate = await supabase.from("leads").update({ lead_score: score }).eq("id", lead.id);
                  throwOnDatabaseError("classificar lead", classificarUpdate);
                  const classificarActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Temperatura: ${input.temperatura}${input.motivo ? ` — ${input.motivo}` : ""}`,
                  });
                  throwOnDatabaseError("registrar atividade de classificação", classificarActivity);
                  resultado = `Lead classificado como ${input.temperatura} (score ${score})`;
                  console.log(`[processar-bot] classificar_lead lead=${lead.id} temperatura=${input.temperatura}`);

                } else if (block.name === "reservar_vaga") {
                  const reservaTask = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: `Reserva de vaga — ${input.turma_nome}`,
                    descricao: `Prazo de pagamento: ${input.prazo_pagamento ?? "a combinar"}${input.observacoes ? ` | ${input.observacoes}` : ""}`,
                    prioridade: "alta",
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("solicitar reserva de vaga", reservaTask);
                  const reservaActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Solicitação de reserva criada para ${input.turma_nome}. Pagamento previsto: ${input.prazo_pagamento ?? "a combinar"}.`,
                  });
                  throwOnDatabaseError("registrar solicitação de reserva", reservaActivity);
                  resultado = `Solicitação de reserva criada para ${input.turma_nome}; a vaga ainda depende de confirmação humana`;
                  console.log(`[processar-bot] reservar_vaga lead=${lead.id}`);

                } else if (block.name === "cadastrar_aluno") {
                  const dadosAluno = [
                    input.nome_completo && `Nome: ${input.nome_completo}`,
                    input.telefone && `Telefone: ${input.telefone}`,
                    input.email && `E-mail: ${input.email}`,
                    input.data_nascimento && `Nascimento: ${input.data_nascimento}`,
                    input.cpf && `CPF: (recebido)`,
                    input.turma_nome && `Turma: ${input.turma_nome}`,
                  ].filter(Boolean).join(" | ");
                  const cadastroTask = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: `Cadastrar aluno — ${input.nome_completo ?? lead.nome ?? lead.id}`,
                    descricao: dadosAluno,
                    prioridade: "alta",
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("solicitar cadastro de aluno", cadastroTask);
                  const cadastroActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Dados coletados para cadastro: ${dadosAluno}`,
                  });
                  throwOnDatabaseError("registrar solicitação de cadastro", cadastroActivity);
                  resultado = `Solicitação de cadastro criada para o time; o aluno ainda não foi cadastrado`;
                  console.log(`[processar-bot] cadastrar_aluno lead=${lead.id}`);

                } else if (block.name === "agendar_reuniao") {
                  const reuniaoTask = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: `Reunião: ${input.assunto}`,
                    descricao: [
                      input.tipo && `Tipo: ${input.tipo}`,
                      input.data_hora && `Data/hora: ${input.data_hora}`,
                      input.contato && `Contato: ${input.contato}`,
                      input.observacoes && input.observacoes,
                    ].filter(Boolean).join(" | "),
                    prioridade: "alta",
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("solicitar reunião", reuniaoTask);
                  const reuniaoActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Solicitação de reunião: ${input.assunto}${input.data_hora ? ` em ${input.data_hora}` : ""}. Tarefa criada para Laura.`,
                  });
                  throwOnDatabaseError("registrar solicitação de reunião", reuniaoActivity);
                  resultado = `Solicitação de reunião criada para Laura; o agendamento ainda depende de confirmação`;
                  console.log(`[processar-bot] agendar_reuniao lead=${lead.id}`);

                } else if (block.name === "adicionar_grupo_turma") {
                  const grupoTask = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: `Adicionar ao grupo — ${input.turma_nome}`,
                    descricao: input.telefone ? `Telefone: ${input.telefone}` : "Adicionar ao grupo da turma após confirmação do pagamento.",
                    prioridade: "media",
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("solicitar inclusão no grupo", grupoTask);
                  resultado = `Solicitação criada para o time adicionar ao grupo de ${input.turma_nome}; a inclusão ainda não foi realizada`;
                  console.log(`[processar-bot] adicionar_grupo_turma lead=${lead.id}`);

                } else if (block.name === "enviar_material") {
                  const materialTask = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: `Enviar ${input.tipo} — ${String(input.descricao ?? "").slice(0, 60)}`,
                    descricao: `Material: ${input.tipo} | ${input.descricao}`,
                    prioridade: "media",
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("solicitar envio de material", materialTask);
                  resultado = `Solicitação de envio de ${input.tipo} criada para o time; o material ainda não foi enviado`;
                  console.log(`[processar-bot] enviar_material lead=${lead.id}`);

                } else if (block.name === "marcar_nao_contatar") {
                  const naoContatarTask = await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: "Marcar como não contatar",
                    descricao: input.motivo ? `Motivo: ${input.motivo}` : "Contato solicitou para não ser contactado.",
                    prioridade: "alta",
                    status: "pendente",
                    tipo: "contato",
                  });
                  throwOnDatabaseError("criar tarefa não contatar", naoContatarTask);
                  const naoContatarActivity = await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Não contatar — ${input.motivo ?? "solicitado pelo contato"}`,
                  });
                  throwOnDatabaseError("registrar atividade não contatar", naoContatarActivity);
                  const naoContatarLead = await supabase.from("leads").update({ bot_ativo: false }).eq("id", lead.id);
                  throwOnDatabaseError("desativar bot para não contatar", naoContatarLead);
                  await persistirEstadoOperacional({ do_not_contact: true }, "não contatar");
                  resultado = "Lead marcado como não contatar — bot desativado";
                  console.log(`[processar-bot] marcar_nao_contatar lead=${lead.id}`);
                }
              } catch (toolErr) {
                resultado = JSON.stringify({
                  ok: false,
                  action: block.name,
                  message: "A ação não foi confirmada pelo sistema. Não informe ao contato que ela foi concluída.",
                });
                console.error(`[processar-bot] erro em ${block.name}:`, toolErr);
              }

              judgeToolResults.push({
                tool: block.name,
                input,
                resultado,
                success: !resultado.startsWith('{"ok":false'),
                status: inferToolStatus(block.name, resultado),
              });
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultado });
            }

            loopMessages = [...loopMessages, { role: "user", content: toolResults }];
            continue;
          }

          // Qualquer outro stop_reason (ex.: max_tokens) — extrai o que houver
          const textoFinal = extrairTexto(response.content);
          if (textoFinal) partesResposta.push(textoFinal);
          resposta = partesResposta.join("\n\n") || null;
          break;
        }

        // O laço pode esgotar MAX_ITER só em chamadas de ferramenta, sem
        // end_turn — o texto que veio junto delas ainda é a resposta.
        if (!resposta && partesResposta.length) resposta = partesResposta.join("\n\n");

        if (!resposta) {
          console.log(`[processar-bot] sem texto de resposta para lead ${lead.id} após ${totalIteracoes} volta(s) de ferramenta`);
          continue;
        }

        // ─── Juiz da Resposta ─────────────────────────────────────────────────
        if (lastBrainDecision) {
          const judgeCtx: JudgeContext = {
            clientMessage: ultimaMensagem.conteudo ?? "",
            conversationState: estadoAtualizado,
            decision: lastBrainDecision,
            candidateResponse: resposta,
            toolResults: judgeToolResults,
          };
          const judgeResult = await executeJudgePipeline(
            anthropic as any,
            judgeCtx,
            systemPrompt,
            "claude-haiku-4-5-20251001",
            agente.modelo,
          );
          console.log(`[processar-bot] juiz lead=${lead.id}`, toJudgeLog(judgeResult));
          if (judgeResult.blocked) {
            console.log(`[processar-bot] juiz bloqueou resposta lead=${lead.id} reason=${judgeResult.judgeDecision?.reason_code ?? "deterministic"}`);
            continue;
          }
          if (judgeResult.finalResponse && judgeResult.finalResponse !== resposta) {
            console.log(`[processar-bot] juiz reescreveu resposta lead=${lead.id}`);
            resposta = judgeResult.finalResponse;
          }
        }

        // O agente pode decidir que não há o que responder: um "ok" ou
        // "obrigado" que só encerra a conversa. Responder a isso soa robótico,
        // e na revisão a decisão de ficar calado também precisa ser julgada.
        const naoResponder = resposta.includes(SEM_RESPOSTA);
        if (naoResponder) resposta = SEM_RESPOSTA;

        // ── Modos de avaliação ────────────────────────────────────────────
        // Guarda o que o agente responderia, sem falar com o cliente.
        if (modoAgente !== "ativo") {
          // upsert e nao insert: duas rodadas podem se sobrepor (a execucao leva
          // ~70s, o cron dispara a cada 2 min) e ambas passam pela checagem de
          // duplicata antes de qualquer uma gravar. O indice unico decide.
          const { error: erroSombra } = await supabase.from("respostas_sombra").upsert(
            {
              empresa_id: agente.empresa_id,
              lead_id: lead.id,
              agente_id: agente.id,
              mensagem_entrada_id: ultimaMensagem.id,
              mensagem_entrada: ultimaMensagem.conteudo,
              resposta_ia: resposta,
              ferramentas: ferramentasIntencionadas,
              modelo: agente.modelo,
              tokens_entrada: tokensEntrada,
              tokens_saida: tokensSaida,
            },
            { onConflict: "mensagem_entrada_id", ignoreDuplicates: true }
          );
          // Sem isto a gravação falha calada: o contador sobe, a chamada ao
          // Claude é paga e a resposta some. Foi exatamente o que aconteceu
          // quando o índice único era parcial e o ON CONFLICT não o aceitava.
          if (erroSombra) {
            console.error("[processar-bot] falha ao gravar resposta sombra:", erroSombra);
          }

          // No modo teste a resposta sai de verdade, mas o destino vem da
          // variável de ambiente — nunca do lead. É impossível acertar um
          // cliente por engano.
          if (modoAgente === "teste") {
            const destinoTeste = Deno.env.get("SLA_ALERTA_WHATSAPP");
            const { data: canalTeste } = await supabase
              .from("canais_crm")
              .select("evolution_url, evolution_token, evolution_instancia")
              .eq("id", lead.canal_id)
              .maybeSingle();

            if (destinoTeste && canalTeste?.evolution_instancia) {
              const apiKeyTeste =
                canalTeste.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");

              if (naoResponder) {
                await fetch(
                  `${canalTeste.evolution_url}/message/sendText/${canalTeste.evolution_instancia}`,
                  {
                    method: "POST",
                    headers: { apikey: apiKeyTeste ?? "", "Content-Type": "application/json" },
                    body: JSON.stringify({
                      number: destinoTeste,
                      text: `[TESTE — lead ${lead.nome ?? lead.id}]\nCliente: "${ultimaMensagem.conteudo}"\nJulia ficaria em silêncio (conversa encerrada).`,
                    }),
                  }
                ).catch((e) => console.error("[processar-bot] falha no envio de teste:", e));
              } else {
                const partesTeste = splitMensagem(resposta);
                const header = `[TESTE — lead ${lead.nome ?? lead.id}] Cliente: "${ultimaMensagem.conteudo}"`;
                for (let pi = 0; pi < partesTeste.length; pi++) {
                  const prefixo = partesTeste.length > 1
                    ? `[TESTE ${pi + 1}/${partesTeste.length}]\n`
                    : `[TESTE]\n`;
                  const texto = pi === 0
                    ? `${header}\n\n${prefixo}${partesTeste[pi]}`
                    : `${prefixo}${partesTeste[pi]}`;
                  await fetch(
                    `${canalTeste.evolution_url}/message/sendText/${canalTeste.evolution_instancia}`,
                    {
                      method: "POST",
                      headers: { apikey: apiKeyTeste ?? "", "Content-Type": "application/json" },
                      body: JSON.stringify({ number: destinoTeste, text: texto }),
                    }
                  ).catch((e) => console.error("[processar-bot] falha no envio de teste:", e));
                  if (pi < partesTeste.length - 1) {
                    await new Promise((r) => setTimeout(r, 1200));
                  }
                }
              }
            }
          }

          console.log(`[processar-bot] modo ${modoAgente}: resposta registrada, nada enviado ao lead ${lead.id}`);
          processados++;
          continue;
        }

        if (naoResponder) {
          // Marca como tratada para o cron não reavaliar a mesma mensagem.
          await supabase.rpc("marcar_bot_respondido", { p_lead_id: lead.id });
          console.log(`[processar-bot] lead ${lead.id}: conversa encerrada, nada a responder`);
          processados++;
          continue;
        }

        // Busca canal para enviar via Evolution API
        const { data: canal } = await supabase
          .from("canais_crm")
          .select("evolution_url, evolution_token, evolution_instancia")
          .eq("id", lead.canal_id)
          .maybeSingle();

        if (!canal?.evolution_instancia || !lead.contato_id) continue;

        const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
        if (!apiKey) continue;

        const partes = splitMensagem(resposta);
        let envioOk = true;

        // Calcula delay de digitação proporcional ao tamanho da mensagem
        // (simula o tempo que uma pessoa levaria para digitar + pensar)
        const calcTypingMs = (texto: string, minMs: number) =>
          Math.min(40_000, Math.max(minMs, Math.floor(texto.length * 60 + Math.random() * 8_000)));

        for (let pi = 0; pi < partes.length; pi++) {
          // Delay de typing: primeira parte min 12s, demais min 5s
          const typingMs = calcTypingMs(partes[pi], pi === 0 ? 12_000 : 5_000);

          // Envia indicador "digitando..." via Evolution API (fire-and-forget)
          fetch(
            `${canal.evolution_url}/chat/whatsApp/presence/${canal.evolution_instancia}`,
            {
              method: "POST",
              headers: { apikey: apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                number: lead.contato_id,
                options: { presence: "composing", delay: typingMs },
              }),
            }
          ).catch(() => { /* indicador não-crítico */ });

          // Aguarda o tempo de "digitação" antes de enviar
          await new Promise((r) => setTimeout(r, typingMs));

          const evoRes = await fetch(
            `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`,
            {
              method: "POST",
              headers: { apikey: apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ number: lead.contato_id, text: partes[pi] }),
            }
          );
          if (!evoRes.ok) {
            const err = await evoRes.text();
            console.error(`[processar-bot] erro Evolution parte ${pi + 1}: ${err}`);
            envioOk = false;
            break;
          }
          if (pi < partes.length - 1) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }

        if (!envioOk) continue;

        // Salva mensagem de saída do bot (usa o mesmo protocolo já buscado acima)
        await supabase.from("mensagens_crm").insert({
          lead_id: lead.id,
          empresa_id: agente.empresa_id,
          conteudo: resposta,
          direcao: "saida",
          canal: "whatsapp",
          protocolo_id: protocoloAtual?.id ?? null,
          agente_bot_id: agente.id,
        });

        // Marca a última mensagem de entrada como respondida pelo bot
        await supabase.rpc("marcar_bot_respondido", { p_lead_id: lead.id });

        // Reset do contador de follow-up + atualiza última mensagem no lead
        await supabase.from("leads").update({
          followup_count: 0,
          ultima_mensagem_em: new Date().toISOString(),
          ultima_mensagem_direcao: "saida",
        }).eq("id", lead.id);

        // Dispara atualização da ficha do lead em background (fire-and-forget)
        // usa a função atualizar-ficha-lead que tem anti-duplicata de 2 min
        const supabaseUrlFicha = Deno.env.get("SUPABASE_URL");
        const serviceKeyFicha = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (supabaseUrlFicha && serviceKeyFicha) {
          fetch(`${supabaseUrlFicha}/functions/v1/atualizar-ficha-lead`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKeyFicha}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ leadId: lead.id }),
          }).catch((e) => console.error("[processar-bot] erro ao disparar atualizar-ficha:", e));
        }

        // Finaliza o registro na conversas_ia
        if (conversaId) {
          try {
            const { data: leadAtual } = await supabase
              .from("leads").select("lead_score").eq("id", lead.id).maybeSingle();
            await supabase.from("conversas_ia").update({
              finalizado_em: new Date().toISOString(),
              houve_handoff: handoff,
              motivo_fim: handoff ? "handoff" : "encerrado",
              total_mensagens: totalMsgsHistorico + 1,
              total_iteracoes: totalIteracoes,
              score_final: leadAtual?.lead_score ?? null,
              resumo: resumoHandoff,
            }).eq("id", conversaId);
          } catch (_) {}
        }

        processados++;
        console.log(`[processar-bot] respondido lead ${lead.id}`);
      }
    }

    // FOLLOW-UP: só no modo cron (não no forceLeadId)
    if (!forceLeadId) {
      for (const agente of agentes) {
        if (!agente.followup_ativo || !agente.canais_ids?.length) continue;
        if (!dentroDoHorario(agente)) continue;

        const maxTentativas = agente.followup_max_tentativas ?? 3;
        const intervaloMs = (agente.followup_intervalo_horas ?? 24) * 60 * 60 * 1000;
        const cutoffFollowup = new Date(Date.now() - intervaloMs).toISOString();

        const { data: candidatos } = await supabase
          .from("leads")
          .select("id, nome, contato_id, canal_id, empresa_id, followup_count")
          .eq("empresa_id", agente.empresa_id)
          .eq("bot_ativo", true)
          .lt("followup_count", maxTentativas)
          .in("canal_id", agente.canais_ids)
          .in("tipo_contato", ["lead", "aluno"])
          .is("deleted_at", null);

        for (const lead of candidatos ?? []) {
          const { data: ultimaMsg } = await supabase
            .from("mensagens_crm")
            .select("direcao, created_at")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!ultimaMsg) continue;
          if (ultimaMsg.direcao !== "saida") continue;
          if (ultimaMsg.created_at > cutoffFollowup) continue;

          // Busca histórico recente para o Claude avaliar o contexto
          const { data: historicoFollowup } = await supabase
            .from("mensagens_crm")
            .select("conteudo, direcao, created_at")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(20);

          const historicoTexto = (historicoFollowup ?? [])
            .reverse()
            .filter((m: any) => m.conteudo && m.conteudo !== "[Mídia]")
            .map((m: any) => `${m.direcao === "entrada" ? "Lead" : "Bot"}: ${m.conteudo}`)
            .join("\n");

          const tomReferencia = (agente.followup_mensagens as string[] ?? []).join(" | ");

          // Claude decide se faz sentido enviar e gera a mensagem contextualizada
          let msgFollowup: string | null = null;
          try {
            const decisao = await anthropic.messages.create({
              model: agente.modelo,
              max_tokens: 256,
              system:
                `Você analisa conversas de vendas e decide se deve ser enviado um follow-up.\n\n` +
                `NÃO envie follow-up se:\n` +
                `- A conversa terminou naturalmente (despedida, "qualquer coisa é só chamar", etc.)\n` +
                `- O lead demonstrou desinteresse claro\n` +
                `- O bot já se despediu formalmente\n` +
                `- A última mensagem do bot já era um follow-up sem resposta\n\n` +
                `ENVIE follow-up se:\n` +
                `- O lead demonstrou interesse mas parou de responder no meio\n` +
                `- O lead recebeu informações mas não deu retorno\n` +
                `- A conversa ficou em aberto sem conclusão\n\n` +
                `Tom de referência para a mensagem: ${tomReferencia}\n\n` +
                `Responda APENAS com JSON válido, sem explicações:\n` +
                `{"enviar": true, "mensagem": "sua mensagem aqui"}\n` +
                `ou\n` +
                `{"enviar": false}`,
              messages: [
                {
                  role: "user",
                  content: `Histórico da conversa:\n${historicoTexto}\n\nDevo enviar um follow-up?`,
                },
              ],
            });

            const textBlock = decisao.content.find((b) => b.type === "text");
            const raw = textBlock?.type === "text" ? textBlock.text.trim() : "";
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.enviar === true && parsed.mensagem) {
                msgFollowup = parsed.mensagem;
              }
            }
          } catch (iaErr) {
            console.error(`[processar-bot] follow-up IA erro lead=${lead.id}:`, iaErr);
            // fallback: usa mensagem estática da lista
            const msgs: string[] = agente.followup_mensagens ?? ["Oi! Ainda posso te ajudar?"];
            msgFollowup = msgs[Math.min(lead.followup_count, msgs.length - 1)];
          }

          if (!msgFollowup) {
            console.log(`[processar-bot] follow-up dispensado pela IA para lead ${lead.id} (contexto não recomenda)`);
            continue;
          }

          const novoCount = lead.followup_count + 1;
          const ultimaTentativa = novoCount >= maxTentativas;

          const { data: canal } = await supabase
            .from("canais_crm")
            .select("evolution_url, evolution_token, evolution_instancia")
            .eq("id", lead.canal_id)
            .maybeSingle();

          if (!canal?.evolution_instancia) continue;
          const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
          if (!apiKey) continue;

          const evoRes = await fetch(
            `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`,
            {
              method: "POST",
              headers: { apikey: apiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ number: lead.contato_id, text: msgFollowup }),
            }
          );

          if (!evoRes.ok) {
            console.error(`[processar-bot] follow-up Evolution erro lead=${lead.id}`);
            continue;
          }

          await supabase.from("mensagens_crm").insert({
            lead_id: lead.id,
            empresa_id: agente.empresa_id,
            conteudo: msgFollowup,
            direcao: "saida",
            canal: "whatsapp",
          });

          await supabase.from("leads").update({
            followup_count: novoCount,
            ...(ultimaTentativa ? { bot_ativo: false } : {}),
          }).eq("id", lead.id);

          if (ultimaTentativa) {
            await supabase.from("atividades").insert({
              lead_id: lead.id,
              empresa_id: agente.empresa_id,
              tipo: "nota",
              descricao: `[IA] Follow-up encerrado após ${maxTentativas} tentativas sem resposta. Bot desativado.`,
            });
          }

          console.log(`[processar-bot] follow-up ${novoCount}/${maxTentativas} enviado para lead ${lead.id}${ultimaTentativa ? " (último — bot desativado)" : ""}`);
        }
      }
    }

    console.log(`[processar-bot] ciclo concluído. Processados: ${processados}`);
    return new Response(JSON.stringify({ ok: true, processados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[processar-bot] erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
