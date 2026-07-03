import { api } from "../client";

export const CHECKLIST_RESULT_STATUS_OPTIONS = [
  { value: "pendente", label: "Pendente", variant: "secondary" },
  { value: "ok", label: "OK", variant: "success" },
  { value: "nao_conforme", label: "Nao conforme", variant: "danger" },
  { value: "nao_aplicavel", label: "Nao aplicavel", variant: "dark" }
] as const;

export type SgChecklistResultStatus = typeof CHECKLIST_RESULT_STATUS_OPTIONS[number]["value"];

export interface SgOrderChecklistExecutionItem {
  checklist_item_id: number;
  title: string;
  item_type: string;
  required: boolean;
  expected_value: string;
  unit: string;
  acceptance_criteria: string;
  order_index: number;
  result_id: number | null;
  value: string;
  status: SgChecklistResultStatus;
  notes: string;
  result_updated_at: string | null;
}

export interface SgOrderChecklistExecution {
  order: { id: number; order_number: string; checklist_id: number; checklist_name: string };
  checklist: { id: number; name: string };
  items: SgOrderChecklistExecutionItem[];
}

export interface SgChecklistResultInput {
  checklistItemId: number;
  value: string;
  status: SgChecklistResultStatus;
  notes: string;
}

export function getOrderChecklistExecution(orderId: number) {
  return api<SgOrderChecklistExecution>(`/sentinelgrid/maintenance-orders/${orderId}/checklist-results`);
}

export function saveOrderChecklistResult(orderId: number, input: SgChecklistResultInput) {
  return api<{ result: unknown }>(`/sentinelgrid/maintenance-orders/${orderId}/checklist-results`, { method: "POST", body: JSON.stringify(input) });
}
