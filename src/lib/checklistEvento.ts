import { supabase } from "@/integrations/supabase/client";

// Cálculos de prazo do checklist de eventos.
// eventos.data é DATE (sem hora); ancoramos às 09:00 de America/Sao_Paulo (-03:00)
// para que offsets em horas/minutos não mudem de dia por causa de UTC.
const HORA_ANCORA = 9;

export type OffsetUnidade = "minutos" | "horas" | "dias";
export type FaseEvento = "pre_evento" | "dia_evento" | "pos_evento";

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
