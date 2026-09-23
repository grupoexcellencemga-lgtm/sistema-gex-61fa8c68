import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const ETAPA_WHATSAPP_ID = "aaaaaaaa-0002-0002-0002-000000000002";
const EVOLUTION_URL = "http://2.25.125.70:8080";

// MIME types de imagem aceitos como visão pelo Claude
const VISION_MIME_TYPES_WEBHOOK = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TipoMensagem = "texto" | "imagem" | "audio" | "video" | "documento" | "sticker";

// Mensagens como view-once e ephemeral encapsulam o conteúdo real num nível a mais.
// Desaninha antes de inspecionar o tipo.
function desaninharMsg(msg: Record<string, unknown>): Record<string, unknown> {
  const inner =
    (msg.viewOnceMessage as any)?.message ??
    (msg.viewOnceMessageV2 as any)?.message?.message ??
    (msg.ephemeralMessage as any)?.message ??
    (msg.editedMessage as any)?.message;
  if (inner) return desaninharMsg(inner as Record<string, unknown>);
  return msg;
}

function detectarTipo(message: Record<string, unknown>): TipoMensagem {
  if (message.imageMessage)    return "imagem";
  if (message.audioMessage)    return "audio";
  if (message.videoMessage || message.ptvMessage) return "video";
  if (message.documentMessage || message.documentWithCaptionMessage) return "documento";
  if (message.stickerMessage)  return "sticker";
  return "texto";
}

async function baixarMidia(
  instance: string,
  msg: Record<string, unknown>,
  globalKey: string
): Promise<{ base64: string; mimetype: string } | null> {
  try {
    const res = await fetch(
      `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instance}`,
      {
        method: "POST",
        headers: { apikey: globalKey, "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, convertToMp4: false }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.base64) return null;
    return { base64: json.base64, mimetype: json.mimetype ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function uploadMidia(
  empresaId: string,
  leadId: string,
  tipo: TipoMensagem,
  base64: string,
  mimetype: string,
  nomeArquivo?: string
): Promise<string | null> {
  try {
    const ext = extFromMime(mimetype);
    const nome = nomeArquivo ?? `${tipo}-${Date.now()}.${ext}`;
    const path = `${empresaId}/${leadId}/${nome}`;
    const bytes = base64ToUint8Array(base64);

    const { error } = await supabase.storage
      .from("midia_crm")
      .upload(path, bytes, { contentType: mimetype, upsert: true });

    if (error) {
      console.error("[webhook] upload mídia erro:", error.message);
      return null;
    }

    const { data } = supabase.storage.from("midia_crm").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("[webhook] upload mídia exception:", e);
    return null;
  }
}

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
    const globalKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY") ?? "";

    for (const msg of mensagens) {
      const fromMe: boolean = msg.key?.fromMe === true;
      const remoteJid: string = msg.key?.remoteJid ?? "";
      if (!remoteJid || remoteJid.includes("@g.us")) continue;

      const telefone = remoteJid.replace("@s.whatsapp.net", "");

      // --- Tipo e conteúdo ---
      const rawMessage = (msg.message ?? {}) as Record<string, unknown>;
      // Reações emoji não têm conteúdo legível — ignorar silenciosamente
      if (rawMessage.reactionMessage) continue;
      const message = desaninharMsg(rawMessage);
      const tipo = detectarTipo(message);

      const docMsg = (message.documentMessage ?? (message.documentWithCaptionMessage as any)?.message?.documentMessage) as Record<string, unknown> | undefined;
      const nomeArquivo: string | undefined =
        (docMsg?.fileName as string) ??
        (message.imageMessage as any)?.fileName ??
        undefined;

      const texto: string =
        (message.conversation as string) ||
        ((message.extendedTextMessage as any)?.text as string) ||
        ((message.listResponseMessage as any)?.singleSelectReply?.selectedRowId as string) ||
        ((message.buttonsResponseMessage as any)?.selectedButtonId as string) ||
        ((message.imageMessage as any)?.caption as string) ||
        ((message.videoMessage as any)?.caption as string) ||
        (docMsg?.caption as string) ||
        (tipo !== "texto" ? `[${tipo.charAt(0).toUpperCase() + tipo.slice(1)}]` : "[Mídia]");

      if (texto === "[Mídia]") {
        console.warn("[webhook] tipo nao detectado. Keys:", Object.keys(rawMessage).join(","));
      }
      console.log("[webhook] msg de:", telefone, "fromMe:", fromMe, "tipo:", tipo, "texto:", texto.substring(0, 50));

      // Resolve nome do contato.
      // Prioridade: o nome salvo na agenda do aparelho (contact.name) vence o
      // que a pessoa pos no perfil dela (pushName) -- se alguem salvou o
      // contato como "Jaqueline", e assim que ela deve ser chamada, mesmo que
      // o WhatsApp dela diga "Jaq".
      // verifiedName fica FORA de proposito: e o nome comercial da conta, e o
      // bot acabaria chamando a pessoa pelo nome da empresa.
      // Antes esta busca so rodava em mensagem de saida, entao o nome da
      // agenda nunca chegava para quem escrevia pra gente.
      let nomeContato: string = msg.pushName || telefone;
      let nomeVeioDaAgenda = false;
      if (globalKey) {
        try {
          const contactRes = await fetch(
            `${EVOLUTION_URL}/chat/findContacts/${instance}?where={"id":"${remoteJid}"}`,
            { headers: { apikey: globalKey } }
          );
          if (contactRes.ok) {
            const contacts = await contactRes.json();
            const contact = Array.isArray(contacts) ? contacts[0] : contacts;
            if (contact?.name) {
              nomeContato = contact.name;
              nomeVeioDaAgenda = true;
            } else if (contact?.pushName) {
              nomeContato = contact.pushName;
            }
          }
        } catch (_) { /* ignora */ }
      }
      if (fromMe && nomeContato === (msg.pushName || telefone)) {
        // Em mensagem nossa o pushName e o NOSSO perfil, nao o do cliente.
        nomeContato = telefone;
      }

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
            bot_ativo: true,
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

      // --- Download de mídia (best-effort) ---
      let mediaUrl: string | null = null;
      let mediaMime: string | null = null;

      if (tipo !== "texto" && globalKey && leadId) {
        const midia = await baixarMidia(instance, msg, globalKey);
        if (midia) {
          mediaMime = midia.mimetype;
          mediaUrl = await uploadMidia(empresaId, leadId, tipo, midia.base64, midia.mimetype, nomeArquivo);
        }
      }

      // --- Mensagem de saída (fromMe) ---
      if (fromMe) {
        const { data: protocoloAtivo } = await supabase
          .from("protocolos_atendimento")
          .select("id")
          .eq("lead_id", leadId)
          .eq("status", "ativo")
          .maybeSingle();

        await supabase.from("mensagens_crm").insert({
          lead_id: leadId,
          empresa_id: empresaId,
          conteudo: texto,
          tipo,
          media_url: mediaUrl,
          media_mime: mediaMime,
          media_nome: nomeArquivo ?? null,
          direcao: "saida",
          canal: "whatsapp",
          protocolo_id: protocoloAtivo?.id ?? null,
        });
        // Responder pelo WhatsApp do notebook conta como ter lido a conversa.
        // Sem zerar aqui, o contador so cresce: o atendimento acontece fora do
        // sistema e o sistema nunca fica sabendo. Eram 153 nao lidas fantasma
        // em 29 leads ja respondidos.
        await supabase.from("leads").update({
          ultima_mensagem_em: new Date().toISOString(),
          ultima_mensagem_texto: texto.substring(0, 200),
          ultima_mensagem_direcao: "saida",
          mensagens_nao_lidas: 0,
          tem_mensagem_nova: false,
        }).eq("id", leadId);

      } else {
        // --- Mensagem de entrada ---

        // 1. Se estava finalizado, volta para fila
        const statusAtual = existingLead?.status_atendimento;
        if (statusAtual === "finalizado") {
          await supabase.from("leads").update({
            status_atendimento: "fila",
            atendente_id: null,
            atribuido_em: null,
          }).eq("id", leadId);
          console.log("[webhook] lead", leadId, "voltou para fila (era finalizado)");
        }

        // 2. Garante protocolo ativo
        let protocoloId: string | null = null;
        const { data: protocoloExistente } = await supabase
          .from("protocolos_atendimento")
          .select("id")
          .eq("lead_id", leadId)
          .eq("status", "ativo")
          .maybeSingle();

        if (protocoloExistente) {
          protocoloId = protocoloExistente.id;
        } else {
          const { data: numeroProtocolo } = await supabase.rpc("gerar_numero_protocolo");
          const { data: novoProtocolo } = await supabase
            .from("protocolos_atendimento")
            .insert({ lead_id: leadId, empresa_id: empresaId, status: "ativo", numero_protocolo: numeroProtocolo })
            .select("id")
            .maybeSingle();
          protocoloId = novoProtocolo?.id ?? null;
          console.log("[webhook] protocolo", numeroProtocolo, "criado para lead", leadId);
        }

        // 3. Insere mensagem
        await supabase.from("mensagens_crm").insert({
          lead_id: leadId,
          empresa_id: empresaId,
          conteudo: texto,
          tipo,
          media_url: mediaUrl,
          media_mime: mediaMime,
          media_nome: nomeArquivo ?? null,
          direcao: "entrada",
          canal: "whatsapp",
          protocolo_id: protocoloId,
        });

        // 4. Foto de perfil (best-effort)
        if (globalKey) {
          try {
            const picRes = await fetch(
              `${EVOLUTION_URL}/chat/fetchProfilePictureUrl/${instance}`,
              { method: "POST", headers: { apikey: globalKey, "Content-Type": "application/json" }, body: JSON.stringify({ number: remoteJid }) }
            );
            if (picRes.ok) {
              const picData = await picRes.json();
              const picUrl: string | undefined = picData?.profilePictureUrl ?? picData?.picture ?? picData?.imgUrl ?? picData?.url;
              if (picUrl) await supabase.from("leads").update({ foto_perfil: picUrl }).eq("id", leadId);
            }
          } catch (_) { /* ignora */ }
        }

        // 5. Atualiza nome do lead.
        // Nome vindo da agenda sobrepoe o que estiver la: se alguem salvou o
        // contato como "Jaqueline", e porque quer que ela seja chamada assim.
        // pushName so preenche quando o lead ainda esta com o telefone no
        // lugar do nome -- senao toda mensagem desfaria a correcao manual.
        if (leadId && nomeVeioDaAgenda) {
          await supabase.from("leads").update({ nome: nomeContato }).eq("id", leadId);
        } else if (leadId && msg.pushName) {
          await supabase.from("leads")
            .update({ nome: msg.pushName })
            .eq("id", leadId)
            .like("nome", telefone);
        }

        await supabase.from("leads").update({
          ultima_mensagem_texto: texto.substring(0, 200),
          ultima_mensagem_direcao: "entrada",
        }).eq("id", leadId);

        await supabase.rpc("incrementar_mensagens_nao_lidas", { lead_id_param: leadId });

        // 6. Push notification
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const notifBody = tipo !== "texto"
          ? `[${tipo.charAt(0).toUpperCase() + tipo.slice(1)}]${texto && texto !== `[${tipo.charAt(0).toUpperCase() + tipo.slice(1)}]` ? " " + texto : ""}`
          : (texto.length > 100 ? texto.substring(0, 97) + "..." : texto);

        fetch(`${supabaseUrl}/functions/v1/enviar-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({
            empresa_id: empresaId,
            title: `💬 ${nomeContato}`,
            body: notifBody,
            lead_id: leadId,
            url: "/",
          }),
        }).catch(e => console.error("[webhook] erro enviar-push:", e));

        // 7. Fluxo e bot (texto + imagem para visão no nó AI)
        const tiposFluxo = ["texto", "imagem"];
        if (tiposFluxo.includes(tipo)) {
          // Para imagens, repassar base64 para o fluxo poder enviar à IA com visão
          const fluxoBody: Record<string, any> = {
            leadId,
            canalId: canal.id,
            empresaId,
            ultimaMensagem: texto,
            telefone,
          };
          if (tipo === "imagem" && mediaUrl && mediaMime && VISION_MIME_TYPES_WEBHOOK.includes(mediaMime.toLowerCase())) {
            // Re-baixar mídia como base64 para o fluxo (já foi baixada acima)
            try {
              const midia2 = await baixarMidia(instance, msg, globalKey);
              if (midia2?.base64) {
                fluxoBody.mediaBase64 = midia2.base64;
                fluxoBody.mediaMimeType = midia2.mimetype;
                fluxoBody.mediaCaption = (message as any)?.imageMessage?.caption ?? null;
              }
            } catch (e) {
              console.error("[webhook] erro re-baixar midia para fluxo:", e);
            }
          }
          fetch(`${supabaseUrl}/functions/v1/executar-fluxo`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
            body: JSON.stringify(fluxoBody),
          }).catch(e => console.error("[webhook] erro executar-fluxo:", e));

          if (existingLead?.bot_ativo) {
            fetch(`${supabaseUrl}/functions/v1/processar-bot`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
              body: JSON.stringify({ forceLeadId: leadId, delayMs: 8000 }),
            }).catch(e => console.error("[webhook] erro processar-bot:", e));
          }
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
