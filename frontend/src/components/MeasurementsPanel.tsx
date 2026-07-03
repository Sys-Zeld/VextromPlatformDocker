import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accordion, Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { Measurement, deleteMeasurement, listMeasurements, saveMeasurement } from "../api/measurements";

function MeasurementTableCard(props: { orderId: number; measurement: Measurement; locked: boolean; onChanged: () => void }) {
  const { orderId, measurement, locked, onChanged } = props;
  const [title, setTitle] = useState(measurement.title);
  const [columns, setColumns] = useState<string[]>(measurement.columns.length ? measurement.columns : ["Teste", "Valor", "Observações"]);
  const [rows, setRows] = useState<string[][]>(measurement.rows.length ? measurement.rows : [[]]);
  const [notes, setNotes] = useState(measurement.notes);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(measurement.title);
    setColumns(measurement.columns.length ? measurement.columns : ["Teste", "Valor", "Observações"]);
    setRows(measurement.rows.length ? measurement.rows : [[]]);
    setNotes(measurement.notes);
  }, [measurement.id, measurement.title, measurement.columns, measurement.rows, measurement.notes]);

  const onError = (e: unknown) => setErr((e as Error).message);
  const mSave = useMutation({
    mutationFn: () => saveMeasurement(orderId, { measurementId: measurement.id, title, columns, rows, notes }),
    onSuccess: () => { setErr(null); onChanged(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: () => deleteMeasurement(orderId, measurement.id), onSuccess: onChanged, onError });

  const cell = (r: number, c: number) => rows[r]?.[c] ?? "";
  const setCell = (r: number, c: number, v: string) => setRows((prev) => prev.map((row, ri) => {
    if (ri !== r) return row;
    const next = [...row];
    while (next.length < columns.length) next.push("");
    next[c] = v;
    return next;
  }));
  const setColumn = (c: number, v: string) => setColumns((prev) => prev.map((x, i) => (i === c ? v : x)));
  const addColumn = () => { setColumns((prev) => [...prev, `Coluna ${prev.length + 1}`]); setRows((prev) => prev.map((row) => [...row, ""])); };
  const removeColumn = (c: number) => { setColumns((prev) => prev.filter((_, i) => i !== c)); setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c))); };
  const addRow = () => setRows((prev) => [...prev, columns.map(() => "")]);
  const removeRow = (r: number) => setRows((prev) => prev.filter((_, i) => i !== r));

  return (
    <Card className="border-0">
      <Card.Header className="d-flex justify-content-between align-items-center gap-2 bg-transparent border-0 px-0">
        <Form.Control size="sm" value={title} disabled={locked} onChange={(e) => setTitle(e.target.value)} placeholder="Título da tabela" style={{ maxWidth: 360 }} />
        <code className="small text-muted">@ensaios={measurement.seq_id}</code>
      </Card.Header>
      <Card.Body className="px-0">
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        <div className="table-responsive">
          <Table bordered size="sm" className="align-middle mb-2">
            <thead>
              <tr>
                {columns.map((col, c) => (
                  <th key={c} style={{ minWidth: 120 }}>
                    <div className="d-flex gap-1 align-items-center">
                      <Form.Control size="sm" value={col} disabled={locked} onChange={(e) => setColumn(c, e.target.value)} />
                      {!locked && columns.length > 1 && <Button size="sm" variant="outline-danger" title="Remover coluna" onClick={() => removeColumn(c)}>×</Button>}
                    </div>
                  </th>
                ))}
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((_, r) => (
                <tr key={r}>
                  {columns.map((__, c) => (
                    <td key={c}><Form.Control size="sm" value={cell(r, c)} disabled={locked} onChange={(e) => setCell(r, c, e.target.value)} /></td>
                  ))}
                  <td className="text-center">
                    {!locked && rows.length > 1 && <Button size="sm" variant="outline-danger" title="Remover linha" onClick={() => removeRow(r)}>×</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {!locked && (
          <div className="d-flex gap-2 mb-3">
            <Button size="sm" variant="outline-secondary" onClick={addColumn}>+ Coluna</Button>
            <Button size="sm" variant="outline-secondary" onClick={addRow}>+ Linha</Button>
          </div>
        )}
        <Form.Label className="small text-muted mb-1">Observações</Form.Label>
        <Form.Control as="textarea" rows={2} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} />
      </Card.Body>
      {!locked && (
        <Card.Footer className="d-flex justify-content-end gap-2 bg-transparent border-0 px-0">
          <Button size="sm" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm("Excluir esta tabela de ensaios?")) mDelete.mutate(); }}>Excluir</Button>
          <Button size="sm" variant="outline-primary" disabled={mSave.isPending} onClick={() => mSave.mutate()}>{mSave.isPending ? "Salvando…" : "Salvar tabela"}</Button>
        </Card.Footer>
      )}
    </Card>
  );
}

export default function MeasurementsPanel(props: { orderId: number }) {
  const { orderId } = props;
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["measurements", orderId], queryFn: () => listMeasurements(orderId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["measurements", orderId] });
  const [actionError, setActionError] = useState<string | null>(null);

  const mCreate = useMutation({
    mutationFn: () => saveMeasurement(orderId, { title: "Ensaios/Medições", columns: ["Teste", "Valor", "Observações"], rows: [["", "", ""]], notes: "" }),
    onSuccess: invalidate,
    onError: (e: unknown) => setActionError((e as Error).message)
  });

  if (isLoading) return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error || !data) return <Alert variant="danger">Falha ao carregar ensaios: {(error as Error)?.message}</Alert>;

  const { measurements, locked } = data;

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex justify-content-between align-items-center">
        <span className="text-muted small">Tabelas de ensaios/medições — use <code>@ensaios=ID</code> num capítulo do relatório para renderizar. <Badge bg="light" text="dark">{measurements.length}</Badge></span>
        {!locked && <Button size="sm" disabled={mCreate.isPending} onClick={() => mCreate.mutate()}>{mCreate.isPending ? "Criando…" : "Nova tabela"}</Button>}
      </div>
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      {measurements.length === 0 && <p className="text-muted">Nenhuma tabela de ensaios cadastrada.</p>}
      {measurements.length > 0 && (
        <Accordion alwaysOpen={false} className="mt-1">
          {measurements.map((m) => (
            <Accordion.Item eventKey={String(m.id)} key={m.id}>
              <Accordion.Header>
                <span className="fw-semibold me-2">{m.title || "Sem título"}</span>
                <Badge bg="light" text="dark" className="me-2"><code>@ensaios={m.seq_id}</code></Badge>
                <span className="text-muted small">{m.columns.length} coluna(s) × {m.rows.length} linha(s)</span>
              </Accordion.Header>
              <Accordion.Body>
                <MeasurementTableCard orderId={orderId} measurement={m} locked={locked} onChanged={invalidate} />
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </div>
  );
}
