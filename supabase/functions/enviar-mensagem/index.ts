import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TipoMensagem = "texto" | "imagem" | "audio" | "video" | "documento" | "sticker";

function evoMediatype(tipo: TipoMensagem): string {
  if (tipo === "imagem" || tipo === "sticker") return "image";
  if (tipo === "audio") return "audio";
  if (tipo === "video") return "video";
  return "document";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      lead_id,
      mensagem,
      tipo = "texto",
      media_url,
      media_mime,
      media_nome,
    }: {
      lead_id: string;
      mensagem?: string;
      tipo?: TipoMensagem;
      media_url?: string;
      media_mime?: string;
      media_nome?: string;
    } = body;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: "lead_id obrigatorio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (tipo === "texto" && !mensagem?.trim()) {
      return new Response(JSON.stringify({ error: "mensagem obrigatoria para tipo texto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (tipo !== "texto" && !media_url) {
      return new Response(JSON.stringify({ error: "media_url obrigatoria para midias" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, contato_id, empresa_id, canal_id")
      .eq("id", lead_id)
      .single();
    if (leadErr || !lead) throw new Error("Lead nao encontrado");
    if (!lead.contato_id) throw new Error("Lead sem numero de telefone");
    if (!lead.canal_id) throw new Error("Lead sem canal associado");

    const { data: canal, error: canalErr } = await supabase
      .from("canais_crm")
      .select("evolution_url, evolution_token, evolution_instancia, tipo")
      .eq("id", lead.canal_id)
      .single();
    if (canalErr || !canal) throw new Error("Canal nao encontrado");
    if (canal.tipo !== "whatsapp") throw new Error("Envio suportado apenas para WhatsApp");

    const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
    if (!apiKey) throw new Error("API key da Evolution nao configurada");

    const { data: protocolo } = await supabase
      .from("protocolos_atendimento")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("status", "ativo")
      .maybeSingle();

    const conteudo = mensagem?.trim() || media_nome || `[${tipo.charAt(0).toUpperCase() + tipo.slice(1)}]`;

    // Salva no DB
    await supabase.from("mensagens_crm").insert({
      lead_id: lead.id,
      empresa_id: lead.empresa_id,
      conteudo,
      tipo,
      media_url: media_url ?? null,
      media_mime: media_mime ?? null,
      media_nome: media_nome ?? null,
      direcao: "saida",
      canal: "whatsapp",
      protocolo_id: protocolo?.id ?? null,
    });

    await supabase.from("leads").update({
      ultima_mensagem_em: new Date().toISOString(),
      ultima_mensagem_texto: conteudo.substring(0, 200),
      ultima_mensagem_direcao: "saida",
    }).eq("id", lead.id);

    // Envia via Evolution API
    if (tipo === "texto") {
      const evoUrl = `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`;
      const evoRes = await fetch(evoUrl, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ number: lead.contato_id, text: mensagem!.trim() }),
      });
      if (!evoRes.ok) {
        const evoErr = await evoRes.text();
        throw new Error(`Evolution API: ${evoErr}`);
      }
    } else {
      const evoUrl = `${canal.evolution_url}/message/sendMedia/${canal.evolution_instancia}`;
      const evoBody: Record<string, string> = {
        number: lead.contato_id,
        mediatype: evoMediatype(tipo),
        media: media_url!,
      };
      if (media_mime) evoBody.mimetype = media_mime;
      if (media_nome) evoBody.fileName = media_nome;
      if (mensagem?.trim()) evoBody.caption = mensagem.trim();

      const evoRes = await fetch(evoUrl, {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(evoBody),
      });
      if (!evoRes.ok) {
        const evoErr = await evoRes.text();
        throw new Error(`Evolution API (media): ${evoErr}`);
      }
    }

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
