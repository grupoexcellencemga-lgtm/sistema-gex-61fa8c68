import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const EVOLUTION_URL = "http://2.25.125.70:8080";
const WEBHOOK_URL = "https://nsxigkgfvbzhpxrpwvhw.supabase.co/functions/v1/webhook-whatsapp";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const globalKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!globalKey) throw new Error("EVOLUTION_GLOBAL_API_KEY não configurada");

    // Busca todas as instâncias WhatsApp ativas
    const { data: canais, error } = await supabase
      .from("canais_crm")
      .select("id, nome, evolution_instancia")
      .eq("tipo", "whatsapp")
      .eq("ativo", true)
      .not("evolution_instancia", "is", null);

    if (error) throw error;

    const resultados: { instancia: string; ok: boolean; erro?: string }[] = [];

    for (const canal of canais ?? []) {
      try {
        const res = await fetch(`${EVOLUTION_URL}/webhook/set/${canal.evolution_instancia}`, {
          method: "POST",
          headers: { "apikey": globalKey, "Content-Type": "application/json" },
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
        resultados.push({ instancia: canal.evolution_instancia, ok: res.ok });
      } catch (e: any) {
        resultados.push({ instancia: canal.evolution_instancia, ok: false, erro: e.message });
      }
    }

    console.log("[verificar-webhooks]", JSON.stringify(resultados));

    return new Response(JSON.stringify({ ok: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[verificar-webhooks] erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
