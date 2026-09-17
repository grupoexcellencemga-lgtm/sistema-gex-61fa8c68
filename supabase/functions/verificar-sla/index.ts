import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLA_MINUTOS_PADRAO = 60;
// Nao repete o aviso do mesmo lead antes disso, senao vira ruido a cada rodada.
const REALERTA_HORAS = 12;

function formatDuracao(min: number): string {
  if (min < 60) return `${min}m`;
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  if (dias > 0) return horas > 0 ? `${dias}d ${horas}h` : `${dias}d`;
  return `${horas}h`;
}

/**
 * O numero de destino vem SOMENTE da variavel de ambiente. Nunca de dado de
 * lead — assim e impossivel esta funcao mandar mensagem para um cliente.
 */
async function avisarPorWhatsapp(empresaId: string, texto: string) {
  const destino = Deno.env.get("SLA_ALERTA_WHATSAPP");
  if (!destino) return { enviado: false, motivo: "SLA_ALERTA_WHATSAPP nao configurado" };

  const { data: canal } = await supabase
    .from("canais_crm")
    .select("evolution_url, evolution_instancia, evolution_token")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .not("evolution_url", "is", null)
    .limit(1)
    .maybeSingle();

  if (!canal?.evolution_url || !canal?.evolution_instancia) {
    return { enviado: false, motivo: "nenhum canal ativo com evolution_url" };
  }

  const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  const resp = await fetch(
    `${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey ?? "" },
      body: JSON.stringify({ number: destino, text: texto }),
    }
  );

  return { enviado: resp.ok, status: resp.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const limiteRealerta = new Date(Date.now() - REALERTA_HORAS * 3600_000).toISOString();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("id, nome, telefone, empresa_id, ultima_mensagem_em, sla_minutos, sla_alertado_em")
      .is("deleted_at", null)
      .eq("ultima_mensagem_direcao", "entrada")
      .not("ultima_mensagem_em", "is", null)
      .or(`sla_alertado_em.is.null,sla_alertado_em.lt.${limiteRealerta}`)
      .order("ultima_mensagem_em", { ascending: true })
      .limit(200);

    if (error) throw error;

    const agora = Date.now();
    const atrasados = (leads ?? []).filter((l) => {
      const min = Math.floor((agora - new Date(l.ultima_mensagem_em!).getTime()) / 60000);
      return min >= (l.sla_minutos ?? SLA_MINUTOS_PADRAO);
    });

    if (atrasados.length === 0) {
      return new Response(JSON.stringify({ ok: true, atrasados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Um aviso resumido por empresa. Um por lead viraria spam com 30 atrasados.
    const porEmpresa = new Map<string, typeof atrasados>();
    for (const l of atrasados) {
      const lista = porEmpresa.get(l.empresa_id) ?? [];
      lista.push(l);
      porEmpresa.set(l.empresa_id, lista);
    }

    const resultados = [];

    for (const [empresaId, lista] of porEmpresa) {
      const maisAntigo = lista[0];
      const esperaMin = Math.floor(
        (agora - new Date(maisAntigo.ultima_mensagem_em!).getTime()) / 60000
      );
      const quem = maisAntigo.nome || maisAntigo.telefone || "um contato";
      const titulo = `${lista.length} ${lista.length === 1 ? "lead aguarda" : "leads aguardam"} resposta`;
      const corpo = `O mais antigo é ${quem}, esperando há ${formatDuracao(esperaMin)}.`;

      const push = await supabase.functions
        .invoke("enviar-push", {
          body: { empresa_id: empresaId, title: titulo, body: corpo, url: "/funil" },
        })
        .then((r) => ({ ok: !r.error }))
        .catch(() => ({ ok: false }));

      const whats = await avisarPorWhatsapp(empresaId, `*${titulo}*\n${corpo}`).catch(
        (e) => ({ enviado: false, motivo: String(e) })
      );

      await supabase
        .from("leads")
        .update({ sla_alertado_em: new Date().toISOString() })
        .in("id", lista.map((l) => l.id));

      resultados.push({ empresaId, leads: lista.length, push, whats });
    }

    return new Response(
      JSON.stringify({ ok: true, atrasados: atrasados.length, resultados }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[verificar-sla]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
