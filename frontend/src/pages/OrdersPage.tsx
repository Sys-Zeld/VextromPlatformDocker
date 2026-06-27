import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Spinner, Table } from "react-bootstrap";
import { Order, deleteOrder, listOrders } from "../api/orders";
import { useState } from "react";

const STATUS_VARIANT: Record<string, string> = {
  draft: "secondary",
  valid: "info",
  in_progress: "primary",
  waiting_review: "warning",
  approved: "success",
  issued: "success",
  closed: "dark",
  cancelled: "danger"
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("pt-BR");
}

export default function OrdersPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["orders"], queryFn: listOrders });
  const [actionError, setActionError] = useState<string | null>(null);

  const mDelete = useMutation({
    mutationFn: deleteOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e) => setActionError((e as Error).message)
  });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar ordens: {(error as Error).message}</Alert>;
  }

  const orders = data?.orders ?? [];

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Ordens de Serviço</span>
        <Badge bg="light" text="dark">{orders.length}</Badge>
      </Card.Header>
      {actionError && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th>OS</th><th>Título</th><th>Cliente</th><th>Site</th><th>Status</th><th>Abertura</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {orders.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma ordem de serviço.</td></tr>}
          {orders.map((o: Order) => (
            <tr key={o.id}>
              <td>{o.os_number || `#${o.id}`}</td>
              <td>{o.title || "—"}</td>
              <td>{o.customer_name}</td>
              <td>{o.site_name || "—"}</td>
              <td><Badge bg={STATUS_VARIANT[o.status || "draft"] || "secondary"}>{o.status || "draft"}</Badge></td>
              <td>{fmtDate(o.opening_date)}</td>
              <td className="text-end">
                <a className="btn btn-sm btn-outline-primary me-2" href={`/admin/report-service/orders/${o.id}`}>Abrir</a>
                <Link className="btn btn-sm btn-outline-secondary me-2" to={`/orders/${o.id}/pdf-history`}>PDFs</Link>
                <Button
                  size="sm"
                  variant="outline-danger"
                  disabled={mDelete.isPending}
                  onClick={() => { if (confirm(`Excluir a OS "${o.title || o.id}"? Esta ação remove todos os dados vinculados.`)) mDelete.mutate(o.id); }}
                >Excluir</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card.Footer className="text-muted small">
        A criação/edição completa de OS ainda usa o editor legado (botão “Abrir”). Migração do editor planejada nas próximas fases.
      </Card.Footer>
    </Card>
  );
}
