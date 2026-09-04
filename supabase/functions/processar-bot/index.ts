import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

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
        // Modo direto: processa apenas o lead específico (sem cutoff de tempo)
        const { data } = await supabase
          .from("leads")
          .select("id, nome, contato_id, canal_id, empresa_id")
          .eq("id", forceLeadId)
          .eq("empresa_id", agente.empresa_id)
          .eq("status_atendimento", "fila")
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
          .select("id, nome, contato_id, canal_id, empresa_id")
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

        // Contexto do contato (nome + telefone) injetado no system prompt
        const nomeContato = lead.nome && lead.nome !== lead.contato_id ? lead.nome : null;
        const contextoContato = nomeContato
          ? `\n\n---\n# CONTATO ATUAL\nNome: ${nomeContato}\nTelefone: ${lead.contato_id}\nUse o nome da pessoa naturalmente na conversa quando fizer sentido.`
          : `\n\n---\n# CONTATO ATUAL\nTelefone: ${lead.contato_id}`;

        // Chama Anthropic
        console.log(`[processar-bot] respondendo lead ${lead.id} com agente ${agente.nome}`);
        const response = await anthropic.messages.create({
          model: agente.modelo,
          max_tokens: 1024,
          system: agente.instrucao + baseConhecimento + resumoAnterior + contextoContato,
          messages,
        });

        let resposta = response.content[0].type === "text" ? response.content[0].text : null;
        if (!resposta) continue;

        // Detecta sinal de handoff para consultor humano
        const handoff = resposta.includes("[HANDOFF]");
        if (handoff) {
          resposta = resposta.replace(/\[HANDOFF\]/g, "").trim();
          await supabase.from("leads").update({ bot_ativo: false }).eq("id", lead.id);
          console.log(`[processar-bot] handoff ativado para lead ${lead.id} — bot desativado`);
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

        processados++;
        console.log(`[processar-bot] respondido lead ${lead.id}`);
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
