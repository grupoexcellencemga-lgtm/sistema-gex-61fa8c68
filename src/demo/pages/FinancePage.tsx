import { Plus, Download, ArrowDownLeft, ArrowUpRight, Landmark, CalendarClock } from "lucide-react";
import { demoAccounts, demoDueItems, demoRevenueSeries, demoTransactions } from "@/demo/data";
import { MiniBarChart, PageIntro, Panel, PanelHeader, PrimaryButton, SecondaryButton, StatCard, StatusBadge } from "@/demo/components/DemoUI";

export default function FinancePage() {
  const chartData = demoRevenueSeries.map((item) => ({ label: item.month, primary: item.revenue, secondary: item.expenses }));
  return (
    <>
      <PageIntro title="Financeiro" description="Caixa, compromissos e movimentações para decidir com segurança."
        actions={<><SecondaryButton><Download className="h-3.5 w-3.5" />Exportar</SecondaryButton><PrimaryButton><Plus className="h-3.5 w-3.5" />Novo lançamento</PrimaryButton></>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="Saldo disponível" value="R$ 128.450" hint="3 contas consolidadas" />
        <StatCard label="A receber no mês" value="R$ 87.430" delta="+14,2%" hint="R$ 14.830 em atraso" />
        <StatCard label="A pagar no mês" value="R$ 28.190" hint="R$ 5.870 nos próximos 7 dias" />
        <StatCard label="Resultado previsto" value="R$ 59.240" delta="+11,8%" hint="Margem projetada de 46,1%" />
      </div>

      <div className="grid xl:grid-cols-[1.45fr_0.75fr] gap-5 mb-5">
        <Panel>
          <PanelHeader title="Fluxo de caixa" eyebrow="Receitas x despesas" action={<div className="text-[10px] text-black/35">Mai — Out 2026</div>} />
          <div className="px-5 pb-5"><MiniBarChart data={chartData} /></div>
        </Panel>
        <Panel>
          <PanelHeader title="Contas" eyebrow="Saldo atual" />
          <div className="divide-y divide-black/[0.05]">
            {demoAccounts.map((account) => <div key={account.name} className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-black/[0.035] flex items-center justify-center"><Landmark className="h-4 w-4 text-black/40" /></div><div className="flex-1"><p className="text-xs font-semibold">{account.name}</p><p className="text-[9px] text-black/30 mt-1">{account.delta} no mês</p></div><p className="text-xs font-semibold">{account.value}</p></div>)}
          </div>
        </Panel>
      </div>
      <div className="grid xl:grid-cols-[0.75fr_1.45fr] gap-5">
        <Panel>
          <PanelHeader title="Próximos vencimentos" action={<CalendarClock className="h-4 w-4 text-black/30" />} />
          <div className="divide-y divide-black/[0.05]">
            {demoDueItems.map((item) => (
              <div key={item.label} className="p-4 flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.kind === "Receber" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>{item.kind === "Receber" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}</div>
                <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold truncate">{item.label}</p><p className="text-[9px] text-black/35 mt-1">{item.date}</p></div>
                <div className="text-right"><p className="text-[11px] font-semibold">{item.value}</p><StatusBadge tone={item.kind === "Receber" ? "success" : "danger"}>{item.kind}</StatusBadge></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Movimentações recentes" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead><tr className="border-b border-black/[0.05] text-[9px] uppercase tracking-[0.08em] text-black/30"><th className="px-5 py-3">Data</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Valor</th></tr></thead>
              <tbody>{demoTransactions.map((item) => <tr key={item.date + item.name} className="border-b border-black/[0.045] last:border-0"><td className="px-5 py-3.5 text-[10px] text-black/35">{item.date}</td><td className="px-4 py-3.5 text-xs font-semibold">{item.name}</td><td className="px-4 py-3.5 text-[10px] text-black/45">{item.category}</td><td className="px-4 py-3.5"><StatusBadge tone="success">{item.status}</StatusBadge></td><td className={`px-5 py-3.5 text-right text-xs font-semibold ${item.type === "Entrada" ? "text-emerald-700" : "text-rose-700"}`}>{item.value}</td></tr>)}</tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}
