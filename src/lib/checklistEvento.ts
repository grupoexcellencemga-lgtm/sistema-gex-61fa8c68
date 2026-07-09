import { supabase } from "@/integrations/supabase/client";

// Cálculos de prazo do checklist de eventos.
// eventos.data é DATE (sem hora); ancoramos às 09:00 de America/Sao_Paulo (-03:00)
// para que offsets em horas/minutos não mudem de dia por causa de UTC.
const HORA_ANCORA = 9;

export type OffsetUnidade = "minutos" | "horas" | "dias";
export type FaseEvento = "pre_evento" | "dia_evento" | "pos_evento";
export type AreaEvento = "comercial" | "marketing" | "operacao";

// A quê a tarefa se refere, quando o checklist é de uma TURMA (várias
// sessões/encontros) em vez de um evento de data única.
// 'cada_sessao' repete a tarefa para CADA encontro da turma (uma tarefa por
// sessão, cada uma com sua própria data). Em Eventos (data única), não há
// o que repetir — se comporta como 'evento_inteiro'.
export type AncoraTarefa = "evento_inteiro" | "primeira_sessao" | "ultima_sessao" | "cada_sessao";

export const ANCORA_LABELS: Record<AncoraTarefa, string> = {
  evento_inteiro: "Evento/curso inteiro",
  primeira_sessao: "Primeira sessão",
  ultima_sessao: "Última sessão",
  cada_sessao: "Cada sessão (repete)",
};

export const AREA_LABELS: Record<AreaEvento, string> = {
  comercial: "Comercial",
  marketing: "Marketing",
  operacao: "Operação",
};
export const AREA_BADGE: Record<AreaEvento, string> = {
  comercial: "bg-blue-100 text-blue-700 border-blue-200",
  marketing: "bg-purple-100 text-purple-700 border-purple-200",
  operacao: "bg-slate-100 text-slate-700 border-slate-200",
};

export function calcularPrazoTarefa(
  dataEvento: string, // "YYYY-MM-DD"
  fase: FaseEvento,
  offsetValor: number,
  offsetUnidade: OffsetUnidade,
): { data_vencimento: string; hora: string | null } {
  // Âncora fixa em -03:00 (America/Sao_Paulo não tem horário de verão desde 2019).
  const ancora = new Date(`${dataEvento}T${String(HORA_ANCORA).padStart(2, "0")}:00:00-03:00`);

  const sinal = fase === "pos_evento" ? 1 : -1;
  const ms =
    offsetUnidade === "minutos"
      ? offsetValor * 60_000
      : offsetUnidade === "horas"
        ? offsetValor * 3_600_000
        : offsetValor * 86_400_000;

  const prazo = new Date(ancora.getTime() + sinal * ms);

  // Converte de volta para o relógio de São Paulo (-03:00)
  const spMs = prazo.getTime() - 3 * 3_600_000;
  const sp = new Date(spMs);
  const yyyy = sp.getUTCFullYear();
  const mm = String(sp.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(sp.getUTCDate()).padStart(2, "0");
  const data_vencimento = `${yyyy}-${mm}-${dd}`;

  // Para offsets em dias, o horário-âncora é irrelevante: tarefa vence no dia.
  if (offsetUnidade === "dias") {
    return { data_vencimento, hora: null };
  }

  const hh = String(sp.getUTCHours()).padStart(2, "0");
  const min = String(sp.getUTCMinutes()).padStart(2, "0");
  return { data_vencimento, hora: `${hh}:${min}` };
}

export interface AplicarChecklistResult {
  aplicado: boolean;
  motivo?: "sem_tipo" | "sem_template" | "ja_aplicado" | "sem_data";
  tarefasCriadas?: number;
  templateNome?: string;
}

// Aplica o template de checklist ao evento. Idempotente: a trava é o campo
// eventos.checklist_template_id — o UPDATE condicional (where null) garante
// que duplo clique/race não gera tarefas duplicadas.
export async function aplicarChecklistNoEvento(
  evento: { id: string; nome: string; tipo: string | null; data: string | null },
  responsavelId: string,
): Promise<AplicarChecklistResult> {
  if (!evento.tipo) return { aplicado: false, motivo: "sem_tipo" };
  if (!evento.data) return { aplicado: false, motivo: "sem_data" };

  const { data: templates, error: tplError } = await supabase
    .from("checklist_templates")
    .select("id, nome, versao")
    .eq("tipo_evento", evento.tipo)
    .eq("ativo", true)
    .is("deleted_at", null)
    .order("versao", { ascending: false })
    .limit(1);

  if (tplError) throw tplError;
  const template = templates?.[0];
  if (!template) return { aplicado: false, motivo: "sem_template" };

  // Trava anti-duplicação: só marca se ainda não havia template aplicado.
  const { data: marcados, error: lockError } = await supabase
    .from("eventos")
    .update({
      checklist_template_id: template.id,
      checklist_template_versao: template.versao,
    })
    .eq("id", evento.id)
    .is("checklist_template_id", null)
    .select("id");

  if (lockError) throw lockError;
  if (!marcados || marcados.length === 0) {
    return { aplicado: false, motivo: "ja_aplicado" };
  }

  const { data: itens, error: itensError } = await supabase
    .from("checklist_template_items")
    .select("*")
    .eq("template_id", template.id)
    .is("deleted_at", null);

  if (itensError) throw itensError;
  if (!itens || itens.length === 0) {
    return { aplicado: true, tarefasCriadas: 0, templateNome: template.nome };
  }

  const rows = itens.map((item: any) => {
    const prazo = calcularPrazoTarefa(
      evento.data as string,
      item.fase as FaseEvento,
      item.offset_valor,
      item.offset_unidade as OffsetUnidade,
    );
    return {
      titulo: item.nome_tarefa,
      descricao: `Checklist do evento "${evento.nome}"${item.obrigatoria ? "" : " (opcional)"}`,
      tipo: "outro",
      prioridade: item.prioridade || "media",
      status: "pendente",
      responsavel_id: responsavelId,
      data_vencimento: prazo.data_vencimento,
      hora: prazo.hora,
      recorrencia: "nenhuma",
      evento_id: evento.id,
      origem_tarefa: "template",
      fase_evento: item.fase,
      area: item.area || "operacao",
      checklist_item_id: item.id,
    };
  });

  const { error: insertError } = await supabase.from("tarefas").insert(rows);
  if (insertError) throw insertError;

  return {
    aplicado: true,
    tarefasCriadas: rows.length,
    templateNome: template.nome,
  };
}

// Gera as linhas de tarefa a partir dos itens de um template (uso interno).
async function gerarTarefasDoTemplate(
  evento: { id: string; nome: string; data: string },
  templateId: string,
  responsavelId: string,
) {
  const { data: itens, error } = await supabase
    .from("checklist_template_items")
    .select("*")
    .eq("template_id", templateId)
    .is("deleted_at", null);
  if (error) throw error;

  return (itens || []).map((item: any) => {
    const prazo = calcularPrazoTarefa(
      evento.data,
      item.fase as FaseEvento,
      item.offset_valor,
      item.offset_unidade as OffsetUnidade,
    );
    return {
      titulo: item.nome_tarefa,
      descricao: `Checklist do evento "${evento.nome}"${item.obrigatoria ? "" : " (opcional)"}`,
      tipo: "outro",
      prioridade: item.prioridade || "media",
      status: "pendente",
      responsavel_id: responsavelId,
      data_vencimento: prazo.data_vencimento,
      hora: prazo.hora,
      recorrencia: "nenhuma",
      evento_id: evento.id,
      origem_tarefa: "template",
      fase_evento: item.fase,
      area: item.area || "operacao",
      checklist_item_id: item.id,
    };
  });
}

// Define (aplica ou TROCA) um checklist ESCOLHIDO no evento. Remove as tarefas
// de checklist anteriores (origem_tarefa='template') e gera as novas — troca limpa.
export async function definirChecklistDoEvento(
  evento: { id: string; nome: string; data: string | null },
  templateId: string,
  responsavelId: string,
): Promise<{ tarefasCriadas: number; templateNome: string }> {
  if (!evento.data)
    throw new Error("Defina a data do evento antes de aplicar o checklist.");

  const { data: tpl, error: tplErr } = await supabase
    .from("checklist_templates")
    .select("id, nome, versao")
    .eq("id", templateId)
    .single();
  if (tplErr) throw tplErr;

  const rows = await gerarTarefasDoTemplate(
    { id: evento.id, nome: evento.nome, data: evento.data },
    templateId,
    responsavelId,
  );

  // Troca limpa: apaga as tarefas do checklist anterior deste evento.
  const { error: delErr } = await supabase
    .from("tarefas")
    .delete()
    .eq("evento_id", evento.id)
    .eq("origem_tarefa", "template");
  if (delErr) throw delErr;

  if (rows.length) {
    const { error: insErr } = await supabase.from("tarefas").insert(rows);
    if (insErr) throw insErr;
  }

  const { error: markErr } = await supabase
    .from("eventos")
    .update({
      checklist_template_id: tpl.id,
      checklist_template_versao: tpl.versao,
    } as any)
    .eq("id", evento.id);
  if (markErr) throw markErr;

  return { tarefasCriadas: rows.length, templateNome: tpl.nome };
}

// Remove o checklist do evento: apaga as tarefas geradas (origem template) e
// limpa o vínculo, liberando para escolher outro.
export async function removerChecklistDoEvento(eventoId: string): Promise<number> {
  const { data: apagadas, error } = await supabase
    .from("tarefas")
    .delete()
    .eq("evento_id", eventoId)
    .eq("origem_tarefa", "template")
    .select("id");
  if (error) throw error;

  const { error: updErr } = await supabase
    .from("eventos")
    .update({
      checklist_template_id: null,
      checklist_template_versao: null,
    } as any)
    .eq("id", eventoId);
  if (updErr) throw updErr;

  return apagadas?.length || 0;
}

// ─── Turmas (várias sessões) ───────────────────────────────────────────────

interface EncontroRef {
  id: string;
  data: string;
  sessao_numero: number | null;
}

async function gerarTarefasDaTurma(
  turma: { id: string; nome: string; data_inicio: string | null; data_fim: string | null },
  templateId: string,
  responsavelId: string,
): Promise<{ rows: any[]; itensSemSessao: number }> {
  const [{ data: itens, error: itensErr }, { data: encontrosRaw, error: encErr }] = await Promise.all([
    supabase.from("checklist_template_items").select("*").eq("template_id", templateId).is("deleted_at", null),
    supabase
      .from("encontros")
      .select("id, data, sessao_numero")
      .eq("turma_id", turma.id)
      .not("data", "is", null)
      .order("data", { ascending: true }),
  ]);
  if (itensErr) throw itensErr;
  if (encErr) throw encErr;

  const encontros = (encontrosRaw || []) as EncontroRef[];
  const primeira = encontros[0]?.data ?? turma.data_inicio;
  const ultima = encontros[encontros.length - 1]?.data ?? (turma.data_fim || turma.data_inicio);

  const montarLinha = (item: any, dataRef: string, encontroId: string | null) => {
    const prazo = calcularPrazoTarefa(
      dataRef,
      item.fase as FaseEvento,
      item.offset_valor,
      item.offset_unidade as OffsetUnidade,
    );
    return {
      titulo: item.nome_tarefa,
      descricao: `Checklist da turma "${turma.nome}"${item.obrigatoria ? "" : " (opcional)"}`,
      tipo: "outro",
      prioridade: item.prioridade || "media",
      status: "pendente",
      responsavel_id: responsavelId,
      data_vencimento: prazo.data_vencimento,
      hora: prazo.hora,
      recorrencia: "nenhuma",
      turma_id: turma.id,
      encontro_id: encontroId,
      origem_tarefa: "template",
      fase_evento: item.fase,
      area: item.area || "operacao",
      checklist_item_id: item.id,
    };
  };

  const rows: any[] = [];
  let itensSemSessao = 0;
  for (const item of itens || []) {
    const ancora = (item.ancora || "evento_inteiro") as AncoraTarefa;

    if (ancora === "cada_sessao") {
      if (encontros.length === 0) { itensSemSessao++; continue; } // sem sessões cadastradas ainda
      for (const enc of encontros) {
        rows.push(montarLinha(item, enc.data, enc.id));
      }
      continue;
    }

    const dataRef =
      ancora === "primeira_sessao" ? primeira :
      ancora === "ultima_sessao" ? ultima :
      turma.data_inicio;
    if (!dataRef) continue; // turma sem data_inicio nem encontros — nada a calcular

    rows.push(montarLinha(item, dataRef, null));
  }
  return { rows, itensSemSessao };
}

// Define (aplica ou TROCA) um checklist ESCOLHIDO na turma — mesma lógica de
// "troca limpa" de definirChecklistDoEvento, mas resolvendo cada tarefa pela
// sua âncora (evento inteiro / primeira sessão / última sessão).
export async function definirChecklistDaTurma(
  turma: { id: string; nome: string; data_inicio: string | null; data_fim: string | null },
  templateId: string,
  responsavelId: string,
): Promise<{ tarefasCriadas: number; templateNome: string; itensSemSessao: number }> {
  if (!turma.data_inicio)
    throw new Error("Defina a data de início da turma antes de aplicar o checklist.");

  const { data: tpl, error: tplErr } = await supabase
    .from("checklist_templates")
    .select("id, nome, versao")
    .eq("id", templateId)
    .single();
  if (tplErr) throw tplErr;

  const { rows, itensSemSessao } = await gerarTarefasDaTurma(turma, templateId, responsavelId);

  const { error: delErr } = await supabase
    .from("tarefas")
    .delete()
    .eq("turma_id", turma.id)
    .eq("origem_tarefa", "template");
  if (delErr) throw delErr;

  if (rows.length) {
    const { error: insErr } = await supabase.from("tarefas").insert(rows);
    if (insErr) throw insErr;
  }

  const { error: markErr } = await supabase
    .from("turmas")
    .update({
      checklist_template_id: tpl.id,
      checklist_template_versao: tpl.versao,
    } as any)
    .eq("id", turma.id);
  if (markErr) throw markErr;

  return { tarefasCriadas: rows.length, templateNome: tpl.nome, itensSemSessao };
}

// Recalcula os prazos das tarefas do checklist de um EVENTO depois que a data
// do evento muda. Só toca tarefas ainda 'pendente' — concluídas/canceladas
// ficam intocadas, preservando o que já foi feito.
export async function recalcularPrazosDoEvento(eventoId: string): Promise<{ atualizadas: number }> {
  const { data: evento, error: evErr } = await supabase
    .from("eventos")
    .select("id, data")
    .eq("id", eventoId)
    .single();
  if (evErr) throw evErr;
  if (!evento?.data) return { atualizadas: 0 };

  const { data: tarefas, error: tErr } = await supabase
    .from("tarefas")
    .select("id, data_vencimento, hora, checklist_template_items(fase, offset_valor, offset_unidade)")
    .eq("evento_id", eventoId)
    .eq("origem_tarefa", "template")
    .eq("status", "pendente")
    .not("checklist_item_id", "is", null);
  if (tErr) throw tErr;

  let atualizadas = 0;
  for (const t of (tarefas || []) as any[]) {
    const item = t.checklist_template_items;
    if (!item) continue;
    const prazo = calcularPrazoTarefa(evento.data, item.fase, item.offset_valor, item.offset_unidade);
    if (prazo.data_vencimento !== t.data_vencimento || prazo.hora !== t.hora) {
      const { error } = await supabase
        .from("tarefas")
        .update({ data_vencimento: prazo.data_vencimento, hora: prazo.hora })
        .eq("id", t.id);
      if (error) throw error;
      atualizadas++;
    }
  }
  return { atualizadas };
}

// Recalcula os prazos das tarefas do checklist de uma TURMA depois que
// datas mudaram (início/fim da turma, ou data de uma sessão). Além de
// recalcular, também cria as tarefas "cada sessão" que faltam para sessões
// novas — nunca deleta nada aqui (sessão removida já leva as tarefas dela
// junto, via ON DELETE CASCADE em tarefas.encontro_id).
export async function recalcularPrazosDaTurma(
  turmaId: string,
): Promise<{ atualizadas: number; criadas: number }> {
  const { data: turma, error: turmaErr } = await supabase
    .from("turmas")
    .select("id, nome, data_inicio, data_fim, checklist_template_id")
    .eq("id", turmaId)
    .single();
  if (turmaErr) throw turmaErr;
  if (!turma?.checklist_template_id) return { atualizadas: 0, criadas: 0 };

  const [{ data: encontrosRaw, error: encErr }, { data: itensTemplate, error: itErr }, { data: tarefasExistentes, error: tErr }] =
    await Promise.all([
      supabase
        .from("encontros")
        .select("id, data, sessao_numero")
        .eq("turma_id", turmaId)
        .not("data", "is", null)
        .order("data", { ascending: true }),
      supabase
        .from("checklist_template_items")
        .select("*")
        .eq("template_id", turma.checklist_template_id as string)
        .is("deleted_at", null),
      supabase
        .from("tarefas")
        .select("id, data_vencimento, hora, status, encontro_id, checklist_item_id, responsavel_id")
        .eq("turma_id", turmaId)
        .eq("origem_tarefa", "template"),
    ]);
  if (encErr) throw encErr;
  if (itErr) throw itErr;
  if (tErr) throw tErr;

  const encontros = (encontrosRaw || []) as EncontroRef[];
  const primeira = encontros[0]?.data ?? turma.data_inicio;
  const ultima = encontros[encontros.length - 1]?.data ?? (turma.data_fim || turma.data_inicio);
  const itensById = new Map((itensTemplate || []).map((i: any) => [i.id, i]));

  let atualizadas = 0;
  const existentesChave = new Set<string>();
  const responsavelPorItem = new Map<string, string>();

  for (const t of (tarefasExistentes || []) as any[]) {
    existentesChave.add(`${t.checklist_item_id}|${t.encontro_id ?? ""}`);
    if (t.checklist_item_id && t.responsavel_id && !responsavelPorItem.has(t.checklist_item_id)) {
      responsavelPorItem.set(t.checklist_item_id, t.responsavel_id);
    }

    if (t.status !== "pendente" || !t.checklist_item_id) continue;
    const item = itensById.get(t.checklist_item_id);
    if (!item) continue; // item foi removido do modelo — não recalcula uma tarefa órfã

    const ancora = (item.ancora || "evento_inteiro") as AncoraTarefa;
    let dataRef: string | null;
    if (ancora === "cada_sessao") {
      dataRef = encontros.find((e) => e.id === t.encontro_id)?.data ?? null;
    } else if (ancora === "primeira_sessao") dataRef = primeira ?? null;
    else if (ancora === "ultima_sessao") dataRef = ultima ?? null;
    else dataRef = turma.data_inicio;
    if (!dataRef) continue;

    const prazo = calcularPrazoTarefa(dataRef, item.fase, item.offset_valor, item.offset_unidade);
    if (prazo.data_vencimento !== t.data_vencimento || prazo.hora !== t.hora) {
      const { error } = await supabase
        .from("tarefas")
        .update({ data_vencimento: prazo.data_vencimento, hora: prazo.hora })
        .eq("id", t.id);
      if (error) throw error;
      atualizadas++;
    }
  }

  // Sessões novas: gera as tarefas "cada sessão" que ainda não existem.
  const novasLinhas: any[] = [];
  for (const item of (itensTemplate || []) as any[]) {
    if ((item.ancora || "evento_inteiro") !== "cada_sessao") continue;
    const responsavelId = responsavelPorItem.get(item.id);
    if (!responsavelId) continue; // sem histórico de quem é o responsável — precisa aplicar/trocar manualmente
    for (const enc of encontros) {
      if (existentesChave.has(`${item.id}|${enc.id}`)) continue;
      const prazo = calcularPrazoTarefa(enc.data, item.fase, item.offset_valor, item.offset_unidade);
      novasLinhas.push({
        titulo: item.nome_tarefa,
        descricao: `Checklist da turma "${turma.nome}"${item.obrigatoria ? "" : " (opcional)"}`,
        tipo: "outro",
        prioridade: item.prioridade || "media",
        status: "pendente",
        responsavel_id: responsavelId,
        data_vencimento: prazo.data_vencimento,
        hora: prazo.hora,
        recorrencia: "nenhuma",
        turma_id: turmaId,
        encontro_id: enc.id,
        origem_tarefa: "template",
        fase_evento: item.fase,
        area: item.area || "operacao",
        checklist_item_id: item.id,
      });
    }
  }

  let criadas = 0;
  if (novasLinhas.length) {
    const { error } = await supabase.from("tarefas").insert(novasLinhas);
    if (error) throw error;
    criadas = novasLinhas.length;
  }

  return { atualizadas, criadas };
}

export async function removerChecklistDaTurma(turmaId: string): Promise<number> {
  const { data: apagadas, error } = await supabase
    .from("tarefas")
    .delete()
    .eq("turma_id", turmaId)
    .eq("origem_tarefa", "template")
    .select("id");
  if (error) throw error;

  const { error: updErr } = await supabase
    .from("turmas")
    .update({
      checklist_template_id: null,
      checklist_template_versao: null,
    } as any)
    .eq("id", turmaId);
  if (updErr) throw updErr;

  return apagadas?.length || 0;
}
