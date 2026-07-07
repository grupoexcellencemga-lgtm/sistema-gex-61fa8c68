import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from "date-fns";

export type AgendaTipo = "evento" | "turma" | "tarefa";

export interface AgendaItem {
  id: string;
  tipo: AgendaTipo;
  titulo: string;
  data: string; // "YYYY-MM-DD"
  url: string; // para onde navegar ao clicar
  concluida?: boolean; // tarefas concluídas ficam esmaecidas
  atrasada?: boolean;
}

export const TIPO_CONFIG: Record<
  AgendaTipo,
  { label: string; dot: string; chip: string }
> = {
  evento: {
    label: "Eventos",
    dot: "bg-orange-500",
    chip: "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200",
  },
  turma: {
    label: "Turmas",
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
  },
  tarefa: {
    label: "Tarefas",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200",
  },
};

// Data local (America/Sao_Paulo, -03:00) em YYYY-MM-DD, para marcar "hoje".
export function hojeISO(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

// Grade do mês: 6 semanas (42 dias) começando no domingo, como o Google Agenda.
export function gridDoMes(ref: Date): Date[] {
  const inicio = startOfWeek(startOfMonth(ref), { weekStartsOn: 0 });
  const fim = endOfWeek(endOfMonth(ref), { weekStartsOn: 0 });
  return eachDayOfInterval({ start: inicio, end: fim });
}

export const isoDoDia = (d: Date) => format(d, "yyyy-MM-dd");

export function itensPorDia(itens: AgendaItem[]): Map<string, AgendaItem[]> {
  const mapa = new Map<string, AgendaItem[]>();
  for (const it of itens) {
    if (!it.data) continue;
    const chave = it.data.slice(0, 10);
    const lista = mapa.get(chave) || [];
    lista.push(it);
    mapa.set(chave, lista);
  }
  // ordena dentro do dia: eventos, turmas, tarefas
  const ordem: Record<AgendaTipo, number> = { evento: 0, turma: 1, tarefa: 2 };
  for (const lista of mapa.values()) {
    lista.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);
  }
  return mapa;
}

export const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
