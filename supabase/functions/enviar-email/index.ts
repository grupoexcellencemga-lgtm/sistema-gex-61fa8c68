import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const rawTo = String(body.to ?? "").trim();
    const validEmail = rawTo.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)?.[0];

    if (!validEmail) {
      return new Response(
        JSON.stringify({ error: "Email inválido", details: rawTo }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const to = validEmail;
    const { subject, html, template_nome, variaveis } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let finalSubject = subject;
    let finalHtml = html;

    // If template_nome is provided, fetch from DB
    if (template_nome && !html) {
      const { data: template, error: tErr } = await supabase
        .from("email_templates")
        .select("*")
        .eq("nome", template_nome)
        .eq("ativo", true)
        .maybeSingle();

      if (tErr || !template) {
        return new Response(
          JSON.stringify({ error: `Template '${template_nome}' não encontrado` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      finalSubject = template.assunto;
      finalHtml = template.corpo_html;

      // Replace variables
      if (variaveis && typeof variaveis === "object") {
        for (const [key, value] of Object.entries(variaveis)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
          finalSubject = finalSubject.replace(regex, String(value || ""));
          finalHtml = finalHtml.replace(regex, String(value || ""));
        }
      }
    }

    if (!finalSubject || !finalHtml) {
      return new Response(
        JSON.stringify({ error: "Subject e HTML são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sistema GEx <onboarding@resend.dev>",
        to: [to],
        subject: finalSubject,
        html: finalHtml,
      }),
    });

    const resendData = await resendRes.json();

    // Get template_id if applicable
    let templateId = null;
    if (template_nome) {
      const { data: t } = await supabase
        .from("email_templates")
        .select("id")
        .eq("nome", template_nome)
        .maybeSingle();
      templateId = t?.id || null;
    }

    // Log the email
    await supabase.from("emails_enviados").insert({
      template_id: templateId,
      destinatario: to,
      assunto: finalSubject,
      status: resendRes.ok ? "enviado" : "erro",
      erro: resendRes.ok ? null : JSON.stringify(resendData),
      metadata: { resend_id: resendData.id, variaveis },
    });

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: "Falha ao enviar email", details: resendData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
