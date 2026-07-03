import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Accordion, Alert, Badge, Button, Form, Spinner, Table } from "react-bootstrap";
import IconAction from "./IconAction";
import {
  deleteAlber,
  deleteEventLog,
  deleteUpsMeasures,
  getUpsData,
  importAlber,
  importEventLog,
  importUpsMeasures
} from "../api/upsData";

function ImportControl(props: { accept: string; hint: string; disabled: boolean; busy: boolean; onImport: (f: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="d-flex gap-2 align-items-end flex-wrap mb-3">
      <div style={{ minWidth: 260 }}>
        <Form.Label className="small mb-1">{props.hint}</Form.Label>
        <Form.Control ref={ref} type="file" size="sm" accept={props.accept} disabled={props.disabled} onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
      </div>
      <Button size="sm" disabled={props.disabled || props.busy || !file} onClick={() => { if (file) { props.onImport(file); setFile(null); if (ref.current) ref.current.value = ""; } }}>
        {props.busy ? <><Spinner animation="border" size="sm" className="me-1" /> Importando…</> : "Importar"}
      </Button>
    </div>
  );
}

export default function UpsDataPanel(props: { orderId: number }) {
  const { orderId } = props;
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["ups-data", orderId], queryFn: () => getUpsData(orderId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ups-data", orderId] });
  const [err, setErr] = useState<string | null>(null);
  const onError = (e: unknown) => setErr((e as Error).message);

  const mImportAlber = useMutation({ mutationFn: (f: File) => importAlber(orderId, f), onSuccess: () => { setErr(null); invalidate(); }, onError });
  const mDeleteAlber = useMutation({ mutationFn: (id: number) => deleteAlber(orderId, id), onSuccess: invalidate, onError });
  const mImportUps = useMutation({ mutationFn: (f: File) => importUpsMeasures(orderId, f), onSuccess: () => { setErr(null); invalidate(); }, onError });
  const mDeleteUps = useMutation({ mutationFn: (id: number) => deleteUpsMeasures(orderId, id), onSuccess: invalidate, onError });
  const mImportEvt = useMutation({ mutationFn: (f: File) => importEventLog(orderId, f), onSuccess: () => { setErr(null); invalidate(); }, onError });
  const mDeleteEvt = useMutation({ mutationFn: (id: number) => deleteEventLog(orderId, id), onSuccess: invalidate, onError });

  if (isLoading) return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error || !data) return <Alert variant="danger">Falha ao carregar dados UPS: {(error as Error)?.message}</Alert>;

  const { alber, upsMeasures, eventLogs, locked } = data;

  return (
    <div className="d-flex flex-column gap-2">
      {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
      <Accordion alwaysOpen defaultActiveKey={["alber", "ups", "evt"]}>
        {/* Leituras Alber */}
        <Accordion.Item eventKey="alber">
          <Accordion.Header>Leituras Alber <Badge bg="light" text="dark" className="ms-2">{alber.length}</Badge></Accordion.Header>
          <Accordion.Body>
            {!locked && <ImportControl accept=".csv,text/csv" hint="Arquivo CSV do Alber" disabled={locked} busy={mImportAlber.isPending} onImport={(f) => mImportAlber.mutate(f)} />}
            <Table striped responsive hover size="sm" className="mb-0 align-middle">
              <thead><tr><th>Local</th><th>Bateria</th><th>Modelo</th><th>Strings</th><th>Células</th><th>Arquivo</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {alber.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma leitura Alber importada.</td></tr>}
                {alber.map((a) => (
                  <tr key={a.id}>
                    <td>{a.location_name || "—"}</td><td>{a.battery_name || "—"}</td><td>{a.model_number || "—"}</td>
                    <td>{a.total_strings || "—"}</td><td>{a.cell_count}</td><td className="small text-muted">{a.nome_arquivo || "—"}</td>
                    <td className="text-end">{!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteAlber.isPending} onClick={() => { if (confirm("Excluir esta leitura Alber?")) mDeleteAlber.mutate(a.id); }} />}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Accordion.Body>
        </Accordion.Item>

        {/* Medições UPS */}
        <Accordion.Item eventKey="ups">
          <Accordion.Header>Medições UPS <Badge bg="light" text="dark" className="ms-2">{upsMeasures.length}</Badge></Accordion.Header>
          <Accordion.Body>
            {!locked && <ImportControl accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hint="Arquivo Measures.xls/.xlsx" disabled={locked} busy={mImportUps.isPending} onImport={(f) => mImportUps.mutate(f)} />}
            <Table striped responsive hover size="sm" className="mb-0 align-middle">
              <thead><tr><th>Título</th><th>Tag</th><th>Seções</th><th>Linhas</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {upsMeasures.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhuma medição UPS importada.</td></tr>}
                {upsMeasures.map((u) => (
                  <tr key={u.id}>
                    <td>{u.title || "—"}</td><td><code className="small">@mesuaresUPS={u.seq_id}</code></td><td>{u.sections}</td><td>{u.rows}</td>
                    <td className="text-end">{!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteUps.isPending} onClick={() => { if (confirm("Excluir estas medições UPS?")) mDeleteUps.mutate(u.id); }} />}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Accordion.Body>
        </Accordion.Item>

        {/* Event Logs */}
        <Accordion.Item eventKey="evt">
          <Accordion.Header>Event Logs <Badge bg="light" text="dark" className="ms-2">{eventLogs.length}</Badge></Accordion.Header>
          <Accordion.Body>
            {!locked && <ImportControl accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hint="Arquivo Event Log.xls/.xlsx" disabled={locked} busy={mImportEvt.isPending} onImport={(f) => mImportEvt.mutate(f)} />}
            <Table striped responsive hover size="sm" className="mb-0 align-middle">
              <thead><tr><th>Título</th><th>Tag</th><th>Seções</th><th>Linhas</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {eventLogs.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum event log importado.</td></tr>}
                {eventLogs.map((e) => (
                  <tr key={e.id}>
                    <td>{e.title || "—"}</td><td><code className="small">@eventlogUPS={e.seq_id}</code></td><td>{e.sections}</td><td>{e.rows}</td>
                    <td className="text-end">{!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteEvt.isPending} onClick={() => { if (confirm("Excluir este event log?")) mDeleteEvt.mutate(e.id); }} />}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
