import {
  LayoutDashboard, Users, Package, GraduationCap, Calendar,
  DollarSign, BarChart3, Shield, Settings,
  Route, UserCheck, Award, Building2, Cake, Brain, Target,
  ClipboardList, CheckSquare, Megaphone, Filter,
  CalendarDays, Home, Kanban, LayoutList,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PageKey } from "@/hooks/usePermissions";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  pageKey: PageKey;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Início", url: "/", icon: Home, pageKey: "inicio" },
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, pageKey: "dashboard" },
      { title: "Alunos", url: "/alunos", icon: Users, pageKey: "alunos" },
      { title: "Jornada", url: "/jornada", icon: Route, pageKey: "jornada" },
      { title: "Produtos", url: "/produtos", icon: Package, pageKey: "produtos" },
      { title: "Turmas", url: "/turmas", icon: GraduationCap, pageKey: "turmas" },
      { title: "Eventos", url: "/eventos", icon: Calendar, pageKey: "eventos" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { title: "Processo Individual", url: "/processo-individual", icon: UserCheck, pageKey: "processo-individual" },
      { title: "Processo Empresarial", url: "/processo-empresarial", icon: Building2, pageKey: "processo-empresarial" },
      { title: "Profissionais", url: "/profissionais", icon: Users, pageKey: "profissionais" },
      { title: "Vendedores", url: "/vendedores", icon: Award, pageKey: "vendedores" },
      { title: "Aniversários", url: "/aniversarios", icon: Cake, pageKey: "aniversarios" },
    ],
  },
  {
    label: "Operações",
    items: [
      { title: "Agenda", url: "/agenda", icon: CalendarDays, pageKey: "agenda" },
      { title: "Metas", url: "/metas", icon: Target, pageKey: "metas" },
      { title: "CRM comercial", url: "/funil", icon: Filter, pageKey: "funil" },
      { title: "Dashboard CRM", url: "/crm/dashboard", icon: LayoutDashboard, pageKey: "crm-dashboard" },
      { title: "Tarefas", url: "/tarefas", icon: CheckSquare, pageKey: "tarefas" },
      { title: "Quadros de Divulgação", url: "/divulgacao", icon: Megaphone, pageKey: "divulgacao" },
      { title: "Mind Map", url: "/mindmap", icon: Brain, pageKey: "mindmap" },
    ],
  },
  {
    label: "Consórcio",
    items: [
      { title: "Dashboard", url: "/consorcios/dashboard", icon: LayoutDashboard, pageKey: "consorcios-dashboard" },
      { title: "Pipeline", url: "/consorcios/pipeline", icon: Kanban, pageKey: "consorcios-pipeline" },
      { title: "Leads", url: "/consorcios/leads", icon: LayoutList, pageKey: "consorcios-leads" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Financeiro", url: "/financeiro", icon: DollarSign, pageKey: "financeiro" },
      { title: "Relatórios", url: "/relatorios", icon: BarChart3, pageKey: "relatorios" },
      { title: "Usuários ADM", url: "/usuarios", icon: Shield, pageKey: "usuarios" },
      { title: "Auditoria", url: "/auditoria", icon: ClipboardList, pageKey: "auditoria" },
      { title: "Configurações", url: "/configuracoes", icon: Settings, pageKey: "configuracoes" },
    ],
  },
];
