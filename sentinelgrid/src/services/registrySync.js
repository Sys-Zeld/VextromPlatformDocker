// Troca de cadastros SentinelGrid ↔ Service Report (Cliente/Site/Equipamento).
//
// Princípio de isolamento (ADR-001/002/005): o SentinelGrid é o dono do contrato de
// integração. Ele consome o RS SÓ pelo contrato de serviço in-process
// (`serviceReportService`) — nunca o banco/repo do RS — e escreve apenas nas próprias
// tabelas `sg_*`. Quando exporta para o RS, usa `ensure*ByRef` (contrato de escrita
// idempotente do RS). Nada de JOIN/FK/transação cruzando a fronteira do módulo.
//
// Idempotência (ADR-004): o mapeamento 1:1 vive em `sg_rs_links` (por entidade); a
// referência externa (`external_source`/`external_id`) faz a dedupe do lado do RS.
// Reimportar/reexportar o mesmo cadastro atualiza o registro vinculado, não duplica.

const clientsRepo = require("../repositories/clientsRepository");
const sitesRepo = require("../repositories/sitesRepository");
const areasRepo = require("../repositories/areasRepository");
const equipmentRepo = require("../repositories/equipmentRepository");
const modelsRepo = require("../repositories/equipmentModelsRepository");
const { lookupRepo } = require("../repositories/lookupRepository");
const links = require("../repositories/rsLinksRepository");
// Contrato de serviço do RS (in-process, remote-ready — ADR-003).
const rs = require("../../../report_service/src/services/serviceReportService");

const manufacturersRepo = lookupRepo("sg_manufacturers");
const equipmentTypesRepo = lookupRepo("sg_equipment_types");

// Tag de origem usada na referência externa do lado do RS (SG→RS).
const SG_SOURCE = "sentinelgrid";
// Nome da área criada automaticamente ao importar equipamento do RS (que não tem "Área").
const DEFAULT_AREA_NAME = "Geral";
const FALLBACK_SITE_NAME = "Sem site (Service Report)";

function s(value) {
  return String(value == null ? "" : value).trim();
}

function syncError(message, code = "SG_SYNC_INVALID") {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Cria ou atualiza um registro vinculado, seguindo o mapeamento em sg_rs_links.
// `repoCreate`/`repoUpdate` são funções do repositório; devolve { id, reused }.
async function upsertLinked(entityType, rsId, buildInput, repoCreate, repoUpdate, actor) {
  const existingSgId = await links.getSgIdByRs(entityType, rsId);
  const input = buildInput();
  if (existingSgId) {
    const updated = await repoUpdate(existingSgId, input, actor);
    if (updated) {
      await links.upsertLink(entityType, existingSgId, rsId);
      return { id: existingSgId, reused: true };
    }
    // vínculo apontava para um registro removido → recria
  }
  const created = await repoCreate(input, actor);
  await links.upsertLink(entityType, created.id, rsId);
  return { id: created.id, reused: false };
}

// ---------------------------------------------------------------------------
// Helpers RS → SG (garantem a estrutura que o SG exige).
// ---------------------------------------------------------------------------

async function ensureSgClientFromRs(rsCustomer, actor) {
  return upsertLinked(
    "client",
    rsCustomer.id,
    () => ({
      name: s(rsCustomer.name) || `Cliente ${rsCustomer.id}`,
      taxId: "",
      segment: s(rsCustomer.customer_type),
      status: "ativo",
      notes: s(rsCustomer.notes)
    }),
    clientsRepo.createClient,
    clientsRepo.updateClient,
    actor
  );
}

async function ensureSgSiteFromRs(rsSite, sgClientId, actor) {
  return upsertLinked(
    "site",
    rsSite.id,
    () => ({
      clientId: sgClientId,
      name: s(rsSite.site_name) || `Site ${rsSite.id}`,
      siteType: "",
      location: s(rsSite.location),
      localContact: "",
      notes: s(rsSite.site_code) ? `Cód. Service Report: ${s(rsSite.site_code)}` : ""
    }),
    sitesRepo.createSite,
    sitesRepo.updateSite,
    actor
  );
}

// O RS não tem camada de "Área"; todo equipamento do SG exige `area_id`. Criamos/
// reusamos uma área "Geral" por site (dedupe por nome dentro do site).
async function ensureDefaultArea(siteId, actor) {
  const { areas } = await areasRepo.listAreas({ siteId, search: "", limit: 200, offset: 0 });
  const found = areas.find((a) => s(a.name).toLowerCase() === DEFAULT_AREA_NAME.toLowerCase());
  if (found) return found;
  return areasRepo.createArea(
    {
      siteId,
      name: DEFAULT_AREA_NAME,
      areaType: "",
      classification: "",
      accessRestrictions: "",
      envConditions: "",
      notes: "Área padrão criada na importação do Service Report."
    },
    actor
  );
}

// Site de fallback para equipamento do RS sem site (raro). Dedupe por nome no cliente.
async function ensureFallbackSite(clientId, actor) {
  const { sites } = await sitesRepo.listSites({ clientId, search: "", limit: 500, offset: 0 });
  const found = sites.find((st) => s(st.name).toLowerCase() === FALLBACK_SITE_NAME.toLowerCase());
  if (found) return found;
  return sitesRepo.createSite(
    { clientId, name: FALLBACK_SITE_NAME, siteType: "", location: "", localContact: "", notes: "" },
    actor
  );
}

function composeEquipmentNotes(rsEquipment) {
  const parts = [];
  const year = s(rsEquipment.year_of_manufacture);
  if (year) parts.push(`Ano de fabricação: ${year}`);
  const notes = s(rsEquipment.notes);
  if (notes) parts.push(notes);
  return parts.join(" — ");
}

// Importa/atualiza UM equipamento do RS num site do SG já resolvido: garante área
// "Geral" e tipo/fabricante/modelo (ensure-by-name), depois o equipamento.
async function importOneEquipmentRow(rsEquipment, sgSiteId, actor) {
  const area = await ensureDefaultArea(sgSiteId, actor);
  const type = await equipmentTypesRepo.ensureByName(rsEquipment.type, actor);
  const manufacturer = await manufacturersRepo.ensureByName(rsEquipment.manufacturer, actor);
  const model = manufacturer && type
    ? await modelsRepo.ensureModelByName(manufacturer.id, type.id, rsEquipment.model_family, actor)
    : null;

  return upsertLinked(
    "equipment",
    rsEquipment.id,
    () => ({
      areaId: area.id,
      tag: s(rsEquipment.tag_number) || s(rsEquipment.serial_number) || `EQ-RS-${rsEquipment.id}`,
      equipmentTypeId: type ? type.id : null,
      manufacturerId: manufacturer ? manufacturer.id : null,
      modelId: model ? model.id : null,
      serialNumber: s(rsEquipment.serial_number),
      ratedPower: s(rsEquipment.power),
      inputVoltage: s(rsEquipment.rated_ac_input_voltage),
      outputVoltage: s(rsEquipment.rated_ac_output_voltage),
      dcVoltage: s(rsEquipment.rated_dc_voltage),
      frequency: s(rsEquipment.input_frequency),
      redundancyConfig: "",
      moduleCount: null,
      batteryType: "",
      installDate: null,
      commissionDate: null,
      criticality: "media",
      operationalStatus: "operacional_normal",
      internalTechnician: "",
      notes: composeEquipmentNotes(rsEquipment)
    }),
    equipmentRepo.createEquipment,
    equipmentRepo.updateEquipment,
    actor
  );
}

// ---------------------------------------------------------------------------
// RS → SG : importar cliente (opcionalmente sites e equipamentos).
// ---------------------------------------------------------------------------
async function importCustomerFromReportService({ rsCustomerId, withSites = true, withEquipment = true } = {}, actor = "") {
  const rsId = Number(rsCustomerId);
  if (!rsId) throw syncError("Cliente do Service Report inválido.", "SG_RS_CUSTOMER_INVALID");
  const rsCustomer = await rs.getCustomer(rsId);
  if (!rsCustomer) throw syncError("Cliente do Service Report inexistente.", "SG_RS_CUSTOMER_INVALID");

  const clientResult = await ensureSgClientFromRs(rsCustomer, actor);
  const sgClientId = clientResult.id;
  const summary = {
    direction: "rs_to_sg",
    clientId: sgClientId,
    clientName: s(rsCustomer.name),
    clientReused: clientResult.reused,
    sites: 0,
    equipment: 0
  };

  if (!withSites && !withEquipment) return summary;

  // Mapa rsSiteId → sgSiteId (necessário para posicionar os equipamentos).
  const siteIdMap = new Map();
  const rsSites = await rs.listSitesByCustomer(rsCustomer.id);
  for (const rsSite of rsSites) {
    const siteResult = await ensureSgSiteFromRs(rsSite, sgClientId, actor);
    siteIdMap.set(Number(rsSite.id), siteResult.id);
    if (withSites) summary.sites += 1;
  }

  if (!withEquipment) return summary;

  const rsEquipments = await rs.listEquipmentsByCustomer(rsCustomer.id);
  for (const rsEquipment of rsEquipments) {
    let sgSiteId = rsEquipment.site_id ? siteIdMap.get(Number(rsEquipment.site_id)) : null;
    if (!sgSiteId) {
      const fallback = await ensureFallbackSite(sgClientId, actor);
      sgSiteId = fallback.id;
    }
    await importOneEquipmentRow(rsEquipment, sgSiteId, actor);
    summary.equipment += 1;
  }

  return summary;
}

// RS → SG : importar UM equipamento (garante o cliente e o site dele).
async function importEquipmentFromReportService({ rsEquipmentId } = {}, actor = "") {
  const reId = Number(rsEquipmentId);
  if (!reId) throw syncError("Equipamento do Service Report inválido.", "SG_RS_EQUIPMENT_INVALID");
  const rsEquipment = await rs.getEquipment(reId);
  if (!rsEquipment) throw syncError("Equipamento do Service Report inexistente.", "SG_RS_EQUIPMENT_INVALID");
  if (!rsEquipment.customer_id) {
    throw syncError("Equipamento do Service Report sem cliente — não é possível importar.", "SG_SYNC_INVALID");
  }

  const rsCustomer = await rs.getCustomer(rsEquipment.customer_id);
  if (!rsCustomer) throw syncError("Cliente do equipamento inexistente no Service Report.", "SG_SYNC_INVALID");
  const clientResult = await ensureSgClientFromRs(rsCustomer, actor);

  let sgSiteId = null;
  if (rsEquipment.site_id) {
    const rsSite = await rs.getSite(rsEquipment.site_id);
    if (rsSite) sgSiteId = (await ensureSgSiteFromRs(rsSite, clientResult.id, actor)).id;
  }
  if (!sgSiteId) sgSiteId = (await ensureFallbackSite(clientResult.id, actor)).id;

  const eqResult = await importOneEquipmentRow(rsEquipment, sgSiteId, actor);
  return {
    direction: "rs_to_sg",
    clientId: clientResult.id,
    clientName: s(rsCustomer.name),
    equipmentId: eqResult.id,
    equipmentTag: s(rsEquipment.tag_number) || s(rsEquipment.serial_number),
    equipmentReused: eqResult.reused,
    sites: 1,
    equipment: 1
  };
}

// ---------------------------------------------------------------------------
// SG → RS : exportar cliente (opcionalmente sites e equipamentos).
// ---------------------------------------------------------------------------

function clientNotes(client) {
  const parts = [];
  if (s(client.tax_id)) parts.push(`CNPJ: ${s(client.tax_id)}`);
  if (s(client.segment)) parts.push(`Segmento: ${s(client.segment)}`);
  if (s(client.notes)) parts.push(s(client.notes));
  return parts.join(" — ");
}

async function ensureRsCustomerFromSg(client, actor) {
  const { customer } = await rs.ensureCustomerByRef({
    externalSource: SG_SOURCE,
    externalId: String(client.id),
    name: s(client.name) || `Cliente ${client.id}`,
    customerType: "others",
    notes: clientNotes(client)
  });
  await links.upsertLink("client", client.id, customer.id);
  return customer;
}

async function ensureRsSiteFromSg(sgSite, rsCustomerId, actor) {
  const { site } = await rs.ensureSiteByRef({
    externalSource: SG_SOURCE,
    externalId: String(sgSite.id),
    customerId: rsCustomerId,
    siteName: s(sgSite.name) || `Site ${sgSite.id}`,
    location: s(sgSite.location),
    siteCode: "",
    notes: s(sgSite.notes)
  });
  await links.upsertLink("site", sgSite.id, site.id);
  return site;
}

async function ensureRsEquipmentFromSg(sgEquipment, rsCustomerId, rsSiteId) {
  const { equipment } = await rs.ensureEquipmentByRef({
    externalSource: SG_SOURCE,
    externalId: String(sgEquipment.id),
    customerId: rsCustomerId,
    siteId: rsSiteId,
    type: s(sgEquipment.equipment_type_name) || "Equipamento",
    serialNumber: s(sgEquipment.serial_number),
    power: s(sgEquipment.rated_power),
    ratedAcInputVoltage: s(sgEquipment.input_voltage),
    ratedAcOutputVoltage: s(sgEquipment.output_voltage),
    ratedDcVoltage: s(sgEquipment.dc_voltage),
    inputFrequency: s(sgEquipment.frequency),
    tagNumber: s(sgEquipment.tag),
    manufacturer: s(sgEquipment.manufacturer_name),
    modelFamily: s(sgEquipment.model_name),
    notes: s(sgEquipment.notes)
  });
  await links.upsertLink("equipment", sgEquipment.id, equipment.id);
  return equipment;
}

async function exportClientToReportService({ sgClientId, withSites = true, withEquipment = true } = {}, actor = "") {
  const clientId = Number(sgClientId);
  if (!clientId) throw syncError("Cliente do SentinelGrid inválido.", "SG_CLIENT_INVALID");
  const client = await clientsRepo.getClient(clientId);
  if (!client) throw syncError("Cliente do SentinelGrid inexistente.", "SG_CLIENT_INVALID");

  const customer = await ensureRsCustomerFromSg(client, actor);
  const summary = {
    direction: "sg_to_rs",
    rsCustomerId: Number(customer.id),
    rsCustomerName: s(customer.name),
    sites: 0,
    equipment: 0
  };

  if (!withSites && !withEquipment) return summary;

  // Mapa sgSiteId → rsSiteId.
  const siteIdMap = new Map();
  const { sites } = await sitesRepo.listSites({ clientId, search: "", limit: 1000, offset: 0 });
  for (const site of sites) {
    const rsSite = await ensureRsSiteFromSg(site, customer.id, actor);
    siteIdMap.set(Number(site.id), Number(rsSite.id));
    if (withSites) summary.sites += 1;
  }

  if (!withEquipment) return summary;

  const { equipment } = await equipmentRepo.listEquipment({ clientId, limit: 5000, offset: 0 });
  for (const eq of equipment) {
    let rsSiteId = siteIdMap.get(Number(eq.site_id));
    if (!rsSiteId) {
      // Garante o site mesmo quando withSites=false (equipamento exige site no RS).
      const site = await sitesRepo.getSite(eq.site_id);
      const rsSite = await ensureRsSiteFromSg(site || { id: eq.site_id, name: `Site ${eq.site_id}`, location: "", notes: "" }, customer.id, actor);
      rsSiteId = Number(rsSite.id);
      siteIdMap.set(Number(eq.site_id), rsSiteId);
    }
    await ensureRsEquipmentFromSg(eq, customer.id, rsSiteId);
    summary.equipment += 1;
  }

  return summary;
}

// SG → RS : exportar UM equipamento (garante o cliente e o site dele).
async function exportEquipmentToReportService({ sgEquipmentId } = {}, actor = "") {
  const eqId = Number(sgEquipmentId);
  if (!eqId) throw syncError("Equipamento do SentinelGrid inválido.", "SG_EQUIPMENT_INVALID");
  const eq = await equipmentRepo.getEquipment(eqId);
  if (!eq) throw syncError("Equipamento do SentinelGrid inexistente.", "SG_EQUIPMENT_INVALID");

  const client = await clientsRepo.getClient(eq.client_id);
  if (!client) throw syncError("Cliente do equipamento inexistente no SentinelGrid.", "SG_SYNC_INVALID");
  const customer = await ensureRsCustomerFromSg(client, actor);

  const site = await sitesRepo.getSite(eq.site_id);
  const rsSite = await ensureRsSiteFromSg(site || { id: eq.site_id, name: eq.site_name || `Site ${eq.site_id}`, location: "", notes: "" }, customer.id, actor);

  const rsEquipment = await ensureRsEquipmentFromSg(eq, customer.id, Number(rsSite.id));
  return {
    direction: "sg_to_rs",
    rsCustomerId: Number(customer.id),
    rsCustomerName: s(customer.name),
    equipmentId: Number(rsEquipment.id),
    equipmentTag: s(eq.tag),
    sites: 1,
    equipment: 1
  };
}

// ---------------------------------------------------------------------------
// Listagens (candidatos a importar/exportar com o status do vínculo).
// ---------------------------------------------------------------------------

async function listReportServiceImportable() {
  const customers = await rs.listCustomers();
  const result = [];
  for (const c of customers) {
    const sgClientId = await links.getSgIdByRs("client", c.id);
    result.push({
      id: Number(c.id),
      name: s(c.name),
      customer_type: s(c.customer_type),
      notes: s(c.notes),
      sg_linked: !!sgClientId,
      sg_client_id: sgClientId
    });
  }
  return result;
}

async function listReportServiceExportable() {
  const { clients } = await clientsRepo.listClients({ search: "", limit: 1000, offset: 0 });
  const result = [];
  for (const c of clients) {
    const rsCustomerId = await links.getRsIdBySg("client", c.id);
    result.push({
      id: Number(c.id),
      name: s(c.name),
      tax_id: s(c.tax_id),
      status: s(c.status),
      rs_linked: !!rsCustomerId,
      rs_customer_id: rsCustomerId
    });
  }
  return result;
}

// Equipamentos do RS disponíveis para importar no SG (marca os já vinculados).
async function listReportServiceImportableEquipment() {
  const equipments = await rs.listEquipments();
  const result = [];
  for (const e of equipments) {
    const linkedByExternalRef =
      s(e.external_source) === SG_SOURCE && Number(s(e.external_id)) ? Number(s(e.external_id)) : null;
    const candidateSgEquipmentId = (await links.getSgIdByRs("equipment", e.id)) || linkedByExternalRef;
    const linkedEquipment = candidateSgEquipmentId ? await equipmentRepo.getEquipment(candidateSgEquipmentId) : null;
    const sgEquipmentId = linkedEquipment ? Number(candidateSgEquipmentId) : null;
    result.push({
      id: Number(e.id),
      tag: s(e.tag_number) || s(e.serial_number),
      customer_name: s(e.customer_name),
      site_name: s(e.site_name),
      sg_linked: !!sgEquipmentId,
      sg_equipment_id: sgEquipmentId
    });
  }
  return result;
}

// Equipamentos do SG disponíveis para exportar ao RS (marca os já vinculados).
async function listReportServiceExportableEquipment() {
  const { equipment } = await equipmentRepo.listEquipment({ limit: 5000, offset: 0 });
  const rsEquipments = await rs.listEquipments();
  const rsIds = new Set(rsEquipments.map((e) => Number(e.id)));
  const rsBySgId = new Map();
  for (const e of rsEquipments) {
    if (s(e.external_source) !== SG_SOURCE) continue;
    const sgId = Number(s(e.external_id));
    if (sgId) rsBySgId.set(sgId, Number(e.id));
  }
  const result = [];
  for (const e of equipment) {
    const linkedRsEquipmentId = await links.getRsIdBySg("equipment", e.id);
    const rsEquipmentId =
      (linkedRsEquipmentId && rsIds.has(Number(linkedRsEquipmentId)) ? Number(linkedRsEquipmentId) : null) ||
      rsBySgId.get(Number(e.id)) ||
      null;
    result.push({
      id: Number(e.id),
      tag: s(e.tag) || s(e.serial_number),
      client_name: s(e.client_name),
      site_name: s(e.site_name),
      rs_linked: !!rsEquipmentId,
      rs_equipment_id: rsEquipmentId
    });
  }
  return result;
}

module.exports = {
  importCustomerFromReportService,
  exportClientToReportService,
  importEquipmentFromReportService,
  exportEquipmentToReportService,
  listReportServiceImportable,
  listReportServiceExportable,
  listReportServiceImportableEquipment,
  listReportServiceExportableEquipment
};
