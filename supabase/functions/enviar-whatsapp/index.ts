import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { telefone, mensagem, template_id, entidade_tipo, entidade_id, entidade_nome } = body;

    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ error: "telefone and mensagem are required" }), { status: 400, headers: corsHeaders });
    }

    // Get WhatsApp config from admin's configuracoes_usuario
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find any admin user's config with whatsapp settings
    const { data: configs } = await serviceClient
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
      // Log as failed
      await serviceClient.from("whatsapp_mensagens").insert({
        user_id: userId,
        telefone,
        mensagem,
        template_id: template_id || null,
        entidade_tipo: entidade_tipo || null,
        entidade_id: entidade_id || null,
        entidade_nome: entidade_nome || null,
        status: "erro",
        erro: "WhatsApp não configurado",
      });
      return new Response(JSON.stringify({ error: "WhatsApp não configurado. Configure a API nas Configurações." }), { status: 400, headers: corsHeaders });
    }

    // Clean phone number
    const cleanPhone = telefone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Build API request based on common Evolution API / Z-API format
    const apiUrl = whatsappConfig.whatsapp_url.replace(/\/+$/, "");
    const instance = whatsappConfig.whatsapp_instancia || "";

    let sendUrl = "";
    let sendBody: any = {};
    let sendHeaders: any = {
      "Content-Type": "application/json",
      apikey: whatsappConfig.whatsapp_token,
    };

    // Evolution API format
    if (apiUrl.includes("evolution") || instance) {
      sendUrl = `${apiUrl}/message/sendText/${instance}`;
      sendBody = {
        number: fullPhone,
        text: mensagem,
      };
    } else {
      // Z-API format
      sendUrl = `${apiUrl}/send-text`;
      sendHeaders = {
        "Content-Type": "application/json",
        "Client-Token": whatsappConfig.whatsapp_token,
      };
      sendBody = {
        phone: fullPhone,
        message: mensagem,
      };
    }

    let status = "enviado";
    let erro: string | null = null;

    try {
      const apiRes = await fetch(sendUrl, {
        method: "POST",
        headers: sendHeaders,
        body: JSON.stringify(sendBody),
      });

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        status = "erro";
        erro = `API ${apiRes.status}: ${errText.substring(0, 200)}`;
      } else {
        await apiRes.text();
      }
    } catch (fetchErr: any) {
      status = "erro";
      erro = fetchErr.message || "Erro de conexão com a API";
    }

    // Log message
    await serviceClient.from("whatsapp_mensagens").insert({
      user_id: userId,
      telefone: fullPhone,
      mensagem,
      template_id: template_id || null,
      entidade_tipo: entidade_tipo || null,
      entidade_id: entidade_id || null,
      entidade_nome: entidade_nome || null,
      status,
      erro,
    });

    if (status === "erro") {
      return new Response(JSON.stringify({ error: erro }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
