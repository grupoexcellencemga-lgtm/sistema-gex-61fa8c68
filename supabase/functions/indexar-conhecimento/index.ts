import { createClient } from "npm:@supabase/supabase-js@2";

// Declara o runtime Supabase AI disponível em Edge Functions
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run(input: string, opts?: { mean_pool?: boolean; normalize?: boolean }): Promise<Float32Array>;
    };
  };
};

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
    const { id, conteudo } = await req.json();

    if (!id || !conteudo) {
      return new Response(JSON.stringify({ error: "id e conteudo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = new Supabase.ai.Session("gte-small");
    const embedding = await session.run(conteudo, { mean_pool: true, normalize: true });

    const { error } = await supabase
      .from("base_conhecimento")
      .update({
        embedding: Array.from(embedding),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    console.log(`[indexar-conhecimento] embedding gerado para artigo ${id}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[indexar-conhecimento] erro:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
