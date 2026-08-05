import { api, API_BASE, downloadFile } from "./client";
import type { Order } from "./orders";
import type { Equipment } from "./equipments";
import type { Instrument, Technician } from "./assets";
import type { SparePart } from "./spareParts";

export interface OrderEquipment {
  equipment_id: number;
  type: string | null;
  serial_number: string | null;
  tag_number: string | null;
  manufacturer: string | null;
  model_family: string | null;
  customer_name: string | null;
  site_name: string | null;
}

export interface TimesheetEntry {
  id: number;
  service_order_id: number;
  activity_date: string | null;
  check_in_base: string | null;
  check_in_client: string | null;
  check_out_client: string | null;
  check_out_base: string | null;
  technician_name: string | null;
  worked_hours: number | string | null;
  notes: string | null;
}

export interface DailyLog {
  id: number;
  service_order_id: number;
  activity_date: string | null;
  title: string | null;
  content: string | null;
  notes: string | null;
  sort_order: number | null;
}

export interface Component {
  id: number;
  category: string | null;
  equipment_id: number | null;
  equipment_tag: string | null;
  description: string | null;
  part_number: string | null;
  quantity: number | string | null;
  notes: string | null;
  sort_order: number | null;
}

export interface OrderValidation {
  valid: boolean;
  hasEquipment: boolean;
  hasTimesheet: boolean;
  hasDailyDescription: boolean;
  hasConclusion: boolean;
  hasTechnicalTeam: boolean;
  missing: string[];
}

export interface OrderEditorPayload {
  order: Order & { service_order_code?: string | null; description?: string | null; proposal_number?: string | null; closing_date?: string | null };
  report: { id: number; status?: string | null };
  validation: OrderValidation;
  isSystemAdmin: boolean;
  timesheet: TimesheetEntry[];
  dailyLogs: DailyLog[];
  locked: boolean;
  orderEquipments: OrderEquipment[];
  availableEquipments: Equipment[];
  linkedTechnicians: Technician[];
  technicians: Technician[];
  availableTechnicians: Technician[];
  linkedInstruments: Instrument[];
  instruments: Instrument[];
  availableInstruments: Instrument[];
  components: Component[];
  componentCategories: string[];
  spareParts: SparePart[];
  componentsHasStyle: boolean;
}

export interface TimesheetInput {
  activityDate: string;
  checkInBase: string;
  checkInClient: string;
  checkOutClient: string;
  checkOutBase: string;
  technicianName: string;
  notes: string;
}

export function getOrderEditor(id: number) {
  return api<OrderEditorPayload>(`/orders/${id}/editor`);
}

export function validateOrder(id: number) {
  return api<{ ok: boolean; status: string }>(`/orders/${id}/validate`, { method: "POST", body: JSON.stringify({}) });
}
export function revalidateOrder(id: number) {
  return api<{ ok: boolean; status: string }>(`/orders/${id}/revalidate`, { method: "POST", body: JSON.stringify({}) });
}

export function addTimesheet(id: number, input: TimesheetInput) {
  return api<TimesheetEntry>(`/orders/${id}/timesheet`, { method: "POST", body: JSON.stringify(input) });
}

export function updateTimesheet(id: number, entryId: number, input: TimesheetInput) {
  return api<TimesheetEntry>(`/orders/${id}/timesheet/${entryId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteTimesheet(id: number, entryId: number) {
  return api<void>(`/orders/${id}/timesheet/${entryId}`, { method: "DELETE" });
}

// ---- Equipamentos / técnicos / instrumentos da OS -----------------------
export function attachEquipment(id: number, equipmentId: number, notes = "") {
  return api<{ ok: boolean }>(`/orders/${id}/equipments`, { method: "POST", body: JSON.stringify({ equipmentId, notes }) });
}
export function detachEquipment(id: number, equipmentId: number) {
  return api<void>(`/orders/${id}/equipments/${equipmentId}`, { method: "DELETE" });
}
export function linkTechnician(id: number, technicianId: number) {
  return api<{ ok: boolean }>(`/orders/${id}/technicians`, { method: "POST", body: JSON.stringify({ technicianId }) });
}
export function unlinkTechnician(id: number, techId: number) {
  return api<void>(`/orders/${id}/technicians/${techId}`, { method: "DELETE" });
}
export function linkInstrument(id: number, instrumentId: number) {
  return api<{ ok: boolean }>(`/orders/${id}/instruments`, { method: "POST", body: JSON.stringify({ instrumentId }) });
}
export function unlinkInstrument(id: number, instrId: number) {
  return api<void>(`/orders/${id}/instruments/${instrId}`, { method: "DELETE" });
}

// ---- Componentes (tabela) -----------------------------------------------
export interface ComponentInput {
  category: string;
  equipmentId: number | "";
  quantity: number | string;
  description: string;
  partNumber: string;
  notes: string;
}

export function addComponent(id: number, input: ComponentInput) {
  return api<{ ok: boolean }>(`/orders/${id}/components`, { method: "POST", body: JSON.stringify(input) });
}
export function updateComponent(id: number, componentId: number, input: ComponentInput) {
  return api<{ ok: boolean }>(`/orders/${id}/components/${componentId}`, { method: "PUT", body: JSON.stringify(input) });
}
export function deleteComponent(id: number, componentId: number) {
  return api<void>(`/orders/${id}/components/${componentId}`, { method: "DELETE" });
}

export interface ComponentSpareListItem {
  partNumber: string;
  description: string;
  quantity: number;
  categories: string[];
  equipmentTags: string[];
  equipments: string[];
  notes: string[];
  sourceRows: number;
}

export type ComponentSpareCategory = "recommended" | "required" | "replaced";

export interface ComponentSpareList {
  order: { id: number; code: string; title: string; customer: string; site: string };
  generatedAt: string;
  filters: {
    categories: ComponentSpareCategory[];
    categoryLabels: string[];
  };
  summary: {
    distinctPartNumbers: number;
    sourceComponents: number;
    totalQuantity: number;
    omittedMissingPartNumber: number;
    omittedByCategory: number;
  };
  items: ComponentSpareListItem[];
}

export function getComponentSpareList(id: number, categories: ComponentSpareCategory[]) {
  const selected = encodeURIComponent(categories.join(","));
  return api<ComponentSpareList>(`/orders/${id}/components/spare-list?format=json&categories=${selected}`);
}

export function downloadComponentSpareList(id: number, orderCode: string, categories: ComponentSpareCategory[]) {
  const safeCode = String(orderCode || `OS-${id}`).replace(/[^a-zA-Z0-9._-]/g, "-");
  const selected = encodeURIComponent(categories.join(","));
  return downloadFile(`/orders/${id}/components/spare-list?format=xlsx&categories=${selected}`, `lista-spare-parts-${safeCode}.xlsx`);
}

// Customização visual da tabela de componentes por IA (chat + preview)
export interface ComponentsStyleConfig { customCss?: string | null; [k: string]: unknown }
export interface ComponentsStyleResult { previewHtml: string; styleConfig: ComponentsStyleConfig | null }

export function componentsStyleAi(id: number, body: { instruction?: string; apply?: boolean; currentStyle?: ComponentsStyleConfig | null }) {
  return api<ComponentsStyleResult>(`/orders/${id}/components/style-ai`, { method: "POST", body: JSON.stringify(body) });
}
export function componentsStyleReset(id: number) {
  return api<ComponentsStyleResult>(`/orders/${id}/components/style-reset`, { method: "POST", body: JSON.stringify({}) });
}
export function componentsStyleDefault(id: number, currentStyle: ComponentsStyleConfig | null) {
  return api<ComponentsStyleResult>(`/orders/${id}/components/style-default`, { method: "POST", body: JSON.stringify({ currentStyle }) });
}

// ---- Anexos da OS -------------------------------------------------------
export interface Attachment {
  id: number;
  service_order_id: number;
  label: string | null;
  original_name: string | null;
  stored_name: string | null;
  file_size: number | string | null;
  mime_type: string | null;
  created_at: string | null;
}

export function listAttachments(id: number) {
  return api<{ ok: boolean; data: Attachment[] }>(`/orders/${id}/attachments`);
}
export function uploadAttachment(id: number, file: File, label: string) {
  return api<{ ok: boolean; data?: unknown; error?: string }>(`/orders/${id}/attachments`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-Label": encodeURIComponent(label.trim())
    },
    body: file
  });
}
export function deleteAttachment(id: number, attachmentId: number) {
  return api<{ ok: boolean }>(`/orders/${id}/attachments/${attachmentId}`, { method: "DELETE" });
}
export function attachmentDownloadUrl(id: number, attachmentId: number): string {
  return `${API_BASE}/orders/${id}/attachments/${attachmentId}/download`;
}

// ---- Enviar OS por e-mail -----------------------------------------------
export function sendOsEmail(id: number, body: { to: string; cc: string }) {
  return api<{ ok: boolean; recipients: string[]; cc: string[] }>(`/orders/${id}/send-os-email`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

// ---- Diário de bordo (daily logs) + IA ----------------------------------
export interface DailyLogInput {
  dailyLogId?: number;
  activityDate: string;
  title: string;
  content: string;
  notes: string;
  sortOrder: number;
}

export function saveDailyLog(id: number, input: DailyLogInput) {
  return api<DailyLog>(`/orders/${id}/daily-logs`, { method: "POST", body: JSON.stringify(input) });
}
export function deleteDailyLog(id: number, dailyLogId: number) {
  return api<void>(`/orders/${id}/daily-logs/${dailyLogId}`, { method: "DELETE" });
}
export function reviseDailyLogText(id: number, text: string, prompt = "") {
  return api<{ revisedText: string; revisedHtml: string }>(`/orders/${id}/daily-logs/revise-text`, {
    method: "POST",
    body: JSON.stringify({ text, prompt })
  });
}
export function generateConclusion(id: number, prompt = "") {
  return api<{ ok: boolean; log: DailyLog }>(`/orders/${id}/daily-logs/generate-conclusion`, {
    method: "POST",
    body: JSON.stringify({ prompt })
  });
}
