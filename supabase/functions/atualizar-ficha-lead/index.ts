import Anthropic from "npm:@anthropic-ai/sdk@0.126.0";
import { createClient } from "npm:@supabase/supabase-js@2";

// Mantém a ficha de cada lead: um resumo estruturado para a equipe não precisar
// reler a conversa inteira. É interna, nunca vai para o cliente.
//
// Dois modos:
//   - cron (corpo vazio): pega os leads com conversa nova desde a última ficha
//   - sob demanda ({ leadId }): gera na hora, pelo botão na tela do lead

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);
const anthropic = new Anthropic();

const MODELO = "claude-opus-5";
const MAX_MENSAGENS = 60;
const LOTE = 5;
// Evita gerar duas vezes seguidas por clique duplo no botão.
const INTERVALO_MINIMO_SOB_DEMANDA_MS = 2 * 60_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIPOS_CONTATO = ["lead", "aluno", "fornecedor", "parceiro", "equipe", "outro"] as const;
const TEMPERATURAS = ["quente", "morno", "frio", "indefinido"] as const;

const listaDeTextos = { type: "array", items: { type: "string" } };

// Structured outputs exige additionalProperties: false e todos os campos em
// required. Campo sem informação vem como "" ou [], nunca nulo.
const SCHEMA_FICHA = {
  type: "object",
  additionalProperties: false,
  required: [
    "tipo_contato",
    "resumo",
    "necessidade",
    "dores",
    "momento",
    "perfil",
    "objecoes",
    "interesses",
    "temperatura",
    "proximo_passo",
    "alertas",
  ],
  properties: {
    tipo_contato: { type: "string", enum: TIPOS_CONTATO },
    resumo: { type: "string" },
    necessidade: { type: "string" },
    dores: listaDeTextos,
    momento: { type: "string" },
    perfil: { type: "string" },
    objecoes: listaDeTextos,
    interesses: listaDeTextos,
    temperatura: { type: "string", enum: TEMPERATURAS },
    proximo_passo: { type: "string" },
    alertas: listaDeTextos,
  },
};

interface Ficha {
  tipo_contato: (typeof TIPOS_CONTATO)[number];
  resumo: string;
  necessidade: string;
  dores: string[];
  momento: string;
  perfil: string;
  objecoes: string[];
  interesses: string[];
  temperatura: (typeof TEMPERATURAS)[number];
  proximo_passo: string;
  alertas: string[];
}

const SYSTEM = `Você mantém a ficha de um contato que conversa pelo WhatsApp com o Grupo Excellence, empresa de desenvolvimento pessoal e profissional de Maringá–PR. A ficha é interna: a equipe comercial a lê para não precisar reler a conversa inteira. O contato nunca a vê.

Escreva como um bom consultor escreveria para o colega que vai assumir o atendimento: direto, concreto, em português do Brasil.

Use somente o que está na conversa e nos dados do contato. Nunca invente — se algo não aparece, deixe o campo vazio ("" ou lista vazia). Nas dores e objeções, prefira as palavras da própria pessoa. Cada item de lista tem no máximo uma frase curta.

Se receber a ficha anterior, atualize-a: mantenha o que continua valendo, corrija o que mudou e acrescente o que é novo.

A equipe vende de forma consultiva, e o próximo passo e os alertas devem seguir esse jeito de vender. Um "não", "por enquanto não" ou "vou pensar" sem motivo não encerra a conversa: o passo seguinte é descobrir, com uma pergunta aberta, o que está impedindo a pessoa ("o que estaria te impedindo nesse momento?"). A venda parte das dores e do momento que a própria pessoa relatou. Só trate o contato como encerrado quando ela recusou de forma firme depois de já ter dado o motivo, pediu para não ser mais procurada, ou demonstrou irritação com a insistência.

Campos:
- tipo_contato: "lead" (possível cliente), "aluno" (já é aluno ou cliente), "fornecedor" (vende ou entrega algo para a empresa), "parceiro", "equipe" (alguém da própria empresa) ou "outro". Na dúvida entre "lead" e outro tipo, use "lead".
- resumo: uma ou duas frases dizendo quem é a pessoa e o que ela quer.
- necessidade: o que ela busca resolver.
- dores: incômodos concretos que ela relatou.
- momento: quando precisa, em que fase de vida ou trabalho está, e se há urgência.
- perfil: como a pessoa é e como se comunica (formal, direta, desconfiada, animada, sucinta...).
- objecoes: o que a fez hesitar ou a impede de avançar.
- interesses: programas, cursos ou eventos que ela mencionou.
- temperatura: "quente" (pronta para decidir), "morno" (interessada, com ressalvas), "frio" (sem interesse ou sumiu) ou "indefinido" (conversa curta demais para dizer).
- proximo_passo: a próxima ação concreta que a equipe deveria tomar.
- alertas: compromissos assumidos, pendências, prazos e cuidados — por exemplo "prometemos enviar a chave PIX" ou "reclamou de cobrança".`;

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function semHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function descreverMensagem(m: { conteudo: string | null; tipo: string | null }): string {
  const texto = (m.conteudo ?? "").trim();
  if (m.tipo && m.tipo !== "text" && m.tipo !== "texto") {
    return texto && texto !== "[Mídia]" ? `[${m.tipo}] ${texto}` : `[${m.tipo}]`;
  }
  return texto || "[mídia]";
}

type Resultado =
  | { leadId: string; ok: true; ficha: Ficha }
  | { leadId: string; ok: false; motivo: string };

async function gerarFicha(leadId: string): Promise<Resultado> {
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, empresa_id, nome, cidade, produto_interesse, origem, observacoes, valor, tipo_contato, ultima_mensagem_em, funil_etapas(nome)"
    )
    .eq("id", leadId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!lead) return { leadId, ok: false, motivo: "lead não encontrado" };

  const { data: recentes } = await supabase
    .from("mensagens_crm")
    .select("conteudo, direcao, tipo, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(MAX_MENSAGENS);

  const mensagens = (recentes ?? []).reverse();
  if (mensagens.length === 0) return { leadId, ok: false, motivo: "sem mensagens" };

  const { data: fichaAnterior } = await supabase
    .from("leads_ficha_ia")
    .select("ficha")
    .eq("lead_id", leadId)
    .maybeSingle();

  const etapa = (lead.funil_etapas as { nome?: string } | null)?.nome;
  const dadosContato = [
    `Nome: ${lead.nome ?? "(sem nome)"}`,
    lead.cidade && `Cidade: ${lead.cidade}`,
    lead.produto_interesse && `Produto de interesse registrado: ${lead.produto_interesse}`,
    lead.origem && `Origem: ${lead.origem}`,
    etapa && `Etapa no funil: ${etapa}`,
    lead.valor && `Valor potencial: R$ ${lead.valor}`,
    semHtml(lead.observacoes) && `Anotações da equipe: ${semHtml(lead.observacoes)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const transcricao = mensagens
    .map((m) => {
      const quem = m.direcao === "saida" ? "Grupo Excellence" : "Contato";
      return `[${fmtData.format(new Date(m.created_at))}] ${quem}: ${descreverMensagem(m)}`;
    })
    .join("\n");

  const partes = [`<dados_do_contato>\n${dadosContato}\n</dados_do_contato>`];
  if (fichaAnterior?.ficha) {
    partes.push(`<ficha_anterior>\n${JSON.stringify(fichaAnterior.ficha, null, 2)}\n</ficha_anterior>`);
  }
  partes.push(`<conversa>\n${transcricao}\n</conversa>`);

  const response = await anthropic.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    // Se o classificador de segurança do Opus 5 recusar, o próprio servidor
    // refaz a chamada no modelo recomendado para aquele tipo de recusa.
    fallbacks: "default",
    output_config: {
      // Resumo em lote: "medium" é o degrau de economia que mantém a
      // qualidade. Suba para "high" se as fichas saírem rasas.
      effort: "medium",
      format: { type: "json_schema", schema: SCHEMA_FICHA },
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${partes.join("\n\n")}\n\nAtualize a ficha deste contato.`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return { leadId, ok: false, motivo: "recusado pelo modelo" };
  }
  if (response.stop_reason === "max_tokens") {
    return { leadId, ok: false, motivo: "resposta cortada por max_tokens" };
  }

  const texto = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let ficha: Ficha;
  try {
    ficha = JSON.parse(texto) as Ficha;
  } catch {
    return { leadId, ok: false, motivo: "resposta fora do formato" };
  }

  const { error } = await supabase.from("leads_ficha_ia").upsert({
    lead_id: leadId,
    empresa_id: lead.empresa_id,
    ficha,
    ate_mensagem_em: mensagens[mensagens.length - 1].created_at,
    modelo: response.model,
    tokens_entrada: response.usage.input_tokens,
    tokens_saida: response.usage.output_tokens,
    atualizada_em: new Date().toISOString(),
  });
  if (error) return { leadId, ok: false, motivo: `falha ao gravar: ${error.message}` };

  return { leadId, ok: true, ficha };
}

async function gerarComSeguranca(leadId: string): Promise<Resultado> {
  try {
    return await gerarFicha(leadId);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return { leadId, ok: false, motivo: "limite de requisições da Anthropic" };
    }
    if (e instanceof Anthropic.APIError) {
      return { leadId, ok: false, motivo: `erro da API (${e.status}): ${e.message}` };
    }
    return { leadId, ok: false, motivo: String(e) };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const corpo = await req.json().catch(() => ({}));
  const leadId: string | undefined = corpo?.leadId;

  if (leadId) {
    const { data: atual } = await supabase
      .from("leads_ficha_ia")
      .select("ficha, atualizada_em")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (
      atual &&
      Date.now() - new Date(atual.atualizada_em).getTime() < INTERVALO_MINIMO_SOB_DEMANDA_MS
    ) {
      return json({ leadId, ok: true, ficha: atual.ficha, reaproveitada: true });
    }
    const resultado = await gerarComSeguranca(leadId);
    if (!resultado.ok) console.error("[atualizar-ficha-lead]", resultado);
    return json(resultado, resultado.ok ? 200 : 422);
  }

  const { data: fila, error } = await supabase.rpc("leads_para_ficha", { p_limite: LOTE });
  if (error) {
    console.error("[atualizar-ficha-lead] fila:", error);
    return json({ error: error.message }, 500);
  }

  const ids = (fila ?? []).map((r: { lead_id: string }) => r.lead_id);
  const resultados = await Promise.all(ids.map(gerarComSeguranca));
  for (const r of resultados) {
    if (!r.ok) console.error("[atualizar-ficha-lead]", r);
  }
  return json({
    processados: resultados.length,
    ok: resultados.filter((r) => r.ok).length,
    falhas: resultados.filter((r) => !r.ok).map((r) => ({ leadId: r.leadId, motivo: (r as { motivo: string }).motivo })),
  });
});
