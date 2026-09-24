import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useLocation } from "react-router-dom";
import { useAlunoLabel } from "@/hooks/useAlunoLabel";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const routeTitles: Record<string, string> = {
  "/": "Início",
  "/dashboard": "Dashboard",
  "/alunos": "Alunos",
  "/jornada": "Jornada",
  "/produtos": "Produtos",
  "/turmas": "Turmas",
  "/eventos": "Eventos",
  "/aniversarios": "Aniversários",
  "/mindmap": "Mind Map",
  "/processo-individual": "Processo Individual",
  "/processo-empresarial": "Processo Empresarial",
  "/profissionais": "Profissionais",
  "/vendedores": "Vendedores",
  "/metas": "Metas",
  "/tarefas": "Tarefas",
  "/financeiro": "Financeiro",
  "/relatorios": "Relatórios",
  "/usuarios": "Usuários ADM",
  "/auditoria": "Auditoria",
  "/configuracoes": "Configurações",
  "/divulgacao": "Divulgação",
  "/funil": "Funil",
  "/consorcios/dashboard": "Dashboard — Consórcio",
  "/consorcios/pipeline": "Pipeline — Consórcio",
  "/consorcios/leads": "Leads — Consórcio",
  "/empresas": "Gestão de Empresas",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { plural: alunoPlural } = useAlunoLabel();
  useRealtimeSync();
  const rawTitle = routeTitles[location.pathname] ?? "Sistema GEx";
  const pageTitle = rawTitle === "Alunos" ? alunoPlural : rawTitle;

  return (
    <SidebarProvider>
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, #C8860A 0%, transparent 70%)",
            transform: "translate(20%, -30%)",
          }}
        />
        <div
          className="absolute bottom-0 left-[220px] w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, #4A9EFF 0%, transparent 70%)",
            transform: "translate(-20%, 20%)",
          }}
        />
      </div>

      <div
        className="h-full flex w-full relative z-10 bg-background text-foreground"
        style={{ minHeight: "-webkit-fill-available" }}
      >
        {/* Sidebar — hidden on mobile, replaced by MobileBottomNav */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* TOPBAR */}
          <header
            className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 pt-safe bg-background/95 border-b border-border backdrop-blur"
          >
            {/* Left: tablet trigger (md-lg) + breadcrumb */}
            <div className="flex items-center gap-3">
              {/* Tablet only: sidebar trigger (768-1024px) */}
              <div className="hidden md:block lg:hidden">
                <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors" />
              </div>

              {/* Desktop breadcrumb */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">GEx</span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="text-sm font-medium text-foreground">{pageTitle}</span>
              </div>

              {/* Mobile: page title */}
              <div className="md:hidden">
                <span className="text-sm font-semibold text-foreground">{pageTitle}</span>
              </div>
            </div>

            {/* Right: search + notifications */}
            <div className="flex items-center gap-2">
              <GlobalSearch />
              <NotificationBell />
            </div>
          </header>

          {/* MAIN CONTENT — extra bottom padding on mobile for the bottom nav */}
          <main
            className="flex-1 overflow-auto bg-background"
            style={{
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "thin",
              scrollbarColor: "#CBD5E1 transparent",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <div className="p-4 md:p-6 lg:p-8 pb-24 md:pb-6 lg:pb-8 animate-gex-fadein">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <MobileBottomNav />
      </div>

      <style>{`
        @keyframes gex-fadein {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-gex-fadein {
          animation: gex-fadein 0.4s ease both;
        }

        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 2px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>
    </SidebarProvider>
  );
}