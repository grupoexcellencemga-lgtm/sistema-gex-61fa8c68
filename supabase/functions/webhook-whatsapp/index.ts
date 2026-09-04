import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ETAPA_WHATSAPP_ID = "aaaaaaaa-0002-0002-0002-000000000002";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { event, instance, data } = body;

    console.log("[webhook] event:", event, "instance:", instance);

    if (event !== "messages.upsert") return new Response("ignored", { status: 200 });
    if (!data) return new Response("ignored", { status: 200 });

    const mensagens = Array.isArray(data)
      ? data
      : Array.isArray(data?.messages)
      ? data.messages
      : [data];

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

      // Resolve nome do contato
      let nomeContato: string = fromMe ? telefone : (msg.pushName || telefone);
      if (fromMe) {
        try {
          const EVOLUTION_URL = "http://2.25.125.70:8080";
          const globalKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
          if (globalKey) {
            const contactRes = await fetch(
              `${EVOLUTION_URL}/chat/findContacts/${instance}?where={"id":"${remoteJid}"}`,
              { headers: { apikey: globalKey } }
            );
            if (contactRes.ok) {
              const contacts = await contactRes.json();
              const contact = Array.isArray(contacts) ? contacts[0] : contacts;
              const nome = contact?.pushName || contact?.name || contact?.verifiedName;
              if (nome) nomeContato = nome;
            }
          }
        } catch (_) { /* ignora — usa telefone como fallback */ }
      }
      const texto: string =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        "[Mídia]";

      console.log("[webhook] msg de:", telefone, "fromMe:", fromMe, "texto:", texto.substring(0, 50));

      // Busca ou cria lead
      let leadId: string | undefined;
      const { data: existingLead } = await supabase
        .from("leads")
        .select("id, status_atendimento, bot_ativo")
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
            telefone,
            origem: "whatsapp",
            empresa_id: empresaId,
            canal_id: canal.id,
            contato_id: telefone,
            etapa_id: ETAPA_WHATSAPP_ID,
            status_atendimento: "fila",
          })
          .select("id, status_atendimento")
          .maybeSingle();
        if (insertErr || !newLead) {
          const { data: retry } = await supabase.from("leads").select("id, status_atendimento")
            .eq("contato_id", telefone).eq("canal_id", canal.id).eq("empresa_id", empresaId)
            .is("deleted_at", null).maybeSingle();
          if (!retry?.id) { console.error("Erro ao criar lead:", insertErr); continue; }
          leadId = retry.id;
        } else {
          leadId = newLead.id;
        }
      }

      // Busca protocolo ativo para linkar a mensagem
      const { data: protocolo } = await supabase
        .from("protocolos_atendimento")
        .select("id")
        .eq("lead_id", leadId)
        .eq("status", "ativo")
        .maybeSingle();

      // Insere mensagem
      await supabase.from("mensagens_crm").insert({
        lead_id: leadId,
        empresa_id: empresaId,
        conteudo: texto,
        direcao: fromMe ? "saida" : "entrada",
        canal: "whatsapp",
        protocolo_id: protocolo?.id ?? null,
      });

      // Foto de perfil (best-effort)
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
            if (picUrl) await supabase.from("leads").update({ foto_perfil: picUrl }).eq("id", leadId);
          }
        }
      } catch (_) { /* ignora */ }

      if (fromMe) {
        await supabase.from("leads").update({ ultima_mensagem_em: new Date().toISOString() }).eq("id", leadId);
      } else {
        // Mensagem de entrada: se estava finalizado, volta para fila
        const statusAtual = existingLead?.status_atendimento;
        if (statusAtual === "finalizado") {
          await supabase.from("leads").update({
            status_atendimento: "fila",
            atendente_id: null,
            atribuido_em: null,
          }).eq("id", leadId);
          console.log("[webhook] lead", leadId, "voltou para fila (era finalizado)");
        }

        // Atualiza nome do lead com pushName real do contato (caso tenha sido criado fromMe com o número)
        if (msg.pushName && leadId) {
          await supabase.from("leads")
            .update({ nome: msg.pushName })
            .eq("id", leadId)
            .like("nome", telefone); // só atualiza se o nome ainda é o número
        }

        await supabase.rpc("incrementar_mensagens_nao_lidas", { lead_id_param: leadId });

        // Disparar motor de fluxo (fire-and-forget)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl}/functions/v1/executar-fluxo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ leadId, canalId: canal.id, empresaId, ultimaMensagem: texto, telefone }),
        }).catch(e => console.error("[webhook] erro executar-fluxo:", e));

        // Se bot_ativo, dispara processar-bot imediatamente (sem aguardar cron)
        if (existingLead?.bot_ativo) {
          fetch(`${supabaseUrl}/functions/v1/processar-bot`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: "{}",
          }).catch(e => console.error("[webhook] erro processar-bot:", e));
        }
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
