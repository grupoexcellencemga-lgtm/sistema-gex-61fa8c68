import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
] as const;

export type PageKey = (typeof ALL_PAGES)[number]["key"];

const ROLE_DEFAULTS: Record<string, PageKey[]> = {
  admin: ALL_PAGES.map((p) => p.key) as PageKey[],
  comercial: ["dashboard", "alunos", "jornada", "produtos", "turmas", "eventos", "vendedores", "metas", "aniversarios", "tarefas", "configuracoes"],
  financeiro: ["dashboard", "financeiro", "relatorios", "aniversarios", "tarefas", "configuracoes"],
  suporte: ["dashboard", "alunos", "turmas", "eventos", "aniversarios", "tarefas", "configuracoes"],
  profissional: ["dashboard", "processo-individual", "processo-empresarial", "turmas", "eventos", "aniversarios", "tarefas", "configuracoes"],
};

export function usePermissions() {
  const { user, isReady: authReady } = useAuth();
  const canLoadUserQueries = authReady && !!user;

  const { data: isAdmin = false, isFetched: isAdminFetched } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      return !!data;
    },
    enabled: canLoadUserQueries,
  });

  const { data: userRole = null, isFetched: isUserRoleFetched } = useQuery({
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
    enabled: canLoadUserQueries,
  });

  const { data: customPermissions = [], isFetched: isPermissionsFetched } = useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("user_permissions")
        .select("page_key, allowed")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: canLoadUserQueries,
  });

  const isReady = authReady && (!user || (isAdminFetched && isUserRoleFetched && isPermissionsFetched));

  const allowedPages: PageKey[] = (() => {
    if (!user || !isReady) return [];
    if (isAdmin) return ALL_PAGES.map((p) => p.key);

    const roleDefaults = ROLE_DEFAULTS[userRole ?? ""] ?? ["dashboard", "configuracoes"];
    const overrides = new Map(customPermissions.map((p) => [p.page_key, p.allowed]));

    return ALL_PAGES.map((p) => p.key).filter((key) => {
      if (overrides.has(key)) return !!overrides.get(key);
      return roleDefaults.includes(key);
    });
  })();

  const canAccess = (pageKey: PageKey) => allowedPages.includes(pageKey);
  const canAccessPath = (path: string) => {
    const page = ALL_PAGES.find((p) => p.path === path);
    if (!page) return true;
    return allowedPages.includes(page.key);
  };

  return { allowedPages, canAccess, canAccessPath, isAdmin, userRole, isReady };
}
