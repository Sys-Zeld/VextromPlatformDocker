import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { AppTheme, applyTheme, getStoredTheme } from "../theme/applyTheme";

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

const NAV: NavItem[] = [
  { to: "/", label: "Ordens de Serviço", icon: "receipt_long", end: true },
  { to: "/customers", label: "Clientes", icon: "groups" },
  { to: "/equipments", label: "Equipamentos", icon: "precision_manufacturing" },
  { to: "/spare-parts", label: "Peças", icon: "inventory_2" },
  { to: "/assets", label: "Equipe & Instrumentos", icon: "engineering" },
  { to: "/table-styles", label: "Estilos de tabela", icon: "table_chart" },
  { to: "/config", label: "Configuração", icon: "settings" },
  { to: "/analytics", label: "Analytics", icon: "insights" }
];

const THEMES: { value: AppTheme; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "vextrom", label: "Vextrom" },
  { value: "xvextrom", label: "X-Vextrom" }
];

function pageTitle(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/orders")) return "Ordens de Serviço";
  const match = NAV.find((n) => n.to !== "/" && pathname.startsWith(n.to));
  return match?.label ?? "Service Report";
}

export default function Layout() {
  const location = useLocation();
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => api<SessionInfo>("/session") });
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme());
  const [open, setOpen] = useState(false);

  const onThemeChange = (next: AppTheme) => { setTheme(next); applyTheme(next); };
  const initials = (session?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="vx-shell">
      {open && <div className="vx-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`vx-sidebar${open ? " is-open" : ""}`}>
        <div className="vx-brand">
          <span className="vx-brand__logo">
            <img src="/public/img/logo-vextrom.svg" alt="Vextrom" />
          </span>
          <span>
            <span className="vx-brand__title d-block">Vextrom</span>
            <span className="vx-brand__subtitle">Service Report</span>
          </span>
        </div>

        <nav className="vx-nav">
          <span className="vx-nav__section">Operação</span>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `vx-nav__link${isActive ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="vx-nav__spacer" />
          <a href="/admin/report-service" className="vx-nav__link vx-nav__link--muted">
            <span className="material-symbols-outlined">arrow_back</span>
            Sistema legado
          </a>
        </nav>
      </aside>

      <div className="vx-content">
        <header className="vx-topbar">
          <div className="d-flex align-items-center gap-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary vx-sidebar-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
            >
              <span className="material-symbols-outlined align-middle">menu</span>
            </button>
            <div>
              <p className="vx-topbar__title">{pageTitle(location.pathname)}</p>
              <span className="vx-topbar__crumb">Vextrom Platform · Service Report</span>
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
