import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_URL = "http://2.25.125.70:8080";
const WEBHOOK_URL = "https://nsxigkgfvbzhpxrpwvhw.supabase.co/functions/v1/webhook-whatsapp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const globalKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!globalKey) throw new Error("EVOLUTION_GLOBAL_API_KEY não configurada nos secrets");

    const { action, instancia, nome } = await req.json();
    let result: unknown;

    if (action === "list") {
      const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
        headers: { "apikey": globalKey },
      });
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else if (action === "create") {
      if (!nome) throw new Error("nome obrigatório");
      const res = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: "POST",
        headers: { "apikey": globalKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: nome,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else if (action === "qrcode") {
      if (!instancia) throw new Error("instancia obrigatória");
      const res = await fetch(`${EVOLUTION_URL}/instance/connect/${instancia}`, {
        headers: { "apikey": globalKey },
      });
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else if (action === "status") {
      if (!instancia) throw new Error("instancia obrigatória");
      const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instancia}`, {
        headers: { "apikey": globalKey },
      });
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else if (action === "delete") {
      if (!instancia) throw new Error("instancia obrigatória");
      const res = await fetch(`${EVOLUTION_URL}/instance/delete/${instancia}`, {
        method: "DELETE",
        headers: { "apikey": globalKey },
      });
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else if (action === "logout") {
      if (!instancia) throw new Error("instancia obrigatória");
      const res = await fetch(`${EVOLUTION_URL}/instance/logout/${instancia}`, {
        method: "DELETE",
        headers: { "apikey": globalKey },
      });
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else if (action === "set_webhook") {
      if (!instancia) throw new Error("instancia obrigatória");
      const res = await fetch(`${EVOLUTION_URL}/webhook/set/${instancia}`, {
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
      if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
      result = await res.json();

    } else {
      throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify({ ok: true, data: result }), {
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
