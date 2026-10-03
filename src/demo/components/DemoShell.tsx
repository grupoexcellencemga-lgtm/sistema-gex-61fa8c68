import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LayoutDashboard, Users, MessageSquareMore, Package, CalendarDays,
  CheckSquare, WalletCards, Bot, GraduationCap, CalendarRange, BarChart3,
  Settings, Search, RotateCcw, Building2, ChevronDown,
} from "lucide-react";
import { useDemoBrand } from "@/demo/DemoBrandContext";

const groups = [
  { label: "Visão geral", items: [
    { label: "Início", to: "/demo", icon: Home },
    { label: "Dashboard", to: "/demo/dashboard", icon: LayoutDashboard },
  ] },
  { label: "Relacionamento", items: [
    { label: "Clientes", to: "/demo/clientes", icon: Users },
    { label: "CRM", to: "/demo/crm", icon: MessageSquareMore },
  ] },
  { label: "Operação", items: [
    { label: "Produtos", to: "/demo/produtos", icon: Package },
    { label: "Agenda", to: "/demo/agenda", icon: CalendarDays },
    { label: "Tarefas", to: "/demo/tarefas", icon: CheckSquare },
  ] },
  { label: "Gestão", items: [
    { label: "Financeiro", to: "/demo/financeiro", icon: WalletCards },
    { label: "IA", to: "/demo/ia", icon: Bot },
  ] },
  { label: "Módulos", items: [
    { label: "Turmas", to: "/demo/turmas", icon: GraduationCap },
    { label: "Eventos", to: "/demo/eventos", icon: CalendarRange },
    { label: "Relatórios", to: "/demo/relatorios", icon: BarChart3 },
  ] },
];
const titleByPath: Record<string, string> = {
  "/demo": "Início",
  "/demo/dashboard": "Dashboard",
  "/demo/clientes": "Clientes",
  "/demo/crm": "CRM",
  "/demo/produtos": "Produtos",
  "/demo/agenda": "Agenda",
  "/demo/tarefas": "Tarefas",
  "/demo/financeiro": "Financeiro",
  "/demo/ia": "Inteligência Artificial",
  "/demo/turmas": "Turmas",
  "/demo/eventos": "Eventos",
  "/demo/relatorios": "Relatórios",
  "/demo/configuracoes": "Configurações",
};

function BrandMark() {
  const { brand } = useDemoBrand();
  if (brand.logoDataUrl) {
    return <img src={brand.logoDataUrl} alt={brand.name} className="h-9 w-9 rounded-xl object-contain bg-white p-1" />;
  }
  return (
    <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white" style={{ background: "var(--demo-primary)" }}>
      <Building2 className="h-4 w-4" />
    </div>
  );
}

export function DemoShell() {
  const { brand, resetBrand } = useDemoBrand();
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = titleByPath[location.pathname] ?? "GEx Demo";
  const handleReset = () => {
    resetBrand();
    navigate("/demo");
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#171717]">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] flex-col bg-[#151619] text-white z-30">
        <div className="h-[76px] px-5 flex items-center border-b border-white/7">
          <div className="flex items-center gap-3 min-w-0 w-full">
            <BrandMark />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate">{brand.name}</div>
              <div className="text-[11px] text-white/45">GEx Business</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-white/35" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.13em] font-semibold text-white/30">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === "/demo"}
                    className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${isActive ? "bg-white/9 text-white" : "text-white/55 hover:text-white hover:bg-white/5"}`}>
                    {({ isActive }) => <>
                      <item.icon className="h-4 w-4" style={isActive ? { color: "var(--demo-primary)" } : undefined} />
                      <span>{item.label}</span>
                    </>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/7 space-y-1">
          <NavLink to="/demo/configuracoes"
            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] ${isActive ? "bg-white/9 text-white" : "text-white/55 hover:text-white hover:bg-white/5"}`}>
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </NavLink>
          {brand.poweredByGex && (
            <div className="px-3 pt-2 pb-1 text-[10px] text-white/25">Powered by GEx</div>
          )}
        </div>
      </aside>

      <div className="lg:pl-[248px] min-h-screen">
        <header className="sticky top-0 z-20 h-[68px] bg-white/92 backdrop-blur border-b border-black/[0.06] px-4 md:px-6 lg:px-8 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold truncate">{pageTitle}</h1>
              <span className="hidden sm:inline-flex text-[10px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Demonstração</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 h-9 w-64 rounded-lg border border-black/[0.07] bg-[#f8f8f9] px-3">
            <Search className="h-3.5 w-3.5 text-black/35" />
            <span className="text-xs text-black/35">Buscar no GEx...</span>
          </div>
          <button onClick={handleReset} className="h-9 px-3 rounded-lg border border-black/[0.08] bg-white text-xs font-medium hover:bg-black/[0.025] flex items-center gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Restaurar demo</span>
          </button>
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: "var(--demo-secondary)" }}>DG</div>
        </header>
        <div className="lg:hidden bg-[#151619] px-3 py-2 overflow-x-auto flex gap-1 border-b border-black/10">
          {[...groups[0].items, ...groups[1].items, { label: "Financeiro", to: "/demo/financeiro", icon: WalletCards }, { label: "IA", to: "/demo/ia", icon: Bot }].map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/demo"}
              className={({ isActive }) => `shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${isActive ? "bg-white/10 text-white" : "text-white/55"}`}>
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <main className="p-4 md:p-6 lg:p-8 max-w-[1580px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
