const pad = (n: number) => String(n).padStart(2, "0");

// Formata datas (DATE ou timestamp ISO) como dd/mm/yyyy, sem horas.
// - "2026-09-01" ou "2026-09-01T03:00:00.000Z" → "01/09/2026".
export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const s = String(value);
  if (s.includes("T")) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }
  const [y, m, day] = s.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : s;
}

// Iniciais do cliente (até 3 letras/dígitos). Ex.: "Sabesp Baterias Manutenção" → "SBM".
export function clientInitials(name?: string | null): string {
  const words = String(name || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/[A-Za-z0-9]+/g) || [];
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

// TAG do equipamento prefixada pelas iniciais do cliente. Ex.: "SBM-UPS-01".
export function equipmentLabel(tag?: string | null, clientName?: string | null): string {
  const t = String(tag || "").trim();
  if (!t) return "";
  const ini = clientInitials(clientName);
  return ini ? `${ini}-${t}` : t;
}
