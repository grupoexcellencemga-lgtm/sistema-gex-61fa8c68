import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UTM_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  email: "E-mail",
  google: "Google",
  indicacao: "Indicação",
  site: "Site",
  stories: "Stories",
  reels: "Reels",
};

Deno.serve(async (req) => {
  // Supabase DB webhooks usam POST com um secret no header
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (webhookSecret) {
    const authHeader = req.headers.get("x-supabase-signature") ?? req.headers.get("authorization");
    if (!authHeader?.includes(webhookSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    // Supabase DB webhook payload: { type: "INSERT", table: "...", record: {...} }
    const record = payload?.record;
    if (!record) {
      return new Response(JSON.stringify({ error: "No record in payload" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceKey);

    // Busca dados do evento
    const { data: evento } = await client
      .from("eventos")
      .select("nome, data, local, responsavel")
      .eq("id", record.evento_id)
      .single();

    // Busca config do WhatsApp
    const { data: configs } = await client
      .from("configuracoes_usuario")
      .select("dados_empresa")
      .limit(50);

    let whatsappConfig: any = null;
    for (const cfg of configs || []) {
      const de = cfg.dados_empresa as any;
      if (de?.whatsapp_url && de?.whatsapp_token) {
        whatsappConfig = de;
        break;
      }
    }

    if (!whatsappConfig?.whatsapp_url || !whatsappConfig?.whatsapp_token) {
      console.log("WhatsApp não configurado — inscrição recebida mas não notificada");
      return new Response(JSON.stringify({ ok: true, notified: false }), { status: 200 });
    }

    // Número que vai receber a notificação (configurado pelo admin)
    const notificarNumero = whatsappConfig.whatsapp_notificacao_numero || Deno.env.get("NOTIFICAR_NUMERO");
    if (!notificarNumero) {
      console.log("Número de notificação não configurado");
      return new Response(JSON.stringify({ ok: true, notified: false }), { status: 200 });
    }

    // Conta total de inscritos no evento
    const { count: totalInscritos } = await client
      .from("participantes_eventos")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", record.evento_id);

    // Monta mensagem
    const origem = record.utm_source
      ? (UTM_LABELS[record.utm_source.toLowerCase()] ?? record.utm_source)
      : "Direto";

    const origemEmoji: Record<string, string> = {
      WhatsApp: "💬", Instagram: "📸", Facebook: "👥",
      YouTube: "▶️", TikTok: "🎵", "E-mail": "📧",
      Google: "🔍", Indicação: "🤝", Site: "🌐",
    };

    const emoji = origemEmoji[origem] ?? "📋";

    const linhas = [
      `${emoji} *Nova inscrição!*`,
      ``,
      `*Evento:* ${evento?.nome ?? "—"}`,
      `*Nome:* ${record.nome ?? "—"}`,
      record.telefone ? `*WhatsApp:* ${record.telefone}` : null,
      record.email ? `*E-mail:* ${record.email}` : null,
      `*Origem:* ${origem}`,
      ``,
      `Total de inscritos: ${totalInscritos ?? "?"}`,
    ].filter(Boolean).join("\n");

    // Chama Evolution API
    const apiUrl = whatsappConfig.whatsapp_url.replace(/\/+$/, "");
    const instance = whatsappConfig.whatsapp_instancia || "";
    const cleanPhone = notificarNumero.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    const sendRes = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: whatsappConfig.whatsapp_token },
      body: JSON.stringify({ number: fullPhone, text: linhas }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error("Erro ao enviar WhatsApp:", err);
      return new Response(JSON.stringify({ ok: false, error: err }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, notified: true }), { status: 200 });
  } catch (err: any) {
    console.error("Erro na função notificar-inscricao:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
