import {
  ChevronLeft, ChevronRight, LogOut, Sun, Moon, Monitor, Crown, ChevronDown, Check,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { APP_VERSION } from "@/lib/version";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { usePermissions, type PageKey } from "@/hooks/usePermissions";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAlunoLabel } from "@/hooks/useAlunoLabel";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navGroups } from "@/lib/navItems";

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { canAccess } = usePermissions();
  const { empresa, empresas, isAdminMaster, hasEmpresa, setSelectedEmpresaId } = useEmpresa();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const { plural: alunoPlural } = useAlunoLabel();
  const nomeEmpresa = empresa?.nome ?? "Sistema GEx";
  const logoSrc = empresa?.logo_url ?? "/logo.png";
  const canSwitch = isAdminMaster && empresas.length > 1;

  // Filtra itens pelos módulos da empresa selecionada
  function isVisible(pageKey: PageKey): boolean {
    if (!canAccess(pageKey)) return false;
    if (!hasEmpresa) return true;            // usuário legado sem empresa
    if (!empresa) return true;
    return empresa.modulos.includes(pageKey);
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={!canSwitch || collapsed}>
            <button className="flex items-center gap-3 w-full text-left rounded-md hover:bg-sidebar-accent transition-colors disabled:cursor-default">
              <div className="shrink-0 flex items-center justify-center">
                <img
                  src={logoSrc}
                  alt={nomeEmpresa}
                  className="h-9 w-9 object-contain rounded"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-sidebar-foreground dark:text-white truncate">
                      {nomeEmpresa}
                    </span>
                    <span className="text-[10px] text-sidebar-muted shrink-0">v{APP_VERSION}</span>
                    {canSwitch && <ChevronDown className="h-3 w-3 text-sidebar-muted ml-auto shrink-0" />}
                  </div>
                  <span className="text-xs text-sidebar-muted truncate">Grupo Excellence</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {empresas.map((e) => (
              <DropdownMenuItem
                key={e.id}
                onClick={() => {
                  setSelectedEmpresaId(e.id);
                  // Se a rota atual não pertence aos módulos da nova empresa, volta para o início
                  const allPageKeys = navGroups.flatMap((g) => g.items.map((i) => ({ url: i.url, pageKey: i.pageKey })));
                  const currentItem = allPageKeys.find((i) => location.pathname.startsWith(i.url) && i.url !== "/");
                  if (currentItem && !e.modulos.includes(currentItem.pageKey)) {
                    navigate("/");
                  }
                }}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: e.cor_primaria }}
                />
                <span className="flex-1 truncate">{e.nome}</span>
                {e.id === empresa?.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => isVisible(item.pageKey));
          if (!visibleItems.length) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs font-semibold text-sidebar-muted px-3 py-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild size="default" className="transition-snappy">
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 dark:text-[#8B8B9E] hover:bg-sidebar-accent hover:text-sidebar-foreground dark:hover:bg-white/5 transition-all duration-200 border-l-2 border-transparent relative group"
                          activeClassName="bg-sidebar-accent text-primary font-medium dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent dark:text-[#C8860A] dark:border-primary border-primary [&>svg]:text-primary [&>svg]:drop-shadow-[0_0_5px_rgba(200,134,10,0.8)]"
                        >
                          <item.icon className="h-4 w-4 shrink-0 transition-all duration-200 group-hover:text-sidebar-foreground dark:group-hover:text-white" />
                          {!collapsed && <span>{item.pageKey === "alunos" ? alunoPlural : item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

        {/* Item exclusivo Admin Master */}
        {isAdminMaster && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-xs font-semibold text-sidebar-muted px-3 py-1">
                Master
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild size="default" className="transition-snappy">
                    <NavLink
                      to="/empresas"
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 dark:text-[#8B8B9E] hover:bg-sidebar-accent hover:text-sidebar-foreground dark:hover:bg-white/5 transition-all duration-200 border-l-2 border-transparent relative group"
                      activeClassName="bg-sidebar-accent text-primary font-medium dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent dark:text-[#C8860A] dark:border-primary border-primary [&>svg]:text-primary [&>svg]:drop-shadow-[0_0_5px_rgba(200,134,10,0.8)]"
                    >
                      <Crown className="h-4 w-4 shrink-0 transition-all duration-200 group-hover:text-sidebar-foreground dark:group-hover:text-white" />
                      {!collapsed && <span>Empresas</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-1">
        <Button variant="ghost" size="sm" onClick={cycleTheme}
          className="w-full justify-start gap-3 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
          title={`Tema: ${theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : "Sistema"}`}>
          <ThemeIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : "Sistema"}</span>}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}
          className="w-full justify-start gap-3 text-sidebar-muted hover:text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleSidebar}
          className="w-full justify-center text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
