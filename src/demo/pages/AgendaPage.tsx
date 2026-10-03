import { ChevronLeft, ChevronRight, Plus, Video, Users, CalendarCheck2 } from "lucide-react";
import { demoAgenda } from "@/demo/data";
import { PageIntro, Panel, PanelHeader, PrimaryButton, StatusBadge } from "@/demo/components/DemoUI";

const week = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const days = [27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
const events: Record<number, Array<{ label: string; tone: "brand" | "dark" | "soft" }>> = {
  3: [{ label: "Demo GEx · 14h", tone: "brand" }],
  4: [{ label: "Café com Propósito", tone: "dark" }],
  6: [{ label: "Follow-up OPEX", tone: "soft" }],
  9: [{ label: "Workshop Eleva-te", tone: "brand" }],
  10: [{ label: "OPEX · Dia 1", tone: "dark" }],
  11: [{ label: "OPEX · Dia 2", tone: "dark" }],
  18: [{ label: "Advanced", tone: "brand" }],
  24: [{ label: "Treinamento", tone: "soft" }],
};

export default function AgendaPage() {
  return (
    <>
      <PageIntro title="Agenda" description="Compromissos, tarefas e operação em um calendário único."
        actions={<PrimaryButton><Plus className="h-3.5 w-3.5" />Novo compromisso</PrimaryButton>} />
      <div className="grid xl:grid-cols-[minmax(0,1fr)_330px] gap-5">
        <Panel className="overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.055] flex items-center justify-between"><div className="flex items-center gap-2"><button className="h-8 w-8 rounded-lg border border-black/[0.06] flex items-center justify-center"><ChevronLeft className="h-3.5 w-3.5" /></button><button className="h-8 w-8 rounded-lg border border-black/[0.06] flex items-center justify-center"><ChevronRight className="h-3.5 w-3.5" /></button><h3 className="text-sm font-semibold ml-2">Outubro 2026</h3></div><StatusBadge tone="info">Google Agenda · leitura</StatusBadge></div>
          <div className="grid grid-cols-7 border-b border-black/[0.05]">{week.map((day) => <div key={day} className="py-2 text-center text-[9px] font-semibold tracking-[0.08em] text-black/30">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const currentMonth = index >= 4;
              const dayEvents = currentMonth ? events[day] ?? [] : [];
              const today = day === 3 && currentMonth;
              return <div key={`${day}-${index}`} className="min-h-[110px] border-r border-b border-black/[0.045] last:border-r-0 p-2.5">
                <div className={`h-6 w-6 rounded-full text-[10px] flex items-center justify-center ${today ? "text-white font-semibold" : currentMonth ? "text-black/55" : "text-black/20"}`} style={today ? { background: "var(--demo-primary)" } : undefined}>{day}</div>
                <div className="mt-2 space-y-1.5">{dayEvents.map((event) => <div key={event.label} className={`rounded-md px-2 py-1.5 text-[9px] font-medium truncate ${event.tone === "dark" ? "bg-[#171717] text-white" : event.tone === "soft" ? "bg-black/[0.045] text-black/55" : "text-white"}`} style={event.tone === "brand" ? { background: "var(--demo-primary)" } : undefined}>{event.label}</div>)}</div>
              </div>;
            })}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel><PanelHeader title="Hoje · 03 out" eyebrow="4 compromissos" /><div className="p-5 space-y-4">{demoAgenda.map((item) => <div key={item.time} className="flex gap-3"><span className="w-10 text-[10px] font-semibold text-black/35 pt-0.5">{item.time}</span><div className="pl-3 border-l border-black/[0.08]"><p className="text-[11px] font-semibold">{item.title}</p><p className="text-[9px] text-black/35 mt-1">{item.meta}</p></div></div>)}</div></Panel>
          <Panel><PanelHeader title="Tipos de agenda" /><div className="p-5 space-y-3"><div className="flex items-center gap-3"><Video className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><div><p className="text-[11px] font-semibold">Reuniões</p><p className="text-[9px] text-black/35 mt-0.5">8 nesta semana</p></div></div><div className="flex items-center gap-3"><Users className="h-4 w-4 text-black/40" /><div><p className="text-[11px] font-semibold">Turmas e eventos</p><p className="text-[9px] text-black/35 mt-0.5">5 programados</p></div></div><div className="flex items-center gap-3"><CalendarCheck2 className="h-4 w-4 text-black/40" /><div><p className="text-[11px] font-semibold">Tarefas</p><p className="text-[9px] text-black/35 mt-0.5">11 com prazo</p></div></div></div></Panel>
        </div>
      </div>
    </>
  );
}
