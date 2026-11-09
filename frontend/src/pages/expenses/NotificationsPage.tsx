import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, ListGroup, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { NotificationEntry, listNotifications, markNotificationsRead } from "../../api/expenses";
import { PageHeader, errorMessage, formatDateTime, useExpensesMeta } from "./shared";

// Eventos de envio vão para a gestão; os demais, para o solicitante.
const MANAGER_EVENTS = new Set(["SUBMITTED", "RESUBMITTED"]);

export default function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const meta = useExpensesMeta();
  const { data, isLoading, error } = useQuery({ queryKey: ["expenses", "notifications"], queryFn: listNotifications });
  const m = useMutation({
    mutationFn: (id?: number) => markNotificationsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses", "notifications"] })
  });

  const open = (n: NotificationEntry) => {
    if (!n.read_at) m.mutate(n.id);
    if (!n.report_id) return;
    const admin = MANAGER_EVENTS.has(n.event) && meta.data?.actor.canManage;
    navigate(admin ? `/expenses/admin/reports/${n.report_id}` : `/expenses/reports/${n.report_id}`);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Notificações"
        actions={data?.unread ? <Button size="sm" variant="outline-secondary" onClick={() => m.mutate(undefined)}>Marcar todas como lidas</Button> : undefined}
      />
      <Card>
        {isLoading ? <Card.Body><Spinner animation="border" size="sm" /></Card.Body> : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (data?.notifications ?? []).length === 0 ? (
          <Card.Body className="text-muted">Nenhuma notificação.</Card.Body>
        ) : (
          <ListGroup variant="flush">
            {(data?.notifications ?? []).map((n) => (
              <ListGroup.Item key={n.id} action onClick={() => open(n)} className={n.read_at ? "" : "fw-semibold"}>
                <div className="d-flex justify-content-between gap-2">
                  <span>{!n.read_at && <Badge bg="primary" className="me-2">Nova</Badge>}{n.title}</span>
                  <small className="text-muted text-nowrap">{formatDateTime(n.created_at)}</small>
                </div>
                <div className="small text-muted fw-normal" style={{ whiteSpace: "pre-line" }}>{n.message}</div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card>
    </div>
  );
}
