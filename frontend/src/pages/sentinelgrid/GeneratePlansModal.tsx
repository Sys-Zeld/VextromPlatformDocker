import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, ButtonGroup, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  SgMaintenanceProgram,
  generatePlansFromProgram,
  listProgramScopeEquipment,
  periodicityToMonths
} from "../../api/sentinelgrid/programs";
import { createMaintenanceOrdersFromPlans } from "../../api/sentinelgrid/maintenanceOrders";
import { getEquipmentGroup, listEquipmentGroups } from "../../api/sentinelgrid/equipmentGroups";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEK = ["S", "T", "Q", "Q", "S", "S", "D"];
const MAX_MONTHS = 36;
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmmyyyy = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

function intervalLabel(m: number): string {
  return ({ 1: "Mensal", 2: "Bimestral", 3: "Trimestral", 6: "Semestral", 12: "Anual", 24: "Bienal" } as Record<number, string>)[m] || `A cada ${m} meses`;
}

function defaultEnd(startISO: string): string {
  const d = new Date(`${startISO}T00:00:00`);
  d.setFullYear(d.getFullYear() + 1);
  d.setDate(d.getDate() - 1);
  return isoOf(d);
}

// Ocorrências de startISO até endISO (inclusive), passo em meses.
function computeOccurrences(startISO: string, months: number, endISO: string): string[] {
  if (!startISO) return [];
  if (endISO && startISO > endISO) return [];
  if (!months || months <= 0) return [startISO];
  const end = new Date(`${endISO}T00:00:00`);
  const start = new Date(`${startISO}T00:00:00`);
  const out: string[] = [];
  let d = new Date(start);
  while (d <= end) { out.push(isoOf(d)); d = new Date(d.getFullYear(), d.getMonth() + months, d.getDate()); }
  return out.length ? out : [startISO];
}

function monthsBetween(startISO: string, endISO: string): { year: number; month0: number }[] {
  const s = new Date(`${startISO}T00:00:00`);
  const e = new Date(`${endISO}T00:00:00`);
  const out: { year: number; month0: number }[] = [];
  let y = s.getFullYear();
  let m = s.getMonth();
  while ((y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) && out.length < MAX_MONTHS) {
    out.push({ year: y, month0: m });
    m += 1; if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

function monthCells(year: number, month0: number): (number | null)[] {
  const lead = (new Date(year, month0, 1).getDay() + 6) % 7;
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

function MiniMonth({ year, month0, marks, onToggle, windowStart, windowEnd }: {
  year: number; month0: number; marks: Set<string>; onToggle: (iso: string) => void; windowStart: string | null; windowEnd: string | null;
}) {
  const cells = monthCells(year, month0);
  return (
    <div className="border rounded p-2">
      <div className="small fw-medium text-center mb-1">{MONTHS[month0]}/{year}</div>
      <table className="w-100 text-center" style={{ fontSize: 10, tableLayout: "fixed" }}>
        <thead><tr>{WEEK.map((w, i) => <th key={i} className="text-muted fw-normal">{w}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => (
            <tr key={r}>
              {cells.slice(r * 7, r * 7 + 7).map((day, i) => {
                if (day == null) return <td key={i} style={{ padding: 1 }} />;
                const key = `${year}-${pad(month0 + 1)}-${pad(day)}`;
                const outOfWindow = (windowStart && key < windowStart) || (windowEnd && key > windowEnd);
                const marked = marks.has(key);
                if (outOfWindow) return <td key={i} style={{ padding: 1 }}><span className="text-muted" style={{ opacity: 0.35 }}>{day}</span></td>;
                return (
                  <td key={i} style={{ padding: 1 }}>
                    <span
                      onClick={() => onToggle(key)}
                      title={marked ? "Remover data" : "Incluir data"}
                      style={{ cursor: "pointer", display: "inline-block", width: 16, height: 16, lineHeight: "16px", borderRadius: "50%", background: marked ? "#4F7F2A" : undefined, color: marked ? "#fff" : undefined }}
                    >{day}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearPreview({ fromISO, toISO, windowStart, windowEnd, marks, onToggle }: {
  fromISO: string; toISO: string; windowStart: string | null; windowEnd: string | null; marks: Set<string>; onToggle: (iso: string) => void;
}) {
  if (!fromISO || !toISO) return <Alert variant="secondary" className="mb-0 py-2 small">Informe a data inicial para ver o calendário.</Alert>;
  const months = monthsBetween(fromISO, toISO);
  return (
    <div className="row g-2">
      {months.map((m, i) => (
        <div key={i} className="col-6 col-sm-4 col-md-3">
          <MiniMonth year={m.year} month0={m.month0} marks={marks} onToggle={onToggle} windowStart={windowStart} windowEnd={windowEnd} />
        </div>
      ))}
    </div>
  );
}

export default function GeneratePlansModal({ program, onHide }: { program: SgMaintenanceProgram; onHide: () => void }) {
  const qc = useQueryClient();

  // Intervalos do programa (fallback: periodicidade base → meses, ou 1).
  const intervals = useMemo(() => {
    if (program.plan_intervals_months && program.plan_intervals_months.length) {
      return Array.from(new Set(program.plan_intervals_months.filter((m) => m > 0))).sort((a, b) => a - b);
    }
    const m = periodicityToMonths(program.periodicity);
    return [m > 0 ? m : 1];
  }, [program]);

  const contractFrom = program.contract_valid_from || null;
  const contractTo = program.contract_valid_to || null;
  const hasWindow = Boolean(contractFrom && contractTo && contractFrom <= contractTo);

  const [initialDate, setInitialDate] = useState(contractFrom || isoOf(new Date()));
  const [activeInterval, setActiveInterval] = useState(intervals[0]);
  const [datesByInterval, setDatesByInterval] = useState<Record<number, string[]>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [groupNote, setGroupNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdPlans: number; createdItems: number; planIds: number[] } | null>(null);
  const [ordersResult, setOrdersResult] = useState<{ created: number; skipped: number } | null>(null);

  const periodEnd = hasWindow ? (contractTo as string) : defaultEnd(initialDate);
  const previewFrom = hasWindow ? (contractFrom as string) : initialDate;
  const previewTo = hasWindow ? (contractTo as string) : defaultEnd(initialDate);

  // Recalcula todos os intervalos quando muda data inicial / fim do período.
  useEffect(() => {
    setDatesByInterval(Object.fromEntries(intervals.map((iv) => [iv, computeOccurrences(initialDate, iv, periodEnd)])));
  }, [initialDate, periodEnd, intervals]);

  const scope = useQuery({
    queryKey: ["sentinelgrid", "program-scope", program.id],
    queryFn: () => listProgramScopeEquipment(program.id)
  });
  const equipment = scope.data?.equipment || [];

  // Atalho: selecionar por grupo (marca os membros que estão no escopo do programa).
  const groupsQuery = useQuery({ queryKey: ["sentinelgrid", "equipment-groups", "gen"], queryFn: () => listEquipmentGroups() });
  const applyGroup = useMutation({
    mutationFn: (groupId: number) => getEquipmentGroup(groupId),
    onSuccess: (g) => {
      const scopeIds = new Set(equipment.map((e) => e.id));
      const inScope = (g.members || []).filter((m) => scopeIds.has(m.id)).map((m) => m.id);
      const out = (g.members || []).length - inScope.length;
      setSelected(new Set(inScope));
      setGroupNote(`${inScope.length} equipamento(s) do grupo "${g.name}" selecionado(s)${out ? ` · ${out} fora do escopo do programa` : ""}.`);
    }
  });

  const activeDates = useMemo(() => (datesByInterval[activeInterval] || []).slice().sort(), [datesByInterval, activeInterval]);
  const activeMarks = useMemo(() => new Set(activeDates), [activeDates]);

  const toggleDate = (iso: string) => setDatesByInterval((prev) => {
    const cur = prev[activeInterval] || [];
    const next = cur.includes(iso) ? cur.filter((d) => d !== iso) : [...cur, iso].sort();
    return { ...prev, [activeInterval]: next };
  });
  const recalcActive = () => setDatesByInterval((prev) => ({ ...prev, [activeInterval]: computeOccurrences(initialDate, activeInterval, periodEnd) }));

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = equipment.length > 0 && selected.size === equipment.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(equipment.map((e) => e.id)));

  const planSpecs = intervals
    .map((iv) => ({ intervalMonths: iv, dates: (datesByInterval[iv] || []).slice().sort() }))
    .filter((p) => p.dates.length > 0);
  const planCount = selected.size * planSpecs.length;

  const generate = useMutation({
    mutationFn: () => generatePlansFromProgram(program.id, { equipmentIds: Array.from(selected), plans: planSpecs }),
    onSuccess: (r) => {
      setError(null);
      setResult({ createdPlans: r.createdPlans, createdItems: r.createdItems, planIds: r.planIds });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "plans"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "calendar"] });
    },
    onError: (e) => setError((e as Error).message)
  });

  // Após gerar os planos, opção de gerar as OMs de todos os itens (feature: perguntar ao usuário).
  const genOrders = useMutation({
    mutationFn: () => createMaintenanceOrdersFromPlans({ planIds: result?.planIds || [] }),
    onSuccess: (r) => {
      setError(null);
      setOrdersResult({ created: r.created, skipped: r.skipped });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "maintenance-orders"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "calendar"] });
    },
    onError: (e) => setError((e as Error).message)
  });

  return (
    <Modal show onHide={onHide} size="xl">
      <Modal.Header closeButton>
        <Modal.Title className="h6 mb-0">Gerar planos · {program.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {result ? (
          <div className="d-flex flex-column gap-3">
            <Alert variant="success" className="mb-0">
              Gerados <strong>{result.createdPlans}</strong> plano(s) com <strong>{result.createdItems}</strong> ocorrência(s).
            </Alert>

            {ordersResult ? (
              <Alert variant="success" className="mb-0">
                Geradas <strong>{ordersResult.created}</strong> ordem(ns) de manutenção
                {ordersResult.skipped > 0 && <> · {ordersResult.skipped} já existia(m)</>}.
                <div className="mt-2 d-flex gap-2">
                  <Link to="/sentinelgrid/maintenance-orders" className="btn btn-sm btn-primary">Ver ordens</Link>
                  <Button size="sm" variant="outline-secondary" onClick={onHide}>Fechar</Button>
                </div>
              </Alert>
            ) : (
              <Card body>
                <div className="mb-2">Deseja <strong>gerar as ordens de manutenção</strong> a partir dos itens desses planos?</div>
                <div className="d-flex gap-2 flex-wrap">
                  <Button size="sm" onClick={() => genOrders.mutate()} disabled={genOrders.isPending || (result.planIds?.length ?? 0) === 0}>
                    {genOrders.isPending ? "Gerando ordens…" : "Gerar ordens dos itens"}
                  </Button>
                  <Link to="/sentinelgrid/plans" className="btn btn-sm btn-outline-primary">Ver planos</Link>
                  <Button size="sm" variant="outline-secondary" onClick={onHide}>Agora não</Button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {hasWindow ? (
              <Alert variant="info" className="py-2 mb-0 small">
                Período limitado ao contrato <strong>{program.contract_name}</strong>: {ddmmyyyy(contractFrom as string)} – {ddmmyyyy(contractTo as string)}.
              </Alert>
            ) : (
              <Alert variant="secondary" className="py-2 mb-0 small">Programa sem contrato — período de 12 meses a partir da data inicial.</Alert>
            )}

            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <Form.Label className="small">Data inicial</Form.Label>
                <Form.Control type="date" value={initialDate} min={hasWindow ? (contractFrom as string) : undefined} max={hasWindow ? (contractTo as string) : undefined} onChange={(e) => setInitialDate(e.target.value)} />
              </div>
              <div className="col-md-9">
                <div className="small text-muted mb-1">Intervalos (um plano por intervalo) — selecione para editar as datas</div>
                <ButtonGroup size="sm" className="flex-wrap">
                  {intervals.map((iv) => (
                    <Button key={iv} variant={activeInterval === iv ? "primary" : "outline-primary"} onClick={() => setActiveInterval(iv)}>
                      {intervalLabel(iv)} <Badge bg="light" text="dark">{(datesByInterval[iv] || []).length}</Badge>
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>

            <div>
              <div className="small fw-medium mb-1 d-flex justify-content-between">
                <span>Datas de <strong>{intervalLabel(activeInterval)}</strong> ({activeDates.length}) — clique no calendário para incluir/remover</span>
                <Button size="sm" variant="link" className="p-0" onClick={recalcActive}>Recalcular este intervalo</Button>
              </div>
              <div className="d-flex flex-wrap gap-1 mb-2">
                {activeDates.length === 0 && <span className="small text-muted">Nenhuma data neste intervalo.</span>}
                {activeDates.map((d) => (
                  <Badge key={d} bg="primary" style={{ cursor: "pointer" }} title="Remover data" onClick={() => toggleDate(d)}>{ddmmyyyy(d)} ✕</Badge>
                ))}
              </div>
              <YearPreview
                fromISO={previewFrom}
                toISO={previewTo}
                windowStart={hasWindow ? (contractFrom as string) : null}
                windowEnd={hasWindow ? (contractTo as string) : null}
                marks={activeMarks}
                onToggle={toggleDate}
              />
            </div>

            <div>
              <div className="d-flex justify-content-between align-items-center mb-1 gap-2 flex-wrap">
                <div className="small fw-medium">Equipamentos do escopo ({equipment.length})</div>
                <div className="d-flex align-items-center gap-2">
                  <Form.Select size="sm" style={{ maxWidth: 240 }} value="" onChange={(e) => { const v = Number(e.target.value); if (v) applyGroup.mutate(v); }}>
                    <option value="">Selecionar por grupo…</option>
                    {(groupsQuery.data?.groups || []).map((g) => <option key={g.id} value={g.id}>{g.site_name} / {g.name} ({g.member_count})</option>)}
                  </Form.Select>
                  {equipment.length > 0 && <Button size="sm" variant="link" className="p-0" onClick={toggleAll}>{allSelected ? "Limpar seleção" : "Selecionar todos"}</Button>}
                </div>
              </div>
              {groupNote && <div className="small text-muted mb-1">{groupNote}</div>}
              {scope.isLoading ? (
                <div className="text-muted small"><Spinner animation="border" size="sm" /> Carregando…</div>
              ) : scope.error ? (
                <Alert variant="danger" className="mb-0">{(scope.error as Error).message}</Alert>
              ) : equipment.length === 0 ? (
                <Alert variant="secondary" className="mb-0 py-2 small">Nenhum equipamento casa com o escopo deste programa.</Alert>
              ) : (
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  <Table size="sm" hover className="mb-0 align-middle">
                    <thead><tr><th style={{ width: 32 }}></th><th>Equipamento</th><th>Cliente / Site / Área</th><th>Criticidade</th></tr></thead>
                    <tbody>
                      {equipment.map((e) => (
                        <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => toggle(e.id)}>
                          <td><Form.Check checked={selected.has(e.id)} onChange={() => toggle(e.id)} onClick={(ev) => ev.stopPropagation()} /></td>
                          <td className="fw-medium">{e.tag || e.serial_number || `#${e.id}`}</td>
                          <td className="small text-muted">{e.client_name} / {e.site_name || "-"} / {e.area_name || "-"}</td>
                          <td className="small">{e.criticality}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>

            <div className="small text-muted">
              Resultado: <strong>{planCount}</strong> plano(s) = {selected.size} equipamento(s) × {planSpecs.length} intervalo(s) com datas.
            </div>
          </div>
        )}
      </Modal.Body>
      {!result && (
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancelar</Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending || selected.size === 0 || planSpecs.length === 0}>
            {generate.isPending ? "Gerando…" : `Gerar ${planCount} plano(s)`}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}
