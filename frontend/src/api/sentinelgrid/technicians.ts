import { api } from "../client";

export interface SgTechnician {
  id: number;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  active?: boolean;
  rs_id?: number | null;
  sg_id?: number | null;
}

export const listTechnicians = () => api<{ technicians: SgTechnician[] }>("/sentinelgrid/technicians");
export const createTechnician = (input: Omit<SgTechnician, "id" | "rs_id" | "sg_id">) =>
  api<{ technician: SgTechnician }>("/sentinelgrid/technicians", { method: "POST", body: JSON.stringify(input) });
export const listReportServiceTechnicians = () => api<{ technicians: SgTechnician[] }>("/sentinelgrid/technicians/report-service");
export const importTechnician = (rsTechnicianId: number) => api<{ technicianId: number; reused: boolean }>(
  "/sentinelgrid/technicians/import", { method: "POST", body: JSON.stringify({ rsTechnicianId }) }
);
export const exportTechnician = (id: number) => api<{ rsTechnicianId: number; reused: boolean }>(
  `/sentinelgrid/technicians/${id}/export`, { method: "POST", body: JSON.stringify({}) }
);
export const listOrderTechnicians = (orderId: number) => api<{ technicians: SgTechnician[] }>(`/sentinelgrid/technicians/orders/${orderId}`);
export const linkOrderTechnician = (orderId: number, technicianId: number) => api<{ technicians: SgTechnician[] }>(
  `/sentinelgrid/technicians/orders/${orderId}/${technicianId}`, { method: "POST", body: JSON.stringify({}) }
);
export const unlinkOrderTechnician = (orderId: number, technicianId: number) => api<{ technicians: SgTechnician[] }>(
  `/sentinelgrid/technicians/orders/${orderId}/${technicianId}`, { method: "DELETE" }
);

export interface SgTechnicianAgendaItem {
  order_id: number;
  order_number: string;
  status: string;
  priority: string;
  scope: string;
  execution_days: number;
  start_date: string;
  end_date: string;
  technician_id: number;
  technician_name: string;
  equipment_id: number;
  equipment_tag: string;
  client_id: number;
  client_name: string;
  site_id: number | null;
  site_name: string | null;
  // OS gerada para o grupo (cliente + site + dia) ao qual esta OM pertence. Nula enquanto o grupo
  // não foi gerado em Gerar Demanda › Agendado.
  rs_service_order_id: number | null;
  rs_service_order_code: string;
}

export const listTechnicianAgenda = (params: { from: string; to: string; technicianId?: number }) => {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.technicianId) q.set("technicianId", String(params.technicianId));
  return api<{ agenda: SgTechnicianAgendaItem[] }>(`/sentinelgrid/technicians/agenda?${q}`);
};

export const rescheduleTechnicianOrder = (orderId: number, input: { startDate: string; executionDays: number }) =>
  api<{ order: unknown }>(`/sentinelgrid/technicians/agenda/orders/${orderId}`, {
    method: "PUT", body: JSON.stringify(input)
  });

export interface SgPreScheduleAssignment {
  orderId: number;
  orderNumber: string;
  status: string;
  equipmentId: number;
  equipmentTag: string;
  startDate: string;
  endDate: string;
  clientId: number;
  clientName: string;
  siteId: number | null;
  siteName: string;
  technicianId: number;
  technicianName: string;
}

export interface SgPreScheduleResult {
  assignments: SgPreScheduleAssignment[];
  unassigned: Array<Omit<SgPreScheduleAssignment, "technicianId" | "technicianName"> & { reason: string }>;
  workload: Array<{ technicianId: number; technicianName: string; existing: number; assigned: number; total: number }>;
  eligibleOrders: number;
  applied: boolean;
  appliedCount: number;
}

export const preScheduleOrders = (input: {
  technicianIds: number[];
  filters?: { search?: string; clientId?: number; status?: string; maintenanceType?: string };
  apply?: boolean;
}) => api<SgPreScheduleResult>("/sentinelgrid/technicians/pre-schedule", {
  method: "POST", body: JSON.stringify(input)
});
