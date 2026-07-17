import type { AuditCategory, AuditAdherence } from "../../api/sentinelgrid/audit";

// Situação da ocorrência (cadência × OM) → rótulo + cor do badge.
export const CATEGORY_META: Record<AuditCategory, { label: string; variant: string }> = {
  cumprida: { label: "Cumprida", variant: "success" },
  em_aberto_atrasada: { label: "Em aberto (atrasada)", variant: "warning" },
  planejada: { label: "Planejada", variant: "info" },
  lacuna: { label: "Lacuna (sem OM)", variant: "danger" },
  futura: { label: "Futura", variant: "secondary" }
};

// Aderência à data prevista (só para OMs cumpridas).
export const ADHERENCE_META: Record<string, { label: string; variant: string }> = {
  no_prazo: { label: "No prazo", variant: "success" },
  aproximado: { label: "Aproximado", variant: "warning" },
  fora_prazo: { label: "Fora do prazo", variant: "danger" },
  sem_data: { label: "Sem data", variant: "secondary" }
};

export function categoryMeta(category: AuditCategory) {
  return CATEGORY_META[category] || { label: category, variant: "secondary" };
}

export function adherenceMeta(adherence: AuditAdherence) {
  if (!adherence) return null;
  return ADHERENCE_META[adherence] || { label: adherence, variant: "secondary" };
}

// Texto curto do desvio em dias (+ atrasada, − adiantada).
export function deltaLabel(deltaDays: number | null): string {
  if (deltaDays === null) return "-";
  if (deltaDays === 0) return "no dia";
  const abs = Math.abs(deltaDays);
  return deltaDays > 0 ? `+${abs}d (atraso)` : `−${abs}d (antes)`;
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "-";
  return String(value).replace(/_/g, " ");
}

// Cor da taxa de aderência para pintar % / barras.
export function rateVariant(rate: number | null): string {
  if (rate === null) return "secondary";
  if (rate >= 85) return "success";
  if (rate >= 60) return "warning";
  return "danger";
}
