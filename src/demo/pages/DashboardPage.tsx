import { CalendarDays, ChevronDown, Target, UsersRound, WalletCards, TrendingUp } from "lucide-react";
import { demoKpis, demoRevenueSeries } from "@/demo/data";
import { MiniBarChart, PageIntro, Panel, PanelHeader, SecondaryButton, StatCard, ProgressBar } from "@/demo/components/DemoUI";

export default function DashboardPage() {
  const chartData = demoRevenueSeries.map((item) => ({ label: item.month, primary: item.revenue, secondary: item.expenses }));
  return (
    <>
      <PageIntro title="Visão do negócio" description="Performance consolidada da empresa em outubro de 2026."
        actions={<SecondaryButton><CalendarDays className="h-3.5 w-3.5" />Outubro 2026<ChevronDown className="h-3.5 w-3.5" /></SecondaryButton>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {demoKpis.map((kpi) => <StatCard key={kpi.label} label={kpi.label} value={kpi.value} delta={kpi.delta} />)}
      </div>

      <div className="grid xl:grid-cols-[1.5fr_0.7fr] gap-5 mb-5">
        <Panel>
          <PanelHeader title="Receita x despesas" eyebrow="Últimos 6 meses" action={<div className="flex gap-3 text-[10px] text-black/35"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: "var(--demo-primary)" }} />Receita</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-black/10" />Despesas</span></div>} />
          <div className="px-5 pb-5"><MiniBarChart data={chartData} /></div>
        </Panel>

        <Panel>
          <PanelHeader title="Meta de receita" eyebrow="Outubro" />
          <div className="p-5">
            <div className="flex items-end justify-between mb-4"><div><p className="text-[28px] font-semibold tracking-[-0.04em]">R$ 128,4 mil</p><p className="text-[11px] text-black/35 mt-1">de R$ 150 mil</p></div><span className="text-xs font-semibold" style={{ color: "var(--demo-primary)" }}>85,6%</span></div>
            <ProgressBar value={85.6} />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/[0.025] p-3"><TrendingUp className="h-4 w-4 text-emerald-600 mb-3" /><p className="text-lg font-semibold">+18,6%</p><p className="text-[10px] text-black/35 mt-1">vs. setembro</p></div>
              <div className="rounded-xl bg-black/[0.025] p-3"><Target className="h-4 w-4 mb-3" style={{ color: "var(--demo-primary)" }} /><p className="text-lg font-semibold">R$ 21,6 mil</p><p className="text-[10px] text-black/35 mt-1">para a meta</p></div>
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel>
          <PanelHeader title="Funil comercial" />
          <div className="p-5 space-y-4">
            {[{ label: "Leads", value: 142, pct: 100 }, { label: "Contatos", value: 88, pct: 62 }, { label: "Propostas", value: 42, pct: 30 }, { label: "Vendas", value: 18, pct: 13 }].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5"><span className="text-black/50">{item.label}</span><span className="font-semibold">{item.value}</span></div>
                <div className="h-1.5 rounded-full bg-black/[0.045]"><div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: "var(--demo-primary)" }} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Clientes" />
          <div className="p-5 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-black/[0.025] p-4"><UsersRound className="h-4 w-4 text-black/45 mb-4" /><p className="text-2xl font-semibold">268</p><p className="text-[10px] text-black/35 mt-1">clientes ativos</p></div>
            <div className="rounded-xl bg-black/[0.025] p-4"><WalletCards className="h-4 w-4 text-black/45 mb-4" /><p className="text-2xl font-semibold">4,2%</p><p className="text-[10px] text-black/35 mt-1">inadimplência</p></div>
            <div className="col-span-2 pt-1"><div className="flex justify-between text-xs"><span className="text-black/40">Retenção</span><span className="font-semibold">91,8%</span></div><div className="mt-2"><ProgressBar value={91.8} /></div></div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Origem das vendas" />
          <div className="p-5 space-y-4">
            {[{ label: "Instagram", value: 42 }, { label: "Indicação", value: 28 }, { label: "Eventos", value: 18 }, { label: "Orgânico", value: 12 }].map((item) => (
              <div key={item.label} className="flex items-center gap-3"><div className="w-20 text-xs text-black/45">{item.label}</div><div className="flex-1 h-2 rounded-full bg-black/[0.045]"><div className="h-full rounded-full" style={{ width: `${item.value * 2}%`, background: "var(--demo-primary)" }} /></div><span className="w-8 text-right text-xs font-semibold">{item.value}%</span></div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
