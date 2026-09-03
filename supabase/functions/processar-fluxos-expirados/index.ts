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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Busca todas as sessões em espera com timer expirado
    const { data: sessoes, error } = await supabase
      .from("fluxo_sessoes")
      .select("id, lead_id, empresa_id")
      .eq("status", "waiting")
      .lt("wait_until", new Date().toISOString())
      .limit(50);

    if (error) throw error;
    if (!sessoes || sessoes.length === 0) {
      return new Response(JSON.stringify({ ok: true, processadas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[processar-fluxos-expirados] ${sessoes.length} sessões expiradas`);

    // Para cada sessão, busca o canal do lead e dispara executar-fluxo
    const resultados = await Promise.allSettled(
      sessoes.map(async (s) => {
        const { data: lead } = await supabase
          .from("leads")
          .select("canal_id, contato_id, telefone")
          .eq("id", s.lead_id)
          .maybeSingle();

        if (!lead?.canal_id) {
          console.warn(`[processar-fluxos-expirados] lead ${s.lead_id} sem canal`);
          return;
        }

        const tel = lead.telefone ?? lead.contato_id ?? "";

        await fetch(`${supabaseUrl}/functions/v1/executar-fluxo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            leadId: s.lead_id,
            canalId: lead.canal_id,
            empresaId: s.empresa_id,
            ultimaMensagem: "",
            telefone: tel,
          }),
        });

        console.log(`[processar-fluxos-expirados] lead ${s.lead_id} retomado`);
      })
    );

    const ok = resultados.filter(r => r.status === "fulfilled").length;
    const fail = resultados.filter(r => r.status === "rejected").length;

    return new Response(JSON.stringify({ ok: true, processadas: ok, falhas: fail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[processar-fluxos-expirados]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
