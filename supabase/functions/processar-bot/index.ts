import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    description: "Move o lead para outra etapa do pipeline de vendas.",
    input_schema: {
      type: "object",
      properties: {
        etapa: {
          type: "string",
          enum: ["lead", "contato", "negociacao", "matricula", "perdido"],
          description: "Nova etapa do pipeline",
        },
        motivo: { type: "string", description: "Motivo da mudança de etapa" },
      },
      required: ["etapa"],
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
      // Verifica horário
      if (!dentroDoHorario(agente)) {
        console.log(`[processar-bot] agente ${agente.nome} fora do horário`);

        // Se for modo direto (forceLeadId), envia mensagem de fora de horário uma vez
        if (forceLeadId && agente.canais_ids?.length) {
          const { data: leadFora } = await supabase
            .from("leads")
            .select("id, nome, contato_id, canal_id, empresa_id")
            .eq("id", forceLeadId)
            .eq("empresa_id", agente.empresa_id)
            .eq("bot_ativo", true)
            .in("canal_id", agente.canais_ids)
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
                const msgFora = agente.horario_inicio && agente.horario_fim
                  ? `Oi! Recebi sua mensagem. Nosso atendimento é das ${agente.horario_inicio.substring(0,5)} às ${agente.horario_fim.substring(0,5)}. Em breve um de nossos consultores retorna com você!`
                  : "Oi! Recebi sua mensagem e retornaremos em breve. Nosso time está fora do horário de atendimento no momento.";

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

      if (forceLeadId) {
        // Modo direto: processa o lead específico sem exigir status "fila"
        // (bot_ativo=true já é a autorização — o status não deve bloquear)
        const { data } = await supabase
          .from("leads")
          .select("id, nome, contato_id, canal_id, empresa_id, lead_score")
          .eq("id", forceLeadId)
          .eq("empresa_id", agente.empresa_id)
          .eq("bot_ativo", true)
          .in("canal_id", agente.canais_ids)
          .is("deleted_at", null)
          .maybeSingle();
        leads = data ? [data] : [];
      } else {
        // Modo cron: busca leads aguardando além do tempo configurado
        const cutoff = new Date(Date.now() - agente.tempo_espera_minutos * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("leads")
          .select("id, nome, contato_id, canal_id, empresa_id, lead_score")
          .eq("empresa_id", agente.empresa_id)
          .eq("status_atendimento", "fila")
          .eq("bot_ativo", true)
          .in("canal_id", agente.canais_ids)
          .lt("ultima_mensagem_em", cutoff)
          .is("deleted_at", null)
          .not("ultima_mensagem_em", "is", null);
        leads = data;
      }

      if (!leads?.length) continue;

      for (const lead of leads) {
        // Verifica se a última mensagem do lead já foi respondida pelo bot
        const { data: ultimaMensagem } = await supabase
          .from("mensagens_crm")
          .select("direcao, bot_respondido")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Só responde se a última mensagem foi de entrada (cliente) e ainda não foi respondida pelo bot
        if (!ultimaMensagem || ultimaMensagem.direcao !== "entrada") continue;
        if (ultimaMensagem.bot_respondido) continue;

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
            .select("conteudo, direcao, created_at")
            .eq("lead_id", lead.id)
            .eq("protocolo_id", protocoloAtual.id)
            .order("created_at", { ascending: false })
            .limit(agente.max_mensagens_contexto);
          // Se não encontrou por id, tenta por created_at (mensagens sem protocolo_id)
          if (!porId?.length) {
            const { data: porData } = await supabase
              .from("mensagens_crm")
              .select("conteudo, direcao, created_at")
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
            .select("conteudo, direcao, created_at")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(agente.max_mensagens_contexto);
          historicoDesc = semProtocolo;
        }

        // Reverte para ordem cronológica
        const historico = (historicoDesc ?? []).reverse();

        // Monta mensagens para Anthropic
        // [Mídia] é preservado como aviso para o bot saber que foi enviada uma mídia
        const rawMsgs = historico
          .filter((m: any) => m.conteudo)
          .map((m: any) => ({
            role: (m.direcao === "saida" ? "assistant" : "user") as "user" | "assistant",
            content: m.conteudo === "[Mídia]"
              ? "[A pessoa enviou uma mídia (áudio, foto ou vídeo) — você não consegue visualizá-la]"
              : m.conteudo as string,
          }));

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

        // Contexto do contato (nome + telefone + perfil) injetado no system prompt
        const nomeContato = lead.nome && lead.nome !== lead.contato_id ? lead.nome : null;
        const contextoContato =
          `\n\n---\n# CONTATO ATUAL\n` +
          (nomeContato ? `Nome: ${nomeContato}\n` : "") +
          `Telefone: ${lead.contato_id}\n` +
          `Perfil: ${perfilContato}\n` +
          (nomeContato
            ? `Use o nome da pessoa naturalmente na conversa quando fizer sentido.`
            : ``);

        // Registra início da sessão na conversas_ia
        let conversaId: string | null = null;
        const totalMsgsHistorico = messages.length;
        try {
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

        // Loop agentic com tool use (máx 5 iterações)
        console.log(`[processar-bot] respondendo lead ${lead.id} com agente ${agente.nome}`);
        const systemPrompt = agente.instrucao + baseConhecimento + conhecimentoRag + resumoAnterior + contextoContato;
        let loopMessages: Anthropic.MessageParam[] = [...messages];
        let resposta: string | null = null;
        let handoff = false;
        let resumoHandoff: string | null = null;
        let totalIteracoes = 0;
        const MAX_ITER = 5;

        for (let iter = 0; iter < MAX_ITER; iter++) {
          const response = await anthropic.messages.create({
            model: agente.modelo,
            max_tokens: 1024,
            system: systemPrompt,
            tools: TOOLS,
            messages: loopMessages,
          });

          if (response.stop_reason === "end_turn") {
            const textBlock = response.content.find((b) => b.type === "text");
            resposta = textBlock?.type === "text" ? textBlock.text : null;
            // Fallback legado: [HANDOFF] no texto
            if (resposta?.includes("[HANDOFF]")) {
              resposta = resposta.replace(/\[HANDOFF\]/g, "").trim();
              handoff = true;
              await supabase.from("leads").update({ bot_ativo: false }).eq("id", lead.id);
              console.log(`[processar-bot] handoff (texto) para lead ${lead.id}`);
            }
            break;
          }

          if (response.stop_reason === "tool_use") {
            totalIteracoes++;
            const assistantMessage: Anthropic.MessageParam = { role: "assistant", content: response.content };
            loopMessages = [...loopMessages, assistantMessage];
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of response.content) {
              if (block.type !== "tool_use") continue;
              const input = block.input as Record<string, any>;
              let resultado = "ok";

              try {
                if (block.name === "atualizar_lead") {
                  const campos: Record<string, any> = {};
                  const permitidos = ["nome", "email", "cidade", "produto_interesse", "empresa_nome", "cargo", "perfil_lead"];
                  for (const k of permitidos) if (input[k] !== undefined) campos[k] = input[k];
                  if (Object.keys(campos).length > 0) {
                    await supabase.from("leads").update(campos).eq("id", lead.id);
                    resultado = `Lead atualizado: ${JSON.stringify(campos)}`;
                    console.log(`[processar-bot] atualizar_lead lead=${lead.id}`, campos);
                  }

                } else if (block.name === "pontuar_lead") {
                  const score = Math.max(0, Math.min(100, Math.round(Number(input.score))));
                  await supabase.from("leads").update({ lead_score: score }).eq("id", lead.id);
                  await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] Score definido: ${score}/100 — ${input.motivo}`,
                  });
                  resultado = `Score ${score} registrado`;
                  console.log(`[processar-bot] pontuar_lead lead=${lead.id} score=${score}`);

                } else if (block.name === "registrar_nota") {
                  await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "nota",
                    descricao: `[IA] ${input.nota}`,
                  });
                  resultado = "Nota registrada";
                  console.log(`[processar-bot] registrar_nota lead=${lead.id}`);

                } else if (block.name === "mover_etapa") {
                  await supabase.from("leads").update({ etapa: input.etapa }).eq("id", lead.id);
                  if (input.motivo) {
                    await supabase.from("atividades").insert({
                      lead_id: lead.id,
                      empresa_id: agente.empresa_id,
                      tipo: "nota",
                      descricao: `[IA] Etapa movida para "${input.etapa}": ${input.motivo}`,
                    });
                  }
                  resultado = `Etapa movida para ${input.etapa}`;
                  console.log(`[processar-bot] mover_etapa lead=${lead.id} etapa=${input.etapa}`);

                } else if (block.name === "criar_tarefa") {
                  await supabase.from("tarefas").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    titulo: input.titulo,
                    descricao: input.descricao ?? null,
                    prioridade: input.prioridade ?? "media",
                    data_vencimento: input.data_vencimento ?? null,
                    status: "pendente",
                    tipo: "contato",
                  });
                  resultado = "Tarefa criada";
                  console.log(`[processar-bot] criar_tarefa lead=${lead.id} titulo=${input.titulo}`);

                } else if (block.name === "solicitar_handoff") {
                  handoff = true;
                  resumoHandoff = input.resumo ?? null;
                  await supabase.from("leads").update({ bot_ativo: false }).eq("id", lead.id);
                  await supabase.from("atividades").insert({
                    lead_id: lead.id,
                    empresa_id: agente.empresa_id,
                    tipo: "alerta",
                    descricao: `[IA] Handoff solicitado — ${input.resumo}`,
                  });

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

                          await fetch(
                            `${canalHandoff.evolution_url}/message/sendText/${canalHandoff.evolution_instancia}`,
                            {
                              method: "POST",
                              headers: { apikey: apiKeyHandoff!, "Content-Type": "application/json" },
                              body: JSON.stringify({ number: telefone, text: msgComercial }),
                            }
                          );
                          console.log(`[processar-bot] notificação handoff enviada para ${comercial.nome} (${telefone})`);
                        }
                      }
                    }
                  } catch (notifErr) {
                    console.error("[processar-bot] erro ao notificar comercial:", notifErr);
                  }

                  resultado = "Handoff registrado — bot desativado";
                  console.log(`[processar-bot] handoff (tool) para lead ${lead.id}`);
                }
              } catch (toolErr) {
                resultado = `Erro ao executar ferramenta: ${String(toolErr)}`;
                console.error(`[processar-bot] erro em ${block.name}:`, toolErr);
              }

              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultado });
            }

            loopMessages = [...loopMessages, { role: "user", content: toolResults }];
            continue;
          }

          // Qualquer outro stop_reason — extrai o que houver
          const fallback = response.content.find((b) => b.type === "text");
          resposta = fallback?.type === "text" ? fallback.text : null;
          break;
        }

        if (!resposta) continue;

        // Busca canal para enviar via Evolution API
        const { data: canal } = await supabase
          .from("canais_crm")
          .select("evolution_url, evolution_token, evolution_instancia")
          .eq("id", lead.canal_id)
          .maybeSingle();

        if (!canal?.evolution_instancia || !lead.contato_id) continue;

        const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
        if (!apiKey) continue;

        const evoRes = await fetch(
          `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`,
          {
            method: "POST",
            headers: { apikey: apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({ number: lead.contato_id, text: resposta }),
          }
        );

        if (!evoRes.ok) {
          const err = await evoRes.text();
          console.error(`[processar-bot] erro Evolution: ${err}`);
          continue;
        }

        // Salva mensagem de saída do bot (usa o mesmo protocolo já buscado acima)
        await supabase.from("mensagens_crm").insert({
          lead_id: lead.id,
          empresa_id: agente.empresa_id,
          conteudo: resposta,
          direcao: "saida",
          canal: "whatsapp",
          protocolo_id: protocoloAtual?.id ?? null,
        });

        // Marca a última mensagem de entrada como respondida pelo bot
        await supabase.rpc("marcar_bot_respondido", { p_lead_id: lead.id });

        // Reset do contador de follow-up (lead respondeu e bot respondeu de volta)
        await supabase.from("leads").update({ followup_count: 0 }).eq("id", lead.id);

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
