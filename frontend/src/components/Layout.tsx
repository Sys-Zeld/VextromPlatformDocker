import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { AppTheme, applyTheme, getStoredTheme } from "../theme/applyTheme";
import SgIcon, { SgIconName, isSgIconName } from "./sentinelgrid/SgIcon";

interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  role: string | null;
  lang: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

interface ModuleNav {
  key: string;
  subtitle: string;
  crumb: string;
  section: string;
  fallbackTitle: string;
  nav: NavItem[];
  footer: { href: string; label: string; icon: string };
}

const SERVICE_REPORT_NAV: NavItem[] = [
  { to: "/", label: "Ordens de Serviço", icon: "receipt_long", end: true },
  { to: "/customers", label: "Clientes", icon: "groups" },
  { to: "/equipments", label: "Equipamentos", icon: "precision_manufacturing" },
  { to: "/spare-parts", label: "Peças", icon: "inventory_2" },
  { to: "/assets", label: "Equipe & Instrumentos", icon: "engineering" },
  { to: "/table-styles", label: "Estilos de tabela", icon: "table_chart" },
  { to: "/config", label: "Configuração", icon: "settings" },
  { to: "/analytics", label: "Analytics", icon: "insights" }
];

// SentinelGrid usa o conjunto de ícones SVG próprio (SgIcon); os nomes abaixo são
// SgIconName, resolvidos em runtime por isSgIconName no render da nav/topbar.
const SENTINELGRID_NAV: NavItem[] = [
  { to: "/sentinelgrid", label: "Início", icon: "shield", end: true },
  { to: "/sentinelgrid/clients", label: "Clientes", icon: "clients" },
  { to: "/sentinelgrid/sites", label: "Sites", icon: "site" },
  { to: "/sentinelgrid/catalog", label: "Catálogo", icon: "catalog" },
  { to: "/sentinelgrid/equipment", label: "Equipamentos", icon: "equipment" },
  { to: "/sentinelgrid/management", label: "Contratos & Gestores", icon: "contract" },
  { to: "/sentinelgrid/programs", label: "Programas", icon: "program" },
  { to: "/sentinelgrid/plans", label: "Planos", icon: "plan" },
  { to: "/sentinelgrid/checklists", label: "Checklists", icon: "checklist" },
  { to: "/sentinelgrid/maintenance-orders", label: "Ordens", icon: "orders" },
  { to: "/sentinelgrid/calendar", label: "Calendario", icon: "calendar" },
  { to: "/sentinelgrid/alerts", label: "Alertas", icon: "alerts" },
  { to: "/sentinelgrid/history", label: "Historico", icon: "history" },
  { to: "/sentinelgrid/recommendations", label: "Recomendacoes", icon: "recommendations" },
  { to: "/sentinelgrid/dashboard", label: "Dashboard", icon: "dashboard" }
];

const SERVICE_REPORT_MODULE: ModuleNav = {
  key: "service-report",
  subtitle: "Service Report",
  crumb: "Vextrom Platform · Service Report",
  section: "Operação",
  fallbackTitle: "Service Report",
  nav: SERVICE_REPORT_NAV,
  footer: { href: "/admin/report-service", label: "Sistema legado", icon: "arrow_back" }
};

const SENTINELGRID_MODULE: ModuleNav = {
  key: "sentinelgrid",
  subtitle: "SentinelGrid",
  crumb: "Vextrom Platform · SentinelGrid",
  section: "Manutenção",
  fallbackTitle: "SentinelGrid",
  nav: SENTINELGRID_NAV,
  footer: { href: "/admin/hub", label: "Service Hub", icon: "grid_view" }
};

function resolveModule(pathname: string): ModuleNav {
  return pathname.startsWith("/sentinelgrid") ? SENTINELGRID_MODULE : SERVICE_REPORT_MODULE;
}

const THEMES: { value: AppTheme; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "vextrom", label: "Vextrom" },
  { value: "xvextrom", label: "X-Vextrom" },
  { value: "darkvextrom", label: "DarkVextrom" }
];

const AUTO_COLLAPSE_WIDTH = 1200; // recolhe automaticamente abaixo desta largura
const COLLAPSE_KEY = "vx_sidebar_collapsed";

function pageTitle(pathname: string, mod: ModuleNav): string {
  if (mod.key === "service-report" && (pathname === "/" || pathname.startsWith("/orders"))) {
    return "Ordens de Serviço";
  }
  // Casa o item de rota mais específico (maior prefixo) para o título do topo.
  const match = [...mod.nav]
    .filter((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? mod.fallbackTitle;
}

// Ícone SVG do item de nav ativo (só SentinelGrid) — usado na topbar e no toggle.
function activeSgIcon(pathname: string): SgIconName | null {
  if (!pathname.startsWith("/sentinelgrid")) return null;
  const match = [...SENTINELGRID_NAV]
    .filter((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match && isSgIconName(match.icon) ? match.icon : null;
}

function readPreferredCollapsed(): boolean {
  if (typeof window !== "undefined" && window.innerWidth < AUTO_COLLAPSE_WIDTH) return true;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Layout() {
  const location = useLocation();
  const mod = resolveModule(location.pathname);
  const sgIcon = activeSgIcon(location.pathname);
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => api<SessionInfo>("/session") });
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme());
  const [open, setOpen] = useState(false); // drawer mobile
  const [collapsed, setCollapsed] = useState<boolean>(readPreferredCollapsed);

  // Recolhimento automático: abaixo do breakpoint força rail; acima respeita a preferência salva.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < AUTO_COLLAPSE_WIDTH) {
        setCollapsed(true);
      } else {
        try {
          setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
        } catch {
          setCollapsed(false);
        }
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onThemeChange = (next: AppTheme) => { setTheme(next); applyTheme(next); };
  const toggleCollapsed = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* indisponível */ }
    return next;
  });
  const initials = (session?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className={`vx-shell${collapsed ? " is-collapsed" : ""}`}>
      {open && <div className="vx-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`vx-sidebar${open ? " is-open" : ""}`}>
        <div className="vx-brand">
          <button type="button" className="vx-collapse-btn" onClick={toggleCollapsed} aria-label="Recolher/expandir menu" title="Recolher/expandir menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="vx-brand__logo">
            <img src="/public/img/logo-vextrom.svg" alt="Vextrom" />
          </span>
          <span className="vx-brand__text">
            <span className="vx-brand__title d-block">Vextrom</span>
            <span className="vx-brand__subtitle">{mod.subtitle}</span>
          </span>
        </div>

        <nav className="vx-nav">
          <span className="vx-nav__section">{mod.section}</span>
          {mod.nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) => `vx-nav__link${isActive ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {mod.key === "sentinelgrid" && isSgIconName(item.icon) ? (
                <SgIcon name={item.icon} size={29} />
              ) : (
                <span className="material-symbols-outlined">{item.icon}</span>
              )}
              <span className="vx-nav__label">{item.label}</span>
            </NavLink>
          ))}
          <div className="vx-nav__spacer" />
          <a href={mod.footer.href} className="vx-nav__link vx-nav__link--muted" title={mod.footer.label}>
            <span className="material-symbols-outlined">{mod.footer.icon}</span>
            <span className="vx-nav__label">{mod.footer.label}</span>
          </a>
        </nav>
      </aside>

      <div className="vx-content">
        <header className="vx-topbar">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className={`vx-sidebar-toggle${mod.key === "sentinelgrid" ? " vx-sidebar-toggle--icon" : " btn btn-sm btn-outline-secondary"}`}
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              title="Menu"
            >
              {mod.key === "sentinelgrid" ? (
                <SgIcon name={sgIcon ?? "shield"} size={30} />
              ) : (
                <span className="material-symbols-outlined align-middle">menu</span>
              )}
            </button>
            <div className="d-flex align-items-center gap-2">
              {sgIcon && <SgIcon name={sgIcon} size={48} className="vx-topbar__icon" />}
              <div>
                <p className="vx-topbar__title">{pageTitle(location.pathname, mod)}</p>
                <span className="vx-topbar__crumb">{mod.crumb}</span>
              </div>
            </div>
          </div>
          <div className="vx-topbar__controls">
            <select
              className="form-select form-select-sm"
              style={{ width: 130 }}
              value={theme}
              onChange={(e) => onThemeChange(e.target.value as AppTheme)}
              aria-label="Tema"
            >
              {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {session?.username && (
              <span className="vx-user">
                <span className="vx-user__avatar">{initials}</span>
                <span className="vx-user__name">{session.username}</span>
              </span>
            )}
          </div>
        </header>

        <main className="vx-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
