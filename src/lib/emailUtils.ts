import { supabase } from "@/integrations/supabase/client";

export async function enviarEmail(
  templateNome: string,
  to: string,
  variaveis: Record<string, string>
) {
  try {
    const { data, error } = await supabase.functions.invoke("enviar-email", {
      body: { to, template_nome: templateNome, variaveis },
    });
    if (error) {
      console.error("Email send error:", error);
      return false;
    }
    return data?.success || false;
  } catch (e) {
    console.error("Email send exception:", e);
    return false;
  }
}

export async function getEmpresaNome(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return "Nossa Empresa";
    const { data } = await supabase
      .from("configuracoes_usuario")
      .select("dados_empresa")
      .eq("user_id", session.user.id)
      .maybeSingle();
    return (data?.dados_empresa as any)?.nome || "Nossa Empresa";
  } catch {
    return "Nossa Empresa";
  }
}
