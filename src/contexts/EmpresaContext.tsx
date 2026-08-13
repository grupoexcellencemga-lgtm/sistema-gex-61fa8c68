import { createContext, useContext, useEffect, useMemo } from "react";
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
  empresa: EmpresaInfo | null;
  isLoading: boolean;
  isAdminMaster: boolean;
  /** True when the user has an empresa assigned (not a legacy user without one) */
  hasEmpresa: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const EmpresaContext = createContext<EmpresaContextValue>({
  empresa: null,
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
    "--primary",
    "--ring",
    "--sidebar-primary",
    "--sidebar-ring",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
  ];
  props.forEach((p) => document.documentElement.style.removeProperty(p));
}

// ── Provider ──────────────────────────────────────────────────────────────────

type RawRow = {
  papel: string;
  empresas: {
    id: string;
    nome: string;
    slug: string;
    logo_url: string | null;
    cor_primaria: string;
    modulos: string[];
    ativo: boolean;
  } | null;
};

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery<RawRow[]>({
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

  const empresa: EmpresaInfo | null = useMemo(() => {
    if (rows.length === 0) return null;
    // Admin master gets the first empresa as "home" but with master role
    const masterRow = rows.find((r) => r.papel === "admin_master" && r.empresas);
    const anyRow = rows.find((r) => r.empresas);
    const row = masterRow ?? anyRow;
    if (!row?.empresas) return null;
    return {
      id: row.empresas.id,
      nome: row.empresas.nome,
      slug: row.empresas.slug,
      logo_url: row.empresas.logo_url,
      cor_primaria: row.empresas.cor_primaria,
      modulos: row.empresas.modulos,
      papel: row.papel as EmpresaInfo["papel"],
    };
  }, [rows]);

  // Apply/reset CSS theme when empresa color changes
  useEffect(() => {
    if (empresa?.cor_primaria) {
      applyEmpresaTheme(empresa.cor_primaria);
    } else {
      resetTheme();
    }
    return () => {
      resetTheme();
    };
  }, [empresa?.cor_primaria]);

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        isLoading,
        isAdminMaster,
        hasEmpresa: rows.length > 0,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}
