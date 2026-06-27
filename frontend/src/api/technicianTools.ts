import { api } from "./client";
import type { Technician } from "./assets";

export interface Tool {
  id: number;
  technician_id: number;
  item: string;
  quantity: number;
  description: string | null;
  serial_number: string | null;
  notes: string | null;
}

export interface ToolsPayload {
  technician: Technician;
  tools: Tool[];
}

export interface ToolCreateInput {
  item: string;
  quantity: number;
  description: string;
  serialNumber: string;
  notes: string;
}

export type ToolUpdateInput = Omit<ToolCreateInput, "item">;

export function listTechnicianTools(techId: number) {
  return api<ToolsPayload>(`/assets/technicians/${techId}/tools`);
}

export function createTechnicianTool(techId: number, input: ToolCreateInput) {
  return api<Tool>(`/assets/technicians/${techId}/tools`, { method: "POST", body: JSON.stringify(input) });
}

export function updateTechnicianTool(techId: number, toolId: number, input: ToolUpdateInput) {
  return api<Tool>(`/assets/technicians/${techId}/tools/${toolId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteTechnicianTool(techId: number, toolId: number) {
  return api<void>(`/assets/technicians/${techId}/tools/${toolId}`, { method: "DELETE" });
}
