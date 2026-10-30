import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { listNotifications } from "../../../api/expenses";
import { useExpensesMe } from "../auth/ExpensesGuard";
import "./mobile.css";

// Moldura da versão mobile: barra superior simples e abas no rodapé, sem menu
// lateral e sem Gestão — no celular todo perfil usa só as funções do Colaborador.

interface TopbarConfig { title: string; back?: string }
const TopbarContext = createContext<(c: TopbarConfig) => void>(() => {});

// Cada tela define o título e para onde o "voltar" leva.
export function useMobileTopbar(title: string, back?: string) {
  const set = useContext(TopbarContext);
  useEffect(() => set({ title, back }), [set, title, back]);
}

const TABS = [
  { to: "/expenses/m", label: "Relatórios", icon: "receipt_long", end: true },
  { to: "/expenses/m/painel", label: "Painel", icon: "dashboard" },
  { to: "/expenses/m/notifications", label: "Notificações", icon: "notifications" },
  { to: "/expenses/m/more", label: "Mais", icon: "menu" }
];
const TAB_ROOTS = new Set(TABS.map((t) => t.to));

export default function MobileShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const me = useExpensesMe();
  const [topbar, setTopbar] = useState<TopbarConfig>({ title: "Relatório de Despesas" });
  const forcedPasswordChange = Boolean(me.data?.user.mustChangePassword);
  // Abas só nas telas principais; formulários usam a barra de ação no lugar.
  const showTabs = TAB_ROOTS.has(pathname) && !forcedPasswordChange;

  const notifications = useQuery({
    queryKey: ["expenses", "notifications"],
    queryFn: listNotifications,
    refetchInterval: 60_000,
    enabled: !forcedPasswordChange
  });
  const unread = notifications.data?.unread ?? 0;

  return (
    <TopbarContext.Provider value={setTopbar}>
      <div className={`exm-shell${showTabs ? " has-tabs" : ""}`}>
        <header className="exm-topbar">
          {topbar.back ? (
            <button type="button" className="exm-iconbtn exm-topbar__back" aria-label="Voltar" onClick={() => navigate(topbar.back!)}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          ) : (
            <img className="exm-topbar__logo" src="/public/img/logo-vextrom.svg" alt="Vextrom" />
          )}
          <span className="exm-topbar__title">{topbar.title}</span>
        </header>
        <main className="exm-main">
          <Outlet />
        </main>
        {showTabs && (
          <nav className="exm-tabbar" aria-label="Navegação">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} replace className={({ isActive }) => `exm-tab${isActive ? " is-active" : ""}`}>
                <span className="exm-tab__icon">
                  <span className="material-symbols-outlined">{t.icon}</span>
                  {t.icon === "notifications" && unread > 0 && <span className="exm-tab__badge">{unread > 99 ? "99+" : unread}</span>}
                </span>
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </TopbarContext.Provider>
  );
}
