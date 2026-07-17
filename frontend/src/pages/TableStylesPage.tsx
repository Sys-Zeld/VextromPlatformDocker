import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Spinner } from "react-bootstrap";
import { confirmDialog } from "../components/ConfirmDialog";
import TableStyleEditorModal from "../components/TableStyleEditorModal";
import { listTableStyles, resetTableStyle, TableStyleType } from "../api/tableStyles";

const DESCRIPTIONS: Record<string, string> = {
  timesheet: "Datas e horários de entrada e saída da equipe.",
  techteam: "Composição da equipe, função e empresa.",
  equipment: "Ficha técnica dos equipamentos vinculados à OS.",
  components: "Peças substituídas, necessárias e disponíveis.",
  upsmeasures: "Medições importadas dos equipamentos UPS.",
  eventlog: "Eventos e alarmes importados dos equipamentos UPS."
};

export default function TableStylesPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["table-styles"], queryFn: listTableStyles });
  const [selectedTable, setSelectedTable] = useState<TableStyleType | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["table-styles"] });
  const mReset = useMutation({
    mutationFn: resetTableStyle,
    onSuccess: refresh,
    onError: (mutationError) => setActionError((mutationError as Error).message)
  });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando...</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar estilos: {(error as Error).message}</Alert>;
  }

  const types = data?.types ?? [];

  return (
    <>
      <div className="d-flex flex-column gap-3">
        <Card>
          <Card.Body className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
            <div>
              <h2 className="h5 mb-1">Ajuste de layout das tabelas</h2>
              <p className="text-muted mb-0 small">
                Personalize com IA o visual padrão usado no preview e nos PDFs dos relatórios.
              </p>
            </div>
            <Badge bg="primary">{types.length} tipos</Badge>
          </Card.Body>
        </Card>

        {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

        <div className="row g-3">
          {types.map((table) => (
            <div className="col-md-6 col-xl-4" key={table.key}>
              <Card className="h-100 table-style-card">
                <Card.Body className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <h3 className="h6 mb-1">{table.label}</h3>
                      <p className="text-muted small mb-0">{DESCRIPTIONS[table.key] || "Tabela do relatório."}</p>
                    </div>
                    {table.hasCustomStyle
                      ? <Badge bg="success">Customizado</Badge>
                      : <Badge bg="secondary">Padrão</Badge>}
                  </div>
                  <div className="d-flex gap-2 mt-auto">
                    <Button size="sm" className="flex-grow-1" onClick={() => setSelectedTable(table)}>
                      Ajustar com IA
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={!table.hasCustomStyle || mReset.isPending}
                      onClick={async () => {
                        if (await confirmDialog(`Restaurar o estilo padrão de "${table.label}"?`)) mReset.mutate(table.key);
                      }}
                    >
                      Restaurar
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <TableStyleEditorModal
        table={selectedTable}
        onHide={() => setSelectedTable(null)}
        onSaved={refresh}
      />
    </>
  );
}
