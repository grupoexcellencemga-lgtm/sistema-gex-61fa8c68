import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://nsxigkgfvbzhpxrpwvhw.supabase.co/functions/v1/webhook-whatsapp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { canal_id } = await req.json();
    if (!canal_id) throw new Error("canal_id obrigatório");

    const { data: canal, error } = await supabase
      .from("canais_crm")
      .select("evolution_url, evolution_token, evolution_instancia, tipo")
      .eq("id", canal_id)
      .single();

    if (error || !canal) throw new Error("Canal não encontrado");
    if (canal.tipo !== "whatsapp") throw new Error("Webhook só para WhatsApp");
    if (!canal.evolution_url || !canal.evolution_token || !canal.evolution_instancia) {
      throw new Error("Preencha URL, API Key e nome da instância");
    }

    const url = `${canal.evolution_url}/webhook/set/${canal.evolution_instancia}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": canal.evolution_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: WEBHOOK_URL,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPSERT"],
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Evolution API (${res.status}): ${txt}`);
    }

    const result = await res.json();
    return new Response(JSON.stringify({ ok: true, webhook: result }), {
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
