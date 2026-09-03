import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function dentroDoHorario(agente: any): boolean {
  if (agente.ativo_24h) return true;

  const agora = new Date();
  const diaSemana = agora.getDay(); // 0=Dom, 6=Sáb
  if (!agente.dias_semana.includes(diaSemana)) return false;

  const [hIni, mIni] = agente.horario_inicio.split(":").map(Number);
  const [hFim, mFim] = agente.horario_fim.split(":").map(Number);
  const minAgora = agora.getUTCHours() * 60 + agora.getUTCMinutes();
  // Ajustar para fuso Brasil (UTC-3)
  const minBrasil = ((minAgora - 180) + 1440) % 1440;
  const minIni = hIni * 60 + mIni;
  const minFim = hFim * 60 + mFim;

  return minBrasil >= minIni && minBrasil < minFim;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY não configurada");

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // Busca todos os agentes ativos
    const { data: agentes, error: agErr } = await supabase
      .from("agentes_bot")
      .select("*")
      .eq("ativo", true);

    if (agErr) throw agErr;
    if (!agentes?.length) {
      return new Response(JSON.stringify({ ok: true, processados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processados = 0;

    for (const agente of agentes) {
      if (!dentroDoHorario(agente)) continue;
      if (!agente.canais_ids?.length) continue;

      const limiteMs = agente.tempo_espera_minutos * 60 * 1000;
      const limiteISO = new Date(Date.now() - limiteMs).toISOString();

      // Busca leads em fila nos canais do agente, cuja última mensagem foi há mais que o tempo de espera
      const { data: leads } = await supabase
        .from("leads")
        .select("id, nome, canal_id, contato_id, empresa_id")
        .eq("empresa_id", agente.empresa_id)
        .eq("status_atendimento", "fila")
        .in("canal_id", agente.canais_ids)
        .lte("ultima_mensagem_em", limiteISO)
        .is("deleted_at", null);

      if (!leads?.length) continue;

      for (const lead of leads) {
        // Verifica se a última mensagem foi do cliente (entrada) — não responde se já respondemos
        const { data: ultimaMsg } = await supabase
          .from("mensagens_crm")
          .select("direcao, conteudo")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!ultimaMsg || ultimaMsg.direcao !== "entrada") continue;

        // Busca histórico de mensagens para contexto
        const { data: historico } = await supabase
          .from("mensagens_crm")
          .select("direcao, conteudo, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: true })
          .limit(agente.max_mensagens_contexto);

        const messages: Anthropic.MessageParam[] = (historico ?? []).map((m: any) => ({
          role: m.direcao === "entrada" ? "user" : "assistant",
          content: m.conteudo,
        }));

        if (!messages.length) continue;

        // Garante que começa com user
        if (messages[0].role !== "user") messages.shift();
        if (!messages.length) continue;

        // Chama API Anthropic
        const resposta = await anthropic.messages.create({
          model: agente.modelo,
          max_tokens: 500,
          system: agente.instrucao,
          messages,
        });

        const textoResposta =
          resposta.content[0]?.type === "text" ? resposta.content[0].text : null;

        if (!textoResposta) continue;

        // Busca canal para enviar via Evolution API
        const { data: canal } = await supabase
          .from("canais_crm")
          .select("evolution_url, evolution_token, evolution_instancia")
          .eq("id", lead.canal_id)
          .maybeSingle();

        if (!canal?.evolution_instancia) continue;

        const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
        if (!apiKey) continue;

        const evoUrl = `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`;
        const evoRes = await fetch(evoUrl, {
          method: "POST",
          headers: { apikey: apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ number: lead.contato_id, text: textoResposta }),
        });

        if (!evoRes.ok) {
          console.error("[processar-bot] Erro Evolution:", await evoRes.text());
          continue;
        }

        // Busca protocolo ativo
        const { data: protocolo } = await supabase
          .from("protocolos_atendimento")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("status", "ativo")
          .maybeSingle();

        // Salva mensagem do bot no histórico
        await supabase.from("mensagens_crm").insert({
          lead_id: lead.id,
          empresa_id: lead.empresa_id,
          conteudo: textoResposta,
          direcao: "saida",
          canal: "whatsapp",
          protocolo_id: protocolo?.id ?? null,
        });

        await supabase
          .from("leads")
          .update({ ultima_mensagem_em: new Date().toISOString() })
          .eq("id", lead.id);

        processados++;
        console.log(`[processar-bot] Respondeu lead ${lead.id} via agente ${agente.nome}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, processados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[processar-bot]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
