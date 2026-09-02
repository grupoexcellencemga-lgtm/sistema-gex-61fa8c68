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

    console.log("[webhook] event:", event, "instance:", instance, "data_type:", Array.isArray(data) ? "array" : typeof data);

    if (event !== "messages.upsert") return new Response("ignored", { status: 200 });
    if (!data) return new Response("ignored", { status: 200 });

    // Evolution API v2: data = { messages: [...], type: "notify" }
    // Versões anteriores: data = array ou objeto direto
    const mensagens = Array.isArray(data)
      ? data
      : Array.isArray(data?.messages)
      ? data.messages
      : [data];

    // Busca canal pelo nome da instância (uma vez, fora do loop)
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

    for (const msg of mensagens) {
      const fromMe: boolean = msg.key?.fromMe === true;

      const remoteJid: string = msg.key?.remoteJid ?? "";
      if (!remoteJid || remoteJid.includes("@g.us")) continue;

      const telefone = remoteJid.replace("@s.whatsapp.net", "");
      const nomeContato: string = msg.pushName || telefone;
      const texto: string =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "[Mídia]";

      console.log("[webhook] processando msg de:", telefone, "fromMe:", fromMe, "texto:", texto.substring(0, 50));

      // Busca lead existente primeiro (evita conflito com índice parcial)
      let leadId: string | undefined;
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id")
        .eq("contato_id", telefone)
        .eq("canal_id", canal.id)
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .maybeSingle();

      if (existingLead) {
        leadId = existingLead.id;
      } else {
        const { data: newLead, error: insertErr } = await supabase
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
          .maybeSingle();
        if (insertErr || !newLead) {
          // Pode ser race condition — tenta buscar novamente
          const { data: retry } = await supabase.from("leads").select("id")
            .eq("contato_id", telefone).eq("canal_id", canal.id).eq("empresa_id", empresaId)
            .is("deleted_at", null).maybeSingle();
          leadId = retry?.id;
          if (!leadId) { console.error("Erro ao criar lead:", insertErr); continue; }
        } else {
          leadId = newLead.id;
        }
      }

      await supabase.from("mensagens_crm").insert({
        lead_id: leadId,
        empresa_id: empresaId,
        conteudo: texto,
        direcao: fromMe ? "saida" : "entrada",
        canal: "whatsapp",
      });

      // Busca foto de perfil (best-effort, não falha se der erro)
      try {
        const EVOLUTION_URL = "http://2.25.125.70:8080";
        const globalKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
        if (globalKey) {
          const picRes = await fetch(
            `${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instance}`,
            { method: "POST", headers: { "apikey": globalKey, "Content-Type": "application/json" }, body: JSON.stringify({ number: remoteJid }) }
          );
          if (picRes.ok) {
            const picData = await picRes.json();
            const picUrl: string | undefined = picData?.profilePictureUrl ?? picData?.picture ?? picData?.imgUrl ?? picData?.url;
            if (picUrl) {
              await supabase.from("leads").update({ foto_perfil: picUrl }).eq("id", leadId);
            }
          }
        }
      } catch (_) { /* ignora erro de foto */ }

      if (fromMe) {
        await supabase.from("leads").update({
          ultima_mensagem_em: new Date().toISOString(),
        }).eq("id", leadId);
      } else {
        // Se a conversa estava finalizada, volta para fila
        const { data: leadAtual } = await supabase
          .from("leads")
          .select("status_atendimento")
          .eq("id", leadId)
          .maybeSingle();

        if ((leadAtual as any)?.status_atendimento === "finalizado") {
          await supabase.from("leads").update({
            status_atendimento: "fila",
            atendente_id: null,
            atribuido_em: null,
          }).eq("id", leadId);
        }

        await supabase.rpc("incrementar_mensagens_nao_lidas", { lead_id_param: leadId });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
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
