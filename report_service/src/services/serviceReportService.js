const path = require("path");
const fs = require("fs");
const repo = require("../repositories/serviceReportRepository");
const {
  getDefaultMeasurementStyleConfig,
  applyDefaultMeasurementStyle,
  getDefaultAlberStyleConfig,
  applyDefaultAlberStyle,
  getDefaultDischargeStyleConfig,
  applyDefaultDischargeStyle,
  getDefaultTimesheetStyleConfig,
  getDefaultTechteamStyleConfig,
  getDefaultEquipmentStyleConfig,
  getDefaultComponentsStyleConfig,
  applyDefaultComponentsStyle,
  getDefaultUpsStyleConfig,
  applyDefaultUpsStyle,
  getDefaultEventLogStyleConfig,
  applyDefaultEventLogStyle
} = require("./measurementStyleService");
const objectStorage = require("../../../specflow/services/objectStorage");
const { normalizeSectionContent } = require("./quillContentService");
const {
  ORDER_STATUSES,
  REPORT_STATUSES,
  SECTION_DEFINITIONS,
  COMPONENT_CATEGORIES,
  SIGNER_TYPES
} = require("../constants");
let reportPdfDirReady = false;
let reportHtmlDirReady = false;

function ensureStatus(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function buildOrderCode(customerName, year, sequence) {
  const pattern = String(process.env.SERVICE_REPORT_ORDER_CODE_PATTERN || "CLIENT_YEAR_SEQ").toUpperCase();
  const seq = String(sequence).padStart(3, "0");
  const yearShort = String(year).slice(-2);
  const customerCode = String(customerName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4) || "CLNT";

  if (pattern === "SHORT_YEAR_SEQ") return `${yearShort}-${seq}`;
  if (pattern === "YEAR_SEQ") return `${year}-${seq}`;
  return `OS-${customerCode}-${year}-${seq}`;
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function equipmentDuplicateError() {
  const err = new Error("TAG ja cadastrada neste site.");
  err.statusCode = 409;
  err.errorCode = "EQUIPMENT_TAG_DUPLICATE";
  return err;
}

async function ensureEquipmentTagUnique(siteId, tagNumber, excludeId = null) {
  const tag = sanitizeText(tagNumber);
  if (!tag) return;
  const duplicate = await repo.findEquipmentBySiteTag(repo.toInt(siteId), tag, excludeId);
  if (duplicate) throw equipmentDuplicateError();
}

function normalizeComponentCategory(value) {
  const normalized = sanitizeText(value).toLowerCase();
  const allowed = (COMPONENT_CATEGORIES || [])
    .map((item) => sanitizeText(item).toLowerCase())
    .filter(Boolean);
  if (!normalized || !allowed.includes(normalized)) {
    const err = new Error("Categoria de componente invalida.");
    err.statusCode = 422;
    throw err;
  }
  return normalized;
}

function normalizeSignerType(value) {
  const normalized = sanitizeText(value).toLowerCase();
  const aliases = new Map([
    ["vextrom_technician", "vextrom_technician"],
    ["tecnicos_vextrom", "vextrom_technician"],
    ["tecnico_vextrom", "vextrom_technician"],
    ["customer_responsible", "customer_responsible"],
    ["responsavel_cliente", "customer_responsible"],
    ["project_manager", "project_manager"],
    ["gerente_projeto", "project_manager"],
    ["technical_director", "technical_director"],
    ["diretor_tecnico", "technical_director"]
  ]);
  if (aliases.has(normalized)) return aliases.get(normalized);

  const normalizedAllowed = new Set(
    (SIGNER_TYPES || [])
      .map((item) => sanitizeText(item).toLowerCase())
      .filter(Boolean)
  );
  if (!normalized || !normalizedAllowed.has(normalized)) {
    const err = new Error("Tipo de assinatura invalido.");
    err.statusCode = 422;
    throw err;
  }
  return normalized;
}

async function createOrder(input = {}) {
  const proposalNumber = Object.prototype.hasOwnProperty.call(input, "proposalNumber")
    ? input.proposalNumber
    : input.proposal_number;
  const customerId = repo.toInt(input.customerId);
  if (!customerId) {
    const err = new Error("OS requer cliente.");
    err.statusCode = 422;
    throw err;
  }
  const customer = await repo.getCustomerById(customerId);
  if (!customer) {
    const err = new Error("Cliente nao encontrado.");
    err.statusCode = 404;
    throw err;
  }
  const siteId = repo.toInt(input.siteId);
  if (!siteId) {
    const err = new Error("OS requer site.");
    err.statusCode = 422;
    throw err;
  }
  const year = Number(input.year || new Date().getFullYear());
  const sequence = await repo.getOrderCodeSequence(year);
  const serviceOrderCode = buildOrderCode(customer.name, year, sequence);
  const created = await repo.createOrder({
    serviceOrderCode,
    year,
    customerId,
    siteId: repo.toInt(input.siteId),
    title: sanitizeText(input.title) || `Ordem ${serviceOrderCode}`,
    proposalNumber: sanitizeText(proposalNumber),
    description: sanitizeText(input.description),
    status: ensureStatus(input.status, ORDER_STATUSES, "draft"),
    openingDate: input.openingDate || null,
    closingDate: input.closingDate || null,
    createdBy: sanitizeText(input.createdBy),
    updatedBy: sanitizeText(input.updatedBy)
  });

  // After a successful creation, move the configured sequence forward.
  // This keeps the manual initialization as a starting point only.
  try {
    await repo.setOrderCodeSeed(year, Number(sequence) + 1);
  } catch (_err) {
    // Do not block OS creation if seed persistence fails.
  }

  await ensureReportForOrder(created.id, created.title);
  return repo.getOrderById(created.id);
}

async function updateOrder(id, input = {}) {
  const existing = await repo.getOrderById(id);
  if (!existing) {
    const err = new Error("OS nao encontrada.");
    err.statusCode = 404;
    throw err;
  }
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const hasProposalNumber = hasOwn(input, "proposalNumber") || hasOwn(input, "proposal_number");
  const proposalNumber = hasOwn(input, "proposalNumber") ? input.proposalNumber : input.proposal_number;
  const customerId = repo.toInt(hasOwn(input, "customerId") ? input.customerId : existing.customer_id);
  const siteId = repo.toInt(hasOwn(input, "siteId") ? input.siteId : existing.site_id);
  if (!customerId) {
    const err = new Error("OS requer cliente.");
    err.statusCode = 422;
    throw err;
  }
  const updated = await repo.updateOrder(id, {
    customerId,
    siteId,
    title: sanitizeText(input.title || existing.title),
    proposalNumber: sanitizeText(hasProposalNumber ? proposalNumber : existing.proposal_number),
    description: sanitizeText(input.description || existing.description),
    status: ensureStatus(input.status || existing.status, ORDER_STATUSES, "draft"),
    openingDate: input.openingDate || existing.opening_date || null,
    closingDate: input.closingDate || existing.closing_date || null,
    updatedBy: sanitizeText(input.updatedBy)
  });
  return updated;
}

async function createCustomer(input = {}) {
  const name = sanitizeText(input.name);
  if (!name) {
    const err = new Error("Nome do cliente e obrigatorio.");
    err.statusCode = 422;
    throw err;
  }
  return repo.createCustomer({
    name,
    customerType: sanitizeText(input.customerType || "others").toLowerCase(),
    notes: sanitizeText(input.notes)
  });
}

async function createSite(input = {}) {
  const customerId = repo.toInt(input.customerId);
  if (!customerId) {
    const err = new Error("Site requer cliente.");
    err.statusCode = 422;
    throw err;
  }
  const siteName = sanitizeText(input.siteName);
  if (!siteName) {
    const err = new Error("Nome do site e obrigatorio.");
    err.statusCode = 422;
    throw err;
  }
  const latitude = input.latitude !== "" && input.latitude != null ? Number(input.latitude) : null;
  const longitude = input.longitude !== "" && input.longitude != null ? Number(input.longitude) : null;
  return repo.createSite({
    customerId,
    siteName,
    siteCode: sanitizeText(input.siteCode),
    location: sanitizeText(input.location),
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    notes: sanitizeText(input.notes)
  });
}

async function createEquipment(input = {}) {
  const type = sanitizeText(input.type);
  if (!type) {
    const err = new Error("Tipo de equipamento e obrigatorio.");
    err.statusCode = 422;
    throw err;
  }
  const payload = {
    customerId: repo.toInt(input.customerId),
    siteId: repo.toInt(input.siteId),
    type,
    yearOfManufacture: sanitizeText(input.yearOfManufacture),
    serialNumber: sanitizeText(input.serialNumber),
    power: sanitizeText(input.power),
    ratedAcInputVoltage: sanitizeText(input.ratedAcInputVoltage),
    inputFrequency: sanitizeText(input.inputFrequency),
    ratedDcVoltage: sanitizeText(input.ratedDcVoltage),
    ratedAcOutputVoltage: sanitizeText(input.ratedAcOutputVoltage),
    outputFrequency: sanitizeText(input.outputFrequency),
    degreeOfProtection: sanitizeText(input.degreeOfProtection),
    mainLabel: sanitizeText(input.mainLabel),
    dtNumber: sanitizeText(input.dtNumber),
    tagNumber: sanitizeText(input.tagNumber),
    manufacturer: sanitizeText(input.manufacturer),
    modelFamily: sanitizeText(input.modelFamily),
    notes: sanitizeText(input.notes)
  };
  await ensureEquipmentTagUnique(payload.siteId, payload.tagNumber);
  return repo.createEquipment(payload);
}

async function updateEquipment(id, input = {}) {
  const existing = await repo.getEquipmentById(id);
  if (!existing) {
    const err = new Error("Equipamento nao encontrado.");
    err.statusCode = 404;
    throw err;
  }
  const pick = (value, fallback) => (value === undefined ? fallback : value);
  const payload = {
    customerId: repo.toInt(pick(input.customerId, existing.customer_id)),
    siteId: repo.toInt(pick(input.siteId, existing.site_id)),
    type: sanitizeText(pick(input.type, existing.type)),
    yearOfManufacture: sanitizeText(pick(input.yearOfManufacture, existing.year_of_manufacture)),
    serialNumber: sanitizeText(pick(input.serialNumber, existing.serial_number)),
    power: sanitizeText(pick(input.power, existing.power)),
    ratedAcInputVoltage: sanitizeText(pick(input.ratedAcInputVoltage, existing.rated_ac_input_voltage)),
    inputFrequency: sanitizeText(pick(input.inputFrequency, existing.input_frequency)),
    ratedDcVoltage: sanitizeText(pick(input.ratedDcVoltage, existing.rated_dc_voltage)),
    ratedAcOutputVoltage: sanitizeText(pick(input.ratedAcOutputVoltage, existing.rated_ac_output_voltage)),
    outputFrequency: sanitizeText(pick(input.outputFrequency, existing.output_frequency)),
    degreeOfProtection: sanitizeText(pick(input.degreeOfProtection, existing.degree_of_protection)),
    mainLabel: sanitizeText(pick(input.mainLabel, existing.main_label)),
    dtNumber: sanitizeText(pick(input.dtNumber, existing.dt_number)),
    tagNumber: sanitizeText(pick(input.tagNumber, existing.tag_number)),
    manufacturer: sanitizeText(pick(input.manufacturer, existing.manufacturer)),
    modelFamily: sanitizeText(pick(input.modelFamily, existing.model_family)),
    notes: sanitizeText(pick(input.notes, existing.notes))
  };
  await ensureEquipmentTagUnique(payload.siteId, payload.tagNumber, id);
  return repo.updateEquipment(id, payload);
}

async function deleteEquipment(id) {
  const existing = await repo.getEquipmentById(id);
  if (!existing) {
    const err = new Error("Equipamento nao encontrado.");
    err.statusCode = 404;
    throw err;
  }
  return repo.deleteEquipment(id);
}

async function ensureReportForOrder(serviceOrderId, fallbackTitle = "") {
  const existing = await repo.getReportByOrderId(serviceOrderId);
  if (existing) {
    return existing;
  }
  const order = await repo.getOrderById(serviceOrderId);
  if (!order) {
    const err = new Error("OS nao encontrada para gerar relatorio.");
    err.statusCode = 404;
    throw err;
  }
  const reportNumber = `SR-${order.service_order_code}`;
  const created = await repo.createReport({
    serviceOrderId,
    reportNumber,
    revision: "A",
    title: fallbackTitle || `Relatorio ${order.service_order_code}`,
    status: "draft",
    documentLanguage: "pt"
  });
  await repo.ensureDefaultSections(created.id);
  return created;
}

async function updateReport(id, input = {}) {
  const existing = await repo.getReportById(id);
  if (!existing) {
    const err = new Error("Relatorio nao encontrado.");
    err.statusCode = 404;
    throw err;
  }
  return repo.updateReport(id, {
    revision: sanitizeText(input.revision || existing.revision || "A"),
    title: sanitizeText(input.title || existing.title),
    status: ensureStatus(input.status || existing.status, REPORT_STATUSES, "draft"),
    issueDate: input.issueDate || existing.issue_date || null,
    documentLanguage: sanitizeText(input.documentLanguage || existing.document_language || "pt").toLowerCase(),
    preparedBy: sanitizeText(input.preparedBy || existing.prepared_by),
    reviewedBy: sanitizeText(input.reviewedBy || existing.reviewed_by),
    approvedBy: sanitizeText(input.approvedBy || existing.approved_by),
    pdfPath: sanitizeText(input.pdfPath || existing.pdf_path || "")
  });
}

async function upsertReportSection(reportId, sectionKey, sectionInput = {}) {
  const normalizedKey = String(sectionKey || "").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(normalizedKey)) {
    const err = new Error("Secao invalida.");
    err.statusCode = 422;
    throw err;
  }
  const fallbackDefinition = SECTION_DEFINITIONS.find((item) => item.key === normalizedKey);
  const currentSection = await repo.getSectionByKey(reportId, normalizedKey);
  const normalizedInput = typeof sectionInput === "string"
    ? { contentHtml: sectionInput }
    : {
      sectionTitle: sectionInput.sectionTitle || sectionInput.section_title,
      sectionTitleDeltaJson: sectionInput.sectionTitleDeltaJson || sectionInput.section_title_delta_json,
      sectionTitleHtml: sectionInput.sectionTitleHtml || sectionInput.section_title_html,
      sectionTitleText: sectionInput.sectionTitleText || sectionInput.section_title_text,
      contentDeltaJson: sectionInput.contentDeltaJson || sectionInput.content_delta_json,
      contentHtml: sectionInput.contentHtml || sectionInput.content_html || sectionInput.content,
      contentText: sectionInput.contentText || sectionInput.content_text,
      imageLeftPath: sectionInput.imageLeftPath || sectionInput.image_left_path,
      imageRightPath: sectionInput.imageRightPath || sectionInput.image_right_path,
      sortOrder: sectionInput.sortOrder || sectionInput.sort_order || currentSection?.sort_order,
      isVisible: sectionInput.isVisible !== undefined ? sectionInput.isVisible : sectionInput.is_visible
    };
  const normalized = normalizeSectionContent(
    normalizedInput,
    currentSection?.section_title || fallbackDefinition?.title || normalizedKey
  );
  await repo.upsertSection(reportId, normalizedKey, {
    ...normalized,
    sortOrder: normalizedInput.sortOrder
  });
  await repo.replaceSectionImages(reportId, normalizedKey, [
    {
      filePath: normalized.imageLeftPath,
      caption: "Imagem 1",
      sortOrder: 1
    },
    {
      filePath: normalized.imageRightPath,
      caption: "Imagem 2",
      sortOrder: 2
    }
  ]);
  return repo.listSections(reportId);
}

async function createReportSection(reportId, sectionInput = {}) {
  const normalized = normalizeSectionContent(sectionInput, "NOVO CAPITULO");
  await repo.createSection(reportId, normalized);
  return repo.listSections(reportId);
}

async function deleteReportSection(reportId, sectionKey) {
  const normalizedKey = String(sectionKey || "").trim().toLowerCase();
  if (!/^[a-z0-9_]+$/.test(normalizedKey)) {
    const err = new Error("Secao invalida.");
    err.statusCode = 422;
    throw err;
  }
  await repo.deleteImagesBySection(reportId, normalizedKey);
  const deleted = await repo.deleteSection(reportId, normalizedKey);
  if (!deleted) {
    const err = new Error("Secao nao encontrada.");
    err.statusCode = 404;
    throw err;
  }
  return repo.listSections(reportId);
}

async function createComponent(reportId, input = {}) {
  const category = normalizeComponentCategory(input.category);
  if (!sanitizeText(input.description)) {
    const err = new Error("Descricao do componente e obrigatoria.");
    err.statusCode = 422;
    throw err;
  }
  return repo.createComponent({
    serviceReportId: reportId,
    category,
    equipmentId: repo.toInt(input.equipmentId),
    quantity: Number(input.quantity || 1),
    description: sanitizeText(input.description),
    partNumber: sanitizeText(input.partNumber),
    notes: sanitizeText(input.notes),
    sortOrder: Number(input.sortOrder || 0)
  });
}

async function updateComponent(id, input = {}) {
  const category = normalizeComponentCategory(input.category);
  return repo.updateComponent(id, {
    category,
    equipmentId: repo.toInt(input.equipmentId),
    quantity: Number(input.quantity || 1),
    description: sanitizeText(input.description),
    partNumber: sanitizeText(input.partNumber),
    notes: sanitizeText(input.notes),
    sortOrder: Number(input.sortOrder || 0)
  });
}

async function createSignature(reportId, input = {}) {
  const signerType = normalizeSignerType(input.signerType);
  const signerName = sanitizeText(input.signerName);
  if (!signerName) {
    const err = new Error("Assinatura exige nome do signatario.");
    err.statusCode = 422;
    throw err;
  }
  let currentRevision = "";
  try {
    const reportNow = await repo.getReportById(reportId);
    currentRevision = sanitizeText(reportNow && reportNow.revision);
  } catch (_err) {
    // non-blocking
  }
  const created = await repo.createSignature({
    serviceReportId: reportId,
    signerType,
    signerName,
    signerRole: sanitizeText(input.signerRole),
    signerCompany: sanitizeText(input.signerCompany),
    signatureData: sanitizeText(input.signatureData),
    signatureFilePath: sanitizeText(input.signatureFilePath),
    revision: currentRevision,
    ipAddress: sanitizeText(input.ipAddress).slice(0, 100),
    userAgent: sanitizeText(input.userAgent).slice(0, 500)
  });
  if (signerType === "vextrom_technician") {
    try {
      await updateReport(reportId, {
        preparedBy: signerName
      });
    } catch (_err) {
      // keep signature recorded even if report metadata update fails
    }
  }
  if (signerType === "customer_responsible") {
    const report = await repo.getReportById(reportId);
    if (report && report.service_order_id) {
      try {
        const order = await repo.getOrderById(report.service_order_id);
        const orderSystemUser = sanitizeText(order && (order.created_by || order.updated_by));
        await updateOrder(report.service_order_id, {
          status: "approved",
          updatedBy: sanitizeText(input.updatedBy) || orderSystemUser || "customer-signature"
        });
      } catch (_err) {
        // keep signature recorded even if order status update fails
      }
    }
  }
  return created;
}

async function buildReportAggregate(serviceReportId) {
  const report = await repo.getReportById(serviceReportId);
  if (!report) return null;
  const order = await repo.getOrderById(report.service_order_id);
  const customer = order ? await repo.getCustomerById(order.customer_id) : null;
  const site = order && order.site_id ? await repo.getSiteById(order.site_id) : null;
  const sections = await repo.listSections(serviceReportId);
  const components = await repo.listComponents(serviceReportId);
  const [measurementRows, defaultMeasurementStyleConfig, defaultComponentsStyleConfig, upsMeasuresRows, defaultUpsStyleConfig, eventLogRows, defaultEventLogStyleConfig] = await Promise.all([
    repo.listMeasurementTables(serviceReportId),
    getDefaultMeasurementStyleConfig(),
    getDefaultComponentsStyleConfig(),
    repo.listUpsMeasuresByReport(serviceReportId),
    getDefaultUpsStyleConfig(),
    repo.listEventLogsByReport(serviceReportId),
    getDefaultEventLogStyleConfig()
  ]);
  const measurements = applyDefaultMeasurementStyle(measurementRows, defaultMeasurementStyleConfig);
  const upsMeasures = applyDefaultUpsStyle(upsMeasuresRows, defaultUpsStyleConfig);
  const eventLogs = applyDefaultEventLogStyle(eventLogRows, defaultEventLogStyleConfig);
  const reportWithDefaults = applyDefaultComponentsStyle(report, defaultComponentsStyleConfig);
  const [alberRows, defaultAlberStyleConfig, dischargeRows, defaultDischargeStyleConfig, timesheetStyleConfig, techteamStyleConfig, equipmentStyleConfig] = await Promise.all([
    repo.listLeiturasAlberByReport(serviceReportId),
    getDefaultAlberStyleConfig(),
    repo.listDischargeTestsByReport(serviceReportId),
    getDefaultDischargeStyleConfig(),
    getDefaultTimesheetStyleConfig(),
    getDefaultTechteamStyleConfig(),
    getDefaultEquipmentStyleConfig()
  ]);
  const alberLeituras = applyDefaultAlberStyle(alberRows, defaultAlberStyleConfig);
  const dischargeTests = applyDefaultDischargeStyle(dischargeRows, defaultDischargeStyleConfig);
  const signatures = await repo.listSignatures(serviceReportId);
  const instruments = await repo.listInstruments(serviceReportId);
  // Equipe tecnica no fluxo atual e vinculada a OS (order-level).
  // Mantemos fallback para o modelo legado por report_id para nao quebrar relatorios antigos.
  const orderTechnicians = order ? await repo.listTechniciansByOrder(order.id) : [];
  const legacyTechnicians = await repo.listTechnicians(serviceReportId);
  const technicians = Array.isArray(orderTechnicians) && orderTechnicians.length
    ? orderTechnicians
    : legacyTechnicians;
  const images = await repo.listImages(serviceReportId);
  const timesheet = order ? await repo.listTimesheetByOrder(order.id) : [];
  const dailyLogs = order ? await repo.listDailyLogsByOrder(order.id) : [];
  const orderEquipments = order ? await repo.listOrderEquipments(order.id) : [];

  return {
    report: reportWithDefaults,
    order,
    customer,
    site,
    sections,
    components,
    measurements,
    upsMeasures,
    eventLogs,
    alberLeituras,
    dischargeTests,
    signatures,
    instruments,
    technicians,
    images,
    timesheet,
    dailyLogs,
    orderEquipments,
    timesheetStyleConfig,
    techteamStyleConfig,
    equipmentStyleConfig
  };
}

function resolveReportPdfPath(serviceReportId) {
  const folder = path.join(process.cwd(), "dados", "service-report-pdfs");
  if (!reportPdfDirReady) {
    fs.mkdirSync(folder, { recursive: true });
    reportPdfDirReady = true;
  }
  return path.join(folder, `service-report-${serviceReportId}.pdf`);
}

function resolveReportHtmlPath(serviceReportId) {
  const folder = path.join(process.cwd(), "dados", "service-report-html");
  if (!reportHtmlDirReady) {
    fs.mkdirSync(folder, { recursive: true });
    reportHtmlDirReady = true;
  }
  return path.join(folder, `service-report-${serviceReportId}.html`);
}

async function deleteOrderFull(orderId) {
  const [attachments, pdfHistory, report] = await Promise.all([
    repo.listOrderAttachments(orderId),
    repo.listPdfHistoryByOrderId(orderId),
    repo.getReportByOrderId(orderId)
  ]);

  let images = [];
  if (report) {
    images = await repo.listImages(report.id);
  }

  const deleted = await repo.deleteOrder(orderId);
  if (!deleted) return false;

  const cleanups = [];

  for (const att of attachments) {
    cleanups.push(
      objectStorage.deleteObject(path.join("dados", "order-attachments", String(orderId), att.stored_name))
        .catch(() => {})
    );
  }

  for (const entry of pdfHistory) {
    if (entry.object_key) {
      cleanups.push(objectStorage.deleteObject(entry.object_key).catch(() => {}));
    }
  }

  for (const img of images) {
    if (img.file_path) {
      cleanups.push(
        objectStorage.deleteObject(path.join("dados", "report-img", img.file_path)).catch(() => {})
      );
    }
  }

  if (report) {
    cleanups.push(fs.promises.unlink(resolveReportHtmlPath(report.id)).catch(() => {}));
  }

  await Promise.all(cleanups);
  return true;
}

// ---------------------------------------------------------------------------
// Fase 11 — Integração idempotente por referência externa (ADR-004).
// "Ensure-or-create": se já existe registro com (external_source, external_id),
// reusa; senão cria com a referência. Não altera os cadastros feitos manualmente
// (que ficam com external_source/id vazios).
// ---------------------------------------------------------------------------

async function attachSentinelGridLink(entityType, row, rawSentinelgridId) {
  const sentinelgridId = repo.toInt(rawSentinelgridId);
  if (!row || !sentinelgridId) return row;
  return (await repo.setSentinelGridLink(entityType, row.id, sentinelgridId)) || row;
}

// Adota um registro que JÁ existe no RS: carimba a referência externa (para a próxima busca achar
// pelo caminho rápido) e fecha o vínculo com o SentinelGrid. É o que impede a duplicata.
async function adoptExisting(entityType, row, input) {
  const externalSource = sanitizeText(input.externalSource);
  const externalId = sanitizeText(input.externalId);
  const refreshed = externalSource && externalId
    ? (await repo.backfillExternalRef(entityType, row.id, externalSource, externalId)) || row
    : row;
  return attachSentinelGridLink(entityType, refreshed, input.sentinelgridId);
}

// Resolve por VÍNCULO, na ordem: referência externa → sentinelgrid_id (a outra ponta, gravada por
// quem importou do RS para o SG). Só depois disso é que se cogita criar.
async function resolveLinked(entityType, getByExternalRef, input) {
  const externalSource = sanitizeText(input.externalSource);
  const externalId = sanitizeText(input.externalId);
  if (externalSource && externalId) {
    const byRef = await getByExternalRef(externalSource, externalId);
    if (byRef) return byRef;
  }
  return repo.getBySentinelGridId(entityType, input.sentinelgridId);
}

async function ensureCustomerByRef(input = {}) {
  const linked = await resolveLinked("client", repo.getCustomerByExternalRef, input);
  if (linked) {
    return { customer: await adoptExisting("client", linked, input), created: false };
  }
  const name = sanitizeText(input.name);
  if (!name) {
    const err = new Error("Nome do cliente e obrigatorio.");
    err.statusCode = 422;
    throw err;
  }
  // Chave natural: o nome. O SentinelGrid não conhece customer_type e manda sempre 'others' — o
  // tipo fica FORA do casamento e o do RS ('offshore'/'onshore') é preservado na adoção, porque
  // era exatamente o único campo que diferia entre o cliente original e a duplicata.
  const byName = await repo.getCustomerByNormalizedName(name);
  if (byName) {
    return { customer: await adoptExisting("client", byName, input), created: false };
  }
  const customer = await repo.createCustomer({
    name,
    customerType: sanitizeText(input.customerType || "others").toLowerCase(),
    notes: sanitizeText(input.notes),
    externalSource: sanitizeText(input.externalSource),
    externalId: sanitizeText(input.externalId)
  });
  return { customer: await attachSentinelGridLink("client", customer, input.sentinelgridId), created: true };
}

async function ensureSiteByRef(input = {}) {
  const linked = await resolveLinked("site", repo.getSiteByExternalRef, input);
  if (linked) {
    return { site: await adoptExisting("site", linked, input), created: false };
  }
  const customerId = repo.toInt(input.customerId);
  if (!customerId) {
    const err = new Error("Site requer cliente.");
    err.statusCode = 422;
    throw err;
  }
  const siteName = sanitizeText(input.siteName);
  if (!siteName) {
    const err = new Error("Nome do site e obrigatorio.");
    err.statusCode = 422;
    throw err;
  }
  // Chave natural: um cliente não tem dois sites com o mesmo nome. Adota em vez de duplicar.
  const byName = await repo.getSiteByNameForCustomer(customerId, siteName);
  if (byName) {
    return { site: await adoptExisting("site", byName, input), created: false };
  }
  const site = await repo.createSite({
    customerId,
    siteName,
    siteCode: sanitizeText(input.siteCode),
    location: sanitizeText(input.location),
    latitude: null,
    longitude: null,
    notes: sanitizeText(input.notes),
    externalSource: sanitizeText(input.externalSource),
    externalId: sanitizeText(input.externalId)
  });
  return { site: await attachSentinelGridLink("site", site, input.sentinelgridId), created: true };
}

// Vincula um equipamento a uma OS (contrato de serviço para integração; idempotente
// por (service_order_id, equipment_id) no repositório).
async function linkOrderEquipment(orderId, equipmentId, notes = "") {
  const oid = repo.toInt(orderId);
  const eid = repo.toInt(equipmentId);
  if (!oid || !eid) {
    const err = new Error("OS e equipamento sao obrigatorios para o vinculo.");
    err.statusCode = 422;
    throw err;
  }
  return repo.attachEquipmentToOrder(oid, eid, sanitizeText(notes));
}

// Contrato de integração inter-módulos (consumido in-process pelo SentinelGrid).
// Expõe leituras e a gravação restrita da FK externa, sem dar acesso ao repo/DB.
async function getCustomer(id) {
  return repo.getCustomerById(repo.toInt(id));
}

async function listCustomers() {
  return repo.listCustomers();
}

async function getSite(id) {
  return repo.getSiteById(repo.toInt(id));
}

async function getEquipment(id) {
  return repo.getEquipmentById(repo.toInt(id));
}

async function linkSentinelGridEntity(entityType, serviceReportId, sentinelgridId) {
  if (!["client", "site", "equipment"].includes(entityType)) {
    const err = new Error("Tipo de entidade de integração inválido.");
    err.statusCode = 422;
    throw err;
  }
  const linked = await repo.setSentinelGridLink(entityType, serviceReportId, sentinelgridId);
  if (!linked) {
    const err = new Error("Registro do Service Report inexistente para o vínculo.");
    err.statusCode = 404;
    throw err;
  }
  return linked;
}

async function listSitesByCustomer(customerId) {
  return repo.listSites({ customerId: repo.toInt(customerId) });
}

async function listEquipments() {
  return repo.listEquipments();
}

async function listEquipmentsByCustomer(customerId) {
  const cid = repo.toInt(customerId);
  if (!cid) return [];
  const all = await repo.listEquipments();
  return all.filter((e) => Number(e.customer_id) === cid);
}

async function ensureEquipmentByRef(input = {}) {
  // Adota e, se o equipamento estava órfão (sem cliente/site), pendura no dono certo.
  const adoptEquipment = async (row) => {
    const owned = (await repo.backfillEquipmentOwner(row.id, input.customerId, input.siteId)) || row;
    return { equipment: await adoptExisting("equipment", owned, input), created: false };
  };

  const linked = await resolveLinked("equipment", repo.getEquipmentByExternalRef, input);
  if (linked) return adoptEquipment(linked);

  const type = sanitizeText(input.type);
  if (!type) {
    const err = new Error("Tipo de equipamento e obrigatorio.");
    err.statusCode = 422;
    throw err;
  }
  // Chave natural: a TAG dentro do cliente (o RS já a trata como única por site). A série vem
  // depois e só quando é inequívoca — na base real o mesmo serial aparece em unidades distintas.
  const byTag = await repo.getEquipmentByTagForCustomer(input.customerId, input.tagNumber);
  if (byTag) return adoptEquipment(byTag);

  const bySerial = await repo.getEquipmentBySerialForCustomer(input.customerId, input.serialNumber);
  if (bySerial) return adoptEquipment(bySerial);

  const payload = {
    customerId: repo.toInt(input.customerId),
    siteId: repo.toInt(input.siteId),
    type,
    yearOfManufacture: sanitizeText(input.yearOfManufacture),
    serialNumber: sanitizeText(input.serialNumber),
    power: sanitizeText(input.power),
    ratedAcInputVoltage: sanitizeText(input.ratedAcInputVoltage),
    inputFrequency: sanitizeText(input.inputFrequency),
    ratedDcVoltage: sanitizeText(input.ratedDcVoltage),
    ratedAcOutputVoltage: sanitizeText(input.ratedAcOutputVoltage),
    outputFrequency: sanitizeText(input.outputFrequency),
    degreeOfProtection: sanitizeText(input.degreeOfProtection),
    mainLabel: sanitizeText(input.mainLabel),
    dtNumber: sanitizeText(input.dtNumber),
    tagNumber: sanitizeText(input.tagNumber),
    manufacturer: sanitizeText(input.manufacturer),
    modelFamily: sanitizeText(input.modelFamily),
    notes: sanitizeText(input.notes),
    externalSource: sanitizeText(input.externalSource),
    externalId: sanitizeText(input.externalId)
  };
  await ensureEquipmentTagUnique(payload.siteId, payload.tagNumber);
  const equipment = await repo.createEquipment(payload);
  return { equipment: await attachSentinelGridLink("equipment", equipment, input.sentinelgridId), created: true };
}

async function listGlobalTechnicians() { return repo.listGlobalTechnicians(); }
async function getGlobalTechnician(id) { return repo.getGlobalTechnicianById(repo.toInt(id)); }
async function createGlobalTechnician(input = {}) {
  const name = sanitizeText(input.name);
  if (!name) { const err = new Error("Nome do tecnico e obrigatorio."); err.statusCode = 422; throw err; }
  return repo.createGlobalTechnician({
    name, role: sanitizeText(input.role), company: sanitizeText(input.company),
    email: sanitizeText(input.email), phone: sanitizeText(input.phone), isLead: Boolean(input.isLead)
  });
}
async function linkTechnicianToOrder(orderId, technicianId) {
  return repo.linkTechnicianToOrder(repo.toInt(orderId), repo.toInt(technicianId));
}
async function unlinkTechnicianFromOrder(orderId, technicianId) {
  return repo.unlinkTechnicianFromOrder(repo.toInt(orderId), repo.toInt(technicianId));
}
async function listOrderTechnicians(orderId) {
  return repo.listTechniciansByOrder(repo.toInt(orderId));
}
async function getOrder(id) { return repo.getOrderById(repo.toInt(id)); }
// Existência em lote — consumidores externos (SentinelGrid) usam para detectar OS apagadas sem
// puxar cada OS inteira. A exclusão de OS aqui é DELETE físico, então "sumiu" é a única evidência.
async function listExistingOrderIds(ids = []) { return repo.listExistingOrderIds(ids); }
async function getReportById(id) { return repo.getReportById(repo.toInt(id)); }
async function getReportByOrderId(orderId) { return repo.getReportByOrderId(repo.toInt(orderId)); }

module.exports = {
  ORDER_STATUSES,
  SECTION_DEFINITIONS,
  createOrder,
  updateOrder,
  createCustomer,
  createSite,
  createEquipment,
  ensureCustomerByRef,
  ensureSiteByRef,
  ensureEquipmentByRef,
  listGlobalTechnicians,
  getGlobalTechnician,
  createGlobalTechnician,
  linkTechnicianToOrder,
  unlinkTechnicianFromOrder,
  listOrderTechnicians,
  getOrder,
  listExistingOrderIds,
  getReportById,
  getReportByOrderId,
  getCustomer,
  getSite,
  getEquipment,
  listCustomers,
  listEquipments,
  listSitesByCustomer,
  listEquipmentsByCustomer,
  linkSentinelGridEntity,
  linkOrderEquipment,
  updateEquipment,
  deleteEquipment,
  ensureReportForOrder,
  updateReport,
  upsertReportSection,
  createReportSection,
  deleteReportSection,
  createComponent,
  updateComponent,
  createSignature,
  buildReportAggregate,
  resolveReportPdfPath,
  resolveReportHtmlPath,
  deleteOrderFull
};
