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
    console.log("[processar-bot] iniciando ciclo");

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
        continue;
      }

      if (!agente.canais_ids?.length) continue;

      // Busca leads em fila nos canais deste agente, aguardando além do tempo configurado
      const cutoff = new Date(Date.now() - agente.tempo_espera_minutos * 60 * 1000).toISOString();

      const { data: leads } = await supabase
        .from("leads")
        .select("id, nome, contato_id, canal_id, empresa_id")
        .eq("empresa_id", agente.empresa_id)
        .eq("status_atendimento", "fila")
        .in("canal_id", agente.canais_ids)
        .lt("ultima_mensagem_em", cutoff)
        .is("deleted_at", null)
        .not("ultima_mensagem_em", "is", null);

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

        // Busca histórico de mensagens
        const { data: historico } = await supabase
          .from("mensagens_crm")
          .select("conteudo, direcao, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: true })
          .limit(agente.max_mensagens_contexto);

        // Monta mensagens para Anthropic
        const messages: Anthropic.MessageParam[] = (historico ?? [])
          .filter((m: any) => m.conteudo && m.conteudo !== "[Mídia]")
          .map((m: any) => ({
            role: m.direcao === "saida" ? "assistant" : "user",
            content: m.conteudo,
          }));

        // Garante que começa com "user"
        if (!messages.length || messages[0].role !== "user") continue;

        // Chama Anthropic
        console.log(`[processar-bot] respondendo lead ${lead.id} com agente ${agente.nome}`);
        const response = await anthropic.messages.create({
          model: agente.modelo,
          max_tokens: 1024,
          system: agente.instrucao,
          messages,
        });

        const resposta = response.content[0].type === "text" ? response.content[0].text : null;
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

        // Busca protocolo ativo para linkar
        const { data: protocolo } = await supabase
          .from("protocolos_atendimento")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("status", "ativo")
          .maybeSingle();

        // Salva mensagem de saída do bot
        await supabase.from("mensagens_crm").insert({
          lead_id: lead.id,
          empresa_id: agente.empresa_id,
          conteudo: resposta,
          direcao: "saida",
          canal: "whatsapp",
          protocolo_id: protocolo?.id ?? null,
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
