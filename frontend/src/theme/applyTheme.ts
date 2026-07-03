// Espelha o comportamento de tema do legado (views/partials/head.ejs):
// valores válidos persistidos em localStorage["app_theme"], aplicados via data-theme.
export type AppTheme = "soft" | "vextrom" | "xvextrom" | "darkvextrom";

const ALLOWED: AppTheme[] = ["soft", "vextrom", "xvextrom", "darkvextrom"];
const STORAGE_KEY = "app_theme";

export function getStoredTheme(): AppTheme {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored === "xvetrom") return "xvextrom"; // typo legado tolerado
  return (ALLOWED as string[]).includes(stored || "") ? (stored as AppTheme) : "vextrom";
}

export function applyTheme(theme: AppTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage indisponível */
  }
}
