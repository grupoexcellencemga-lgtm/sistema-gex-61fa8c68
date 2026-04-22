import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// All navigable pages with their keys
export const ALL_PAGES = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "alunos", label: "Alunos", path: "/alunos" },
  { key: "jornada", label: "Jornada", path: "/jornada" },
  { key: "produtos", label: "Produtos", path: "/produtos" },
  { key: "turmas", label: "Turmas", path: "/turmas" },
  { key: "eventos", label: "Eventos", path: "/eventos" },
  { key: "processo-individual", label: "Processo Individual", path: "/processo-individual" },
  { key: "processo-empresarial", label: "Processo Empresarial", path: "/processo-empresarial" },
  { key: "profissionais", label: "Profissionais", path: "/profissionais" },
  { key: "vendedores", label: "Vendedores", path: "/vendedores" },
  { key: "metas", label: "Metas", path: "/metas" },
  { key: "financeiro", label: "Financeiro", path: "/financeiro" },
  { key: "relatorios", label: "Relatórios", path: "/relatorios" },
  { key: "usuarios", label: "Usuários ADM", path: "/usuarios" },
  { key: "auditoria", label: "Auditoria", path: "/auditoria" },
  { key: "configuracoes", label: "Configurações", path: "/configuracoes" },
  { key: "aniversarios", label: "Aniversários", path: "/aniversarios" },
  { key: "mindmap", label: "Mind Map", path: "/mindmap" },
  { key: "tarefas", label: "Tarefas", path: "/tarefas" },
  { key: "divulgacao", label: "Divulgação", path: "/divulgacao" },
] as const;

export type PageKey = (typeof ALL_PAGES)[number]["key"];

// Default pages per role (baseline)
const ROLE_DEFAULTS: Record<string, PageKey[]> = {
  admin: ALL_PAGES.map((p) => p.key) as PageKey[],
  comercial: ["dashboard", "alunos", "jornada", "produtos", "turmas", "eventos", "vendedores", "metas", "aniversarios", "tarefas", "divulgacao", "configuracoes"],
  financeiro: ["dashboard", "financeiro", "relatorios", "aniversarios", "tarefas", "divulgacao", "configuracoes"],
  suporte: ["dashboard", "alunos", "turmas", "eventos", "aniversarios", "tarefas", "divulgacao", "configuracoes"],
  profissional: ["dashboard", "processo-individual", "processo-empresarial", "turmas", "eventos", "aniversarios", "tarefas", "divulgacao", "configuracoes"],
};

export function usePermissions() {
  const { user } = useAuth();

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
    enabled: !!user,
  });

  // Get user role
  const { data: userRole } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      return data?.role ?? null;
    },
    enabled: !!user,
  });

  // Get custom permissions overrides
  const { data: customPermissions } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_permissions")
        .select("page_key, allowed")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  // Compute allowed pages: role defaults + custom overrides
  const allowedPages: PageKey[] = (() => {
    if (!user) return [];
    if (isAdmin) return ALL_PAGES.map((p) => p.key); // Admin sees everything

    const roleDefaults = ROLE_DEFAULTS[userRole ?? ""] ?? ["dashboard", "configuracoes"];
    const overrides = new Map(customPermissions?.map((p) => [p.page_key, p.allowed]) ?? []);

    return ALL_PAGES.map((p) => p.key).filter((key) => {
      if (overrides.has(key)) return overrides.get(key);
      return roleDefaults.includes(key);
    });
  })();

  const canAccess = (pageKey: PageKey) => allowedPages.includes(pageKey);
  const canAccessPath = (path: string) => {
    const page = ALL_PAGES.find((p) => p.path === path);
    if (!page) return true; // unknown paths are allowed (e.g. reset-password)
    return allowedPages.includes(page.key);
  };

  return { allowedPages, canAccess, canAccessPath, isAdmin: !!isAdmin, userRole, isReady: isAdmin !== undefined };
}
