import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { ackAlerts, getAlertAck, getAlertPopupPosition, listAlerts, saveAlertPopupPosition } from "../../api/sentinelgrid/alerts";
import { EVENT_KIND_LABEL } from "../../api/sentinelgrid/calendarMap";
import { equipmentLabel, formatDate } from "../../utils/format";
import PriorityBadge from "./PriorityBadge";

export default function MaintenanceAlertsPopup() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const popupRef = useRef<HTMLElement>(null);
  const restoredRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const alertsQuery = useQuery({ queryKey: ["sentinelgrid", "alerts"], queryFn: () => listAlerts() });
  const ackQuery = useQuery({ queryKey: ["sentinelgrid", "alerts", "ack"], queryFn: getAlertAck });
  const positionQuery = useQuery({ queryKey: ["sentinelgrid", "alerts", "popup-position"], queryFn: getAlertPopupPosition });
  const savePosition = useMutation({
    mutationFn: saveAlertPopupPosition,
    onSuccess: (saved) => qc.setQueryData(["sentinelgrid", "alerts", "popup-position"], saved)
  });
  const acknowledge = useMutation({
    mutationFn: ackAlerts,
    onSuccess: (state) => {
      qc.setQueryData(["sentinelgrid", "alerts", "ack"], state);
      if (!state.acknowledged) qc.invalidateQueries({ queryKey: ["sentinelgrid", "alerts", "ack"] });
    }
  });

  const alerts = alertsQuery.data?.alerts ?? [];
  const visible = ackQuery.data && !ackQuery.data.acknowledged && (alertsQuery.data?.total ?? 0) > 0;

  useEffect(() => {
    if (!visible || restoredRef.current || !positionQuery.isFetched || !popupRef.current) return;
    restoredRef.current = true;
    const saved = positionQuery.data;
    if (saved?.left == null || saved.top == null) return;
    const rect = popupRef.current.getBoundingClientRect();
    const margin = 8;
    setPosition({
      left: Math.min(Math.max(margin, window.innerWidth - rect.width - margin), Math.max(margin, saved.left)),
      top: Math.min(Math.max(margin, window.innerHeight - rect.height - margin), Math.max(margin, saved.top)),
      width: rect.width
    });
  }, [visible, positionQuery.data, positionQuery.isFetched]);

  useEffect(() => {
    if (!position) return;
    const keepInsideViewport = () => setPosition((current) => {
      if (!current || !popupRef.current) return current;
      const rect = popupRef.current.getBoundingClientRect();
      const margin = 8;
      return {
        left: Math.min(Math.max(margin, window.innerWidth - rect.width - margin), Math.max(margin, current.left)),
        top: Math.min(Math.max(margin, window.innerHeight - rect.height - margin), Math.max(margin, current.top)),
        width: rect.width
      };
    });
    window.addEventListener("resize", keepInsideViewport);
    return () => window.removeEventListener("resize", keepInsideViewport);
  }, [position]);

  if (!visible) return null;

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !popupRef.current) return;
    const rect = popupRef.current.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    setPosition({ left: rect.left, top: rect.top, width: rect.width });
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const popup = popupRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !popup) return;
    const margin = 8;
    const rect = popup.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    setPosition({
      left: Math.min(maxLeft, Math.max(margin, event.clientX - drag.offsetX)),
      top: Math.min(maxTop, Math.max(margin, event.clientY - drag.offsetY)),
      width: rect.width
    });
  };
  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      savePosition.mutate({ left: rect.left, top: rect.top });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <aside
      ref={popupRef}
      className={`sg-maintenance-alert-popup${dragging ? " is-dragging" : ""}`}
      style={position ? { left: position.left, top: position.top, width: position.width, right: "auto", bottom: "auto" } : undefined}
      role="alertdialog"
      aria-labelledby="sg-maintenance-alert-title"
      aria-describedby="sg-maintenance-alert-description"
    >
      <div
        className="sg-maintenance-alert-popup__header"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        title="Arraste para mover"
      >
        <div>
          <div id="sg-maintenance-alert-title" className="fw-semibold d-flex align-items-center gap-2"><span aria-hidden="true" className="sg-maintenance-alert-popup__drag-icon">⠇⠇</span>Alertas de manutenção</div>
          <div id="sg-maintenance-alert-description" className="small text-muted">{alertsQuery.data?.total ?? 0} item(ns) requerem atenção</div>
        </div>
        <span className="sg-maintenance-alert-popup__count">{alertsQuery.data?.total ?? 0}</span>
      </div>

      <div className="sg-maintenance-alert-popup__list">
        {alerts.slice(0, 5).map((item, index) => {
          const isOrder = item.ref_table === "sg_maintenance_orders";
          const openOrder = () => { if (isOrder) navigate(`/sentinelgrid/maintenance-orders?order=${item.ref_id}`); };
          return (
          <div
            key={`${item.ref_table}-${item.ref_id}-${index}`}
            className={`sg-maintenance-alert-popup__item${isOrder ? " is-clickable" : ""}`}
            role={isOrder ? "button" : undefined}
            tabIndex={isOrder ? 0 : undefined}
            title={isOrder ? `Abrir ${item.title} na tela de Ordens` : undefined}
            onClick={openOrder}
            onKeyDown={(event) => { if (isOrder && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openOrder(); } }}
          >
            <PriorityBadge priority={item.priority} />
            <div className="min-w-0 flex-grow-1">
              <div className="small fw-medium text-truncate">{isOrder ? item.title : equipmentLabel(item.equipment_tag, item.client_name)}</div>
              <div className="small text-muted text-truncate">{isOrder ? equipmentLabel(item.equipment_tag, item.client_name) : (EVENT_KIND_LABEL[item.event_kind] || item.event_kind)}</div>
            </div>
            <span className="small text-nowrap">{formatDate(item.event_date)}</span>
          </div>
          );
        })}
        {alerts.length > 5 && <div className="small text-muted pt-1">+{alerts.length - 5} outros alertas</div>}
      </div>

      {acknowledge.error && <Alert variant="danger" className="small py-1 px-2 mb-2">Não foi possível registrar a confirmação.</Alert>}
      {savePosition.error && <Alert variant="warning" className="small py-1 px-2 mb-2">A posição foi alterada, mas não pôde ser salva no Redis.</Alert>}
      <div className="d-flex justify-content-between align-items-center gap-2">
        <Link to="/sentinelgrid/alerts" className="btn btn-sm btn-outline-primary">Ver todos</Link>
        <Button size="sm" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
          {acknowledge.isPending ? <><Spinner animation="border" size="sm" className="me-1" />Salvando</> : "Ciente"}
        </Button>
      </div>
    </aside>
  );
}
