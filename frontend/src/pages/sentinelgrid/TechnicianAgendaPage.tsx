import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import SgIcon from "../../components/sentinelgrid/SgIcon";
import { setDemandGroupDuration } from "../../api/sentinelgrid/demands";
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

// O calendário mostra a OS, não a OM: um bloco reúne as OMs do mesmo grupo (técnico + cliente +
// site + dia de início) — exatamente o agrupamento que Gerar Demanda usa para emitir a OS.
// Grupo ainda não gerado aparece como "Sem OS" (borda tracejada), porque o trabalho já está na
// agenda do técnico mesmo antes da OS existir.
interface AgendaBlock {
  key: string;
  technicianId: number;
  technicianName: string;
  clientName: string;
  siteName: string;
  startDate: string;
  endDate: string;
  osId: number | null;
  osCode: string;
  orders: SgTechnicianAgendaItem[];
  scheduled: boolean;
}

function buildBlocks(items: SgTechnicianAgendaItem[]): AgendaBlock[] {
  const blocks = new Map<string, AgendaBlock>();
  for (const item of items) {
    const key = `${item.technician_id}:${item.client_id}:${item.site_id ?? "null"}:${item.start_date}`;
    const block = blocks.get(key);
    if (!block) {
      blocks.set(key, {
        key,
        technicianId: item.technician_id,
        technicianName: item.technician_name,
        clientName: item.client_name,
        siteName: item.site_name || "Sem site",
        startDate: item.start_date,
        endDate: item.end_date,
        osId: item.rs_service_order_id,
        osCode: item.rs_service_order_code || "",
        orders: [item],
        scheduled: item.status === "agendada"
      });
      continue;
    }
    block.orders.push(item);
    // O bloco acaba com a OM mais longa; só é arrastável se TODAS as OMs forem agendadas.
    if (item.end_date > block.endDate) block.endDate = item.end_date;
    if (!block.osId && item.rs_service_order_id) {
      block.osId = item.rs_service_order_id;
      block.osCode = item.rs_service_order_code || "";
    }
    block.scheduled = block.scheduled && item.status === "agendada";
  }
  return [...blocks.values()];
}

function occupies(block: AgendaBlock, date: string) {
  return block.startDate <= date && block.endDate >= date;
}

const blockLabel = (block: AgendaBlock) => block.osCode || (block.osId ? `OS #${block.osId}` : "Sem OS");
const orderNumbers = (block: AgendaBlock) => block.orders.map((order) => order.order_number).join(", ");

export default function TechnicianAgendaPage() {
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState(new Date());
  const [technicianId, setTechnicianId] = useState<number | "">("");
  const [selected, setSelected] = useState<AgendaBlock | null>(null);
  const [duration, setDuration] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const range = monthRange(anchor);
  const technicians = useQuery({ queryKey: ["sentinelgrid", "technicians"], queryFn: listTechnicians });
  const agenda = useQuery({
    queryKey: ["sentinelgrid", "technician-agenda", range, technicianId],
    queryFn: () => listTechnicianAgenda({ ...range, technicianId: technicianId === "" ? undefined : technicianId })
  });
  const blocks = useMemo(() => buildBlocks(agenda.data?.agenda || []), [agenda.data]);

  const weeks = useMemo(() => {
    const first = new Date(`${range.from}T12:00:00`);
    const last = new Date(`${range.to}T12:00:00`);
    const result: Date[][] = [];
    for (let cur = first; cur <= last; cur = addDays(cur, 7)) result.push(Array.from({ length: 7 }, (_, i) => addDays(cur, i)));
    return result;
  }, [range.from, range.to]);

  const refresh = (text: string) => {
    setError(null); setMessage(text); setSelected(null);
    qc.invalidateQueries({ queryKey: ["sentinelgrid", "technician-agenda"] });
    qc.invalidateQueries({ queryKey: ["sentinelgrid", "map-events"] });
    qc.invalidateQueries({ queryKey: ["sentinelgrid", "maintenance-orders"] });
    qc.invalidateQueries({ queryKey: ["sentinelgrid", "demands"] });
  };

  // Arrastar a OS move TODAS as OMs dela: é uma mobilização só, não se desloca metade dela.
  // Cada OM mantém a própria duração.
  const move = useMutation({
    mutationFn: async ({ block, startDate }: { block: AgendaBlock; startDate: string }) => {
      for (const order of block.orders) {
        await rescheduleTechnicianOrder(order.order_id, { startDate, executionDays: order.execution_days });
      }
    },
    onSuccess: () => refresh("Agenda da OS atualizada."),
    onError: (err) => setError((err as Error).message)
  });

  // Duração é da mobilização — grava em todas as OMs do bloco (mesmo endpoint do Agendado).
  const saveDuration = useMutation({
    mutationFn: ({ block, executionDays }: { block: AgendaBlock; executionDays: number }) =>
      setDemandGroupDuration({ orderIds: block.orders.map((order) => order.order_id), executionDays }),
    onSuccess: () => refresh("Duração da OS atualizada."),
    onError: (err) => setError((err as Error).message)
  });

  const open = (block: AgendaBlock) => {
    setSelected(block);
    setDuration(Math.max(...block.orders.map((order) => order.execution_days)));
    setError(null);
  };
  const drop = (ev: React.DragEvent, targetDate: string) => {
    ev.preventDefault();
    try {
      const block = JSON.parse(ev.dataTransfer.getData("application/x-sg-technician-order")) as AgendaBlock;
      if (block.scheduled && block.startDate !== targetDate) move.mutate({ block, startDate: targetDate });
    } catch { /* arraste externo */ }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div><h2 className="h5 mb-1">Agenda dos técnicos</h2><p className="text-muted small mb-0">Ordens de Serviço por técnico, com as OMs que cada uma reúne, duração prevista e disponibilidade da equipe.</p></div>
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
            const dayBlocks = blocks.filter((block) => block.startDate <= weekEnd && block.endDate >= weekStart && laterDate(block.startDate, weekStart) === date);
            const dayHasWork = blocks.some((block) => occupies(block, date));
            const inMonth = day.getMonth() === anchor.getMonth();
            return <td key={date} className={`sg-tech-agenda-day${dayHasWork ? " has-work" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, date)} style={{ height: 130, verticalAlign: "top", opacity: inMonth ? 1 : .45 }}>
              <div className="sg-tech-agenda-day__number">{day.getDate()}</div><div className="sg-tech-agenda-day__tasks">
                {dayBlocks.map((block) => {
                  const segmentStart = laterDate(block.startDate, weekStart);
                  const segmentEnd = earlierDate(block.endDate, weekEnd);
                  const span = daysInclusive(segmentStart, segmentEnd);
                  return <button
                  key={block.key}
                  type="button"
                  draggable={block.scheduled}
                  onDragStart={(e) => e.dataTransfer.setData("application/x-sg-technician-order", JSON.stringify(block))}
                  onClick={() => open(block)}
                  className={`sg-tech-agenda-task sg-tech-agenda-task--os${block.osId ? "" : " sg-tech-agenda-task--unlinked"}${block.scheduled ? " is-scheduled" : ""}${date === block.startDate ? " is-start" : ""}${date === block.endDate ? " is-end" : ""}`}
                  style={{ "--sg-agenda-span": span } as React.CSSProperties}
                  title={`${blockLabel(block)} · ${block.clientName} / ${block.siteName} · ${block.technicianName}\n${block.orders.map((order) => `${order.order_number} · ${order.equipment_tag || `#${order.equipment_id}`} · ${order.execution_days} dia(s)`).join("\n")}`}
                >
                  <SgIcon name="check" size={23} className="sg-tech-agenda-task__icon" />
                  <span className="sg-tech-agenda-task__body">
                    <span className="sg-tech-agenda-task__order">{blockLabel(block)}</span>
                    <span className="sg-tech-agenda-task__orders">{orderNumbers(block)}</span>
                    <span className="sg-tech-agenda-task__technician">{block.technicianName}</span>
                  </span>
                </button>;})}
              </div>
            </td>;
          })}</tr>;})}</tbody>
        </table></div></Card>
      )}
      <div className="small text-muted">
        Cada cartão é uma <strong>OS</strong> — as OMs do mesmo cliente, site e dia. <Badge bg="primary">Agendada</Badge> pode ser arrastada, e mover a OS move todas as OMs dela.
        Borda tracejada = grupo ainda sem OS gerada (veja <Link to="/sentinelgrid/demands/scheduled">Gerar Demanda › Agendado</Link>).
      </div>
      {selected && <Modal show onHide={() => setSelected(null)}><Modal.Header closeButton><Modal.Title>{blockLabel(selected)}</Modal.Title></Modal.Header><Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <p className="mb-1"><strong>{selected.clientName}</strong> · {selected.siteName}</p>
        <p className="text-muted small">{selected.technicianName} · início {selected.startDate} · fim {selected.endDate}</p>
        <ul className="small ps-3">
          {selected.orders.map((order) => (
            <li key={order.order_id}>
              <strong>{order.order_number}</strong> · {order.equipment_tag || `#${order.equipment_id}`} · {order.execution_days} dia(s)
            </li>
          ))}
        </ul>
        {selected.osId
          ? <p className="small mb-2">OS gerada: <a href={`/app/orders/${selected.osId}/editor`} target="_blank" rel="noreferrer">{blockLabel(selected)}</a></p>
          : <Alert variant="secondary" className="py-2 small">Grupo ainda sem OS no Service Report.</Alert>}
        <Form.Label>Tempo previsto de execução (dias)</Form.Label>
        <Form.Control type="number" min={1} max={365} value={duration} disabled={!selected.scheduled} onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))} />
        <Form.Text className="text-muted">Vale para todas as OMs desta OS.</Form.Text>
      </Modal.Body><Modal.Footer><Button variant="secondary" onClick={() => setSelected(null)}>Fechar</Button><Button disabled={!selected.scheduled || saveDuration.isPending} onClick={() => saveDuration.mutate({ block: selected, executionDays: duration })}>Salvar duração</Button></Modal.Footer></Modal>}
    </div>
  );
}
