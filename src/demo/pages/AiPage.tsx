import { Plus, Bot, MessageSquareMore, Gauge, Coins, ArrowRight, ShieldCheck, DatabaseZap, Workflow } from "lucide-react";
import { demoAgents } from "@/demo/data";
import { PageIntro, Panel, PanelHeader, PrimaryButton, ProgressBar, StatCard, StatusBadge } from "@/demo/components/DemoUI";

export default function AiPage() {
  return (
    <>
      <PageIntro title="Inteligência Artificial" description="Agentes, conversas, automações e consumo em uma central própria."
        actions={<PrimaryButton><Plus className="h-3.5 w-3.5" />Novo agente</PrimaryButton>} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <StatCard label="Atendimentos hoje" value="260" delta="+21%" hint="Todos os agentes" />
        <StatCard label="Em andamento" value="18" hint="9 WhatsApp · 6 Instagram · 3 web" />
        <StatCard label="Transferidos ao humano" value="16" hint="6,1% dos atendimentos" />
        <StatCard label="Custo estimado hoje" value="R$ 32,26" hint="Tokens + provedores" />
      </div>

      <div className="grid xl:grid-cols-[1.4fr_0.7fr] gap-5 mb-5">
        <Panel>
          <PanelHeader title="Agentes" eyebrow="Operação atual" />
          <div className="divide-y divide-black/[0.05]">
            {demoAgents.map((agent, index) => <div key={agent.name} className="p-5 flex items-center gap-4"><div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: "var(--demo-primary-soft)", color: "var(--demo-primary)" }}><Bot className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-xs font-semibold">{agent.name}</p><StatusBadge tone={agent.status === "Pausado" ? "neutral" : "success"}>{agent.status}</StatusBadge></div><p className="text-[10px] text-black/35 mt-1">{agent.role}</p></div><div className="hidden sm:grid grid-cols-3 gap-7 text-right"><div><p className="text-xs font-semibold">{agent.conversations}</p><p className="text-[9px] text-black/30 mt-1">conversas</p></div><div><p className="text-xs font-semibold">{agent.handoffs}</p><p className="text-[9px] text-black/30 mt-1">handoffs</p></div><div><p className="text-xs font-semibold">{agent.cost}</p><p className="text-[9px] text-black/30 mt-1">custo</p></div></div><ArrowRight className="h-4 w-4 text-black/20" /></div>)}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Consumo IA" eyebrow="Outubro" action={<Coins className="h-4 w-4 text-black/30" />} />
          <div className="p-5">
            <p className="text-[30px] font-semibold tracking-[-0.04em]">R$ 386,42</p><p className="text-[10px] text-black/35 mt-1">custo acumulado estimado</p>
            <div className="mt-6 space-y-4">{[{ label: "Júlia", value: 58, price: "R$ 224,11" }, { label: "OPEX", value: 24, price: "R$ 92,74" }, { label: "Financeiro", value: 12, price: "R$ 46,37" }, { label: "Outros", value: 6, price: "R$ 23,20" }].map((item) => <div key={item.label}><div className="flex justify-between text-[10px] mb-2"><span className="text-black/45">{item.label}</span><span className="font-semibold">{item.price}</span></div><ProgressBar value={item.value} /></div>)}</div>
            <div className="mt-6 rounded-xl bg-black/[0.025] p-3 flex items-center gap-3"><Gauge className="h-4 w-4" style={{ color: "var(--demo-primary)" }} /><div><p className="text-[10px] font-semibold">Custo médio por atendimento</p><p className="text-[9px] text-black/35 mt-0.5">R$ 0,12 hoje</p></div></div>
          </div>
        </Panel>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Panel className="p-5"><div className="h-9 w-9 rounded-xl bg-black/[0.035] flex items-center justify-center"><Workflow className="h-4 w-4 text-black/45" /></div><h3 className="text-sm font-semibold mt-4">Fluxos</h3><p className="text-[10px] text-black/38 mt-1.5 leading-relaxed">12 automações ativas para qualificação, follow-up, cobrança e pós-venda.</p><button className="mt-4 text-[10px] font-semibold" style={{ color: "var(--demo-primary)" }}>Gerenciar fluxos →</button></Panel>
        <Panel className="p-5"><div className="h-9 w-9 rounded-xl bg-black/[0.035] flex items-center justify-center"><DatabaseZap className="h-4 w-4 text-black/45" /></div><h3 className="text-sm font-semibold mt-4">Base de conhecimento</h3><p className="text-[10px] text-black/38 mt-1.5 leading-relaxed">Produtos, objeções, políticas e materiais usados pelos agentes nas respostas.</p><button className="mt-4 text-[10px] font-semibold" style={{ color: "var(--demo-primary)" }}>Abrir base →</button></Panel>
        <Panel className="p-5"><div className="h-9 w-9 rounded-xl bg-black/[0.035] flex items-center justify-center"><ShieldCheck className="h-4 w-4 text-black/45" /></div><h3 className="text-sm font-semibold mt-4">Revisão de respostas</h3><p className="text-[10px] text-black/38 mt-1.5 leading-relaxed">96% aprovadas. Respostas sensíveis passam por regras antes do envio.</p><button className="mt-4 text-[10px] font-semibold" style={{ color: "var(--demo-primary)" }}>Ver qualidade →</button></Panel>
      </div>
    </>
  );
}
