import { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { logout } from "../../../api/expenses";
import { useExpensesMe } from "../auth/ExpensesGuard";
import { useMobileTopbar } from "./MobileShell";
import { setViewPreference } from "./uiMode";

// Aba "Mais": demais funções do colaborador, conta e troca de versão.
// Dados bancários ficam só na versão completa.
export default function MobileMorePage() {
  useMobileTopbar("Mais");
  const qc = useQueryClient();
  const user = useExpensesMe().data?.user;

  const openDesktop = (path: string) => {
    setViewPreference("desktop");
    window.location.href = `/app/expenses${path}`;
  };
  const onLogout = async () => {
    await logout();
    qc.removeQueries({ queryKey: ["expenses"] });
    window.location.href = "/app/expenses/login?logout=1";
  };

  return (
    <>
      {user && (
        <div className="exm-card d-flex align-items-center gap-3">
          <span className="material-symbols-outlined" style={{ fontSize: 40 }}>account_circle</span>
          <div className="min-w-0">
            <div className="fw-semibold text-truncate">{user.fullName || user.username}</div>
            <div className="exm-card__meta text-truncate">{user.email || user.username}</div>
          </div>
        </div>
      )}

      <div className="exm-list">
        <Item icon="timeline" label="Histórico" to="/expenses/m/history" />
        <Item icon="password" label="Trocar senha" to="/expenses/m/change-password" />
        <Item icon="account_balance" label="Meus dados bancários" hint="Abre a versão completa" onClick={() => openDesktop("/profile")} external />
      </div>

      <div className="exm-list">
        <Item icon="desktop_windows" label="Versão completa" onClick={() => openDesktop("")} external />
        <Item icon="logout" label="Sair" onClick={onLogout} />
      </div>
    </>
  );
}

function Item({ icon, label, hint, to, onClick, external }: {
  icon: string; label: string; hint?: string; to?: string; onClick?: () => void; external?: boolean;
}) {
  const content: ReactNode = (
    <>
      <span className="material-symbols-outlined">{icon}</span>
      <span className="exm-list__label">
        {label}
        {hint && <span className="d-block exm-list__hint">{hint}</span>}
      </span>
      <span className="material-symbols-outlined">{external ? "open_in_new" : "chevron_right"}</span>
    </>
  );
  return to
    ? <Link to={to} className="exm-list__item">{content}</Link>
    : <button type="button" className="exm-list__item" onClick={onClick}>{content}</button>;
}
