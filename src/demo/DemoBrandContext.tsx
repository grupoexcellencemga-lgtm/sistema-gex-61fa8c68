/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DEMO_BRAND,
  DEMO_BRAND_STORAGE_KEY,
  type DemoBrand,
  isHexColor,
} from "@/demo/theme";

type DemoBrandContextValue = {
  brand: DemoBrand;
  updateBrand: (patch: Partial<DemoBrand>) => void;
  resetBrand: () => void;
};

const DemoBrandContext = createContext<DemoBrandContextValue | null>(null);

function loadStoredBrand(): DemoBrand {
  try {
    const raw = localStorage.getItem(DEMO_BRAND_STORAGE_KEY);
    if (!raw) return DEFAULT_DEMO_BRAND;
    const parsed = JSON.parse(raw) as Partial<DemoBrand>;
    return { ...DEFAULT_DEMO_BRAND, ...parsed };
  } catch {
    return DEFAULT_DEMO_BRAND;
  }
}
function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function applyBrandCss(brand: DemoBrand) {
  const root = document.documentElement;
  const primary = isHexColor(brand.primary) ? brand.primary : DEFAULT_DEMO_BRAND.primary;
  const secondary = isHexColor(brand.secondary) ? brand.secondary : DEFAULT_DEMO_BRAND.secondary;
  const rgb = hexToRgb(primary);
  root.style.setProperty("--demo-primary", primary);
  root.style.setProperty("--demo-secondary", secondary);
  root.style.setProperty("--demo-primary-rgb", `${rgb.r} ${rgb.g} ${rgb.b}`);
  root.style.setProperty("--demo-primary-soft", `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.10)`);
  root.style.setProperty("--demo-primary-faint", `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.055)`);
}

export function DemoBrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<DemoBrand>(loadStoredBrand);
  useEffect(() => {
    applyBrandCss(brand);
    localStorage.setItem(DEMO_BRAND_STORAGE_KEY, JSON.stringify(brand));
  }, [brand]);

  const value = useMemo<DemoBrandContextValue>(() => ({
    brand,
    updateBrand: (patch) => setBrand((current) => ({ ...current, ...patch })),
    resetBrand: () => setBrand(DEFAULT_DEMO_BRAND),
  }), [brand]);

  return (
    <DemoBrandContext.Provider value={value}>
      {children}
    </DemoBrandContext.Provider>
  );
}

export function useDemoBrand() {
  const context = useContext(DemoBrandContext);
  if (!context) {
    throw new Error("useDemoBrand must be used within DemoBrandProvider");
  }
  return context;
}
