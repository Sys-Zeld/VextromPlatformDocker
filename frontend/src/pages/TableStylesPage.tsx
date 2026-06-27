import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Spinner, Table } from "react-bootstrap";
import { listTableStyles, resetTableStyle } from "../api/tableStyles";

export default function TableStylesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["table-styles"], queryFn: listTableStyles });
  const [actionError, setActionError] = useState<string | null>(null);

  const mReset = useMutation({
    mutationFn: resetTableStyle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["table-styles"] }),
    onError: (e) => setActionError((e as Error).message)
  });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar estilos: {(error as Error).message}</Alert>;
  }

  const types = data?.types ?? [];

  return (
    <Card>
      <Card.Header>Estilos padrão das tabelas</Card.Header>
      {actionError && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead><tr><th>Tabela</th><th>Estilo</th><th className="text-end">Ações</th></tr></thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.key}>
              <td>{t.label}</td>
              <td>{t.hasCustomStyle ? <Badge bg="info">Customizado</Badge> : <Badge bg="secondary">Padrão</Badge>}</td>
              <td className="text-end">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={!t.hasCustomStyle || mReset.isPending}
                  onClick={() => { if (confirm(`Restaurar o estilo padrão de "${t.label}"?`)) mReset.mutate(t.key); }}
                >Restaurar padrão</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card.Footer className="text-muted small">
        A estilização por IA (instrução → CSS) com pré-visualização continua no editor legado de cada tabela.
      </Card.Footer>
    </Card>
  );
}
