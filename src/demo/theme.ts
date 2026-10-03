export type DemoBrand = {
  name: string;
  logoDataUrl: string;
  primary: string;
  secondary: string;
  poweredByGex: boolean;
};

export const DEFAULT_DEMO_BRAND: DemoBrand = {
  name: "Empresa Modelo",
  logoDataUrl: "",
  primary: "#B8893B",
  secondary: "#171717",
  poweredByGex: true,
};

export const DEMO_BRAND_STORAGE_KEY = "gex:demo-brand";

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
