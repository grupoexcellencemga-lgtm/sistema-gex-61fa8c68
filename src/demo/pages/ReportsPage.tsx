import { Download, CalendarDays, ChevronDown, FileSpreadsheet, FileText, TrendingUp } from "lucide-react";
import { demoRevenueSeries } from "@/demo/data";
import { MiniBarChart, PageIntro, Panel, PanelHeader, SecondaryButton, StatCard } from "@/demo/components/DemoUI";

export default function ReportsPage() {
  const data = demoRevenueSeries.map((item) => ({ label: item.month, primary: item.revenue, secondary: item.expenses }));
  return (
    <>
      <PageIntro title="Relatórios" description="Uma área de análise para transformar os dados operacionais em decisões."
        actions={<><SecondaryButton><CalendarDays className="h-3.5 w-3.5" />Últimos 6 meses<ChevronDown className="h-3.5 w-3.5" /></SecondaryButton><SecondaryButton><Download className="h-3.5 w-3.5" />Exportar</SecondaryButton></>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="Receita acumulada" value="R$ 598 mil" delta="+16,2%" />
        <StatCard label="Lucro acumulado" value="R$ 351 mil" delta="+13,4%" />
        <StatCard label="Vendas" value="284" delta="+22,1%" />
        <StatCard label="Ticket médio" value="R$ 2.105" delta="+4,8%" />
      </div>
      <div className="grid xl:grid-cols-[1.35fr_0.65fr] gap-5 mb-5">
        <Panel><PanelHeader title="Evolução financeira" eyebrow="Receita x despesas" /><div className="px-5 pb-5"><MiniBarChart data={data} /></div></Panel>
        <Panel><PanelHeader title="Indicadores comerciais" /><div className="p-5 space-y-5">{[{ label: "Conversão", value: "24,8%", delta: "+3,2 p.p." }, { label: "CAC estimado", value: "R$ 184", delta: "-8,4%" }, { label: "Ciclo médio", value: "7,8 dias", delta: "-1,2 dia" }, { label: "Inadimplência", value: "4,2%", delta: "-0,9 p.p." }].map((item) => <div key={item.label} className="flex items-center justify-between"><div><p className="text-[10px] text-black/35">{item.label}</p><p className="text-base font-semibold mt-1">{item.value}</p></div><span className="text-[10px] font-semibold text-emerald-700">{item.delta}</span></div>)}</div></Panel>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Panel className="p-5"><TrendingUp className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><h3 className="text-sm font-semibold mt-4">DRE gerencial</h3><p className="text-[10px] text-black/38 mt-1.5 leading-relaxed">Receita, custos, despesas e resultado organizados por período.</p><button className="mt-5 text-[10px] font-semibold" style={{ color: "var(--demo-primary)" }}>Abrir relatório →</button></Panel>
        <Panel className="p-5"><FileSpreadsheet className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><h3 className="text-sm font-semibold mt-4">Comissões</h3><p className="text-[10px] text-black/38 mt-1.5 leading-relaxed">Vendas, valores devidos, pagos e histórico por vendedor.</p><button className="mt-5 text-[10px] font-semibold" style={{ color: "var(--demo-primary)" }}>Abrir relatório →</button></Panel>
        <Panel className="p-5"><FileText className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><h3 className="text-sm font-semibold mt-4">Inadimplência</h3><p className="text-[10px] text-black/38 mt-1.5 leading-relaxed">Atrasos, aging de carteira, clientes e valores em risco.</p><button className="mt-5 text-[10px] font-semibold" style={{ color: "var(--demo-primary)" }}>Abrir relatório →</button></Panel>
      </div>
    </>
  );
}
