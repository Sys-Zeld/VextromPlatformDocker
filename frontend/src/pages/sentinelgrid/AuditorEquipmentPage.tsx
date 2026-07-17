import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Alert, Badge, Card, Col, Form, ProgressBar, Row, Spinner, Table } from "react-bootstrap";
import { formatDate } from "../../utils/format";
import { listClients } from "../../api/sentinelgrid/clients";
import { listEquipment } from "../../api/sentinelgrid/equipment";
import { auditEquipment } from "../../api/sentinelgrid/audit";
import { adherenceMeta, categoryMeta, deltaLabel, humanize, rateVariant } from "./auditLabels";

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

export default function AuditorEquipmentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientId, setClientId] = useState(0);
  const [equipmentId, setEquipmentId] = useState(Number(searchParams.get("equipmentId")) || 0);
  const [from, setFrom] = useState(isoDate(-365));
  const [to, setTo] = useState(isoDate(0));

  const clients = useQuery({ queryKey: ["sentinelgrid", "clients"], queryFn: () => listClients({ pageSize: 500 }) });
  const equipments = useQuery({
    queryKey: ["sentinelgrid", "equipment", { clientId }],
    queryFn: () => listEquipment({ clientId: clientId || undefined, pageSize: 500 }),
    placeholderData: keepPreviousData
  });

  const audit = useQuery({
    queryKey: ["sentinelgrid", "audit", "equipment", { equipmentId, from, to }],
    queryFn: () => auditEquipment(equipmentId, from, to),
    enabled: equipmentId > 0,
    placeholderData: keepPreviousData
  });

  // Deep-link vindo da auditoria por cliente (?equipmentId=): pré-seleciona o equipamento.
  useEffect(() => {
    if (equipmentId) setSearchParams({ equipmentId: String(equipmentId) }, { replace: true });
  }, [equipmentId, setSearchParams]);

  const summary = audit.data?.summary;
  const occurrences = useMemo(() => audit.data?.occurrences || [], [audit.data]);
  const equipmentOptions = equipments.data?.equipment || [];

  return (
    <div className="d-flex flex-column gap-3">
      <Card>
        <Card.Body className="d-flex flex-wrap align-items-end gap-3">
          <Form.Group>
            <Form.Label className="small mb-1">Cliente</Form.Label>
            <Form.Select
              size="sm"
              style={{ minWidth: 200 }}
              value={clientId}
              onChange={(e) => { setClientId(Number(e.target.value)); setEquipmentId(0); }}
            >
              <option value={0}>Todos</option>
              {(clients.data?.clients || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">Equipamento</Form.Label>
            <Form.Select
              size="sm"
              style={{ minWidth: 240 }}
              value={equipmentId}
              onChange={(e) => setEquipmentId(Number(e.target.value))}
            >
              <option value={0}>Selecione…</option>
              {equipmentOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.tag} · {e.equipment_type_name || "equipamento"}{e.site_name ? ` — ${e.site_name}` : ""}
                </option>
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

      {!equipmentId && (
        <Alert variant="secondary">Selecione um equipamento para auditar a aderência ao plano de manutenção.</Alert>
      )}
      {audit.isFetching && <Spinner animation="border" />}
      {audit.error && <Alert variant="danger">Falha ao carregar a auditoria do equipamento.</Alert>}

      {equipmentId > 0 && audit.data && summary && (
        <>
          <Card>
            <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <strong className="fs-5">{audit.data.equipment.tag}</strong>
                <span className="text-muted ms-2">
                  {audit.data.equipment.client_name} · {audit.data.equipment.site_name} · {audit.data.equipment.area_name}
                </span>
              </div>
              <div className="text-end">
                <div className="small text-muted">Aderência (no prazo + aproximado ÷ esperadas)</div>
                <div className={`fs-3 fw-bold text-${rateVariant(summary.adherenceRate)}`}>
                  {summary.adherenceRate === null ? "—" : `${summary.adherenceRate}%`}
                </div>
              </div>
            </Card.Body>
            {summary.esperadasPassado > 0 && (
              <ProgressBar style={{ height: 8, borderRadius: 0 }}>
                <ProgressBar variant="success" now={summary.noPrazo} max={summary.esperadasPassado} key="a" />
                <ProgressBar variant="warning" now={summary.aproximado} max={summary.esperadasPassado} key="b" />
                <ProgressBar variant="danger" now={summary.foraPrazo + summary.lacunas + summary.emAberto} max={summary.esperadasPassado} key="c" />
              </ProgressBar>
            )}
          </Card>

          <Row xs={2} md={4} lg={7} className="g-2">
            <Col><Kpi label="Esperadas (passado)" value={summary.esperadasPassado} /></Col>
            <Col><Kpi label="Cumpridas" value={summary.cumpridas} variant="success" /></Col>
            <Col><Kpi label="No prazo" value={summary.noPrazo} variant="success" /></Col>
            <Col><Kpi label="Aproximado" value={summary.aproximado} variant="warning" /></Col>
            <Col><Kpi label="Fora do prazo" value={summary.foraPrazo} variant="danger" /></Col>
            <Col><Kpi label="Lacunas" value={summary.lacunas} variant="danger" /></Col>
            <Col><Kpi label="Em aberto/pend." value={summary.emAberto + summary.comPendencias} variant="warning" /></Col>
          </Row>

          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Ocorrências previstas × executadas</span>
              <span className="small text-muted">
                {formatDate(audit.data.from)} → {formatDate(audit.data.to)}
              </span>
            </Card.Header>
            <Card.Body className="p-0">
              <div style={{ overflowX: "auto" }}>
                <Table size="sm" hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Data prevista</th>
                      <th>Programa / Plano</th>
                      <th>Item</th>
                      <th>Tipo</th>
                      <th>OM</th>
                      <th>Execução</th>
                      <th>Δ</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occurrences.map((o, idx) => {
                      const cat = categoryMeta(o.category);
                      const adh = adherenceMeta(o.adherence);
                      return (
                        <tr key={`${o.itemId ?? "x"}-${o.expectedDate ?? idx}-${o.order?.id ?? "n"}`}>
                          <td>{formatDate(o.expectedDate)}</td>
                          <td>
                            <div>{o.programName || "—"}</div>
                            <div className="small text-muted">{o.planName || "—"}</div>
                          </td>
                          <td>{o.itemTitle || "-"}</td>
                          <td className="small">{humanize(o.maintenanceType)}</td>
                          <td>
                            {o.order ? (
                              <a href={`/app/sentinelgrid/maintenance-orders?search=${o.order.orderNumber}`} target="_blank" rel="noreferrer">
                                {o.order.orderNumber}
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>{formatDate(o.execDate)}</td>
                          <td className="small">{deltaLabel(o.deltaDays)}</td>
                          <td>
                            <Badge bg={cat.variant}>{cat.label}</Badge>
                            {adh && o.category === "cumprida" && (
                              <Badge bg={adh.variant} className="ms-1">{adh.label}</Badge>
                            )}
                            {o.pendencias && <Badge bg="warning" text="dark" className="ms-1">pendências</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                    {!occurrences.length && (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-3">
                          Nenhuma ocorrência no período. O equipamento pode não ter planos ativos com data prevista.
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
