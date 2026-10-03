import { useNavigate } from "react-router-dom";
import { Plus, UserPlus, BadgeDollarSign, ClipboardPlus, ArrowRight, Clock3, CircleCheck, MessageSquareText } from "lucide-react";
import { demoAgenda, demoActivities, demoPriorities } from "@/demo/data";
import { useDemoBrand } from "@/demo/DemoBrandContext";
import { PageIntro, Panel, PanelHeader, StatusBadge } from "@/demo/components/DemoUI";

const quickActions = [
  { label: "Novo cliente", icon: UserPlus, to: "/demo/clientes" },
  { label: "Novo lead", icon: Plus, to: "/demo/crm" },
  { label: "Nova venda", icon: ClipboardPlus, to: "/demo/crm" },
  { label: "Registrar pagamento", icon: BadgeDollarSign, to: "/demo/financeiro" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { brand } = useDemoBrand();
  const firstName = "Douglas";

  return (
    <>
      <PageIntro title={`Bom dia, ${firstName}`} description={`Aqui está o que precisa da sua atenção hoje em ${brand.name}.`} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        {quickActions.map((action) => (
          <button key={action.label} onClick={() => navigate(action.to)} className="bg-white border border-black/[0.055] rounded-[16px] p-4 flex items-center gap-3 text-left hover:-translate-y-0.5 hover:shadow-sm transition-all">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "var(--demo-primary-soft)", color: "var(--demo-primary)" }}>
              <action.icon className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold">{action.label}</span>
          </button>
        ))}
      </div>
      <div className="grid xl:grid-cols-[1.3fr_0.7fr] gap-5 mb-5">
        <Panel>
          <PanelHeader title="Prioridades do dia" eyebrow="Atenção agora" />
          <div className="divide-y divide-black/[0.05]">
            {demoPriorities.map((item) => (
              <button key={item.id} onClick={() => navigate(item.action.includes("financeiro") ? "/demo/financeiro" : item.action.includes("CRM") ? "/demo/crm" : "/demo/tarefas")} className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-black/[0.012]">
                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.tone === "danger" ? "#e11d48" : item.tone === "warning" ? "#d97706" : item.tone === "info" ? "#0284c7" : "#a3a3a3" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-[11px] text-black/38 mt-0.5">{item.detail}</div>
                </div>
                <span className="hidden sm:inline text-[11px] font-semibold" style={{ color: "var(--demo-primary)" }}>{item.action}</span>
                <ArrowRight className="h-3.5 w-3.5 text-black/25" />
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Próximos passos" eyebrow="Comercial" />
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <MessageSquareText className="h-4 w-4 mt-0.5" style={{ color: "var(--demo-primary)" }} />
              <div><div className="text-xs font-semibold">Responder leads quentes</div><p className="text-[11px] text-black/38 mt-1">4 conversas com alta intenção de compra.</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="h-4 w-4 mt-0.5" style={{ color: "var(--demo-primary)" }} />
              <div><div className="text-xs font-semibold">Follow-ups de hoje</div><p className="text-[11px] text-black/38 mt-1">6 retornos programados até 18h.</p></div>
            </div>
            <div className="flex items-start gap-3">
              <CircleCheck className="h-4 w-4 mt-0.5" style={{ color: "var(--demo-primary)" }} />
              <div><div className="text-xs font-semibold">Fechar pendências</div><p className="text-[11px] text-black/38 mt-1">3 tarefas vencidas aguardam conclusão.</p></div>
            </div>
          </div>
        </Panel>
      </div>
      <div className="grid xl:grid-cols-2 gap-5">
        <Panel>
          <PanelHeader title="Agenda de hoje" action={<StatusBadge tone="info">4 compromissos</StatusBadge>} />
          <div className="p-5 space-y-4">
            {demoAgenda.map((item) => (
              <div key={item.time} className="flex gap-4">
                <span className="w-11 text-[11px] font-semibold text-black/40 pt-0.5">{item.time}</span>
                <div className="pl-4 border-l border-black/[0.08] min-w-0">
                  <p className="text-xs font-semibold">{item.title}</p>
                  <p className="text-[11px] text-black/38 mt-1">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Atividade recente" />
          <div className="divide-y divide-black/[0.05]">
            {demoActivities.map((activity) => (
              <div key={activity.title + activity.time} className="px-5 py-3.5 flex items-center gap-3">
                <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: "var(--demo-primary-faint)" }}><CircleCheck className="h-3.5 w-3.5" style={{ color: "var(--demo-primary)" }} /></div>
                <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{activity.title}</p><p className="text-[10px] text-black/35 truncate mt-0.5">{activity.meta}</p></div>
                <span className="text-[10px] text-black/30 shrink-0">{activity.time}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
