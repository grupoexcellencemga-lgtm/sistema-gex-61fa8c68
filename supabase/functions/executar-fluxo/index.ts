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
  const { field, operator, value, no_value } = data;
  if (field !== "message") return false;
  const subject = lastMsg.toLowerCase().trim();

  // Palavras do caminho Não têm precedência quando a mensagem casa com elas
  if (no_value) {
    const noVals = (no_value as string).split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean);
    if (noVals.some(v => subject.includes(v))) return false;
  }

  const vals = (value ?? "").split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean);
  if (!vals.length) return false;
  switch (operator) {
    case "contains":     return vals.some(v => subject.includes(v));
    case "not_contains": return vals.every(v => !subject.includes(v));
    case "equals":       return vals.some(v => subject === v);
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

async function enviarBotoes(canal: any, telefone: string, pergunta: string): Promise<void> {
  const apiKey = canal.evolution_token || Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  const res = await fetch(`${canal.evolution_url}/message/sendList/${canal.evolution_instancia}`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      number: telefone,
      listMessage: {
        title: pergunta,
        description: "Selecione uma opção",
        buttonText: "Ver opções",
        footerText: "",
        sections: [{
          title: "Opções",
          rows: [
            { title: "Sim ✅", description: "", rowId: "sim" },
            { title: "Não ❌", description: "", rowId: "nao" },
          ],
        }],
      },
    }),
  });
  // fallback para texto simples se o endpoint de lista falhar
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[enviarBotoes] sendList falhou:", res.status, errBody);
    await enviar(canal, telefone, pergunta);
  }
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

    // 1. Sessão ativa ou em espera
    const { data: sessao } = await supabase
      .from("fluxo_sessoes")
      .select("*")
      .eq("lead_id", leadId)
      .in("status", ["active", "waiting", "waiting_input"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Selecionar fluxo:
    //    - sessão waiting_input + keyword → reinicia do zero (abandona sessão atual)
    //    - sessão ativa → continua com o fluxo ativo do canal
    //    - nova sessão → tenta casar pela palavra_chave
    let fluxo: { id: string; fluxo_json: any } | null = null;

    // Busca todos os fluxos ativos do canal para testar keyword
    const { data: fluxosAtivos } = await supabase
      .from("fluxos_bot")
      .select("id, fluxo_json, palavra_chave")
      .eq("ativo", true)
      .eq("empresa_id", empresaId)
      .contains("canal_ids", [canalId]);

    const msgNorm = lastMsg.toLowerCase().trim();
    const keywordMatch = fluxosAtivos?.find(
      f => f.palavra_chave && msgNorm.includes(f.palavra_chave.toLowerCase().trim())
    ) ?? null;

    if (sessao && keywordMatch && sessao.status === "waiting_input") {
      // Usuário mandou a palavra-chave enquanto o bot aguardava resposta → reinicia
      await supabase.from("fluxo_sessoes").delete().eq("id", sessao.id);
      fluxo = keywordMatch;
    } else if (sessao) {
      // Sessão ativa/waiting normal → continua
      const { data } = await supabase
        .from("fluxos_bot")
        .select("id, fluxo_json")
        .eq("ativo", true)
        .eq("empresa_id", empresaId)
        .contains("canal_ids", [canalId])
        .limit(1)
        .maybeSingle();
      fluxo = data;
    } else {
      // Nova sessão → só inicia se a keyword bater
      fluxo = keywordMatch;
    }

    if (!fluxo) {
      return new Response(JSON.stringify({ ok: true, msg: "sem fluxo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fj = fluxo.fluxo_json as FluxoJson;

    // 3. Dados do canal
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

    let currentNodeId: string;
    let isNew = false;
    let sessaoNovaId: string | null = null;

    if (!sessao) {
      // ── Guarda de atendimento ativo ──────────────────────────────────────────
      // Não inicia um fluxo novo se o lead já estiver sendo atendido por humano
      // ou IA, evitando que a palavra-chave dispare por acidente numa conversa
      // em andamento.
      const { data: leadStatus } = await supabase
        .from("leads")
        .select("status_atendimento, atendente_id")
        .eq("id", leadId)
        .maybeSingle();

      // Bloqueia apenas se um atendente humano estiver com o lead
      // "fila" = aguardando atendimento → permite fluxo
      const emAtendimentoHumano = leadStatus?.atendente_id != null;

      if (emAtendimentoHumano) {
        return new Response(JSON.stringify({ ok: true, msg: "lead com atendente humano — fluxo bloqueado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // ─────────────────────────────────────────────────────────────────────────

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

      // ── Guarda contra chamadas concorrentes ───────────────────────────────
      // Insere a sessão ANTES de executar os nós. Se duas chamadas chegarem
      // ao mesmo tempo (Evolution API retransmitindo o mesmo evento), o índice
      // único (lead_id, fluxo_id) WHERE status != 'completed' rejeita a segunda
      // e apenas UMA chamada executa o fluxo e envia mensagens.
      const { data: sessaoNova, error: errInsert } = await supabase
        .from("fluxo_sessoes")
        .insert({
          lead_id: leadId,
          fluxo_id: fluxo.id,
          empresa_id: empresaId,
          current_node_id: currentNodeId,
          status: "active",
          contexto: { ultima_mensagem: lastMsg },
        })
        .select("id")
        .maybeSingle();

      if (errInsert || !sessaoNova) {
        return new Response(JSON.stringify({ ok: true, msg: "sessão já iniciada (concorrência)" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sessaoNovaId = sessaoNova.id;
      // ─────────────────────────────────────────────────────────────────────
    } else {
      currentNodeId = sessao.current_node_id;

      if (sessao.status === "waiting_input") {
        const waitingAtNode = getNode(fj, currentNodeId);
        if (waitingAtNode?.type === "condition") {
          // Mensagem recebida: re-avaliar a condição com a nova mensagem (não avança ainda)
          // A avaliação acontece no case "condition" do loop abaixo
        } else {
          // Nó aguardar resposta: salva resposta se configurado e avança
          const saveTo: string | undefined = waitingAtNode?.data?.save_to;
          if (saveTo && lastMsg.trim()) {
            // Campos padrão do lead
            if (saveTo === "nome" || saveTo === "email") {
              await supabase.from("leads").update({ [saveTo]: lastMsg.trim() }).eq("id", leadId);
            }
            // Atualiza variáveis de interpolação para os nós seguintes
            msgVars[saveTo] = lastMsg.trim();
          }
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
      } else if (sessao.status === "waiting" && sessao.wait_until) {
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
    let finalStatus: "active" | "waiting" | "waiting_input" | "completed" = "active";
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
          const resumingHere = sessao?.status === "waiting_input" && sessao?.current_node_id === node.id;
          // Se tem pergunta e ainda não enviou (não estamos resumindo aqui), envia e aguarda
          if (node.data.pergunta?.trim() && !resumingHere) {
            const pergText = interpolate(node.data.pergunta, msgVars);
            // Se há palavras-chave de Sim/Não configuradas, envia botões interativos
            const temOpcoes = node.data.value?.trim() || node.data.no_value?.trim();
            if (temOpcoes) {
              await enviarBotoes(canal, telefone, pergText);
            } else {
              await enviar(canal, telefone, pergText);
            }
            await salvarMensagem(leadId, empresaId, pergText);
            finalStatus = "waiting_input";
            run = false;
            break;
          }
          // Avalia a condição com a mensagem recebida
          const passed = evalCondition(node.data, lastMsg);
          const next =
            getNextByHandle(fj, node.id, passed ? "yes" : "no") ??
            getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "wait": {
          if (node.data.mode === "input") {
            // Aguardar resposta: pausa indefinidamente até qualquer mensagem chegar
            finalStatus = "waiting_input";
            waitUntil = null;
          } else {
            const value: number = node.data.value ?? 30;
            const unit: string = node.data.unit ?? "s";
            const ms = unit === "h" ? value * 3600 * 1000 : unit === "min" ? value * 60 * 1000 : value * 1000;
            waitUntil = new Date(Date.now() + ms).toISOString();
            finalStatus = "waiting";
          }
          run = false;
          break;
        }

        case "ai": {
          try {
            const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
            if (!apiKey) throw new Error("ANTHROPIC_API_KEY nao configurada nas secrets da edge function");

            const { data: historico } = await supabase
              .from("mensagens_crm")
              .select("conteudo, direcao")
              .eq("lead_id", leadId)
              .order("created_at", { ascending: true })
              .limit(20);

            const rawMsgs = (historico ?? [])
              .filter((m: any) => m.conteudo && m.conteudo !== "[Mídia]")
              .map((m: any) => ({
                role: m.direcao === "saida" ? "assistant" as const : "user" as const,
                content: m.conteudo as string,
              }));

            if (!rawMsgs.length || rawMsgs[0].role !== "user") {
              rawMsgs.unshift({ role: "user" as const, content: lastMsg || "Olá" });
            }

            // Remove mensagens consecutivas com o mesmo role (Anthropic não aceita)
            const messages: { role: "user" | "assistant"; content: string }[] = [];
            for (const m of rawMsgs) {
              if (messages.length === 0 || messages[messages.length - 1].role !== m.role) {
                messages.push(m);
              }
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
          } catch (aiErr) {
            console.error("[executar-fluxo] ERRO no no ai:", String(aiErr));
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
      // Sessão já foi inserida antes do loop; só atualiza com o estado final
      if (sessaoNovaId) {
        await supabase.from("fluxo_sessoes")
          .update({ current_node_id: currentNodeId, status: finalStatus, wait_until: waitUntil, updated_at: now })
          .eq("id", sessaoNovaId);
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
