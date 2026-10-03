import { Plus, CalendarDays, List, Kanban, Clock3, UserRound } from "lucide-react";
import { demoTasks } from "@/demo/data";
import { PageIntro, Panel, PrimaryButton, SecondaryButton, StatusBadge } from "@/demo/components/DemoUI";

const priorities = ["Alta", "Média", "Baixa"];

export default function TasksPage() {
  return (
    <>
      <PageIntro title="Tarefas" description="Responsáveis, prazos e execução organizados sem perder contexto."
        actions={<><SecondaryButton><List className="h-3.5 w-3.5" />Lista</SecondaryButton><SecondaryButton><CalendarDays className="h-3.5 w-3.5" />Calendário</SecondaryButton><PrimaryButton><Plus className="h-3.5 w-3.5" />Nova tarefa</PrimaryButton></>} />
      <div className="flex items-center gap-2 mb-4"><StatusBadge tone="info"><Kanban className="h-3 w-3 mr-1" />Kanban</StatusBadge><span className="text-[10px] text-black/30">18 tarefas abertas · 3 atrasadas</span></div>
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-4 gap-4 min-w-[980px]">
          {demoTasks.map((column, columnIndex) => (
            <section key={column.stage} className="rounded-[16px] bg-black/[0.025] border border-black/[0.04] p-3 min-h-[530px]">
              <div className="flex items-center justify-between px-1 pb-3"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: columnIndex === 3 ? "#10b981" : columnIndex === 1 ? "var(--demo-primary)" : "#a3a3a3" }} /><p className="text-xs font-semibold">{column.stage}</p></div><span className="text-[10px] text-black/35">{column.items.length}</span></div>
              <div className="space-y-2.5">{column.items.map((item, itemIndex) => <Panel key={item} className="p-3"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold leading-snug">{item}</p><span className="h-2 w-2 rounded-full mt-1 shrink-0" style={{ background: priorities[itemIndex % 3] === "Alta" ? "#e11d48" : priorities[itemIndex % 3] === "Média" ? "#d97706" : "#a3a3a3" }} /></div><div className="mt-4 flex items-center justify-between"><span className="flex items-center gap-1 text-[9px] text-black/30"><Clock3 className="h-3 w-3" />{columnIndex === 0 ? "Hoje" : columnIndex === 3 ? "Concluída" : "04 out"}</span><span className="h-6 w-6 rounded-full bg-black/[0.04] flex items-center justify-center"><UserRound className="h-3 w-3 text-black/35" /></span></div></Panel>)}</div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
