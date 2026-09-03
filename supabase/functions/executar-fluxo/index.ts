import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.36.3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Types ────────────────────────────────────────────────────────────────────

type FluxoNode = { id: string; type: string; data: Record<string, any> };
type FluxoEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
type FluxoJson = { nodes: FluxoNode[]; edges: FluxoEdge[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNode(f: FluxoJson, id: string): FluxoNode | undefined {
  return f.nodes.find(n => n.id === id);
}

function getNext(f: FluxoJson, nodeId: string): FluxoNode | undefined {
  const edge = f.edges.find(e => e.source === nodeId);
  if (!edge) return undefined;
  return getNode(f, edge.target);
}

function getNextByHandle(f: FluxoJson, nodeId: string, handle: string): FluxoNode | undefined {
  const edge = f.edges.find(e => e.source === nodeId && e.sourceHandle === handle);
  if (!edge) return undefined;
  return getNode(f, edge.target);
}

function checkTrigger(startData: any, lastMsg: string): boolean {
  const trigger = startData.trigger ?? "message_received";
  if (trigger === "message_received" || trigger === "outside_hours") return true;
  if (trigger === "keyword") {
    const kws: string[] = (startData.keywords ?? "")
      .split(",")
      .map((k: string) => k.trim().toLowerCase())
      .filter(Boolean);
    if (!kws.length) return true;
    const msg = lastMsg.toLowerCase();
    return kws.some(k => msg.includes(k));
  }
  return true;
}

function evalCondition(data: any, lastMsg: string): boolean {
  const { field, operator, value } = data;
  if (field !== "message") return false;
  const subject = lastMsg.toLowerCase();
  // Suporte a múltiplas palavras separadas por vírgula
  const vals = (value ?? "").split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean);
  if (!vals.length) return false;
  switch (operator) {
    case "contains":     return vals.some(v => subject.includes(v));
    case "not_contains": return vals.every(v => !subject.includes(v));
    case "equals":       return vals.some(v => subject.trim() === v);
    default:             return false;
  }
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

async function enviar(canal: any, telefone: string, texto: string): Promise<void> {
  const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  await fetch(`${canal.evolution_url}/message/sendText/${canal.evolution_instancia}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ number: telefone, text: texto }),
  });
}

async function salvarMensagem(leadId: string, empresaId: string, conteudo: string): Promise<void> {
  const { data: protocolo } = await supabase
    .from("protocolos_atendimento")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "ativo")
    .maybeSingle();

  await supabase.from("mensagens_crm").insert({
    lead_id: leadId,
    empresa_id: empresaId,
    conteudo,
    direcao: "saida",
    canal: "whatsapp",
    protocolo_id: protocolo?.id ?? null,
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { leadId, canalId, empresaId, ultimaMensagem, telefone } = await req.json();
    if (!leadId || !canalId || !empresaId) {
      return new Response(JSON.stringify({ error: "params missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastMsg: string = ultimaMensagem ?? "";

    // Dados do lead para interpolação de variáveis
    const { data: leadData } = await supabase
      .from("leads")
      .select("nome, telefone, contato_id")
      .eq("id", leadId)
      .maybeSingle();
    const msgVars: Record<string, string> = {
      nome: leadData?.nome ?? "",
      telefone: leadData?.telefone ?? leadData?.contato_id ?? telefone ?? "",
    };

    // 1. Buscar fluxo ativo para o canal
    const { data: fluxo } = await supabase
      .from("fluxos_bot")
      .select("id, fluxo_json")
      .eq("ativo", true)
      .eq("empresa_id", empresaId)
      .contains("canal_ids", [canalId])
      .limit(1)
      .maybeSingle();

    if (!fluxo) {
      return new Response(JSON.stringify({ ok: true, msg: "sem fluxo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fj = fluxo.fluxo_json as FluxoJson;

    // 2. Dados do canal
    const { data: canal } = await supabase
      .from("canais_crm")
      .select("evolution_url, evolution_token, evolution_instancia")
      .eq("id", canalId)
      .maybeSingle();

    if (!canal?.evolution_instancia) {
      return new Response(JSON.stringify({ ok: true, msg: "canal sem instância" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Sessão ativa ou em espera
    const { data: sessao } = await supabase
      .from("fluxo_sessoes")
      .select("*")
      .eq("lead_id", leadId)
      .in("status", ["active", "waiting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let currentNodeId: string;
    let isNew = false;

    if (!sessao) {
      // Iniciar novo fluxo
      const startNode = fj.nodes.find(n => n.type === "start");
      if (!startNode) {
        return new Response(JSON.stringify({ ok: true, msg: "sem nó start" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!checkTrigger(startNode.data, lastMsg)) {
        return new Response(JSON.stringify({ ok: true, msg: "trigger não disparou" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      currentNodeId = startNode.id;
      isNew = true;
    } else {
      currentNodeId = sessao.current_node_id;

      if (sessao.status === "waiting" && sessao.wait_until) {
        if (new Date() < new Date(sessao.wait_until)) {
          // Timer ainda não expirou — ignora mensagem
          return new Response(JSON.stringify({ ok: true, msg: "aguardando timer" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Timer expirou: avança do nó wait
        const afterWait = getNext(fj, currentNodeId);
        if (!afterWait) {
          await supabase.from("fluxo_sessoes")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", sessao.id);
          return new Response(JSON.stringify({ ok: true, msg: "concluído" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        currentNodeId = afterWait.id;
      }
    }

    // 4. Executar nós (máx 20 iterações para evitar loop infinito)
    const MAX = 20;
    let iter = 0;
    let finalStatus: "active" | "waiting" | "completed" = "active";
    let waitUntil: string | null = null;
    let run = true;

    while (run && iter < MAX) {
      iter++;
      const node = getNode(fj, currentNodeId);
      if (!node) { finalStatus = "completed"; break; }

      console.log(`[executar-fluxo] nó ${node.id} tipo ${node.type}`);

      switch (node.type) {
        case "start": {
          const next = getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "message": {
          const texto: string = interpolate(node.data.text ?? "", msgVars);
          if (texto.trim()) {
            await enviar(canal, telefone, texto);
            await salvarMensagem(leadId, empresaId, texto);
          }
          const next = getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "condition": {
          const passed = evalCondition(node.data, lastMsg);
          const next =
            getNextByHandle(fj, node.id, passed ? "yes" : "no") ??
            getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "wait": {
          const value: number = node.data.value ?? 30;
          const unit: string = node.data.unit ?? "s";
          const ms = unit === "s" ? value * 1000 : value * 60 * 1000;
          waitUntil = new Date(Date.now() + ms).toISOString();
          finalStatus = "waiting";
          run = false;
          break;
        }

        case "ai": {
          const { data: historico } = await supabase
            .from("mensagens_crm")
            .select("conteudo, direcao")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: true })
            .limit(20);

          const messages = (historico ?? [])
            .filter((m: any) => m.conteudo && m.conteudo !== "[Mídia]")
            .map((m: any) => ({
              role: m.direcao === "saida" ? "assistant" as const : "user" as const,
              content: m.conteudo as string,
            }));

          if (!messages.length || messages[0].role !== "user") {
            messages.unshift({ role: "user" as const, content: lastMsg });
          }

          const aiResp = await anthropic.messages.create({
            model: node.data.model ?? "claude-haiku-4-5-20251001",
            max_tokens: 512,
            system: interpolate(node.data.prompt ?? "", msgVars),
            messages,
          });

          const resposta = aiResp.content[0]?.type === "text" ? aiResp.content[0].text : null;
          if (resposta) {
            await enviar(canal, telefone, resposta);
            await salvarMensagem(leadId, empresaId, resposta);
          }

          const next = getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "assign": {
          // Transfere para fila humana e encerra o fluxo
          await supabase.from("leads")
            .update({ status_atendimento: "fila", atendente_id: null })
            .eq("id", leadId);
          finalStatus = "completed";
          run = false;
          break;
        }

        case "end":
        default: {
          finalStatus = "completed";
          run = false;
          break;
        }
      }
    }

    if (iter >= MAX) {
      console.warn("[executar-fluxo] limite de iterações atingido");
      finalStatus = "completed";
    }

    // 5. Persistir sessão
    const now = new Date().toISOString();
    if (isNew) {
      if (finalStatus !== "completed") {
        await supabase.from("fluxo_sessoes").insert({
          lead_id: leadId,
          fluxo_id: fluxo.id,
          empresa_id: empresaId,
          current_node_id: currentNodeId,
          status: finalStatus,
          wait_until: waitUntil,
          contexto: { ultima_mensagem: lastMsg },
        });
      }
    } else if (sessao) {
      await supabase.from("fluxo_sessoes")
        .update({ current_node_id: currentNodeId, status: finalStatus, wait_until: waitUntil, updated_at: now })
        .eq("id", sessao.id);
    }

    return new Response(JSON.stringify({ ok: true, finalStatus, currentNodeId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[executar-fluxo]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
