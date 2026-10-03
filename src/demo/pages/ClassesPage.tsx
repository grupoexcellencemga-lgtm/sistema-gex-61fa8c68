import { useState } from "react";
import { Plus, Users, CalendarDays, MapPin, MoreHorizontal, CheckCircle2, WalletCards, BarChart3, ClipboardCheck } from "lucide-react";
import { demoClasses } from "@/demo/data";
import { PageIntro, Panel, PrimaryButton, ProgressBar, StatusBadge } from "@/demo/components/DemoUI";

export default function ClassesPage() {
  const [selected, setSelected] = useState(0);
  const turma = demoClasses[selected];
  return (
    <>
      <PageIntro title="Turmas" description="Acompanhe ocupação e andamento; abra uma turma para operar alunos, presença e financeiro."
        actions={<PrimaryButton><Plus className="h-3.5 w-3.5" />Nova turma</PrimaryButton>} />
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {demoClasses.map((item, index) => (
          <button key={item.name} onClick={() => setSelected(index)} className={`text-left bg-white rounded-[18px] border p-5 transition-all hover:-translate-y-0.5 ${selected === index ? "border-[var(--demo-primary)] shadow-sm" : "border-black/[0.055]"}`}>
            <div className="flex items-start justify-between"><StatusBadge tone={item.status === "Em andamento" ? "success" : item.status === "Planejado" ? "neutral" : "warning"}>{item.status}</StatusBadge><MoreHorizontal className="h-4 w-4 text-black/25" /></div>
            <h3 className="text-sm font-semibold mt-4">{item.name}</h3><p className="text-[10px] text-black/35 mt-1">{item.product}</p>
            <div className="flex items-center gap-4 mt-5 text-[10px] text-black/40"><span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{item.date}</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{item.students}/{item.capacity}</span></div>
            <div className="mt-4"><div className="flex justify-between text-[9px] text-black/35 mb-2"><span>Ocupação</span><span>{Math.round((item.students / item.capacity) * 100)}%</span></div><ProgressBar value={(item.students / item.capacity) * 100} /></div>
          </button>
        ))}
      </div>
      <Panel className="overflow-hidden">
        <div className="p-5 border-b border-black/[0.055] flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div><div className="flex items-center gap-2"><h3 className="text-base font-semibold">{turma.name}</h3><StatusBadge tone="success">{turma.status}</StatusBadge></div><div className="flex items-center gap-4 mt-2 text-[10px] text-black/35"><span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{turma.date}</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />Maringá · Presencial</span></div></div>
          <div className="flex gap-1 p-1 bg-black/[0.025] rounded-xl overflow-x-auto">{["Visão geral", "Alunos", "Presença", "Financeiro", "Métricas", "Operação"].map((tab, index) => <button key={tab} className={`h-8 px-3 rounded-lg text-[10px] font-semibold shrink-0 ${index === 0 ? "bg-white shadow-sm" : "text-black/40"}`}>{tab}</button>)}</div>
        </div>
        <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5 md:p-6 border-b lg:border-b-0 lg:border-r border-black/[0.055]">
            <div className="grid sm:grid-cols-3 gap-3"><div className="rounded-xl bg-black/[0.025] p-4"><Users className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold mt-4">{turma.students}</p><p className="text-[9px] text-black/35 mt-1">alunos</p></div><div className="rounded-xl bg-black/[0.025] p-4"><WalletCards className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold mt-4">{turma.revenue}</p><p className="text-[9px] text-black/35 mt-1">contratado</p></div><div className="rounded-xl bg-black/[0.025] p-4"><CheckCircle2 className="h-4 w-4 text-black/35" /><p className="text-2xl font-semibold mt-4">89%</p><p className="text-[9px] text-black/35 mt-1">frequência média</p></div></div>
            <div className="mt-6"><div className="flex justify-between text-xs mb-2"><span className="font-semibold">Preparação operacional</span><span className="font-semibold" style={{ color: "var(--demo-primary)" }}>{turma.progress}%</span></div><ProgressBar value={turma.progress} /><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">{["Sala confirmada", "Equipe definida", "Materiais", "Comunicação"].map((step, index) => <div key={step} className="rounded-lg border border-black/[0.055] p-2.5"><span className={`h-2 w-2 rounded-full inline-block mr-2 ${index < 2 ? "bg-emerald-500" : "bg-amber-400"}`} /><span className="text-[9px] font-medium">{step}</span></div>)}</div></div>
          </div>
          <div className="p-5 md:p-6">
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-black/30 mb-4">Resumo da turma</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3"><BarChart3 className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><div><p className="text-[11px] font-semibold">Métricas atualizadas</p><p className="text-[9px] text-black/35 mt-0.5">Ocupação, frequência e resultado financeiro.</p></div></div>
              <div className="flex items-center gap-3"><ClipboardCheck className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><div><p className="text-[11px] font-semibold">6 tarefas pendentes</p><p className="text-[9px] text-black/35 mt-0.5">2 precisam ser concluídas hoje.</p></div></div>
              <div className="rounded-xl bg-amber-50 p-4"><p className="text-[10px] font-semibold text-amber-800">Atenção</p><p className="text-[9px] text-amber-700/80 mt-1">3 alunos estão com pagamento em atraso.</p></div>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
