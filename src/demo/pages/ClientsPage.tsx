import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Plus, Phone, Mail, CreditCard, MessageSquare, CheckCircle2 } from "lucide-react";
import { demoClients, demoClientTimeline } from "@/demo/data";
import { EmptyAvatar, PageIntro, Panel, PrimaryButton, SecondaryButton, StatCard, StatusBadge } from "@/demo/components/DemoUI";

export default function ClientsPage() {
  const [selectedId, setSelectedId] = useState("ana");
  const [query, setQuery] = useState("");
  const clients = useMemo(() => demoClients.filter((client) => client.name.toLowerCase().includes(query.toLowerCase()) || client.product.toLowerCase().includes(query.toLowerCase())), [query]);
  const selected = demoClients.find((client) => client.id === selectedId) ?? demoClients[0];

  return (
    <>
      <PageIntro title="Clientes" description="Relacionamento, histórico e situação financeira em uma única visão."
        actions={<><SecondaryButton><SlidersHorizontal className="h-3.5 w-3.5" />Filtros</SecondaryButton><PrimaryButton><Plus className="h-3.5 w-3.5" />Novo cliente</PrimaryButton></>} />
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Total de clientes" value="286" hint="+18 nos últimos 30 dias" />
        <StatCard label="Ativos" value="268" delta="+6,8%" hint="93,7% da base" />
        <StatCard label="Com pendência" value="12" hint="R$ 14.830 em aberto" />
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_430px] gap-5 items-start">
        <Panel className="overflow-hidden">
          <div className="p-4 border-b border-black/[0.055] flex items-center gap-3">
            <div className="flex-1 h-10 rounded-xl bg-black/[0.025] border border-black/[0.055] flex items-center gap-2.5 px-3">
              <Search className="h-4 w-4 text-black/30" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou produto..." className="w-full bg-transparent outline-none text-xs placeholder:text-black/30" />
            </div>
            <span className="text-[11px] text-black/35">{clients.length} exibidos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead><tr className="text-[10px] uppercase tracking-[0.08em] text-black/30 border-b border-black/[0.05]">
                <th className="px-5 py-3 font-semibold">Cliente</th><th className="px-4 py-3 font-semibold">Produto</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Contratado</th><th className="px-4 py-3 font-semibold">Pendente</th>
              </tr></thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} onClick={() => setSelectedId(client.id)} className={`border-b border-black/[0.045] last:border-0 cursor-pointer transition-colors ${selected.id === client.id ? "bg-[var(--demo-primary-faint)]" : "hover:bg-black/[0.012]"}`}>
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><EmptyAvatar name={client.name} /><div><p className="text-xs font-semibold">{client.name}</p><p className="text-[10px] text-black/35 mt-0.5">{client.phone}</p></div></div></td>
                    <td className="px-4 py-3.5 text-xs text-black/55">{client.product}</td>
                    <td className="px-4 py-3.5"><StatusBadge tone={client.status === "Ativo" ? "success" : client.status === "Pendente" ? "warning" : "neutral"}>{client.status}</StatusBadge></td>
                    <td className="px-4 py-3.5 text-xs font-medium">{client.total}</td>
                    <td className="px-4 py-3.5 text-xs font-medium" style={{ color: client.pending !== "R$ 0" ? "#be123c" : undefined }}>{client.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="overflow-hidden xl:sticky xl:top-[92px]">
          <div className="p-5 border-b border-black/[0.055]">
            <div className="flex items-start gap-3"><EmptyAvatar name={selected.name} size="lg" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-base font-semibold truncate">{selected.name}</h3><StatusBadge tone={selected.status === "Ativo" ? "success" : "warning"}>{selected.status}</StatusBadge></div><p className="text-[11px] text-black/35 mt-1">Cliente desde 26 set 2026</p></div></div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <button className="h-9 rounded-lg bg-black/[0.025] flex items-center justify-center gap-1.5 text-[10px] font-semibold"><Phone className="h-3.5 w-3.5" />Ligar</button>
              <button className="h-9 rounded-lg bg-black/[0.025] flex items-center justify-center gap-1.5 text-[10px] font-semibold"><MessageSquare className="h-3.5 w-3.5" />WhatsApp</button>
              <button className="h-9 rounded-lg bg-black/[0.025] flex items-center justify-center gap-1.5 text-[10px] font-semibold"><Mail className="h-3.5 w-3.5" />E-mail</button>
            </div>
          </div>
          <div className="p-5 border-b border-black/[0.055]">
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-black/30 mb-3">Visão geral</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-black/[0.025] p-3"><p className="text-[10px] text-black/35">Produto atual</p><p className="text-xs font-semibold mt-1.5">{selected.product}</p></div>
              <div className="rounded-xl bg-black/[0.025] p-3"><p className="text-[10px] text-black/35">Total contratado</p><p className="text-xs font-semibold mt-1.5">{selected.total}</p></div>
            </div>
            <div className="mt-3 rounded-xl border border-black/[0.055] p-3 flex items-center justify-between"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-black/35" /><div><p className="text-[10px] text-black/35">Situação financeira</p><p className="text-xs font-semibold mt-0.5">{selected.pending === "R$ 0" ? "Em dia" : `${selected.pending} pendente`}</p></div></div>{selected.pending === "R$ 0" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div>
          </div>

          <div className="p-5">
            <p className="text-[10px] uppercase tracking-[0.1em] font-semibold text-black/30 mb-4">Histórico recente</p>
            <div className="space-y-4">
              {demoClientTimeline.map((item, index) => (
                <div key={item.title + item.date} className="flex gap-3">
                  <div className="flex flex-col items-center"><span className="h-2 w-2 rounded-full mt-1.5" style={{ background: index === 0 ? "var(--demo-primary)" : "#d4d4d4" }} />{index < demoClientTimeline.length - 1 && <span className="w-px flex-1 bg-black/[0.06] mt-1" />}</div>
                  <div className="pb-1"><p className="text-xs font-semibold">{item.title}</p><p className="text-[10px] text-black/38 mt-0.5">{item.detail}</p><p className="text-[9px] text-black/25 mt-1">{item.date}</p></div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
