import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const EVOLUTION_URL = "http://2.25.125.70:8080";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const globalKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!globalKey) throw new Error("EVOLUTION_GLOBAL_API_KEY não configurada");

    // Busca leads com telefone mas sem foto, junto com a instância do canal
    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, contato_id, canal_id, canais_crm!canal_id(evolution_instancia)")
      .is("deleted_at", null)
      .not("contato_id", "is", null)
      .is("foto_perfil", null)
      .limit(50);

    if (error) throw error;

    const resultados: { id: string; ok: boolean; url?: string }[] = [];

    // Testa endpoint com o primeiro lead para diagnóstico
    const testLead = leads?.[0];
    let debugInfo: any = null;
    if (testLead) {
      const instancia = (testLead as any).canais_crm?.evolution_instancia;
      if (instancia && testLead.contato_id) {
        const jid = `${testLead.contato_id}@s.whatsapp.net`;
        const testRes = await fetch(
          `${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instancia}`,
          { method: "POST", headers: { "apikey": globalKey, "Content-Type": "application/json" }, body: JSON.stringify({ number: jid }) }
        );
        const testBody = await testRes.text();
        debugInfo = { status: testRes.status, body: testBody, jid, instancia };
        console.log("[fotos] debug:", JSON.stringify(debugInfo));
      }
    }

    for (const lead of leads ?? []) {
      const instancia = (lead as any).canais_crm?.evolution_instancia;
      if (!instancia || !lead.contato_id) continue;

      try {
        const jid = `${lead.contato_id}@s.whatsapp.net`;
        const res = await fetch(
          `${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instancia}`,
          { method: "POST", headers: { "apikey": globalKey, "Content-Type": "application/json" }, body: JSON.stringify({ number: jid }) }
        );
        if (res.ok) {
          const data = await res.json();
          // Tenta vários campos possíveis dependendo da versão da API
          const picUrl: string | undefined = data?.profilePictureUrl ?? data?.picture ?? data?.imgUrl ?? data?.url;
          if (picUrl) {
            await supabase.from("leads").update({ foto_perfil: picUrl }).eq("id", lead.id);
            resultados.push({ id: lead.id, ok: true, url: picUrl });
          } else {
            resultados.push({ id: lead.id, ok: false, raw: data });
          }
        } else {
          const errText = await res.text();
          resultados.push({ id: lead.id, ok: false, status: res.status, err: errText.substring(0, 100) });
        }
      } catch (e: any) {
        resultados.push({ id: lead.id, ok: false, err: e.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, total: leads?.length ?? 0, debugInfo, resultados }), {
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
