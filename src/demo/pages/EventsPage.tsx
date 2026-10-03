import { Plus, CalendarDays, MapPin, Users, CheckCircle2, ArrowRight, TicketCheck, TrendingUp } from "lucide-react";
import { demoEvents } from "@/demo/data";
import { PageIntro, Panel, PanelHeader, PrimaryButton, ProgressBar, StatusBadge } from "@/demo/components/DemoUI";

export default function EventsPage() {
  return (
    <>
      <PageIntro title="Eventos" description="Calendário, inscrições e operação com foco no que precisa acontecer antes de cada evento."
        actions={<PrimaryButton><Plus className="h-3.5 w-3.5" />Novo evento</PrimaryButton>} />
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Panel className="p-5"><CalendarDays className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold mt-4">4</p><p className="text-[10px] text-black/35 mt-1">próximos eventos</p></Panel>
        <Panel className="p-5"><TicketCheck className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold mt-4">265</p><p className="text-[10px] text-black/35 mt-1">inscrições confirmadas</p></Panel>
        <Panel className="p-5"><TrendingUp className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold mt-4">18,4%</p><p className="text-[10px] text-black/35 mt-1">conversão pós-evento</p></Panel>
      </div>

      <div className="grid xl:grid-cols-[1.25fr_0.75fr] gap-5">
        <Panel>
          <PanelHeader title="Outubro 2026" eyebrow="Próximos eventos" />
          <div className="divide-y divide-black/[0.05]">
            {demoEvents.map((event) => (
              <div key={event.name} className="p-5 flex gap-4 md:gap-5 items-start">
                <div className="h-16 w-14 rounded-xl bg-black/[0.025] border border-black/[0.05] flex flex-col items-center justify-center shrink-0"><span className="text-xl font-semibold tracking-[-0.04em]">{event.day}</span><span className="text-[9px] font-semibold text-black/35">{event.month}</span></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{event.name}</h3><StatusBadge tone={event.status === "Pronto" ? "success" : event.status === "Planejado" ? "neutral" : "warning"}>{event.status}</StatusBadge></div><div className="flex flex-wrap gap-4 mt-2 text-[10px] text-black/35"><span>{event.time}</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.place}</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.registrations} inscritos</span></div><div className="mt-4 max-w-md"><div className="flex justify-between text-[9px] text-black/35 mb-1.5"><span>Checklist operacional</span><span>{event.checklist}%</span></div><ProgressBar value={event.checklist} /></div></div>
                <ArrowRight className="h-4 w-4 text-black/20 mt-1" />
              </div>
            ))}
          </div>
        </Panel>
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Próximo evento" eyebrow="04 out · 09:00" />
            <div className="p-5">
              <h3 className="text-lg font-semibold">Café com Propósito</h3><p className="text-[10px] text-black/35 mt-1">Maringá · Presencial</p>
              <div className="grid grid-cols-2 gap-3 mt-5"><div className="rounded-xl bg-black/[0.025] p-3"><p className="text-xl font-semibold">70</p><p className="text-[9px] text-black/35 mt-1">inscritas</p></div><div className="rounded-xl bg-black/[0.025] p-3"><p className="text-xl font-semibold">92%</p><p className="text-[9px] text-black/35 mt-1">operação pronta</p></div></div>
              <div className="mt-5 space-y-3">{["Lista de presença pronta", "Equipe confirmada", "Mesa do café confirmada", "Disparo final às 18h"].map((item, index) => <div key={item} className="flex items-center gap-2"><CheckCircle2 className={`h-3.5 w-3.5 ${index < 3 ? "text-emerald-600" : "text-amber-500"}`} /><span className="text-[10px] text-black/55">{item}</span></div>)}</div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Funil dos eventos" />
            <div className="p-5 space-y-4">{[{ label: "Inscritos", value: 265, pct: 100 }, { label: "Compareceram", value: 214, pct: 81 }, { label: "Oportunidades", value: 63, pct: 24 }, { label: "Vendas", value: 39, pct: 15 }].map((item) => <div key={item.label}><div className="flex justify-between text-[10px] mb-1.5"><span className="text-black/40">{item.label}</span><span className="font-semibold">{item.value}</span></div><ProgressBar value={item.pct} /></div>)}</div>
          </Panel>
        </div>
      </div>
    </>
  );
}
