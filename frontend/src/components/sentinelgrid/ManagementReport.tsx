import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, ProgressBar, Row, Spinner, Table } from "react-bootstrap";
import { listClients } from "../../api/sentinelgrid/clients";
import { listSites } from "../../api/sentinelgrid/sites";
import { listEquipment } from "../../api/sentinelgrid/equipment";
import { listTechnicians } from "../../api/sentinelgrid/technicians";
import { equipmentLabel } from "../../utils/format";
import {
  exportReport, getReport,
  type SgReportColumn, type SgReportFilters, type SgReportFormat,
  type SgReportKind, type SgReportRow, type SgReportSummary, type SgReportTask
} from "../../api/sentinelgrid/reports";

// Tela única dos relatórios gerenciais: os três relatórios devolvem o mesmo
// documento, mudando só o agrupamento — então compartilham filtros, KPIs,
// resumo, cronograma e exportação.

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const TYPE_OPTIONS = [
  { value: "preventiva", label: "Preventiva" },
  { value: "preventiva_com_parada", label: "Preventiva c/ parada" },
  { value: "preditiva", label: "Preditiva" },
  { value: "corretiva", label: "Corretiva" },
  { value: "inspecao", label: "Inspeção" }
];

const rateVariant = (rate: number | null) =>
  rate === null ? "secondary" : rate >= 90 ? "success" : rate >= 70 ? "warning" : "danger";

const inColumn = (task: SgReportTask, column: SgReportColumn) =>
  task.startDate <= column.to && task.endDate >= column.from;

function Kpi({ label, value, variant }: { label: string; value: number | string; variant?: string }) {
  return (
    <Card className="text-center h-100">
      <Card.Body className="py-2">
        <div className={`fs-4 fw-bold${variant ? ` text-${variant}` : ""}`}>{value}</div>
        <div className="small text-muted">{label}</div>
      </Card.Body>
    </Card>
  );
}

function SummaryCells({ summary }: { summary: SgReportSummary }) {
  return (
    <>
      <td className="text-center">{summary.total}</td>
      <td className="text-center text-success">{summary.concluidas}</td>
      <td className="text-center">{summary.pendentes}</td>
      <td className="text-center">{summary.atrasadas ? <Badge bg="danger">{summary.atrasadas}</Badge> : 0}</td>
      <td className="text-center text-muted">{summary.canceladas}</td>
      <td className="text-center">{summary.dias}</td>
      <td style={{ minWidth: 140 }}>
        {summary.conclusaoRate === null ? (
          <span className="text-muted small">—</span>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <ProgressBar now={summary.conclusaoRate} variant={rateVariant(summary.conclusaoRate)}
              style={{ height: 8, flexGrow: 1 }} />
            <span className={`small fw-semibold text-${rateVariant(summary.conclusaoRate)}`}>
              {summary.conclusaoRate}%
            </span>
          </div>
        )}
      </td>
    </>
  );
}

export default function ManagementReport({ kind, showTechnician = false }: {
  kind: SgReportKind;
  showTechnician?: boolean;
}) {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<number | "">("");
  const [clientId, setClientId] = useState<number | "">("");
  const [siteId, setSiteId] = useState<number | "">("");
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [technicianId, setTechnicianId] = useState<number | "">("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [exporting, setExporting] = useState<SgReportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const filters = useMemo<SgReportFilters>(() => ({
    year,
    month: month === "" ? null : month,
    clientId, siteId, equipmentId,
    technicianId: showTechnician ? technicianId : "",
    maintenanceType,
    includeCancelled
  }), [year, month, clientId, siteId, equipmentId, technicianId, maintenanceType, includeCancelled, showTechnician]);

  const report = useQuery({
    queryKey: ["sentinelgrid", "reports", kind, filters],
    queryFn: () => getReport(kind, filters),
    placeholderData: keepPreviousData
  });

  const clients = useQuery({
    queryKey: ["sentinelgrid", "clients", "reports"],
    queryFn: () => listClients({ pageSize: 500 })
  });
  const sites = useQuery({
    queryKey: ["sentinelgrid", "sites", "reports", clientId],
    queryFn: () => listSites({ clientId: clientId === "" ? undefined : clientId, pageSize: 500 }),
    placeholderData: keepPreviousData
  });
  const equipments = useQuery({
    queryKey: ["sentinelgrid", "equipment", "reports", clientId],
    queryFn: () => listEquipment({ clientId: clientId === "" ? undefined : clientId, pageSize: 500 }),
    placeholderData: keepPreviousData
  });
  const technicians = useQuery({
    queryKey: ["sentinelgrid", "technicians"],
    queryFn: listTechnicians,
    enabled: showTechnician
  });

  const availableEquipment = (equipments.data?.equipment ?? [])
    .filter((item) => siteId === "" || Number(item.site_id) === siteId);

  const onExport = async (format: SgReportFormat) => {
    setExporting(format);
    setExportError(null);
    try {
      await exportReport(kind, filters, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Falha ao exportar o relatório.");
    } finally {
      setExporting(null);
    }
  };

  const openOrder = (task: SgReportTask) =>
    navigate(`/sentinelgrid/maintenance-orders?order=${task.orderId}`);

  const doc = report.data;
  const busy = Boolean(exporting);

  return (
    <div className="d-flex flex-column gap-3 sg-schedule-page">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap sg-schedule-print-header">
        <div>
          <h2 className="h5 mb-1">{doc?.title ?? "Relatório gerencial"}</h2>
          <p className="text-muted small mb-0">{doc?.subtitle ?? ""}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap sg-no-print">
          <Button variant="outline-secondary" size="sm" onClick={() => window.print()} disabled={busy}>
            <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 18 }}>print</span>
            Imprimir
          </Button>
          <Button variant="outline-danger" size="sm" onClick={() => onExport("pdf")} disabled={busy}>
            {exporting === "pdf"
              ? <Spinner animation="border" size="sm" className="me-1" />
              : <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 18 }}>picture_as_pdf</span>}
            PDF
          </Button>
          <Button variant="outline-success" size="sm" onClick={() => onExport("xlsx")} disabled={busy}>
            {exporting === "xlsx"
              ? <Spinner animation="border" size="sm" className="me-1" />
              : <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 18 }}>table_view</span>}
            Excel
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={() => onExport("csv")} disabled={busy}>
            CSV
          </Button>
        </div>
      </div>

      <Card className="sg-no-print">
        <Card.Body className="d-flex flex-wrap align-items-end gap-3">
          <Form.Group>
            <Form.Label className="small mb-1">Ano</Form.Label>
            <div className="d-flex gap-1" style={{ width: 150 }}>
              <Button size="sm" variant="outline-secondary" onClick={() => setYear((v) => v - 1)}>‹</Button>
              <Form.Control size="sm" type="number" value={year}
                onChange={(e) => setYear(Number(e.target.value) || currentYear)} />
              <Button size="sm" variant="outline-secondary" onClick={() => setYear((v) => v + 1)}>›</Button>
            </div>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Mês</Form.Label>
            <Form.Select size="sm" style={{ minWidth: 150 }} value={month}
              onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Ano inteiro</option>
              {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Cliente</Form.Label>
            <Form.Select size="sm" style={{ minWidth: 200 }} value={clientId}
              onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : ""); setSiteId(""); setEquipmentId(""); }}>
              <option value="">Todos</option>
              {(clients.data?.clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Site</Form.Label>
            <Form.Select size="sm" style={{ minWidth: 170 }} value={siteId}
              onChange={(e) => { setSiteId(e.target.value ? Number(e.target.value) : ""); setEquipmentId(""); }}>
              <option value="">Todos</option>
              {(sites.data?.sites ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Equipamento</Form.Label>
            <Form.Select size="sm" style={{ minWidth: 190 }} value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todos</option>
              {availableEquipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {equipmentLabel(item.tag, item.client_name) || `#${item.id}`}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {showTechnician && (
            <Form.Group>
              <Form.Label className="small mb-1">Técnico</Form.Label>
              <Form.Select size="sm" style={{ minWidth: 180 }} value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todos</option>
                {(technicians.data?.technicians ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group>
            <Form.Label className="small mb-1">Tipo</Form.Label>
            <Form.Select size="sm" style={{ minWidth: 180 }} value={maintenanceType}
              onChange={(e) => setMaintenanceType(e.target.value)}>
              <option value="">Todos</option>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Check className="mb-1" type="checkbox" id={`cancel-${kind}`} label="Incluir canceladas"
            checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />
        </Card.Body>
      </Card>

      {exportError && <Alert variant="danger" className="sg-no-print mb-0">{exportError}</Alert>}
      {report.error && <Alert variant="danger">{(report.error as Error).message}</Alert>}

      {report.isLoading ? (
        <div className="text-muted"><Spinner animation="border" size="sm" /> Gerando relatório...</div>
      ) : !doc || doc.rows.length === 0 ? (
        <Alert variant="secondary">Nenhuma ordem de manutenção encontrada para os filtros e o período selecionado.</Alert>
      ) : (
        <>
          <Row xs={2} md={4} lg={6} className="g-2">
            <Col><Kpi label={doc.groupLabel} value={doc.totals.linhas} /></Col>
            <Col><Kpi label="OMs no período" value={doc.totals.total} /></Col>
            <Col><Kpi label="Concluídas" value={doc.totals.concluidas} variant="success" /></Col>
            <Col><Kpi label="Pendentes" value={doc.totals.pendentes} /></Col>
            <Col><Kpi label="Atrasadas" value={doc.totals.atrasadas} variant="danger" /></Col>
            <Col>
              <Kpi label="Conclusão"
                value={doc.totals.conclusaoRate === null ? "—" : `${doc.totals.conclusaoRate}%`}
                variant={rateVariant(doc.totals.conclusaoRate)} />
            </Col>
          </Row>

          <Card>
            <Card.Header>Resumo gerencial</Card.Header>
            <Card.Body className="p-0">
              <div style={{ overflowX: "auto" }}>
                <Table size="sm" hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>{doc.groupLabel}</th>
                      <th className="text-center">Total</th>
                      <th className="text-center">Concl.</th>
                      <th className="text-center">Pend.</th>
                      <th className="text-center">Atras.</th>
                      <th className="text-center">Canc.</th>
                      <th className="text-center">Dias</th>
                      <th>Conclusão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.rows.map((row: SgReportRow) => (
                      <tr key={row.key}>
                        <td>
                          <div className="fw-semibold">{row.title}</div>
                          <div className="small text-muted">{row.subtitle}</div>
                        </td>
                        <SummaryCells summary={row.summary} />
                      </tr>
                    ))}
                    <tr className="table-light fw-bold">
                      <td>TOTAL</td>
                      <SummaryCells summary={doc.totals} />
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          <Card className="sg-schedule-sheet-card">
            <Card.Header>Cronograma {doc.period.label}</Card.Header>
            <div className="sg-schedule-scroll">
              <table className={`sg-schedule-sheet${doc.period.granularity === "day" ? " sg-schedule-sheet--day" : ""}`}>
                <thead>
                  <tr>
                    <th className="sg-schedule-sheet__identity">{doc.groupLabel}</th>
                    {doc.columns.map((column) => <th key={column.key}>{column.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map((row) => (
                    <tr key={row.key}>
                      <th className="sg-schedule-sheet__identity">
                        <span>{row.title}</span><small>{row.subtitle}</small>
                      </th>
                      {doc.columns.map((column) => (
                        <td key={column.key}>
                          {row.tasks.filter((task) => inColumn(task, column)).map((task) => (
                            <button
                              key={`${task.key}-${column.key}`}
                              type="button"
                              className={`sg-schedule-task sg-schedule-task--${task.priority} is-clickable`}
                              onClick={() => openOrder(task)}
                              title={`${task.orderNumber} · ${task.label} · ${task.statusLabel}`}
                            >
                              <span className="sg-schedule-task__date">{task.startDate.slice(8, 10)}</span>
                              <span className="sg-schedule-task__title">{task.orderNumber}</span>
                            </button>
                          ))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
