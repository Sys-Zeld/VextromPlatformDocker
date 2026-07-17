import { ReactNode } from "react";

// Conjunto de ícones do SentinelGrid, desenhado no estilo da folha de marca:
// traço (line-art) na cor do texto (currentColor → adapta ao tema claro/escuro)
// + destaque verde fixo da marca (classes .sg-i-accent / .sg-i-accent-fill, ver
// theme.css). viewBox 24×24. Substitui os glifos material-symbols e os app-icons
// PNG na UI do módulo.

export const SG_ICON_NAMES = [
  "shield",
  "clients",
  "site",
  "catalog",
  "equipment",
  "contract",
  "program",
  "plan",
  "checklist",
  "orders",
  "calendar",
  "alerts",
  "history",
  "recommendations",
  "dashboard",
  "wrench",
  "battery",
  "rectifier",
  "settings",
  "export",
  "profile",
  "include",
  "trash",
  "edit-plan",
  "delete-plan",
  "add-circle",
  "new-doc",
  "groups",
  "month",
  "year",
  "today",
  "emergency",
  "critical",
  "important",
  "attention",
  "pencil",
  "check",
  "status",
  "save",
  "assets",
  "qr-code",
  "manage-items",
  "generate-by-plan",
  "execute-checklist",
  "technical-execution",
  "change-status",
  "approve-shutdown",
  "new-client",
  "new-site",
  "new-program",
  "new-plan",
  "new-checklist",
  "import-report",
  "clear-selection"
] as const;

export type SgIconName = (typeof SG_ICON_NAMES)[number];

const NAME_SET = new Set<string>(SG_ICON_NAMES);
export function isSgIconName(x: string): x is SgIconName {
  return NAME_SET.has(x);
}

const PATHS: Record<SgIconName, ReactNode> = {
  shield: (
    <>
      <path d="M12 3l7.5 2.8v5c0 4.8-3.2 8.4-7.5 9.7C7.7 19.2 4.5 15.6 4.5 10.8v-5z" />
      <path className="sg-i-accent-fill" d="M12.9 8.1l-3.1 4.6h2.1l-.7 3.1 3.1-4.6h-2.1z" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8.6" r="3.1" />
      <path d="M3.6 19.4v-.4c0-2.9 2.4-5 5.4-5s5.4 2.1 5.4 5v.4" />
      <path className="sg-i-accent" d="M16.2 6.8a2.6 2.6 0 0 1 0 5" />
      <path className="sg-i-accent" d="M17.4 14.3c2 .5 3.4 2.1 3.4 4.1v.4" />
    </>
  ),
  site: (
    <>
      <path d="M5 20.5V5.6A1.6 1.6 0 0 1 6.6 4h7.8A1.6 1.6 0 0 1 16 5.6v14.9" />
      <path d="M16 11h2.4A1.6 1.6 0 0 1 20 12.6v7.9" />
      <path d="M3.5 20.5h17" />
      <path d="M8.4 8h1.4M12.2 8h1.4M8.4 11.4h1.4M12.2 11.4h1.4" />
      <path className="sg-i-accent" d="M9.4 20.5v-3.6h3.2v3.6" />
    </>
  ),
  catalog: (
    <>
      <rect className="sg-i-accent" x="4" y="4" width="7" height="7" rx="1.6" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" />
    </>
  ),
  equipment: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1.8" />
      <circle cx="9" cy="5.4" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="11.3" cy="5.4" r="0.55" fill="currentColor" stroke="none" />
      <circle className="sg-i-accent-fill" cx="13.6" cy="5.4" r="0.55" />
      <rect className="sg-i-accent-fill" x="9" y="7.1" width="6" height="3" rx="0.7" />
      <path d="M8.6 13h6.8M8.6 15.4h6.8M8.6 17.8h6.8" />
    </>
  ),
  contract: (
    <>
      <path d="M6 3.5h6.8l4.2 4.2V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5z" />
      <path d="M12.5 3.5v4.2h4.2" />
      <path d="M7.6 11.2h5.2M7.6 14h5.2" />
      <path className="sg-i-accent" d="M8 17.3l1.6 1.6 3.3-3.4" />
    </>
  ),
  program: (
    <>
      <rect x="3.5" y="5" width="12.5" height="12.5" rx="2" />
      <path d="M3.5 8.9h12.5" />
      <path d="M7 3.2v3M12.5 3.2v3" />
      <path className="sg-i-accent" d="M20 15a4 4 0 1 1-1.3-3" />
      <path className="sg-i-accent" d="M18.9 9.9v2.4h-2.4" />
    </>
  ),
  plan: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <rect x="9" y="2.7" width="6" height="3" rx="1.2" />
      <path d="M8.4 11.5h7.2M8.4 15h7.2M8.4 18.4h4.6" />
      <circle className="sg-i-accent-fill" cx="6.6" cy="11.5" r="0.7" />
    </>
  ),
  checklist: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <rect x="9" y="2.7" width="6" height="3" rx="1.2" />
      <path className="sg-i-accent" d="M7.4 11.2l1 1 1.9-2" />
      <path d="M12 11.4h4" />
      <path className="sg-i-accent" d="M7.4 16l1 1 1.9-2" />
      <path d="M12 16.2h4" />
    </>
  ),
  orders: (
    <>
      <rect x="4.3" y="4.5" width="11.4" height="16" rx="2" />
      <rect x="7.5" y="2.7" width="5" height="3" rx="1.2" />
      <path d="M7.2 10.8h5.6M7.2 13.6h3.8" />
      <g className="sg-i-accent">
        <circle cx="16.4" cy="16.4" r="2.1" />
        <path d="M16.4 13.6v-1M16.4 20.2v-1M19.2 16.4h1M12.6 16.4h1M18.4 14.4l.7-.7M13.7 19.1l.7-.7M18.4 18.4l.7.7M13.7 13.7l.7.7" />
      </g>
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.4h17" />
      <path d="M8 3v4M16 3v4" />
      <path className="sg-i-accent" d="M8.6 14.6l2 2 4-4.2" />
    </>
  ),
  alerts: (
    <>
      <path d="M6.6 17c1.1-1 1.7-2.4 1.7-4.1V11a3.7 3.7 0 0 1 7.4 0v1.9c0 1.7.6 3.1 1.7 4.1z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <circle className="sg-i-accent-fill" cx="16.9" cy="7" r="2.1" />
    </>
  ),
  history: (
    <>
      <path d="M4.8 12A7.3 7.3 0 1 0 7.2 6.5" />
      <path className="sg-i-accent" d="M4.3 4.6v3.2h3.2" />
      <path d="M12 8.4V12l2.6 1.7" />
    </>
  ),
  recommendations: (
    <>
      <path d="M9 16.4a5.4 5.4 0 1 1 6 0c-.7.5-1 1.1-1 1.9v.5h-4v-.5c0-.8-.3-1.4-1-1.9z" />
      <path d="M10 21h4" />
      <path className="sg-i-accent" d="M10.4 12l1.4 1.4 2.2-2.6" />
    </>
  ),
  dashboard: (
    <>
      <path d="M4.5 4.5v15h15" />
      <rect x="7.4" y="12" width="2.6" height="5" rx="0.4" />
      <rect className="sg-i-accent-fill" x="11.7" y="9" width="2.6" height="8" rx="0.4" />
      <rect x="16" y="6.5" width="2.6" height="10.5" rx="0.4" />
    </>
  ),
  wrench: (
    <path d="M15.6 6.6a3.5 3.5 0 0 0-4.5 4.3l-6.3 6.2a1.6 1.6 0 0 0 2.3 2.3l6.2-6.3a3.5 3.5 0 0 0 4.3-4.5l-2.3 2.3-2-2z" />
  ),
  battery: (
    <>
      <rect x="4.5" y="7" width="14" height="10" rx="2" />
      <path d="M18.5 10.5h1.5v3h-1.5" />
      <rect className="sg-i-accent-fill" x="6.6" y="9.4" width="3.2" height="5.2" rx="0.5" />
      <path className="sg-i-accent" d="M12.4 12h3M13.9 10.5v3" />
    </>
  ),
  rectifier: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path className="sg-i-accent" d="M7 14c1.5 0 1.5-4 3-4s1.5 4 3 4 1.5-4 3-4" />
      <path d="M7 16.6h10" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.4M12 18v2.4M4.6 12H7M17 12h2.4M6.3 6.3l1.7 1.7M16 16l1.7 1.7M6.3 17.7l1.7-1.7M16 8l1.7-1.7" />
    </>
  ),
  export: (
    <>
      <path d="M12 3.8v10.4" />
      <path className="sg-i-accent" d="M8 10.4l4 4 4-4" />
      <path d="M5 19.2h14" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.4" r="3.5" />
      <path d="M5.6 20v-.5c0-3.2 2.9-5.4 6.4-5.4s6.4 2.2 6.4 5.4v.5" />
    </>
  ),
  include: (
    <>
      <path d="M12.5 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h3.4" />
      <path d="M12.5 3.5 16 7v3.4" />
      <path d="M12.5 3.5V7H16" />
      <path d="M8 10.4h4" />
      <path className="sg-i-accent" d="M8 12.7h2.3" />
      <path d="M8 15h3.4" />
      <circle className="sg-i-accent" cx="16.3" cy="16.3" r="3.4" />
      <path className="sg-i-accent" d="M16.3 14.5v3.6M14.5 16.3h3.6" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.6h15" />
      <path d="M9 6.6V5A1.5 1.5 0 0 1 10.5 3.5h3A1.5 1.5 0 0 1 15 5v1.6" />
      <path d="M6.6 6.6 7.5 19a1.6 1.6 0 0 0 1.6 1.5h5.8a1.6 1.6 0 0 0 1.6-1.5l.9-12.4" />
      <path className="sg-i-accent" d="M9.9 10v6.6M12 10v6.6M14.1 10v6.6" />
    </>
  ),
  "edit-plan": (
    <>
      <rect x="3.8" y="4.5" width="12.4" height="13" rx="1.8" />
      <path d="M7.3 3v3M12.7 3v3" />
      <path className="sg-i-accent" d="M6 9.1l1 1 1.7-1.9" />
      <path d="M10 9.3h4" />
      <path className="sg-i-accent" d="M6 12.4l1 1 1.7-1.9" />
      <path d="M10 12.6h4" />
      <path className="sg-i-accent" d="M6 15.7l1 1 1.7-1.9" />
      <path d="M10 15.9h2.4" />
      <circle className="sg-i-accent" cx="17" cy="16.6" r="4" />
      <path className="sg-i-accent" d="M18.1 14.7l1.2 1.2-2.9 2.9-1.6.4.4-1.6z" />
    </>
  ),
  "delete-plan": (
    <>
      <rect x="3.8" y="4.5" width="12.4" height="13" rx="1.8" />
      <path d="M7.3 3v3M12.7 3v3" />
      <path className="sg-i-accent" d="M6 9.1l1 1 1.7-1.9" />
      <path d="M10 9.3h4" />
      <path className="sg-i-accent" d="M6 12.4l1 1 1.7-1.9" />
      <path d="M10 12.6h4" />
      <path className="sg-i-accent" d="M6 15.7l1 1 1.7-1.9" />
      <path d="M10 15.9h2.4" />
      <circle className="sg-i-accent" cx="17" cy="16.6" r="4" />
      <path className="sg-i-accent" d="M15.2 15.2h3.6M15.7 15.2l.3 3a.5.5 0 0 0 .5.45h1a.5.5 0 0 0 .5-.45l.3-3" />
    </>
  ),
  "add-circle": (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path className="sg-i-accent" d="M12 8v8M8 12h8" />
    </>
  ),
  "new-doc": (
    <>
      <path d="M13.5 7.5H9A1.5 1.5 0 0 0 7.5 9v10A1.5 1.5 0 0 0 9 20.5h7A1.5 1.5 0 0 0 17.5 19V11.5z" />
      <path d="M13.5 7.5V11.5H17.5" />
      <path d="M10.5 15h5M10.5 17.5h3" />
      <g className="sg-i-accent">
        <rect x="5.6" y="5.6" width="5" height="5" rx="0.7" />
        <rect x="5.6" y="5.6" width="5" height="5" rx="0.7" transform="rotate(45 8.1 8.1)" />
        <path d="M8.1 6.5v3.2M6.5 8.1h3.2" />
      </g>
    </>
  ),
  groups: (
    <>
      <circle cx="12" cy="8" r="2.6" />
      <path d="M8 18.5v-.3c0-2.2 1.8-3.9 4-3.9s4 1.7 4 3.9v.3" />
      <circle cx="5.5" cy="10.5" r="2" />
      <path d="M2.6 17.6c0-1.9 1.3-3.3 2.9-3.3.4 0 .8.1 1.2.2" />
      <circle cx="18.5" cy="10.5" r="2" />
      <path d="M21.4 17.6c0-1.9-1.3-3.3-2.9-3.3-.4 0-.8.1-1.2.2" />
      <path className="sg-i-accent" d="M7.6 6.1a6 6 0 0 1 8.8 0" />
    </>
  ),
  month: (
    <>
      <rect x="3.8" y="5" width="16.4" height="14.5" rx="2" />
      <path className="sg-i-accent" d="M4.5 9.2h15" />
      <path d="M7.5 3v3.4M16.5 3v3.4" />
      <rect x="6.2" y="11.2" width="2.6" height="2.4" rx="0.4" />
      <rect x="10.7" y="11.2" width="2.6" height="2.4" rx="0.4" />
      <rect x="15.2" y="11.2" width="2.6" height="2.4" rx="0.4" />
      <rect x="6.2" y="15" width="2.6" height="2.4" rx="0.4" />
      <rect x="10.7" y="15" width="2.6" height="2.4" rx="0.4" />
      <rect x="15.2" y="15" width="2.6" height="2.4" rx="0.4" />
    </>
  ),
  year: (
    <>
      <rect x="3.5" y="4.8" width="17" height="15" rx="2" />
      <path className="sg-i-accent" d="M4.3 8.8h15.4" />
      <path d="M7.5 3v3.2M16.5 3v3.2" />
      <g className="sg-i-accent">
        <rect x="5.3" y="10.4" width="2.5" height="2.1" rx="0.3" />
        <rect x="8.8" y="10.4" width="2.5" height="2.1" rx="0.3" />
        <rect x="12.3" y="10.4" width="2.5" height="2.1" rx="0.3" />
        <rect x="15.8" y="10.4" width="2.5" height="2.1" rx="0.3" />
        <rect x="5.3" y="13.1" width="2.5" height="2.1" rx="0.3" />
        <rect x="8.8" y="13.1" width="2.5" height="2.1" rx="0.3" />
        <rect x="12.3" y="13.1" width="2.5" height="2.1" rx="0.3" />
        <rect x="15.8" y="13.1" width="2.5" height="2.1" rx="0.3" />
        <rect x="5.3" y="15.8" width="2.5" height="2.1" rx="0.3" />
        <rect x="8.8" y="15.8" width="2.5" height="2.1" rx="0.3" />
        <rect x="12.3" y="15.8" width="2.5" height="2.1" rx="0.3" />
        <rect x="15.8" y="15.8" width="2.5" height="2.1" rx="0.3" />
      </g>
    </>
  ),
  today: (
    <>
      <rect x="3.8" y="5" width="16.4" height="14.5" rx="2" />
      <path className="sg-i-accent" d="M4.5 9.2h15" />
      <path d="M7.5 3v3.4M16.5 3v3.4" />
      <rect x="6.2" y="11.2" width="2.6" height="2.4" rx="0.4" />
      <rect x="10.7" y="11.2" width="2.6" height="2.4" rx="0.4" />
      <rect x="15.2" y="11.2" width="2.6" height="2.4" rx="0.4" />
      <rect x="6.2" y="15" width="2.6" height="2.4" rx="0.4" />
      <rect className="sg-i-accent-fill" x="10.7" y="15" width="2.6" height="2.4" rx="0.4" />
      <rect x="15.2" y="15" width="2.6" height="2.4" rx="0.4" />
    </>
  ),
  emergency: (
    <>
      <path d="M6 18.6h12" />
      <path d="M8 18.6v-1.4h8v1.4" />
      <path d="M7.6 17v-3a4.4 4.4 0 0 1 8.8 0v3" />
      <path className="sg-i-accent" d="M12.6 10l-2 3.1h1.7l-.4 2.4 2-3.1h-1.7z" />
      <path className="sg-i-accent" d="M12 4.2V2.6M6.7 6.2 5.5 5M17.3 6.2 18.5 5M5 10.6H3.5M19 10.6h1.5" />
    </>
  ),
  critical: (
    <>
      <path d="M12 4.2 3.7 18.8a1 1 0 0 0 .9 1.5h14.8a1 1 0 0 0 .9-1.5z" />
      <path d="M12 9.4v2.8" />
      <circle cx="12" cy="14.6" r="0.6" fill="currentColor" stroke="none" />
      <path className="sg-i-accent" d="M6.5 16.8h2l1-2 1.6 3.4 1.1-1.8.8 1.2h3" />
    </>
  ),
  important: (
    <>
      <path d="M6 4.6h12v15.4l-6-3.1-6 3.1z" />
      <path className="sg-i-accent" d="M12 8.2l1.25 2.6 2.85.35-2.1 2 .52 2.8-2.52-1.35-2.52 1.35.52-2.8-2.1-2 2.85-.35z" />
    </>
  ),
  attention: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path className="sg-i-accent" d="M12 7.5v5.5" />
      <circle className="sg-i-accent-fill" cx="12" cy="16" r="0.9" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l1.1-4.2L15.6 5.3a1.9 1.9 0 0 1 2.7 0l1.4 1.4a1.9 1.9 0 0 1 0 2.7L9.2 19.9 5 21z" />
      <path d="M14.4 6.5l3.1 3.1" />
      <path className="sg-i-accent" d="M5.1 15.8 8.2 18.9" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path className="sg-i-accent" d="M8.2 12.2l2.6 2.6 5-5.4" />
    </>
  ),
  status: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path className="sg-i-accent" d="M20.5 4v4.4h-4.4" />
    </>
  ),
  save: (
    <>
      <path d="M5 4.5h11l3 3V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5z" />
      <path d="M7 4.5v5h7v-5" />
      <rect className="sg-i-accent" x="7.5" y="13" width="9" height="4.5" rx="0.6" />
    </>
  ),
  assets: (
    <>
      <path d="M12 3.3 7.8 5.7 12 8.1l4.2-2.4zM7.8 5.7 3.8 8 8 10.4l4-2.3M16.2 5.7 20.2 8 16 10.4l-4-2.3" />
      <path d="M3.8 8v4.7L8 15.1l4-2.3V8.1M12 8.1v4.7l4 2.3 4.2-2.4V8" />
      <path className="sg-i-accent" d="M8 15.1v4.4l4 2.2 4-2.2v-4.4L12 12.8z" />
    </>
  ),
  "qr-code": (
    <>
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <rect x="6.5" y="6.5" width="3.5" height="3.5" />
      <rect x="14" y="6.5" width="3.5" height="3.5" />
      <rect x="6.5" y="14" width="3.5" height="3.5" />
      <path className="sg-i-accent" d="M13.5 13.5h2v2h2v2h-4v-4zM12 9.8v2.1h2.2" />
    </>
  ),
  "manage-items": (
    <>
      <path d="M5.5 7h1M5.5 12h1M5.5 17h1M9 7h6M9 12h5M9 17h4" />
      <g className="sg-i-accent">
        <circle cx="17.2" cy="16.5" r="2.6" />
        <path d="M17.2 12.7v1.2M17.2 19.1v1.2M13.4 16.5h1.2M19.8 16.5H21M14.5 13.8l.9.9M19 18.3l.9.9M14.5 19.2l.9-.9M19 14.7l.9-.9" />
      </g>
    </>
  ),
  "generate-by-plan": (
    <>
      <path d="M6 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5zM13 3.5v4h4" />
      <path className="sg-i-accent" d="M7.5 12h3v2.8h3v2.7h3M9 12v-1.7M13.5 14.8v-1.7M16.5 17.5v-1.7" />
    </>
  ),
  "execute-checklist": (
    <>
      <rect x="5" y="4.5" width="12.5" height="16" rx="2" />
      <rect x="8.5" y="2.7" width="5.5" height="3" rx="1.2" />
      <path className="sg-i-accent" d="M7.5 10.5l1.1 1.1 1.9-2M7.5 15l1.1 1.1 1.9-2" />
      <path d="M12 10.7h3M12 15.2h1.4" />
      <circle className="sg-i-accent" cx="17.2" cy="17.2" r="3.2" />
      <path className="sg-i-accent-fill" d="m16.3 15.6 2.4 1.6-2.4 1.6z" />
    </>
  ),
  "technical-execution": (
    <>
      <circle cx="10" cy="7" r="3" />
      <path d="M4.5 19.5v-.6c0-3.3 2.4-5.7 5.5-5.7 1.1 0 2.1.3 2.9.8" />
      <path d="M6.6 5.5h6.8M8 3.8V3h4v.8" />
      <path className="sg-i-accent" d="M19.2 13.2a2.8 2.8 0 0 0-3.5 3.5l-3 3a1.3 1.3 0 0 0 1.8 1.8l3-3a2.8 2.8 0 0 0 3.5-3.5l-1.8 1.8-1.6-1.6z" />
    </>
  ),
  "change-status": (
    <>
      <circle cx="6" cy="6.5" r="1.5" />
      <circle className="sg-i-accent" cx="6" cy="12" r="1.5" />
      <circle cx="6" cy="17.5" r="1.5" />
      <path d="M10 6.5h8M10 12h8M10 17.5h8" />
    </>
  ),
  "approve-shutdown": (
    <>
      <path d="M12 3.2 19 6v5.2c0 4.5-2.9 7.8-7 9.2-4.1-1.4-7-4.7-7-9.2V6z" />
      <path className="sg-i-accent" d="m8.2 11.8 2.5 2.5 5-5.2" />
    </>
  ),
  "new-client": (
    <>
      <circle cx="9.2" cy="7.8" r="3.2" />
      <path d="M3.5 19.5v-.6c0-3.2 2.5-5.4 5.7-5.4 1.8 0 3.3.7 4.3 1.8" />
      <circle className="sg-i-accent" cx="17.4" cy="16.8" r="3.6" />
      <path className="sg-i-accent" d="M17.4 14.8v4M15.4 16.8h4" />
    </>
  ),
  "new-site": (
    <>
      <path d="M12 20.5s6.2-5.1 6.2-10.6a6.2 6.2 0 1 0-12.4 0c0 5.5 6.2 10.6 6.2 10.6z" />
      <circle cx="12" cy="9.8" r="2.2" />
      <path className="sg-i-accent" d="M15.7 18.8h5M18.2 16.3v5" />
    </>
  ),
  "new-program": (
    <>
      <rect x="3.8" y="5" width="14.5" height="14.5" rx="2" />
      <path d="M4.5 9.2h13.1M7.5 3v3.4M14.7 3v3.4" />
      <circle className="sg-i-accent" cx="18.2" cy="17.8" r="3.3" />
      <path className="sg-i-accent" d="M18.2 15.9v3.8M16.3 17.8h3.8" />
    </>
  ),
  "new-plan": (
    <>
      <rect x="4.5" y="4.5" width="13" height="16" rx="2" />
      <rect x="8" y="2.7" width="6" height="3" rx="1.2" />
      <path d="M7.5 10.5h5.5M7.5 14h4.2" />
      <circle className="sg-i-accent" cx="17.2" cy="16.7" r="3.3" />
      <path className="sg-i-accent" d="M17.2 14.8v3.8M15.3 16.7h3.8" />
    </>
  ),
  "new-checklist": (
    <>
      <rect x="4.5" y="4.5" width="13" height="16" rx="2" />
      <rect x="8" y="2.7" width="6" height="3" rx="1.2" />
      <path className="sg-i-accent" d="m7 10.5 1 1 1.8-2M7 14.6l1 1 1.8-2" />
      <path d="M11.5 10.7h3M11.5 14.8h2" />
      <circle className="sg-i-accent" cx="17.4" cy="17.1" r="3.1" />
      <path className="sg-i-accent" d="M17.4 15.3v3.6M15.6 17.1h3.6" />
    </>
  ),
  "import-report": (
    <>
      <path d="M6 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V5A1.5 1.5 0 0 1 6 3.5zM13 3.5v4h4M7.5 11.5h5M7.5 15h3.5" />
      <path className="sg-i-accent" d="M18.5 20.5v-8M15.5 15.5l3-3 3 3" />
    </>
  ),
  "clear-selection": (
    <>
      <rect x="4" y="4" width="14" height="14" rx="2" strokeDasharray="2.5 2.5" />
      <circle className="sg-i-accent" cx="17.7" cy="17.7" r="3.4" />
      <path className="sg-i-accent" d="m16.3 16.3 2.8 2.8M19.1 16.3l-2.8 2.8" />
    </>
  )
};

interface Props {
  name: SgIconName;
  size?: number;
  className?: string;
  title?: string;
}

export default function SgIcon({ name, size = 24, className, title }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`sg-icon${className ? ` ${className}` : ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
