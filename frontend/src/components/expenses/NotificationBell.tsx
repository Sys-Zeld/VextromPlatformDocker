import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listNotifications } from "../../api/expenses";

// Sino da topbar do módulo de Despesas: contador de notificações não lidas.
export default function NotificationBell() {
  const { data } = useQuery({
    queryKey: ["expenses", "notifications"],
    queryFn: listNotifications,
    refetchInterval: 60_000
  });
  const unread = data?.unread ?? 0;

  return (
    <Link
      to="/expenses/notifications"
      className="btn btn-sm btn-outline-secondary position-relative"
      title={unread ? `${unread} notificação(ões) não lida(s)` : "Notificações"}
      aria-label="Notificações"
    >
      <span className="material-symbols-outlined align-middle">notifications</span>
      {unread > 0 && (
        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
