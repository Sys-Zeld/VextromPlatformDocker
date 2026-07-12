import { api } from "../client";

// Troca de cadastros SentinelGrid ↔ Service Report. Todas as rotas ficam sob a
// façade do SentinelGrid (dono do contrato de integração). A tela de Clientes do RS
// também consome estes endpoints para "buscar do SentinelGrid".

export interface RsImportableCustomer {
  id: number;
  name: string;
  customer_type: string;
  notes: string;
  sg_linked: boolean;
  sg_client_id: number | null;
}

export interface SgExportableClient {
  id: number;
  name: string;
  tax_id: string;
  status: string;
  rs_linked: boolean;
  rs_customer_id: number | null;
}

export interface SyncResult {
  direction: "rs_to_sg" | "sg_to_rs";
  clientId?: number;
  clientName?: string;
  clientReused?: boolean;
  rsCustomerId?: number;
  rsCustomerName?: string;
  equipmentId?: number;
  equipmentTag?: string;
  equipmentReused?: boolean;
  sites: number;
  equipment: number;
}

export interface RsImportableEquipment {
  id: number;
  tag: string;
  customer_name: string;
  site_name: string;
  sg_linked: boolean;
  sg_equipment_id: number | null;
}

export interface SgExportableEquipment {
  id: number;
  tag: string;
  client_name: string;
  site_name: string;
  rs_linked: boolean;
  rs_equipment_id: number | null;
}

export interface SyncOptions {
  withSites: boolean;
  withEquipment: boolean;
}

// RS → SG : importar para o SentinelGrid
export function listRsImportable() {
  return api<{ customers: RsImportableCustomer[] }>("/sentinelgrid/integration/report-service/importable");
}

export function importFromReportService(rsCustomerId: number, opts: SyncOptions) {
  return api<{ result: SyncResult }>("/sentinelgrid/integration/report-service/import", {
    method: "POST",
    body: JSON.stringify({ rsCustomerId, ...opts })
  });
}

// SG → RS : exportar do SentinelGrid para o Service Report
export function listSgExportable() {
  return api<{ clients: SgExportableClient[] }>("/sentinelgrid/integration/report-service/exportable");
}

export function exportToReportService(sgClientId: number, opts: SyncOptions) {
  return api<{ result: SyncResult }>("/sentinelgrid/integration/report-service/export", {
    method: "POST",
    body: JSON.stringify({ sgClientId, ...opts })
  });
}

// Equipamento — RS → SG (importar). Traz junto o cliente e o site do equipamento.
export function listRsImportableEquipment() {
  return api<{ equipment: RsImportableEquipment[] }>("/sentinelgrid/integration/report-service/importable-equipment");
}

export function importEquipmentFromReportService(rsEquipmentId: number) {
  return api<{ result: SyncResult }>("/sentinelgrid/integration/report-service/import-equipment", {
    method: "POST",
    body: JSON.stringify({ rsEquipmentId })
  });
}

// Equipamento — SG → RS (exportar). Traz junto o cliente e o site do equipamento.
export function listSgExportableEquipment() {
  return api<{ equipment: SgExportableEquipment[] }>("/sentinelgrid/integration/report-service/exportable-equipment");
}

export function exportEquipmentToReportService(sgEquipmentId: number) {
  return api<{ result: SyncResult }>("/sentinelgrid/integration/report-service/export-equipment", {
    method: "POST",
    body: JSON.stringify({ sgEquipmentId })
  });
}
