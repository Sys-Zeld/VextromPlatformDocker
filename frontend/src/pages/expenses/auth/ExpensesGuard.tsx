import { useQuery } from "@tanstack/react-query";
import { Spinner } from "react-bootstrap";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getMe } from "../../../api/expenses";
import { isMobilePath, prefersMobile, toMobilePath } from "../mobile/uiMode";

// Sessão do módulo (login próprio). Sem sessão, o cliente HTTP já leva à tela
// de login; com senha provisória, só a troca de senha fica acessível.
export function useExpensesMe() {
  return useQuery({ queryKey: ["expenses", "me"], queryFn: getMe, retry: false, staleTime: 60_000 });
}

export default function ExpensesGuard() {
  const location = useLocation();
  const me = useExpensesMe();

  if (me.isLoading) {
    return <div className="d-flex align-items-center gap-2 text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (!me.data) return <Navigate to={`/expenses/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  const mobile = prefersMobile();
  if (me.data.user.mustChangePassword) {
    const changePath = mobile ? "/expenses/m/change-password" : "/expenses/change-password";
    return location.pathname === changePath ? <Outlet /> : <Navigate to={changePath} replace />;
  }
  // Celular: navegações internas (ex.: depois do login) seguem a decisão do servidor.
  if (mobile && !isMobilePath(location.pathname)) {
    return <Navigate to={toMobilePath(location.pathname)} replace />;
  }
  return <Outlet />;
}
