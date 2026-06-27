import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../api/client";
import { AppTheme, applyTheme, getStoredTheme } from "../theme/applyTheme";
import { useState } from "react";

interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  role: string | null;
  lang: string;
}

const NAV = [
  { to: "/", label: "Ordens de Serviço", end: true },
  { to: "/customers", label: "Clientes" },
  { to: "/equipments", label: "Equipamentos" },
  { to: "/spare-parts", label: "Peças" },
  { to: "/assets", label: "Equipe & Instrumentos" },
  { to: "/table-styles", label: "Estilos de tabela" },
  { to: "/config", label: "Configuração" },
  { to: "/analytics", label: "Analytics" }
];

const THEMES: { value: AppTheme; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "vextrom", label: "Vextrom" },
  { value: "xvextrom", label: "X-Vextrom" }
];

export default function Layout() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionInfo>("/session")
  });
  const [theme, setTheme] = useState<AppTheme>(getStoredTheme());

  const onThemeChange = (next: AppTheme) => {
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div className="app-shell admin-page">
      <main className="container app-main py-4 py-md-5">
        <div className="app-topbar">
          <div className="app-brand-wrap">
            <a className="app-brand" href="/app/">
              <img className="app-brand-logo" src="/public/img/logo-vextrom.svg" alt="Vextrom" />
            </a>
            <span className="app-brand-title">Service Report <small className="app-brand-version">SPA</small></span>
          </div>
          <div className="app-topbar-controls">
            <div className="topbar-group">
              <label className="lang-label mb-0" htmlFor="themeSelector">Tema:</label>
              <select
                id="themeSelector"
                className="form-select form-select-sm theme-select"
                value={theme}
                onChange={(e) => onThemeChange(e.target.value as AppTheme)}
              >
                {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {session?.username && (
              <small className="topbar-user-meta">Usuário: <strong>{session.username}</strong></small>
            )}
          </div>
        </div>

        <nav className="nav nav-pills gap-2 mb-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
          <a className="nav-link ms-auto text-decoration-none" href="/admin/report-service">← Sistema legado</a>
        </nav>

        <Outlet />
      </main>
    </div>
  );
}
