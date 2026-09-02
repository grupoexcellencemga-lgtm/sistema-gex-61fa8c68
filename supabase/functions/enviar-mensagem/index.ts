import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { lead_id, mensagem } = await req.json();
    if (!lead_id || !mensagem?.trim()) {
      return new Response(JSON.stringify({ error: "lead_id e mensagem são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, contato_id, empresa_id, canal_id")
      .eq("id", lead_id)
      .single();
    if (leadErr || !lead) throw new Error("Lead não encontrado");
    if (!lead.contato_id) throw new Error("Lead sem número de telefone");
    if (!lead.canal_id) throw new Error("Lead sem canal associado");

    const { data: canal, error: canalErr } = await supabase
      .from("canais_crm")
      .select("evolution_url, evolution_token, evolution_instancia, tipo")
      .eq("id", lead.canal_id)
      .single();
    if (canalErr || !canal) throw new Error("Canal não encontrado");
    if (canal.tipo !== "whatsapp") throw new Error("Envio suportado apenas para WhatsApp");

    const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!apiKey) throw new Error("API key da Evolution não configurada");
    const evoUrl = `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`;
    const evoRes = await fetch(evoUrl, {
      method: "POST",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: lead.contato_id,
        text: mensagem.trim(),
      }),
    });

    if (!evoRes.ok) {
      const evoErr = await evoRes.text();
      throw new Error(`Evolution API: ${evoErr}`);
    }

    await supabase.from("mensagens_crm").insert({
      lead_id: lead.id,
      empresa_id: lead.empresa_id,
      conteudo: mensagem.trim(),
      direcao: "saida",
      canal: "whatsapp",
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
