import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, Filter, Users, DollarSign, MoreHorizontal, X,
  Crown, LogOut, Sun, Moon, Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAlunoLabel } from "@/hooks/useAlunoLabel";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { navGroups, type NavItem } from "@/lib/navItems";
import type { PageKey } from "@/hooks/usePermissions";

const BOTTOM_TABS: NavItem[] = [
  { title: "Início", url: "/", icon: Home, pageKey: "inicio" },
  { title: "CRM", url: "/funil", icon: Filter, pageKey: "funil" },
  { title: "Alunos", url: "/alunos", icon: Users, pageKey: "alunos" },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign, pageKey: "financeiro" },
];

export function MobileBottomNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccess } = usePermissions();
  const { empresa, isAdminMaster, hasEmpresa } = useEmpresa();
  const { plural: alunoPlural } = useAlunoLabel();
  const { theme, setTheme } = useTheme();

  function isVisible(pageKey: PageKey): boolean {
    if (!canAccess(pageKey)) return false;
    if (!hasEmpresa || !empresa) return true;
    return empresa.modulos.includes(pageKey);
  }

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const visibleBottomTabs = BOTTOM_TABS.filter(tab => isVisible(tab.pageKey));
  const isMoreActive = !visibleBottomTabs.some(tab => isActive(tab.url)) || menuOpen;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const themeLabel = theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : "Sistema";

  const handleNavigate = (url: string) => {
    navigate(url);
    setMenuOpen(false);
  };

  return (
    <>
      {/* Full-screen menu overlay — slides up from bottom */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50 bg-background flex flex-col transition-transform duration-300 ease-in-out",
          menuOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        )}
        style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <span className="text-sm font-semibold">Menu completo</span>
          <button
            onClick={() => setMenuOpen(false)}
            className="p-2 -mr-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable nav list */}
        <div className="flex-1 overflow-auto py-1">
          {navGroups.map((group) => {
            const visible = group.items.filter(i => isVisible(i.pageKey));
            if (!visible.length) return null;
            return (
              <div key={group.label}>
                <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {group.label}
                </p>
                {visible.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <button
                      key={item.url}
                      onClick={() => handleNavigate(item.url)}
                      className={cn(
                        "w-full flex items-center gap-3.5 px-4 py-3 text-sm transition-colors text-left",
                        active
                          ? "text-primary bg-primary/10 font-medium"
                          : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-[18px] w-[18px] shrink-0",
                        active ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span>{item.pageKey === "alunos" ? alunoPlural : item.title}</span>
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Admin Master */}
          {isAdminMaster && (
            <div>
              <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Master
              </p>
              <button
                onClick={() => handleNavigate("/empresas")}
                className={cn(
                  "w-full flex items-center gap-3.5 px-4 py-3 text-sm transition-colors text-left",
                  location.pathname === "/empresas"
                    ? "text-primary bg-primary/10 font-medium"
                    : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Crown className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  location.pathname === "/empresas" ? "text-primary" : "text-muted-foreground"
                )} />
                <span>Empresas</span>
                {location.pathname === "/empresas" && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            </div>
          )}

          {/* Actions footer */}
          <div className="mt-4 mb-2 border-t border-border pt-2">
            <button
              onClick={cycleTheme}
              className="w-full flex items-center gap-3.5 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors text-left"
            >
              <ThemeIcon className="h-[18px] w-[18px] shrink-0" />
              <span>Tema: {themeLabel}</span>
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-3.5 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border backdrop-blur-sm"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-16">
          {visibleBottomTabs.map((tab) => {
            const active = isActive(tab.url) && !menuOpen;
            return (
              <button
                key={tab.url}
                onClick={() => { setMenuOpen(false); navigate(tab.url); }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 px-1",
                  active ? "text-primary" : "text-muted-foreground active:text-foreground"
                )}
              >
                <tab.icon className={cn(
                  "h-[22px] w-[22px] transition-all shrink-0",
                  active && "drop-shadow-[0_0_5px_rgba(200,134,10,0.7)]"
                )} />
                <span className="text-[10px] leading-tight font-medium w-full text-center truncate">
                  {tab.pageKey === "alunos" ? alunoPlural : tab.title}
                </span>
              </button>
            );
          })}

          {/* Mais button */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 px-1",
              isMoreActive ? "text-primary" : "text-muted-foreground active:text-foreground"
            )}
          >
            {menuOpen ? (
              <X className={cn("h-[22px] w-[22px] transition-all shrink-0", "text-primary")} />
            ) : (
              <MoreHorizontal className={cn(
                "h-[22px] w-[22px] transition-all shrink-0",
                isMoreActive && "drop-shadow-[0_0_5px_rgba(200,134,10,0.7)]"
              )} />
            )}
            <span className="text-[10px] leading-tight font-medium">Mais</span>
          </button>
        </div>
      </nav>
    </>
  );
}
