import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import SgIcon from "../../components/sentinelgrid/SgIcon";
import {
  SgTechnicianAgendaItem, listTechnicianAgenda, listTechnicians, rescheduleTechnicianOrder
} from "../../api/sentinelgrid/technicians";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, days: number) => { const next = new Date(d); next.setDate(next.getDate() + days); return next; };
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const laterDate = (a: string, b: string) => a > b ? a : b;
const earlierDate = (a: string, b: string) => a < b ? a : b;
const daysInclusive = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86400000) + 1;

function monthRange(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: iso(startOfWeek(first)), to: iso(addDays(startOfWeek(last), 6)) };
}

function occupies(item: SgTechnicianAgendaItem, date: string) {
  return item.start_date <= date && item.end_date >= date;
}

export default function TechnicianAgendaPage() {
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(new Date());
  const [technicianId, setTechnicianId] = useState<number | "">("");
  const [selected, setSelected] = useState<SgTechnicianAgendaItem | null>(null);
  const [duration, setDuration] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const range = monthRange(anchor);
  const technicians = useQuery({ queryKey: ["sentinelgrid", "technicians"], queryFn: listTechnicians });
  const agenda = useQuery({
    queryKey: ["sentinelgrid", "technician-agenda", range, technicianId],
    queryFn: () => listTechnicianAgenda({ ...range, technicianId: technicianId === "" ? undefined : technicianId })
  });
  const items = agenda.data?.agenda || [];

  const weeks = useMemo(() => {
    const first = new Date(`${range.from}T12:00:00`);
    const last = new Date(`${range.to}T12:00:00`);
    const result: Date[][] = [];
    for (let cur = first; cur <= last; cur = addDays(cur, 7)) result.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)));
    return result;
  }, [range.from, range.to]);

  const update = useMutation({
    mutationFn: ({ item, startDate, executionDays }: { item: SgTechnicianAgendaItem; startDate: string; executionDays: number }) =>
      rescheduleTechnicianOrder(item.order_id, { startDate, executionDays }),
    onSuccess: () => {
      setError(null); setMessage("Agenda da ordem atualizada."); setSelected(null);
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "technician-agenda"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "map-events"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "maintenance-orders"] });
    },
    onError: (err) => setError((err as Error).message)
  });

  const open = (item: SgTechnicianAgendaItem) => { setSelected(item); setDuration(item.execution_days); setError(null); };
  const drop = (ev: React.DragEvent, targetDate: string) => {
    ev.preventDefault();
    try {
      const item = JSON.parse(ev.dataTransfer.getData("application/x-sg-technician-order")) as SgTechnicianAgendaItem;
      if (item.status === "agendada" && item.start_date !== targetDate) update.mutate({ item, startDate: targetDate, executionDays: item.execution_days });
    } catch { /* arraste externo */ }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><h2 className="h5 mb-1">Agenda dos técnicos</h2><p className="text-muted small mb-0">Ordens vinculadas, duração prevista e disponibilidade da equipe.</p></div>
        <Link to="/sentinelgrid/maintenance-orders" className="btn btn-outline-secondary btn-sm">Ordens</Link>
      </div>
      {message && <Alert variant="success" dismissible onClose={() => setMessage(null)}>{message}</Alert>}
      {error && !selected && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      <Card><Card.Body className="d-flex gap-3 align-items-end flex-wrap">
        <Button variant="outline-secondary" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</Button>
        <div className="fw-semibold fs-5">{MONTHS[anchor.getMonth()]} {anchor.getFullYear()}</div>
        <Button variant="outline-secondary" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</Button>
        <div className="ms-md-auto" style={{ minWidth: 280 }}><Form.Label>Técnico</Form.Label><Form.Select value={technicianId} onChange={(e) => setTechnicianId(e.target.value ? Number(e.target.value) : "")}><option value="">Todos os técnicos</option>{(technicians.data?.technicians || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Form.Select></div>
      </Card.Body></Card>
      {agenda.isLoading ? <div className="text-muted"><Spinner size="sm" /> Carregando agenda...</div> : agenda.error ? <Alert variant="danger">{(agenda.error as Error).message}</Alert> : (
        <Card className="overflow-hidden"><div className="table-responsive"><table className="table table-bordered mb-0" style={{ tableLayout: "fixed", minWidth: 900 }}>
          <thead><tr>{WEEKDAYS.map((day) => <th key={day} className="text-center">{day}</th>)}</tr></thead>
          <tbody>{weeks.map((week, wi) => {
            const weekStart = iso(week[0]);
            const weekEnd = iso(week[6]);
            return <tr key={wi}>{week.map((day) => {
            const date = iso(day);
            const dayItems = items.filter((item) => item.start_date <= weekEnd && item.end_date >= weekStart && laterDate(item.start_date, weekStart) === date);
            const dayHasWork = items.some((item) => occupies(item, date));
            const inMonth = day.getMonth() === anchor.getMonth();
            return <td key={date} className={`sg-tech-agenda-day${dayHasWork ? " has-work" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, date)} style={{ height: 130, verticalAlign: "top", opacity: inMonth ? 1 : .45 }}>
              <div className="sg-tech-agenda-day__number">{day.getDate()}</div><div className="sg-tech-agenda-day__tasks">
                {dayItems.map((item) => {
                  const segmentStart = laterDate(item.start_date, weekStart);
                  const segmentEnd = earlierDate(item.end_date, weekEnd);
                  const span = daysInclusive(segmentStart, segmentEnd);
                  return <button
                  key={`${item.order_id}-${item.technician_id}`}
                  type="button"
                  draggable={item.status === "agendada"}
                  onDragStart={(e) => e.dataTransfer.setData("application/x-sg-technician-order", JSON.stringify(item))}
                  onClick={() => open(item)}
                  className={`sg-tech-agenda-task${item.status === "agendada" ? " is-scheduled" : ""}${date === item.start_date ? " is-start" : ""}${date === item.end_date ? " is-end" : ""}`}
                  style={{ "--sg-agenda-span": span } as React.CSSProperties}
                  title={`${item.order_number} · ${item.equipment_tag || `#${item.equipment_id}`} · ${item.technician_name} · ${item.execution_days} dia(s)`}
                >
                  <SgIcon name="check" size={23} className="sg-tech-agenda-task__icon" />
                  <span className="sg-tech-agenda-task__order">{item.order_number}</span>
                  <span className="sg-tech-agenda-task__technician">{item.technician_name}</span>
                </button>;})}
              </div>
            </td>;
          })}</tr>;})}</tbody>
        </table></div></Card>
      )}
      <div className="small text-muted"><Badge bg="primary">Agendada</Badge> pode ser arrastada. Cada cartão aparece em todos os dias previstos para execução.</div>
      {selected && <Modal show onHide={() => setSelected(null)}><Modal.Header closeButton><Modal.Title>{selected.order_number}</Modal.Title></Modal.Header><Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}<p className="mb-1"><strong>{selected.equipment_tag}</strong> · {selected.client_name} / {selected.site_name || "-"}</p><p className="text-muted small">{selected.technician_name} · início {selected.start_date} · fim {selected.end_date}</p>
        <Form.Label>Tempo previsto de execução (dias)</Form.Label><Form.Control type="number" min={1} max={365} value={duration} disabled={selected.status !== "agendada"} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} />
      </Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setSelected(null)}>Fechar</Button><Button disabled={selected.status !== "agendada" || update.isPending} onClick={() => update.mutate({ item: selected, startDate: selected.start_date, executionDays: duration })}>Salvar duração</Button></Modal.Footer></Modal>}
    </div>
  );
}
