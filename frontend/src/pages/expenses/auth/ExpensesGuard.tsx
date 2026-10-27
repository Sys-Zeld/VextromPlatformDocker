import { useQuery } from "@tanstack/react-query";
import { Spinner } from "react-bootstrap";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getMe } from "../../../api/expenses";

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
  if (me.data.user.mustChangePassword && location.pathname !== "/expenses/change-password") {
    return <Navigate to="/expenses/change-password" replace />;
  }
  return <Outlet />;
}
