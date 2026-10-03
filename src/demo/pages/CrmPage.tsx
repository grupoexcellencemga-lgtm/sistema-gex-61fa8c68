import { useState } from "react";
import { Search, SlidersHorizontal, Send, Phone, MoreHorizontal, Bot, UserRound, Clock3, MessageSquareMore, Kanban, BarChart3, Sparkles } from "lucide-react";
import { demoAgents, demoChat, demoConversations, demoPipeline } from "@/demo/data";
import { EmptyAvatar, PageIntro, Panel, PanelHeader, ProgressBar, StatusBadge } from "@/demo/components/DemoUI";

type CrmTab = "conversas" | "oportunidades" | "agentes" | "desempenho";

const tabs: Array<{ id: CrmTab; label: string; icon: typeof MessageSquareMore }> = [
  { id: "conversas", label: "Conversas", icon: MessageSquareMore },
  { id: "oportunidades", label: "Oportunidades", icon: Kanban },
  { id: "agentes", label: "Agentes", icon: Bot },
  { id: "desempenho", label: "Desempenho", icon: BarChart3 },
];

export default function CrmPage() {
  const [tab, setTab] = useState<CrmTab>("conversas");
  const [selectedId, setSelectedId] = useState("ana");
  const selected = demoConversations.find((item) => item.id === selectedId) ?? demoConversations[0];

  return (
    <>
      <PageIntro title="Central comercial" description="Atendimento, oportunidades e agentes trabalhando no mesmo contexto." />
      <div className="mb-5 flex gap-1 p-1 bg-white rounded-xl border border-black/[0.055] w-fit max-w-full overflow-x-auto">
        {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 ${tab === item.id ? "bg-[#171717] text-white" : "text-black/45 hover:bg-black/[0.025]"}`}><item.icon className="h-3.5 w-3.5" />{item.label}</button>)}
      </div>

      {tab === "conversas" && <ConversationView selected={selected} selectedId={selectedId} onSelect={setSelectedId} />}
      {tab === "oportunidades" && <OpportunityView />}
      {tab === "agentes" && <AgentsView />}
      {tab === "desempenho" && <PerformanceView />}
    </>
  );
}
function ConversationView({ selected, selectedId, onSelect }: { selected: (typeof demoConversations)[number]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="grid xl:grid-cols-[330px_minmax(0,1fr)_310px] min-h-[650px] bg-white rounded-[18px] border border-black/[0.055] overflow-hidden">
      <section className="border-r border-black/[0.055] min-w-0">
        <div className="p-4 border-b border-black/[0.055]">
          <div className="flex items-center justify-between mb-3"><div><p className="text-sm font-semibold">Caixa de entrada</p><p className="text-[10px] text-black/35 mt-0.5">12 aguardando atendimento</p></div><SlidersHorizontal className="h-4 w-4 text-black/35" /></div>
          <div className="h-9 rounded-lg bg-black/[0.025] flex items-center gap-2 px-3"><Search className="h-3.5 w-3.5 text-black/30" /><span className="text-[11px] text-black/30">Buscar conversa...</span></div>
          <div className="flex gap-2 mt-3 text-[10px]"><StatusBadge tone="warning">Não lidas 3</StatusBadge><StatusBadge>IA atendendo 9</StatusBadge></div>
        </div>
        <div className="divide-y divide-black/[0.05]">
          {demoConversations.map((item) => (
            <button key={item.id} onClick={() => onSelect(item.id)} className={`w-full p-4 text-left flex gap-3 hover:bg-black/[0.012] ${item.id === selectedId ? "bg-[var(--demo-primary-faint)]" : ""}`}>
              <div className="relative"><EmptyAvatar name={item.name} /><span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white" /></div>
              <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="text-xs font-semibold truncate">{item.name}</p><span className="text-[9px] text-black/30 shrink-0">{item.time}</span></div><p className="text-[10px] text-black/38 truncate mt-1">{item.preview}</p><div className="flex items-center gap-1.5 mt-2"><span className="text-[9px] text-black/35">{item.channel}</span>{item.unread > 0 && <span className="h-4 min-w-4 px-1 rounded-full text-[8px] text-white flex items-center justify-center" style={{ background: "var(--demo-primary)" }}>{item.unread}</span>}</div></div>
            </button>
          ))}
        </div>
      </section>
      <section className="min-w-0 flex flex-col bg-[#fafafa]">
        <div className="h-16 px-5 bg-white border-b border-black/[0.055] flex items-center gap-3">
          <EmptyAvatar name={selected.name} />
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{selected.name}</p><p className="text-[10px] text-black/35 mt-0.5">{selected.channel} · atendido por {selected.owner}</p></div>
          <button className="h-8 w-8 rounded-lg hover:bg-black/[0.03] flex items-center justify-center"><Phone className="h-3.5 w-3.5 text-black/40" /></button>
          <button className="h-8 w-8 rounded-lg hover:bg-black/[0.03] flex items-center justify-center"><MoreHorizontal className="h-4 w-4 text-black/40" /></button>
        </div>
        <div className="flex-1 p-5 md:p-7 space-y-4 overflow-y-auto">
          <div className="flex justify-center"><span className="text-[9px] text-black/30 bg-white border border-black/[0.05] rounded-full px-2 py-1">Hoje</span></div>
          {demoChat.map((message, index) => (
            <div key={index} className={`flex ${message.from === "agent" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${message.from === "agent" ? "text-white rounded-br-md" : "bg-white border border-black/[0.055] rounded-bl-md"}`} style={message.from === "agent" ? { background: "var(--demo-secondary)" } : undefined}>
                <p>{message.text}</p><p className={`text-[8px] mt-1.5 ${message.from === "agent" ? "text-white/45" : "text-black/25"}`}>{message.time}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-white border-t border-black/[0.055]">
          <div className="rounded-xl border border-black/[0.08] bg-white p-2 flex items-end gap-2">
            <div className="flex-1 min-h-9 px-2 py-2 text-[11px] text-black/30">Digite uma mensagem...</div>
            <button className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: "var(--demo-primary)" }}><Send className="h-3.5 w-3.5" /></button>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[9px] text-black/30"><Sparkles className="h-3 w-3" style={{ color: "var(--demo-primary)" }} />Sugestão de resposta da Júlia disponível</div>
        </div>
      </section>
      <aside className="border-l border-black/[0.055] bg-white min-w-0">
        <div className="p-5 border-b border-black/[0.055]">
          <p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-black/30 mb-4">Contato</p>
          <div className="flex items-center gap-3"><EmptyAvatar name={selected.name} size="lg" /><div><p className="text-sm font-semibold">{selected.name}</p><p className="text-[10px] text-black/35 mt-1">Lead comercial</p></div></div>
        </div>
        <div className="p-5 border-b border-black/[0.055] space-y-4">
          <div className="flex justify-between gap-3 text-xs"><span className="text-black/38">Produto</span><span className="font-semibold text-right">{selected.product}</span></div>
          <div className="flex justify-between gap-3 text-xs"><span className="text-black/38">Origem</span><span className="font-semibold text-right">{selected.source}</span></div>
          <div className="flex justify-between gap-3 text-xs"><span className="text-black/38">Responsável</span><span className="font-semibold text-right">{selected.owner}</span></div>
        </div>
        <div className="p-5 border-b border-black/[0.055]">
          <div className="flex justify-between items-center mb-3"><p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-black/30">Oportunidade</p><StatusBadge tone="warning">{selected.stage}</StatusBadge></div>
          <p className="text-2xl tracking-[-0.04em] font-semibold">{selected.value}</p>
          <p className="text-[10px] text-black/35 mt-1">Valor potencial</p>
        </div>
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-[0.11em] font-semibold text-black/30 mb-3">Próximas ações</p>
          <div className="space-y-2">
            <div className="rounded-xl bg-black/[0.025] p-3 flex gap-2"><Clock3 className="h-3.5 w-3.5 mt-0.5" style={{ color: "var(--demo-primary)" }} /><div><p className="text-[11px] font-semibold">Follow-up hoje às 15h</p><p className="text-[9px] text-black/35 mt-1">Automático pela Júlia</p></div></div>
            <div className="rounded-xl bg-black/[0.025] p-3 flex gap-2"><UserRound className="h-3.5 w-3.5 mt-0.5" style={{ color: "var(--demo-primary)" }} /><div><p className="text-[11px] font-semibold">Revisar proposta</p><p className="text-[9px] text-black/35 mt-1">Responsável: Douglas</p></div></div>
          </div>
        </div>
      </aside>
    </div>
  );
}
function OpportunityView() {
  return (
    <div>
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        {[{ label: "Pipeline", value: "R$ 92 mil" }, { label: "Oportunidades", value: "34" }, { label: "Propostas", value: "11" }, { label: "Conversão", value: "24,8%" }].map((item) => <Panel key={item.label} className="p-4"><p className="text-[10px] text-black/35">{item.label}</p><p className="text-xl font-semibold mt-2 tracking-[-0.03em]">{item.value}</p></Panel>)}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-4 gap-4 min-w-[1000px]">
          {demoPipeline.map((column) => (
            <section key={column.stage} className="rounded-[16px] bg-black/[0.025] border border-black/[0.04] p-3 min-h-[480px]">
              <div className="flex items-center justify-between px-1 pb-3"><div><p className="text-xs font-semibold">{column.stage}</p><p className="text-[9px] text-black/35 mt-0.5">{column.items.length} oportunidades</p></div><span className="text-[10px] font-semibold text-black/45">{column.total}</span></div>
              <div className="space-y-2.5">
                {column.items.map((item) => <div key={item.name} className="bg-white rounded-xl border border-black/[0.055] p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"><div className="flex items-center gap-2"><EmptyAvatar name={item.name} size="sm" /><p className="text-[11px] font-semibold">{item.name}</p></div><div className="flex justify-between mt-3"><span className="text-[9px] text-black/35">{item.product}</span><span className="text-[10px] font-semibold">{item.value}</span></div><div className="mt-3 flex items-center gap-1 text-[9px] text-black/30"><Clock3 className="h-3 w-3" />Follow-up hoje</div></div>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
function AgentsView() {
  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-5">
      <Panel>
        <PanelHeader title="Agentes comerciais" eyebrow="Equipe de IA" />
        <div className="divide-y divide-black/[0.05]">
          {demoAgents.map((agent) => (
            <div key={agent.name} className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--demo-primary-soft)", color: "var(--demo-primary)" }}><Bot className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-xs font-semibold">{agent.name}</p><StatusBadge tone={agent.status === "Pausado" ? "neutral" : "success"}>{agent.status}</StatusBadge></div><p className="text-[10px] text-black/35 mt-1">{agent.role}</p></div>
              <div className="hidden md:grid grid-cols-3 gap-7 text-right"><div><p className="text-xs font-semibold">{agent.conversations}</p><p className="text-[9px] text-black/30 mt-1">conversas</p></div><div><p className="text-xs font-semibold">{agent.conversion}</p><p className="text-[9px] text-black/30 mt-1">conversão</p></div><div><p className="text-xs font-semibold">{agent.cost}</p><p className="text-[9px] text-black/30 mt-1">custo hoje</p></div></div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Júlia agora" eyebrow="Gerente comercial" />
        <div className="p-5">
          <div className="rounded-2xl p-4 text-white" style={{ background: "var(--demo-secondary)" }}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-white/60">Ativa</span></div><p className="text-3xl font-semibold mt-5">18</p><p className="text-[10px] text-white/45 mt-1">conversas em andamento</p><div className="grid grid-cols-2 gap-3 mt-5"><div><p className="text-lg font-semibold">142</p><p className="text-[9px] text-white/40">atendimentos hoje</p></div><div><p className="text-lg font-semibold">7</p><p className="text-[9px] text-white/40">transferidas</p></div></div></div>
          <div className="mt-4 rounded-xl bg-black/[0.025] p-4"><p className="text-[10px] font-semibold">Próxima ação automática</p><p className="text-[10px] text-black/38 mt-1">Follow-up com 6 leads às 15:00.</p></div>
        </div>
      </Panel>
    </div>
  );
}
function PerformanceView() {
  return (
    <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-5">
      <Panel>
        <PanelHeader title="Volume de atendimento" eyebrow="Hoje" />
        <div className="p-5">
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[{ label: "Conversas", value: "184" }, { label: "Em fila", value: "12" }, { label: "Tempo médio", value: "18s" }, { label: "Conversão", value: "24,8%" }].map((item) => <div key={item.label} className="rounded-xl bg-black/[0.025] p-3"><p className="text-lg font-semibold">{item.value}</p><p className="text-[9px] text-black/35 mt-1">{item.label}</p></div>)}
          </div>
          <div className="h-52 flex items-end gap-2 border-b border-black/[0.06] pb-px">
            {[28, 36, 31, 52, 67, 58, 81, 74, 92, 76, 63, 48].map((height, index) => <div key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%`, background: index > 8 ? "var(--demo-primary)" : "var(--demo-primary-soft)" }} />)}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-black/30"><span>08h</span><span>11h</span><span>14h</span><span>17h</span><span>20h</span></div>
        </div>
      </Panel>
      <div className="space-y-5">
        <Panel><PanelHeader title="Canais" /><div className="p-5 space-y-4">{[{ label: "WhatsApp", value: 72 }, { label: "Instagram", value: 21 }, { label: "Outros", value: 7 }].map((item) => <div key={item.label}><div className="flex justify-between text-xs mb-2"><span className="text-black/45">{item.label}</span><span className="font-semibold">{item.value}%</span></div><ProgressBar value={item.value} /></div>)}</div></Panel>
        <Panel><PanelHeader title="Qualidade do atendimento" /><div className="p-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-2xl font-semibold text-emerald-700">96%</p><p className="text-[9px] text-emerald-700/70 mt-1">resolvidas sem erro</p></div><div className="rounded-xl bg-amber-50 p-4"><p className="text-2xl font-semibold text-amber-700">3,8%</p><p className="text-[9px] text-amber-700/70 mt-1">transferidas ao humano</p></div></div></Panel>
      </div>
    </div>
  );
}
