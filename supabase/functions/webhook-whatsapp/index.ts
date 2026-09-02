import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const QUADRO_WHATSAPP_ID = "aaaaaaaa-0001-0001-0001-000000000001";
const ETAPA_WHATSAPP_ID  = "aaaaaaaa-0002-0002-0002-000000000002";
const QUADRO_INSTAGRAM_ID = "aaaaaaaa-0003-0003-0003-000000000003";
const ETAPA_INSTAGRAM_ID  = "aaaaaaaa-0004-0004-0004-000000000004";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { event, instance, data } = body;

    if (event !== "messages.upsert") return new Response("ignored", { status: 200 });
    if (!data) return new Response("ignored", { status: 200 });

    const fromMe: boolean = data.key?.fromMe === true;

    // Extrai o número da conversa
    const remoteJid: string = data.key?.remoteJid ?? "";
    if (remoteJid.includes("@g.us")) return new Response("group ignored", { status: 200 });

    const telefone = remoteJid.replace("@s.whatsapp.net", "");
    const nomeContato: string = data.pushName || telefone;
    const texto: string =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      "[Mídia]";

    // Busca canal pelo nome da instância
    const { data: canal } = await supabase
      .from("canais_crm")
      .select("id, empresa_id")
      .eq("evolution_instancia", instance)
      .eq("ativo", true)
      .maybeSingle();

    if (!canal) {
      console.log("Canal não encontrado para instância:", instance);
      return new Response("canal not found", { status: 200 });
    }

    const empresaId = canal.empresa_id;

    // Busca lead existente pelo telefone + canal
    let { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("contato_id", telefone)
      .eq("canal_id", canal.id)
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .maybeSingle();

    // Cria lead se não existir
    if (!lead) {
      const { data: novoLead, error: errLead } = await supabase
        .from("leads")
        .insert({
          nome: nomeContato,
          telefone: telefone,
          origem: "whatsapp",
          empresa_id: empresaId,
          canal_id: canal.id,
          contato_id: telefone,
          etapa_id: ETAPA_WHATSAPP_ID,
        })
        .select("id")
        .single();

      if (errLead) throw errLead;
      lead = novoLead;
    }

    // Salva a mensagem (fromMe = enviada pelo número da empresa)
    await supabase.from("mensagens_crm").insert({
      lead_id: lead.id,
      empresa_id: empresaId,
      conteudo: texto,
      direcao: fromMe ? "saida" : "entrada",
      canal: "whatsapp",
    });

    return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
