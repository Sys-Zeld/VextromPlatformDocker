import { api } from "../client";

export interface SgGroupMember {
  id: number;
  tag: string;
  serial_number: string;
  criticality: string;
  area_name?: string | null;
  equipment_type_id: number | null;
  equipment_type_name?: string | null;
}

export interface SgEquipmentGroup {
  id: number;
  site_id: number;
  site_name?: string;
  client_id?: number;
  client_name?: string;
  name: string;
  description: string;
  notes: string;
  member_count: number;
  members?: SgGroupMember[];
  created_at: string;
  updated_at: string;
}

export interface SgEquipmentGroupInput {
  siteId: number;
  name: string;
  description?: string;
  notes?: string;
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listEquipmentGroups(params: { siteId?: number; clientId?: number; search?: string } = {}) {
  return api<{ groups: SgEquipmentGroup[]; total: number }>(`/sentinelgrid/equipment-groups${qs(params)}`);
}

export function getEquipmentGroup(id: number) {
  return api<{ group: SgEquipmentGroup }>(`/sentinelgrid/equipment-groups/${id}`).then((r) => r.group);
}

export function createEquipmentGroup(input: SgEquipmentGroupInput) {
  return api<{ group: SgEquipmentGroup }>("/sentinelgrid/equipment-groups", { method: "POST", body: JSON.stringify(input) }).then((r) => r.group);
}

export function updateEquipmentGroup(id: number, input: SgEquipmentGroupInput) {
  return api<{ group: SgEquipmentGroup }>(`/sentinelgrid/equipment-groups/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.group);
}

export function deleteEquipmentGroup(id: number) {
  return api<void>(`/sentinelgrid/equipment-groups/${id}`, { method: "DELETE" });
}

export function addGroupMembers(id: number, equipmentIds: number[]) {
  return api<{ added: number; skippedWrongSite: number; eligible: number }>(
    `/sentinelgrid/equipment-groups/${id}/members`,
    { method: "POST", body: JSON.stringify({ equipmentIds }) }
  );
}

export function removeGroupMember(id: number, equipmentId: number) {
  return api<void>(`/sentinelgrid/equipment-groups/${id}/members/${equipmentId}`, { method: "DELETE" });
}
