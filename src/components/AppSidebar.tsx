import {
  LayoutDashboard, Users, Package, GraduationCap, Calendar,
  DollarSign, BarChart3, Shield, Settings, ChevronLeft, ChevronRight, Route, LogOut, UserCheck, Award, Building2, Cake, Brain, Target, ClipboardList, CheckSquare, Sun, Moon, Monitor, Megaphone, Filter
} from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { usePermissions, type PageKey } from "@/hooks/usePermissions";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuGroups = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, pageKey: "dashboard" as PageKey },
      { title: "Alunos", url: "/alunos", icon: Users, pageKey: "alunos" as PageKey },
      { title: "Jornada", url: "/jornada", icon: Route, pageKey: "jornada" as PageKey },
      { title: "Produtos", url: "/produtos", icon: Package, pageKey: "produtos" as PageKey },
      { title: "Turmas", url: "/turmas", icon: GraduationCap, pageKey: "turmas" as PageKey },
      { title: "Eventos", url: "/eventos", icon: Calendar, pageKey: "eventos" as PageKey },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { title: "Processo Individual", url: "/processo-individual", icon: UserCheck, pageKey: "processo-individual" as PageKey },
      { title: "Processo Empresarial", url: "/processo-empresarial", icon: Building2, pageKey: "processo-empresarial" as PageKey },
      { title: "Profissionais", url: "/profissionais", icon: Users, pageKey: "profissionais" as PageKey },
      { title: "Vendedores", url: "/vendedores", icon: Award, pageKey: "vendedores" as PageKey },
      { title: "Aniversários", url: "/aniversarios", icon: Cake, pageKey: "aniversarios" as PageKey },
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Metas", url: "/metas", icon: Target, pageKey: "metas" as PageKey },
      { title: "Funil de Vendas", url: "/funil", icon: Filter, pageKey: "funil" as PageKey },
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare, pageKey: "tarefas" as PageKey },
      { title: "Divulgação", url: "/divulgacao", icon: Megaphone, pageKey: "divulgacao" as PageKey },
      { title: "Mind Map", url: "/mindmap", icon: Brain, pageKey: "mindmap" as PageKey },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, pageKey: "financeiro" as PageKey },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3, pageKey: "relatorios" as PageKey },
      { title: "Usuários ADM", url: "/usuarios", icon: Shield, pageKey: "usuarios" as PageKey },
      { title: "Auditoria", url: "/auditoria", icon: ClipboardList, pageKey: "auditoria" as PageKey },
      { title: "Configurações", url: "/configuracoes", icon: Settings, pageKey: "configuracoes" as PageKey },
    ],
  },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { canAccess } = usePermissions();
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary dark:bg-gradient-to-br dark:from-[#F97316] dark:to-[#F59E0B] shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">GE</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground dark:text-white">Sistema GEx</span>
              <span className="text-xs text-sidebar-muted">Grupo Excellence</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {menuGroups.map((group) => {
          const visibleItems = group.items.filter((item) => canAccess(item.pageKey));
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
                          activeClassName="bg-sidebar-accent text-primary font-medium dark:bg-gradient-to-r dark:from-primary/15 dark:to-transparent dark:text-[#F97316] dark:border-primary border-primary [&>svg]:text-primary [&>svg]:drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]"
                        >
                          <item.icon className="h-4 w-4 shrink-0 transition-all duration-200 group-hover:text-sidebar-foreground dark:group-hover:text-white" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
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