import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, Spinner, Table } from "react-bootstrap";
import { deletePdfHistory, listPdfHistory, pdfHistoryDownloadUrl } from "../api/pdfHistory";

function fmtDateTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("pt-BR");
}

export default function PdfHistoryPage() {
  const orderId = Number(useParams().id);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["pdf-history", orderId],
    queryFn: () => listPdfHistory(orderId)
  });
  const [actionError, setActionError] = useState<string | null>(null);

  const mDelete = useMutation({
    mutationFn: (entryId: number) => deletePdfHistory(orderId, entryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pdf-history", orderId] }),
    onError: (e) => setActionError((e as Error).message)
  });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar histórico: {(error as Error).message}</Alert>;
  }

  const entries = data?.pdfHistory ?? [];
  const order = data?.order;

  return (
    <Card>
      <Card.Header>
        Histórico de PDFs — {order?.service_order_code || order?.title || `OS #${orderId}`}
        <Link to="/" className="ms-2 small">← Ordens</Link>
      </Card.Header>
      {actionError && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead><tr><th>Arquivo</th><th>Status</th><th>Gerado em</th><th className="text-end">Ações</th></tr></thead>
        <tbody>
          {entries.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhum PDF gerado.</td></tr>}
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.original_name || e.file_name || `#${e.id}`}</td>
              <td>{e.status || "—"}</td>
              <td>{fmtDateTime(e.created_at)}</td>
              <td className="text-end">
                <a className="btn btn-sm btn-outline-primary me-2" href={pdfHistoryDownloadUrl(orderId, e.id)} target="_blank" rel="noreferrer">Baixar</a>
                <Button size="sm" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm("Excluir este registro de PDF?")) mDelete.mutate(e.id); }}>Excluir</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
