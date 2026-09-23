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

type StructuredField = {
  name: string;
  type: "text" | "enum";
  required?: boolean;
  options?: string[];
};

// MIME types que o Claude aceita como imagem via vision
const VISION_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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

function evalCondition(data: any, subject: string): boolean {
  const { field, operator, value, no_value } = data;
  if (field !== "message") return false;
  const subj = subject.toLowerCase().trim();

  if (no_value) {
    const noVals = (no_value as string).split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean);
    if (noVals.some(v => subj.includes(v))) return false;
  }

  const vals = (value ?? "").split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean);
  if (!vals.length) return false;
  switch (operator) {
    case "contains":     return vals.some(v => subj.includes(v));
    case "not_contains": return vals.every(v => !subj.includes(v));
    case "equals":       return vals.some(v => subj === v);
    default:             return false;
  }
}

// Retorna o handle ID da opção que casou (ou da última como fallback).
// exactMatch=true usa comparação exata em vez de substring (para node_output/variable).
function evalConditionHandle(data: any, subject: string, exactMatch = false): string {
  if (Array.isArray(data.opcoes) && data.opcoes.length > 0) {
    const subj = subject.toLowerCase().trim();
    for (const opcao of data.opcoes) {
      const palavras = (opcao.palavras ?? "").split(",").map((v: string) => v.trim().toLowerCase()).filter(Boolean);
      if (!palavras.length) return opcao.id; // catch-all sem palavras
      const hit = exactMatch
        ? palavras.some((p: string) => subj === p)
        : palavras.some((p: string) => subj.includes(p));
      if (hit) return opcao.id;
    }
    return data.opcoes[data.opcoes.length - 1].id; // fallback: última opção
  }
  // Legado: retorna "yes" ou "no"
  return evalCondition(data, subject) ? "yes" : "no";
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
    const body = await req.json();
    const { leadId, canalId, empresaId, ultimaMensagem, telefone } = body;
    // Mídia opcional — passada pelo webhook quando a mensagem contém imagem
    const mediaBase64: string | null = body.mediaBase64 ?? null;
    const mediaMimeType: string | null = body.mediaMimeType ?? null;
    const mediaCaption: string | null = body.mediaCaption ?? null;

    if (!leadId || !canalId || !empresaId) {
      return new Response(JSON.stringify({ error: "params missing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastMsg: string = ultimaMensagem ?? "";

    // Dados do lead para interpolação
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

    // Contexto persistido (nodeOutputs, variables) restaurado da sessão anterior
    let nodeOutputs: Record<string, Record<string, string>> = {};
    let variables: Record<string, string> = {};

    if (sessao?.contexto) {
      nodeOutputs = (sessao.contexto as any).nodeOutputs ?? {};
      variables = (sessao.contexto as any).variables ?? {};
      // Mesclar variáveis persistidas na interpolação
      Object.assign(msgVars, variables);
    }

    // Helper para construir contexto de sessão a persistir
    const buildContexto = () => ({
      ultima_mensagem: lastMsg,
      nodeOutputs,
      variables,
    });

    // 2. Selecionar fluxo
    let fluxo: { id: string; fluxo_json: any } | null = null;

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
      await supabase.from("fluxo_sessoes").delete().eq("id", sessao.id);
      fluxo = keywordMatch;
    } else if (sessao) {
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
      const { data: leadStatus } = await supabase
        .from("leads")
        .select("status_atendimento, atendente_id")
        .eq("id", leadId)
        .maybeSingle();

      if (leadStatus?.atendente_id != null) {
        return new Response(JSON.stringify({ ok: true, msg: "lead com atendente humano — fluxo bloqueado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      const { data: sessaoNova, error: errInsert } = await supabase
        .from("fluxo_sessoes")
        .insert({
          lead_id: leadId,
          fluxo_id: fluxo.id,
          empresa_id: empresaId,
          current_node_id: currentNodeId,
          status: "active",
          contexto: buildContexto(),
        })
        .select("id")
        .maybeSingle();

      if (errInsert || !sessaoNova) {
        return new Response(JSON.stringify({ ok: true, msg: "sessão já iniciada (concorrência)" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sessaoNovaId = sessaoNova.id;
    } else {
      currentNodeId = sessao.current_node_id;

      if (sessao.status === "waiting_input") {
        const waitingAtNode = getNode(fj, currentNodeId);
        if (waitingAtNode?.type === "condition") {
          // Re-avalia condição com nova mensagem — continua no loop
        } else {
          // Nó aguardar resposta: salva resposta e avança
          const saveTo: string | undefined = waitingAtNode?.data?.save_to;
          if (saveTo && lastMsg.trim()) {
            if (saveTo === "nome" || saveTo === "email") {
              await supabase.from("leads").update({ [saveTo]: lastMsg.trim() }).eq("id", leadId);
            }
            msgVars[saveTo] = lastMsg.trim();
            variables[saveTo] = lastMsg.trim(); // persiste entre pausas
          }
          const afterWait = getNext(fj, currentNodeId);
          if (!afterWait) {
            await supabase.from("fluxo_sessoes")
              .update({ status: "completed", contexto: buildContexto(), updated_at: new Date().toISOString() })
              .eq("id", sessao.id);
            return new Response(JSON.stringify({ ok: true, msg: "concluído" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          currentNodeId = afterWait.id;
        }
      } else if (sessao.status === "waiting" && sessao.wait_until) {
        if (new Date() < new Date(sessao.wait_until)) {
          return new Response(JSON.stringify({ ok: true, msg: "aguardando timer" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const afterWait = getNext(fj, currentNodeId);
        if (!afterWait) {
          await supabase.from("fluxo_sessoes")
            .update({ status: "completed", contexto: buildContexto(), updated_at: new Date().toISOString() })
            .eq("id", sessao.id);
          return new Response(JSON.stringify({ ok: true, msg: "concluído" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        currentNodeId = afterWait.id;
      }
    }

    // 4. Executar nós (máx 20 iterações)
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
          const texto: string = interpolate(node.data.text ?? "", { ...msgVars, ...variables });
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
          const sourceType = (node.data.sourceType as string) ?? "message";
          const resumingHere = sessao?.status === "waiting_input" && sessao?.current_node_id === node.id;

          // Pergunta só faz sentido para condições baseadas em mensagem
          if (sourceType === "message" && node.data.pergunta?.trim() && !resumingHere) {
            const pergText = interpolate(node.data.pergunta, { ...msgVars, ...variables });
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

          // Determinar sujeito e modo de comparação
          let subject = lastMsg;
          let exactMatch = false;

          if (sourceType === "node_output") {
            const srcNodeId = node.data.sourceNodeId as string;
            const srcField = node.data.sourceField as string;
            subject = nodeOutputs[srcNodeId]?.[srcField] ?? "";
            exactMatch = true;
            console.log(`[executar-fluxo] condition node_output: nó=${srcNodeId} campo=${srcField} valor="${subject}"`);
          } else if (sourceType === "variable") {
            const varName = node.data.variableName as string;
            subject = variables[varName] ?? msgVars[varName] ?? "";
            exactMatch = true;
            console.log(`[executar-fluxo] condition variable: ${varName}="${subject}"`);
          }

          const handleId = evalConditionHandle(node.data, subject, exactMatch);
          console.log(`[executar-fluxo] condition handle=${handleId}`);

          const next =
            getNextByHandle(fj, node.id, handleId) ??
            getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "wait": {
          if (node.data.mode === "input") {
            finalStatus = "waiting_input";
            waitUntil = null;
            run = false;
          } else {
            const value: number = node.data.value ?? 30;
            const unit: string = node.data.unit ?? "s";
            const ms = unit === "h" ? value * 3600 * 1000 : unit === "min" ? value * 60 * 1000 : value * 1000;
            if (ms <= 30_000) {
              await new Promise((r) => setTimeout(r, ms));
              const next = getNext(fj, node.id);
              if (!next) { run = false; break; }
              currentNodeId = next.id;
            } else {
              waitUntil = new Date(Date.now() + ms).toISOString();
              finalStatus = "waiting";
              run = false;
            }
          }
          break;
        }

        case "ai": {
          try {
            const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
            if (!apiKey) throw new Error("ANTHROPIC_API_KEY nao configurada");

            const structuredCfg = node.data.structuredOutput as {
              enabled?: boolean;
              fields?: StructuredField[];
            } | undefined;
            const useStructured = structuredCfg?.enabled === true && (structuredCfg?.fields?.length ?? 0) > 0;

            // Histórico de mensagens
            const { data: historico } = await supabase
              .from("mensagens_crm")
              .select("conteudo, direcao")
              .eq("lead_id", leadId)
              .order("created_at", { ascending: true })
              .limit(20);

            const rawMsgs: Array<{ role: "user" | "assistant"; content: any }> = [];
            for (const m of (historico ?? [])) {
              if (!m.conteudo) continue;
              rawMsgs.push({
                role: m.direcao === "saida" ? "assistant" : "user",
                content: m.conteudo === "[Mídia]" ? "[arquivo recebido]" : m.conteudo,
              });
            }

            // Injetar imagem na última mensagem do usuário (se presente e suportado)
            if (mediaBase64 && mediaMimeType && VISION_MIME_TYPES.includes(mediaMimeType.toLowerCase())) {
              let injected = false;
              for (let i = rawMsgs.length - 1; i >= 0; i--) {
                if (rawMsgs[i].role === "user") {
                  const existingText = typeof rawMsgs[i].content === "string"
                    ? rawMsgs[i].content
                    : (mediaCaption ?? "Imagem enviada");
                  rawMsgs[i].content = [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mediaMimeType,
                        data: mediaBase64,
                      },
                    },
                    {
                      type: "text",
                      text: existingText === "[arquivo recebido]"
                        ? (mediaCaption ?? "Imagem enviada")
                        : existingText,
                    },
                  ];
                  injected = true;
                  break;
                }
              }
              if (!injected) {
                rawMsgs.push({
                  role: "user",
                  content: [
                    { type: "image", source: { type: "base64", media_type: mediaMimeType, data: mediaBase64 } },
                    { type: "text", text: mediaCaption ?? "Imagem enviada" },
                  ],
                });
              }
            }

            if (!rawMsgs.length || rawMsgs[0].role !== "user") {
              rawMsgs.unshift({ role: "user" as const, content: lastMsg || "Olá" });
            }

            // Deduplicar mensagens consecutivas com mesmo role
            const messages: Array<{ role: "user" | "assistant"; content: any }> = [];
            for (const m of rawMsgs) {
              if (messages.length === 0 || messages[messages.length - 1].role !== m.role) {
                messages.push(m);
              }
            }

            // Montar system prompt — incluir instrução JSON se structured output ativo
            let systemPrompt = interpolate(node.data.prompt ?? "", { ...msgVars, ...variables });

            if (useStructured) {
              const fields = structuredCfg!.fields!;
              const fieldsDesc = fields.map(f => {
                if (f.type === "enum" && f.options?.length) {
                  return `  "${f.name}": um dos valores: ${f.options.map(o => `"${o}"`).join(" | ")}`;
                }
                return `  "${f.name}": string`;
              }).join(",\n");

              systemPrompt += `\n\n[FORMATO DE RESPOSTA OBRIGATÓRIO]\nResponda EXCLUSIVAMENTE com JSON válido, sem texto fora do JSON e sem markdown.\nFormato:\n{\n  "message": "texto para enviar ao cliente",\n${fieldsDesc}\n}`;
            }

            const aiResp = await anthropic.messages.create({
              model: node.data.model ?? "claude-haiku-4-5-20251001",
              max_tokens: useStructured ? 1024 : 512,
              system: systemPrompt,
              messages,
            });

            const rawText = aiResp.content[0]?.type === "text" ? aiResp.content[0].text : null;

            if (useStructured && rawText) {
              // Parsear JSON estruturado
              let parsed: Record<string, any> = {};
              let parseOk = false;

              try {
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  parsed = JSON.parse(jsonMatch[0]);
                  parseOk = true;
                }
              } catch (e) {
                console.error("[executar-fluxo] ai - falha parse JSON:", String(e), "raw:", rawText.substring(0, 200));
              }

              const messageText = parsed.message as string | undefined;
              const fields = structuredCfg!.fields!;
              const allRequiredOk = !fields.some(f => f.required && !parsed[f.name]);

              if (!parseOk || !messageText || !allRequiredOk) {
                // FALLBACK SEGURO — nunca liberar automaticamente, nunca COMPROVANTE_RECEBIDO
                console.error("[executar-fluxo] ai - saída estruturada inválida → ATENDIMENTO_HUMANO");
                const fallbackMsg = "Preciso verificar mais alguns detalhes. Nossa equipe dará continuidade ao seu atendimento em breve.";
                await enviar(canal, telefone, fallbackMsg);
                await salvarMensagem(leadId, empresaId, fallbackMsg);
                nodeOutputs[node.id] = { message: fallbackMsg };
                for (const f of fields) {
                  nodeOutputs[node.id][f.name] = "ATENDIMENTO_HUMANO";
                }
              } else {
                await enviar(canal, telefone, messageText);
                await salvarMensagem(leadId, empresaId, messageText);
                nodeOutputs[node.id] = { message: messageText };
                for (const f of fields) {
                  if (parsed[f.name] !== undefined) {
                    nodeOutputs[node.id][f.name] = String(parsed[f.name]);
                  }
                }
                console.log(`[executar-fluxo] ai ${node.id} outputs:`, JSON.stringify(nodeOutputs[node.id]));
              }
            } else if (rawText) {
              // Modo legado: enviar resposta completa
              await enviar(canal, telefone, rawText);
              await salvarMensagem(leadId, empresaId, rawText);
              nodeOutputs[node.id] = { message: rawText };
            }
          } catch (aiErr) {
            console.error("[executar-fluxo] ERRO no nó ai:", String(aiErr));
            // Garantir fallback seguro em caso de erro total
            if (node.data.structuredOutput?.enabled) {
              nodeOutputs[node.id] = nodeOutputs[node.id] ?? {};
              for (const f of (node.data.structuredOutput.fields ?? []) as StructuredField[]) {
                if (!nodeOutputs[node.id][f.name]) {
                  nodeOutputs[node.id][f.name] = "ATENDIMENTO_HUMANO";
                }
              }
            }
          }

          const next = getNext(fj, node.id);
          if (!next) { finalStatus = "completed"; run = false; }
          else currentNodeId = next.id;
          break;
        }

        case "assign": {
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

    // 5. Persistir sessão com contexto atualizado
    const now = new Date().toISOString();
    const contexto = buildContexto();

    if (isNew) {
      if (sessaoNovaId) {
        await supabase.from("fluxo_sessoes")
          .update({ current_node_id: currentNodeId, status: finalStatus, wait_until: waitUntil, contexto, updated_at: now })
          .eq("id", sessaoNovaId);
      }
    } else if (sessao) {
      await supabase.from("fluxo_sessoes")
        .update({ current_node_id: currentNodeId, status: finalStatus, wait_until: waitUntil, contexto, updated_at: now })
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
