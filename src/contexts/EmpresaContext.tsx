import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmpresaInfo {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cor_primaria: string;
  modulos: string[];
  papel: "admin_master" | "admin" | "colaborador";
}

interface EmpresaContextValue {
  /** Empresa atualmente selecionada */
  empresa: EmpresaInfo | null;
  /** Todas as empresas que o usuário pode acessar */
  empresas: EmpresaInfo[];
  selectedEmpresaId: string | null;
  setSelectedEmpresaId: (id: string) => void;
  isLoading: boolean;
  isAdminMaster: boolean;
  hasEmpresa: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const EmpresaContext = createContext<EmpresaContextValue>({
  empresa: null,
  empresas: [],
  selectedEmpresaId: null,
  setSelectedEmpresaId: () => {},
  isLoading: false,
  isAdminMaster: false,
  hasEmpresa: false,
});

export function useEmpresa() {
  return useContext(EmpresaContext);
}

// ── Theme helpers ─────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function applyEmpresaTheme(hex: string) {
  if (!hex || !hex.startsWith("#") || hex.length !== 7) return;
  try {
    const [h, s, l] = hexToHsl(hex);
    const hsl = `${h} ${s}% ${l}%`;
    const accentL = Math.min(l + 52, 95);
    const accentS = Math.round(s * 0.55);
    const root = document.documentElement;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);
    root.style.setProperty("--sidebar-accent", `${h} ${accentS}% ${accentL}%`);
    root.style.setProperty("--sidebar-accent-foreground", hsl);
  } catch {
    // silently ignore invalid hex
  }
}

function resetTheme() {
  const props = [
    "--primary", "--ring", "--sidebar-primary",
    "--sidebar-ring", "--sidebar-accent", "--sidebar-accent-foreground",
  ];
  props.forEach((p) => document.documentElement.style.removeProperty(p));
}

// ── Provider ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gex:empresa-id";

type RawRow = {
  papel: string;
  empresas: {
    id: string; nome: string; slug: string; logo_url: string | null;
    cor_primaria: string; modulos: string[]; ativo: boolean;
  } | null;
};

type RawEmpresa = {
  id: string; nome: string; slug: string; logo_url: string | null;
  cor_primaria: string; modulos: string[]; ativo: boolean;
};

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // ── Selected empresa (persistida em localStorage) ──────────────────────────

  const [selectedId, setSelectedIdState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );

  const setSelectedEmpresaId = (id: string) => {
    setSelectedIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  // ── Query 1: vínculos do usuário ───────────────────────────────────────────

  const { data: rows = [], isLoading: rowsLoading } = useQuery<RawRow[]>({
    queryKey: ["user-empresa", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("user_empresa")
        .select("papel, empresas(id, nome, slug, logo_url, cor_primaria, modulos, ativo)")
        .eq("user_id", user.id);
      return ((data ?? []) as RawRow[]).filter((r) => r.empresas?.ativo !== false);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isAdminMaster = useMemo(
    () => rows.some((r) => r.papel === "admin_master"),
    [rows]
  );

  // ── Query 2: todas as empresas ativas (admin_master pode trocar entre todas) ──

  const { data: allEmpresasData = [], isLoading: allLoading } = useQuery<RawEmpresa[]>({
    queryKey: ["all-empresas"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("empresas")
        .select("id, nome, slug, logo_url, cor_primaria, modulos, ativo")
        .eq("ativo", true)
        .order("nome");
      return (data ?? []) as RawEmpresa[];
    },
    enabled: isAdminMaster,
    staleTime: 5 * 60 * 1000,
  });

  // ── Lista de empresas acessíveis ───────────────────────────────────────────

  const empresas: EmpresaInfo[] = useMemo(() => {
    if (isAdminMaster) {
      return allEmpresasData.map((e) => ({
        id: e.id,
        nome: e.nome,
        slug: e.slug,
        logo_url: e.logo_url,
        cor_primaria: e.cor_primaria,
        modulos: e.modulos,
        papel: "admin_master" as const,
      }));
    }
    return rows
      .filter((r) => r.empresas)
      .map((r) => ({
        id: r.empresas!.id,
        nome: r.empresas!.nome,
        slug: r.empresas!.slug,
        logo_url: r.empresas!.logo_url,
        cor_primaria: r.empresas!.cor_primaria,
        modulos: r.empresas!.modulos,
        papel: r.papel as EmpresaInfo["papel"],
      }));
  }, [isAdminMaster, allEmpresasData, rows]);

  // Auto-selecionar primeira empresa se nada estiver salvo ou se o id salvo não existir mais
  useEffect(() => {
    if (empresas.length === 0) return;
    if (!selectedId || !empresas.find((e) => e.id === selectedId)) {
      setSelectedEmpresaId(empresas[0].id);
    }
  }, [empresas, selectedId]);

  const empresa: EmpresaInfo | null = useMemo(
    () => empresas.find((e) => e.id === selectedId) ?? empresas[0] ?? null,
    [empresas, selectedId]
  );

  // ── Tema CSS dinâmico ──────────────────────────────────────────────────────

  useEffect(() => {
    if (empresa?.cor_primaria) {
      applyEmpresaTheme(empresa.cor_primaria);
    } else {
      resetTheme();
    }
    return () => { resetTheme(); };
  }, [empresa?.cor_primaria]);

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        empresas,
        selectedEmpresaId: selectedId,
        setSelectedEmpresaId,
        isLoading: rowsLoading || (isAdminMaster && allLoading),
        isAdminMaster,
        hasEmpresa: rows.length > 0,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}
