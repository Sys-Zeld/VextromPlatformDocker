import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { NotificationEntry, listNotifications, markNotificationsRead } from "../../../api/expenses";
import { errorMessage, formatDateTime } from "../shared";
import { useMobileTopbar } from "./MobileShell";

// Notificações; tocar marca como lida e abre o relatório na versão mobile.
export default function MobileNotificationsPage() {
  useMobileTopbar("Notificações");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ["expenses", "notifications"], queryFn: listNotifications });
  const m = useMutation({
    mutationFn: (id?: number) => markNotificationsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", "notifications"] })
  });

  const open = (n: NotificationEntry) => {
    if (!n.read_at) m.mutate(n.id);
    if (n.report_id) navigate(`/expenses/m/reports/${n.report_id}`);
  };

  if (isLoading) return <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error) return <Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert>;
  const notifications = data?.notifications ?? [];

  return (
    <>
      {(data?.unread ?? 0) > 0 && (
        <Button variant="outline-secondary" size="sm" className="align-self-end" disabled={m.isPending} onClick={() => m.mutate(undefined)}>
          Marcar todas como lidas
        </Button>
      )}
      {notifications.length === 0 && (
        <div className="text-center text-muted py-5">
          <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: 48 }}>notifications_off</span>
          Nenhuma notificação.
        </div>
      )}
      {notifications.map((n) => (
        <button key={n.id} type="button" className={`exm-card text-start w-100${n.read_at ? "" : " exm-unread"}`} onClick={() => open(n)}>
          <div className="exm-card__row">
            <span className="exm-card__meta">{n.report_number || ""}</span>
            <span className="exm-card__meta">{formatDateTime(n.created_at)}</span>
          </div>
          <div className={`exm-card__title${n.read_at ? " fw-normal" : ""}`}>
            {!n.read_at && <Badge bg="primary" className="me-2">Nova</Badge>}{n.title}
          </div>
          <div className="exm-card__meta" style={{ whiteSpace: "pre-line" }}>{n.message}</div>
        </button>
      ))}
    </>
  );
}
