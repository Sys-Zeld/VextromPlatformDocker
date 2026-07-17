import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert, Badge, Card, Col, Form, ProgressBar, Row, Spinner, Table } from "react-bootstrap";
import { listClients } from "../../api/sentinelgrid/clients";
import { listSites } from "../../api/sentinelgrid/sites";
import { auditClient } from "../../api/sentinelgrid/audit";
import { rateVariant } from "./auditLabels";

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

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

export default function AuditorClientPage() {
  const [clientId, setClientId] = useState(0);
  const [siteId, setSiteId] = useState(0);
  const [from, setFrom] = useState(isoDate(-365));
  const [to, setTo] = useState(isoDate(0));

  const clients = useQuery({ queryKey: ["sentinelgrid", "clients"], queryFn: () => listClients({ pageSize: 500 }) });
  const sites = useQuery({
    queryKey: ["sentinelgrid", "sites", { clientId }],
    queryFn: () => listSites({ clientId: clientId || undefined, pageSize: 500 }),
    enabled: clientId > 0,
    placeholderData: keepPreviousData
  });

  const audit = useQuery({
    queryKey: ["sentinelgrid", "audit", "client", { clientId, siteId, from, to }],
    queryFn: () => auditClient(clientId, siteId || undefined, from, to),
    enabled: clientId > 0,
    placeholderData: keepPreviousData
  });

  const agg = audit.data?.aggregate;
  const rows = audit.data?.equipments || [];

  return (
    <div className="d-flex flex-column gap-3">
      <Card>
        <Card.Body className="d-flex flex-wrap align-items-end gap-3">
          <Form.Group>
            <Form.Label className="small mb-1">Cliente</Form.Label>
            <Form.Select
              size="sm"
              style={{ minWidth: 220 }}
              value={clientId}
              onChange={(e) => { setClientId(Number(e.target.value)); setSiteId(0); }}
            >
              <option value={0}>Selecione…</option>
              {(clients.data?.clients || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Site</Form.Label>
            <Form.Select
              size="sm"
              style={{ minWidth: 200 }}
              value={siteId}
              disabled={!clientId}
              onChange={(e) => setSiteId(Number(e.target.value))}
            >
              <option value={0}>Todos</option>
              {(sites.data?.sites || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">De</Form.Label>
            <Form.Control type="date" size="sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Até</Form.Label>
            <Form.Control type="date" size="sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </Form.Group>
        </Card.Body>
      </Card>

      {!clientId && <Alert variant="secondary">Selecione um cliente para auditar todos os seus equipamentos.</Alert>}
      {audit.isFetching && <Spinner animation="border" />}
      {audit.error && <Alert variant="danger">Falha ao carregar a auditoria do cliente.</Alert>}

      {clientId > 0 && agg && (
        <>
          <Row xs={2} md={4} lg={7} className="g-2">
            <Col><Kpi label="Equipamentos" value={agg.equipamentos} /></Col>
            <Col><Kpi label="Esperadas" value={agg.esperadasPassado} /></Col>
            <Col><Kpi label="Cumpridas" value={agg.cumpridas} variant="success" /></Col>
            <Col><Kpi label="No prazo" value={agg.noPrazo} variant="success" /></Col>
            <Col><Kpi label="Fora do prazo" value={agg.foraPrazo} variant="danger" /></Col>
            <Col><Kpi label="Lacunas" value={agg.lacunas} variant="danger" /></Col>
            <Col>
              <Kpi
                label="Aderência"
                value={agg.adherenceRate === null ? "—" : `${agg.adherenceRate}%`}
                variant={rateVariant(agg.adherenceRate)}
              />
            </Col>
          </Row>

          <Card>
            <Card.Header>Aderência por equipamento</Card.Header>
            <Card.Body className="p-0">
              <div style={{ overflowX: "auto" }}>
                <Table size="sm" hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>TAG</th>
                      <th>Site / Área</th>
                      <th className="text-center">Esperadas</th>
                      <th className="text-center">Cumpridas</th>
                      <th className="text-center">No prazo</th>
                      <th className="text-center">Aprox.</th>
                      <th className="text-center">Fora</th>
                      <th className="text-center">Lacunas</th>
                      <th style={{ minWidth: 160 }}>Aderência</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ equipment, summary }) => {
                      const rate = summary.adherenceRate;
                      return (
                        <tr key={equipment.id}>
                          <td className="fw-semibold">{equipment.tag}</td>
                          <td className="small text-muted">{equipment.site_name} · {equipment.area_name}</td>
                          <td className="text-center">{summary.esperadasPassado}</td>
                          <td className="text-center">{summary.cumpridas}</td>
                          <td className="text-center">{summary.noPrazo}</td>
                          <td className="text-center">{summary.aproximado}</td>
                          <td className="text-center">{summary.foraPrazo ? <Badge bg="danger">{summary.foraPrazo}</Badge> : 0}</td>
                          <td className="text-center">{summary.lacunas ? <Badge bg="danger">{summary.lacunas}</Badge> : 0}</td>
                          <td>
                            {rate === null ? (
                              <span className="text-muted small">sem esperadas</span>
                            ) : (
                              <div className="d-flex align-items-center gap-2">
                                <ProgressBar
                                  now={rate}
                                  variant={rateVariant(rate)}
                                  style={{ height: 8, flexGrow: 1 }}
                                />
                                <span className={`small fw-semibold text-${rateVariant(rate)}`}>{rate}%</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <Link className="small" to={`/sentinelgrid/auditor/equipment?equipmentId=${equipment.id}`}>
                              Detalhe
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length && (
                      <tr>
                        <td colSpan={10} className="text-center text-muted py-3">
                          Nenhum equipamento encontrado para o filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
}
