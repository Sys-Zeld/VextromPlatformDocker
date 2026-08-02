// Controller do façade JSON /admin/api/v2 (consumido pelo SPA React).
// NÃO reimplementa regra de negócio: reusa os MESMOS repositories/services
// do web controller, apenas devolvendo res.json em vez de res.render.
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const repo = require("../repositories/serviceReportRepository");
const service = require("../services/serviceReportService");
const analyticsService = require("../services/analyticsService");
const objectStorage = require("../../../specflow/services/objectStorage");
const accessControl = require("../../../specflow/services/accessControl");
const { getReportServiceEmailSettings, getTemplateByPurpose } = require("../services/emailSettings");
const { sanitizeReportSectionHtml } = require("../services/quillContentService");
const { buildPreviewModel } = require("../services/reportPreviewService");
const { normalizeReportTemplateKey, getReportTemplateOptions, renderReportPreviewHtml } = require("../services/reportTemplateService");
const { createReportWebController } = require("./createReportWebController");
const { parseAlberCsv } = require("../services/alberParserService");
const { parseUpsMeasuresWorkbook } = require("../services/upsMeasuresParser");
const { parseEventLogWorkbook } = require("../services/eventLogParser");
const { COMPONENT_CATEGORIES } = require("../constants");
const { formatServiceOrderColumnNumber } = require("../utils/serviceOrderDisplay");

function jsonArr(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (_e) { return []; } }
  return [];
}
function countSectionRows(sectionsJson) {
  return jsonArr(sectionsJson).reduce((sum, s) => sum + (Array.isArray(s && s.rows) ? s.rows.length : 0), 0);
}

// Idiomas suportados para tradução do relatório (espelha REPORT_LANGUAGES do legado).
const REPORT_LANGUAGES = [
  { key: "pt", label: "Português" },
  { key: "en", label: "Inglês" },
  { key: "es", label: "Espanhol" },
  { key: "fr", label: "Francês" }
];
const REPORT_LANGUAGE_KEYS = new Set(REPORT_LANGUAGES.map((l) => l.key));
function normalizeReportLanguageKey(value, fallback = "pt") {
  const normalized = String(value || "").trim().toLowerCase();
  return REPORT_LANGUAGE_KEYS.has(normalized) ? normalized : fallback;
}

// Utilitários de e-mail (equivalentes aos helpers locais do web controller legado).
function parseEmailList(raw) {
  return String(raw || "").split(/[;,\r\n]+/).map((item) => String(item || "").trim()).filter(Boolean);
}
function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}
function sanitizeSubjectHeaderValue(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}
function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function renderEmailPlaceholder(template, variables) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key) => {
    const k = String(key || "").trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(variables, k)) return match;
    return escapeHtml(String(variables[k] || ""));
  });
}
let _sharp;
function getSharpOrNull() {
  if (_sharp !== undefined) return _sharp;
  try { _sharp = require("sharp"); } catch (_e) { _sharp = null; }
  return _sharp;
}
async function optimizeImageBuffer(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return buffer;
  const normalizedExt = String(ext || "").toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(normalizedExt)) return buffer;
  const sharp = getSharpOrNull();
  if (!sharp) return buffer;
  try {
    const source = sharp(buffer, { animated: false });
    const metadata = await source.metadata();
    const transformed = Number(metadata.width || 0) > 1600 ? source.resize({ width: 1600, withoutEnlargement: true }) : source;
    if (normalizedExt === ".png") return transformed.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    if (normalizedExt === ".webp") return transformed.webp({ quality: 80 }).toBuffer();
    return transformed.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  } catch (_err) {
    return buffer;
  }
}

function buildOsTemplateVariables(order, technicians) {
  const techNames = (Array.isArray(technicians) ? technicians : [])
    .map((t) => String(t.name || "").trim()).filter(Boolean).join(", ");
  return {
    os_codigo: order.service_order_code || order.service_order_display || `OS-${order.id}`,
    os_titulo: order.title || "",
    cliente: order.customer_name || "",
    local: order.site_name || "",
    data_abertura: (() => {
      const val = order.opening_date;
      if (!val) return "";
      const iso = val instanceof Date
        ? `${val.getUTCFullYear()}-${String(val.getUTCMonth() + 1).padStart(2, "0")}-${String(val.getUTCDate()).padStart(2, "0")}`
        : String(val).slice(0, 10);
      const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
    })(),
    status: order.status || "",
    nr_proposta: order.proposal_number || "",
    tecnicos: techNames
  };
}
const { getReportConfigSettings, saveReportConfigSettings } = require("../services/reportConfigSettings");
const {
  getDefaultTimesheetStyleConfig,
  getDefaultTechteamStyleConfig,
  getDefaultEquipmentStyleConfig,
  getDefaultComponentsStyleConfig,
  getDefaultUpsStyleConfig,
  getDefaultEventLogStyleConfig,
  generateDefaultComponentsCss,
  buildComponentsStyleConfig,
  saveDefaultComponentsStyleConfig,
  buildComponentsPreviewHtml,
  applyComponentsStyleViaAi
} = require("../services/measurementStyleService");

const TABLE_STYLE_TYPES = [
  { key: "timesheet", label: "Timesheet", get: getDefaultTimesheetStyleConfig, settingKey: "report.preview.timesheet.style.default" },
  { key: "techteam", label: "Equipe técnica", get: getDefaultTechteamStyleConfig, settingKey: "report.preview.techteam.style.default" },
  { key: "equipment", label: "Equipamentos", get: getDefaultEquipmentStyleConfig, settingKey: "report.preview.equipment.style.default" },
  { key: "components", label: "Componentes", get: getDefaultComponentsStyleConfig, settingKey: "report.preview.components.style.default" },
  { key: "upsmeasures", label: "Medições UPS", get: getDefaultUpsStyleConfig, settingKey: "report.preview.upsmeasures.style.default" },
  { key: "eventlog", label: "Event Log", get: getDefaultEventLogStyleConfig, settingKey: "report.preview.eventlog.style.default" }
];

// Normaliza a tabela de ensaios/medições (mesmas regras do legado: máx. 12 colunas, 80 linhas).
function normalizeMeasurementInput(body) {
  const trim = (v) => String(v == null ? "" : v).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
  const rawCols = Array.isArray(body.columns) ? body.columns : [];
  const columns = rawCols.map(trim).filter(Boolean).slice(0, 12);
  const safeColumns = columns.length ? columns : ["Teste", "Valor", "Observações"];
  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  const rows = rawRows
    .map((row) => {
      const src = Array.isArray(row) ? row : [];
      const cells = [];
      for (let i = 0; i < safeColumns.length; i += 1) cells.push(trim(src[i]));
      return cells;
    })
    .filter((row) => row.some((cell) => String(cell || "").trim()))
    .slice(0, 80);
  return {
    id: Number(body.measurementId || body.measurement_id || 0),
    title: trim(body.title) || "Ensaios/Medições",
    columns: safeColumns,
    rows: rows.length ? rows : [safeColumns.map(() => "")],
    notes: trim(body.notes),
    sortOrder: Number(body.sortOrder || body.sort_order || 0)
  };
}

function dedupeEmailList(items) {
  const seen = new Set();
  const result = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const email = String(item || "").trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) return;
    seen.add(key);
    result.push(email);
  });
  return result;
}

function buildSignedReportTemplateVariables(order, report, signedLink, extra = {}) {
  return {
    os_codigo: order.service_order_code || order.service_order_display || `OS-${order.id}`,
    relatorio_numero: String(report.report_number || ""),
    cliente: order.customer_name || "",
    local: order.site_name || "",
    nr_proposta: order.proposal_number || "",
    link_relatorio: signedLink || "",
    signatario: String(extra.signatario || ""),
    signatario_email: String(extra.signatario_email || ""),
    tecnicos: String(extra.tecnicos || ""),
    emails_notificados: String(extra.emails_notificados || "")
  };
}

// Guard do link de assinatura eletrônica: OS 'valid' + assinatura do técnico Vextrom.
function buildElectronicSignatureLinkGuard({ order, signatures } = {}) {
  const orderStatus = String(order && order.status || "").toLowerCase();
  const sigs = Array.isArray(signatures) ? signatures : [];
  const hasValidOrder = orderStatus === "valid";
  const hasVextromSignature = sigs.some((item) => String(item && item.signer_type || "").toLowerCase() === "vextrom_technician");
  const reasons = [];
  if (!hasValidOrder) reasons.push("A OS precisa estar com status valid.");
  if (!hasVextromSignature) reasons.push("É obrigatória pelo menos 1 assinatura do técnico Vextrom.");
  return { allowed: hasValidOrder && hasVextromSignature, hasValidOrder, hasVextromSignature, reasons };
}

// Incrementa a revisão do relatório (A → B → … → Z → AA), igual ao legado.
function incrementReportRevision(value) {
  const input = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]+$/.test(input)) return "A";
  const chars = input.split("");
  let cursor = chars.length - 1;
  while (cursor >= 0) {
    if (chars[cursor] !== "Z") { chars[cursor] = String.fromCharCode(chars[cursor].charCodeAt(0) + 1); return chars.join(""); }
    chars[cursor] = "A";
    cursor -= 1;
  }
  return `A${chars.join("")}`;
}

// Regras de validação da OS (mesmas do legado buildOrderValidationSummary).
function buildOrderValidationSummary({ orderEquipments, timesheet, dailyLogs, technicians } = {}) {
  const eq = Array.isArray(orderEquipments) ? orderEquipments : [];
  const ts = Array.isArray(timesheet) ? timesheet : [];
  const logs = Array.isArray(dailyLogs) ? dailyLogs : [];
  const techs = Array.isArray(technicians) ? technicians : [];
  const hasEquipment = eq.length > 0;
  const hasTimesheet = ts.length > 0;
  const hasDailyDescription = logs.some((i) => String(i && i.notes || "").trim().toLowerCase() !== "conclusaogeral");
  const hasConclusion = logs.some((i) => String(i && i.notes || "").trim().toLowerCase() === "conclusaogeral");
  const hasTechnicalTeam = techs.length > 0;
  const missing = [];
  if (!hasEquipment) missing.push("A OS precisa de pelo menos 1 equipamento associado.");
  if (!hasTimesheet) missing.push("A OS precisa de pelo menos 1 registro de timesheet.");
  if (!hasDailyDescription) missing.push("A OS precisa de pelo menos 1 descrição diária.");
  if (!hasConclusion) missing.push("A OS precisa de pelo menos 1 conclusão geral.");
  if (!hasTechnicalTeam) missing.push("A OS precisa de pelo menos 1 pessoa na equipe técnica.");
  return { valid: missing.length === 0, hasEquipment, hasTimesheet, hasDailyDescription, hasConclusion, hasTechnicalTeam, missing };
}

function parsePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function setNoSniff(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function setFrameIsolationHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://vextrom.com.br; font-src 'self' data:; connect-src 'self'"
  );
}

function isPngDataUrl(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("data:image/png;base64,")) return false;
  const payload = raw.slice("data:image/png;base64,".length);
  if (!payload || payload.length > 2 * 1024 * 1024) return false;
  return /^[a-zA-Z0-9+/]+={0,2}$/.test(payload);
}

function createReportServiceV2Controller(deps) {
  const sanitize = typeof deps.sanitizeInput === "function" ? deps.sanitizeInput : (v) => v;
  const extractSparePartsFromDocument = deps.extractSparePartsFromDocument;
  const getSparePartsDefaultPrompt = deps.getSparePartsDefaultPrompt;
  const getSparePartsJsonSchema = deps.getSparePartsJsonSchema;
  const reviseTextWithAi = deps.reviseTextWithAi;
  const sanitizeRichText = typeof deps.sanitizeRichTextInput === "function" ? deps.sanitizeRichTextInput : (v) => v;

  function localIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  // Instância lazy do web controller: reusamos os handlers JSON de tradução
  // (job assíncrono + progresso persistido no banco) sem duplicar a pipeline de IA.
  let _webController = null;
  function web() {
    if (!_webController) _webController = createReportWebController(deps);
    return _webController;
  }

  function resolveBaseUrl(req) {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (appBaseUrl) return String(appBaseUrl).replace(/\/+$/, "");
    const host = String((req.get && req.get("host")) || req.headers.host || "").trim();
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProto || req.protocol || "http";
    return host ? `${protocol}://${host}` : "http://localhost:3000";
  }

  function stripHtmlToText(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function paragraphsToHtml(plainText) {
    const paragraphs = String(plainText || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    return paragraphs.length
      ? paragraphs.map((p) => `<p class="ql-align-justify">${p}</p>`).join("")
      : "<p><br></p>";
  }

  function normalizePn(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function normalizeBulkItem(item) {
    return {
      description: sanitize(String(item.description || "")).trim(),
      manufacturer: sanitize(String(item.manufacturer || "")).trim(),
      partNumber: sanitize(String(item.part_number || item.partNumber || "")).trim(),
      equipmentModel: sanitize(String(item.equipment_model || item.equipmentModel || "")).trim(),
      equipmentFamily: sanitize(String(item.equipment_family || item.equipmentFamily || "")).trim(),
      leadTime: sanitize(String(item.lead_time || item.leadTime || "")).trim(),
      isObsolete: item.is_obsolete === true || String(item.is_obsolete ?? item.isObsolete).toLowerCase() === "true",
      replacedByPartNumber: sanitize(String(item.replaced_by_part_number || item.replacedByPartNumber || "")).trim(),
      quantity: Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1
    };
  }

  function mapEquipmentSpareBody(body) {
    return {
      description: sanitize(String(body.description || "")).trim(),
      manufacturer: sanitize(body.manufacturer),
      equipmentModel: sanitize(body.equipmentModel || body.equipment_model),
      partNumber: sanitize(body.partNumber || body.part_number),
      leadTime: sanitize(body.leadTime || body.lead_time),
      isObsolete: body.isObsolete === true || body.isObsolete === "true" || body.is_obsolete === "on",
      replacedByPartNumber: sanitize(body.replacedByPartNumber || body.replaced_by_part_number),
      equipmentFamily: sanitize(body.equipmentFamily || body.equipment_family),
      quantity: Number(body.quantity || 1)
    };
  }

  function parseCoord(value) {
    if (value === "" || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return {
    // Espelho leve da sessão de admin legada — valida que o cookie é reconhecido.
    async session(req, res) {
      const role = req.adminRole ? accessControl.normalizeRole(req.adminRole) : null;
      return res.json({
        authenticated: Boolean(req.adminUsername),
        username: req.adminUsername || null,
        role,
        roleLabel: role ? accessControl.roleLabel(role) : null,
        // O SPA usa isto para esconder ações que o perfil não pode executar.
        // É conveniência de UI: quem barra de verdade é o servidor.
        capabilities: role ? accessControl.capabilitiesForRole(role) : [],
        lang: req.lang || "pt",
        reactAppEnabled: true
      });
    },

    // ---- Customers -------------------------------------------------------
    async listCustomers(_req, res) {
      const [customers, sites] = await Promise.all([
        repo.listCustomers(),
        repo.listSites()
      ]);
      return res.json({ customers, sites });
    },

    async createCustomer(req, res) {
      const created = await service.createCustomer({
        name: sanitize(req.body.name),
        customerType: req.body.customerType || req.body.customer_type,
        notes: sanitize(req.body.notes)
      });
      return res.status(201).json(created);
    },

    async updateCustomer(req, res) {
      const id = Number(req.params.id);
      const updated = await repo.updateCustomer(id, {
        name: sanitize(req.body.name),
        customerType: req.body.customerType || req.body.customer_type,
        notes: sanitize(req.body.notes)
      });
      if (!updated) return res.status(404).json({ error: "Cliente não encontrado." });
      return res.json(updated);
    },

    async deleteCustomer(req, res) {
      const id = Number(req.params.id);
      try {
        const ok = await repo.deleteCustomer(id);
        if (!ok) return res.status(404).json({ error: "Cliente não encontrado." });
        return res.status(204).end();
      } catch (err) {
        if (err && err.code === "23503") {
          return res.status(409).json({
            error: "Cliente possui registros vinculados e não pode ser excluído.",
            errorCode: "CUSTOMER_HAS_DEPENDENTS"
          });
        }
        throw err;
      }
    },

    // ---- Sites -----------------------------------------------------------
    async createSite(req, res) {
      const created = await service.createSite({
        customerId: Number(req.body.customerId || req.body.customer_id),
        siteName: sanitize(req.body.siteName || req.body.site_name),
        siteCode: sanitize(req.body.siteCode || req.body.site_code),
        location: sanitize(req.body.location),
        latitude: parseCoord(req.body.latitude),
        longitude: parseCoord(req.body.longitude),
        notes: sanitize(req.body.notes)
      });
      return res.status(201).json(created);
    },

    async updateSite(req, res) {
      const id = Number(req.params.id);
      const updated = await repo.updateSite(id, {
        siteName: sanitize(req.body.siteName || req.body.site_name),
        siteCode: sanitize(req.body.siteCode || req.body.site_code),
        location: sanitize(req.body.location),
        latitude: parseCoord(req.body.latitude),
        longitude: parseCoord(req.body.longitude),
        notes: sanitize(req.body.notes)
      });
      if (!updated) return res.status(404).json({ error: "Site não encontrado." });
      return res.json(updated);
    },

    async deleteSite(req, res) {
      const id = Number(req.params.id);
      try {
        const ok = await repo.deleteSite(id);
        if (!ok) return res.status(404).json({ error: "Site não encontrado." });
        return res.status(204).end();
      } catch (err) {
        if (err && err.code === "23503") {
          return res.status(409).json({
            error: "Site possui registros vinculados e não pode ser excluído.",
            errorCode: "SITE_HAS_DEPENDENTS"
          });
        }
        throw err;
      }
    },

    // ---- Orders (lista + criação/edição/exclusão) -----------------------
    async listOrders(_req, res) {
      const [orders, customers, sites, technicians] = await Promise.all([
        repo.listOrders(),
        repo.listCustomers(),
        repo.listSites(),
        repo.listGlobalTechnicians()
      ]);
      const orderIds = orders.map((o) => Number(o.id)).filter((id) => Number.isInteger(id) && id > 0);
      const links = await repo.listOrderTechnicianLinks(orderIds);
      const displayOrders = orders.map((order) => {
        const osNumber = formatServiceOrderColumnNumber(order.service_order_code, order.year);
        return { ...order, os_number: osNumber === "-" ? (order.os_number || null) : osNumber };
      });
      const technicianIdsByOrder = links.reduce((acc, row) => {
        const orderId = Number(row.order_id);
        const techId = Number(row.technician_id);
        if (!Number.isInteger(orderId) || !Number.isInteger(techId)) return acc;
        (acc[orderId] = acc[orderId] || []).push(techId);
        return acc;
      }, {});
      return res.json({ orders: displayOrders, customers, sites, technicians, technicianIdsByOrder });
    },

    async createOrder(req, res) {
      // Abrir OS é do Coordenador para cima (antes era exclusivo do admin).
      if (!accessControl.hasCapability(req.adminRole, accessControl.CAPABILITIES.ORDERS_CREATE)) {
        return res.status(403).json({ error: "Seu perfil não permite abrir OS." });
      }
      const created = await service.createOrder({
        customerId: req.body.customerId || req.body.customer_id,
        siteId: req.body.siteId || req.body.site_id,
        title: req.body.title,
        proposalNumber: req.body.proposalNumber || req.body.proposal_number,
        description: req.body.description,
        status: req.body.status,
        openingDate: req.body.openingDate || req.body.opening_date,
        createdBy: req.adminUsername || ""
      });
      const techIds = normalizeTechIds(req.body.technicianIds || req.body.technician_ids);
      for (const techId of techIds) {
        await repo.linkTechnicianToOrder(created.id, techId);
      }
      return res.status(201).json(created);
    },

    async updateOrderRegistration(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") {
        return res.status(409).json({ error: "OS aprovada não pode ser editada.", errorCode: "ORDER_APPROVED_LOCKED" });
      }
      const techIds = normalizeTechIds(req.body.technicianIds || req.body.technician_ids);
      if (!techIds.length) {
        return res.status(422).json({ error: "Selecione ao menos um técnico." });
      }
      const updated = await service.updateOrder(orderId, {
        customerId: order.customer_id,
        siteId: order.site_id,
        title: req.body.title,
        proposalNumber: req.body.proposalNumber || req.body.proposal_number,
        description: req.body.description,
        status: order.status,
        openingDate: req.body.openingDate || req.body.opening_date || order.opening_date || null,
        closingDate: order.closing_date,
        updatedBy: req.adminUsername || ""
      });
      await repo.replaceTechniciansByOrder(orderId, techIds);
      return res.json(updated);
    },

    async deleteOrder(req, res) {
      const id = Number(req.params.id);
      const deleted = await service.deleteOrderFull(id);
      if (!deleted) return res.status(404).json({ error: "OS não encontrada." });
      return res.status(204).end();
    },

    // ---- Order editor (cabeçalho + timesheet + equipamentos/equipe) -----
    async getOrderEditor(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const [report, timesheet, dailyLogs, technicians, instruments, orderEquipments, allEquipments, linkedTechnicians, linkedInstruments, spareParts] = await Promise.all([
        service.ensureReportForOrder(orderId, order.title),
        repo.listTimesheetByOrder(orderId),
        repo.listDailyLogsByOrder(orderId),
        repo.listGlobalTechnicians(),
        repo.listGlobalInstruments(),
        repo.listOrderEquipments(orderId),
        repo.listEquipments(),
        repo.listTechniciansByOrder(orderId),
        repo.listInstrumentsByOrder(orderId),
        repo.listSpareParts()
      ]);
      const components = await repo.listComponents(report.id);
      // Equipamentos elegíveis: mesmo cliente (e site, se houver) e ainda não vinculados.
      const linkedEqIds = new Set(orderEquipments.map((e) => Number(e.equipment_id)));
      const hasSite = Number.isInteger(Number(order.site_id)) && Number(order.site_id) > 0;
      const availableEquipments = (allEquipments || []).filter((e) => {
        if (Number(e.customer_id) !== Number(order.customer_id)) return false;
        if (hasSite && Number(e.site_id) !== Number(order.site_id)) return false;
        return !linkedEqIds.has(Number(e.id));
      });
      const linkedTechIds = new Set(linkedTechnicians.map((t) => Number(t.id)));
      const linkedInstrIds = new Set(linkedInstruments.map((i) => Number(i.id)));
      const locked = String(order.status || "").toLowerCase() === "approved";
      const validation = buildOrderValidationSummary({ orderEquipments, timesheet, dailyLogs, technicians: linkedTechnicians });
      const isSystemAdmin = accessControl.isAdministrator(res.locals.adminRole);
      return res.json({
        validation, isSystemAdmin,
        order, report, timesheet, dailyLogs, locked,
        orderEquipments, availableEquipments,
        linkedTechnicians, technicians,
        availableTechnicians: technicians.filter((t) => !linkedTechIds.has(Number(t.id))),
        linkedInstruments, instruments,
        availableInstruments: instruments.filter((i) => !linkedInstrIds.has(Number(i.id))),
        components, componentCategories: COMPONENT_CATEGORIES, spareParts,
        componentsHasStyle: !!report.components_style_config
      });
    },

    // Validar / Revalidar a OS
    async validateOrder(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") {
        return res.status(409).json({ error: "OS aprovada — bloqueada para edição.", errorCode: "edit_locked" });
      }
      const [orderEquipments, timesheet, dailyLogs, technicians] = await Promise.all([
        repo.listOrderEquipments(orderId),
        repo.listTimesheetByOrder(orderId),
        repo.listDailyLogsByOrder(orderId),
        repo.listTechniciansByOrder(orderId)
      ]);
      const summary = buildOrderValidationSummary({ orderEquipments, timesheet, dailyLogs, technicians });
      if (!summary.valid) {
        return res.status(422).json({ error: "A OS não atende aos requisitos de validação.", errorCode: "validation_error", missing: summary.missing });
      }
      await service.updateOrder(orderId, { status: "valid", updatedBy: res.locals.adminUsername || "" });
      return res.json({ ok: true, status: "valid" });
    },

    async revalidateOrder(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      // Reabrir uma OS aprovada é operação destrutiva sobre a OS — Coordenador
      // para cima, junto com a permissão de excluir.
      if (!accessControl.hasCapability(res.locals.adminRole, accessControl.CAPABILITIES.ORDERS_DELETE)) {
        return res.status(403).json({ error: "Seu perfil não permite revalidar uma OS aprovada.", errorCode: "forbidden_admin" });
      }
      if (String(order.status || "").toLowerCase() !== "approved") {
        return res.status(409).json({ error: "A OS precisa estar aprovada para ser revalidada.", errorCode: "invalid_state" });
      }
      const report = await service.ensureReportForOrder(orderId);
      await service.updateOrder(orderId, { status: "valid", updatedBy: res.locals.adminUsername || "revalidate-os" });
      await service.updateReport(report.id, { revision: incrementReportRevision(report.revision || "A"), issueDate: localIsoDate() });
      return res.json({ ok: true, status: "valid" });
    },

    // Equipamentos da OS
    async attachOrderEquipment(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const equipmentId = Number(req.body.equipmentId || req.body.equipment_id);
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
      const sameCustomer = Number(equipment.customer_id) === Number(order.customer_id);
      const sameSite = Number.isInteger(Number(order.site_id)) && Number(order.site_id) > 0
        ? Number(equipment.site_id) === Number(order.site_id) : true;
      if (!sameCustomer || !sameSite) return res.status(422).json({ error: "Equipamento não pertence ao cliente/site da OS." });
      await repo.attachEquipmentToOrder(orderId, equipmentId, sanitize(req.body.notes));
      return res.status(201).json({ ok: true });
    },

    async detachOrderEquipment(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      await repo.detachEquipmentFromOrder(orderId, Number(req.params.equipmentId));
      return res.status(204).end();
    },

    // Técnicos da OS
    async linkOrderTechnician(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const techId = Number(req.body.technicianId || req.body.technician_id);
      if (techId > 0) await repo.linkTechnicianToOrder(orderId, techId);
      return res.status(201).json({ ok: true });
    },

    async unlinkOrderTechnician(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      await repo.unlinkTechnicianFromOrder(orderId, Number(req.params.techId));
      return res.status(204).end();
    },

    // Instrumentos da OS
    async linkOrderInstrument(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const instrId = Number(req.body.instrumentId || req.body.instrument_id);
      if (instrId > 0) await repo.linkInstrumentToOrder(orderId, instrId);
      return res.status(201).json({ ok: true });
    },

    async unlinkOrderInstrument(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      await repo.unlinkInstrumentFromOrder(orderId, Number(req.params.instrId));
      return res.status(204).end();
    },

    // ---- Componentes (tabela) -------------------------------------------
    async addOrderComponent(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      await service.createComponent(report.id, {
        category: req.body.category,
        equipmentId: req.body.equipmentId || req.body.equipment_id,
        quantity: req.body.quantity,
        description: req.body.description,
        partNumber: req.body.partNumber || req.body.part_number,
        notes: req.body.notes,
        sortOrder: req.body.sortOrder || req.body.sort_order
      });
      return res.status(201).json({ ok: true });
    },

    async updateOrderComponent(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const componentId = Number(req.params.componentId);
      if (!Number.isInteger(componentId) || componentId <= 0) return res.status(422).json({ error: "Componente inválido." });
      const report = await service.ensureReportForOrder(orderId);
      const components = await repo.listComponents(report.id);
      if (!components.some((item) => Number(item.id) === componentId)) return res.status(404).json({ error: "Componente não encontrado nesta OS." });
      await service.updateComponent(componentId, {
        category: req.body.category,
        equipmentId: req.body.equipmentId || req.body.equipment_id,
        quantity: req.body.quantity,
        description: req.body.description,
        partNumber: req.body.partNumber || req.body.part_number,
        notes: req.body.notes,
        sortOrder: req.body.sortOrder || req.body.sort_order
      });
      return res.json({ ok: true });
    },

    async deleteOrderComponent(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const componentId = Number(req.params.componentId);
      if (!Number.isInteger(componentId) || componentId <= 0) return res.status(422).json({ error: "Componente inválido." });
      const report = await service.ensureReportForOrder(orderId);
      const components = await repo.listComponents(report.id);
      if (!components.some((item) => Number(item.id) === componentId)) return res.status(404).json({ error: "Componente não encontrado nesta OS." });
      await repo.deleteComponent(componentId);
      return res.status(204).end();
    },

    // ---- Ensaios / Medições (tabelas @ensaios) --------------------------
    async listMeasurements(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const report = await service.ensureReportForOrder(orderId, order.title);
      const rows = await repo.listMeasurementTables(report.id);
      const parseArr = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === "string") { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (_e) { return []; } }
        return [];
      };
      const measurements = (rows || []).map((m) => ({
        id: m.id,
        seq_id: m.seq_id ?? m.id,
        title: m.title || "",
        columns: parseArr(m.columns_json),
        rows: parseArr(m.rows_json),
        notes: m.notes || "",
        sort_order: m.sort_order ?? 0
      }));
      const locked = String(order.status || "").toLowerCase() === "approved";
      return res.json({ measurements, locked });
    },

    async saveMeasurement(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      const payload = normalizeMeasurementInput(req.body || {});
      if (Number.isInteger(payload.id) && payload.id > 0) {
        await repo.updateMeasurementTable(payload.id, report.id, payload);
      } else {
        await repo.createMeasurementTable({ serviceReportId: report.id, ...payload });
      }
      return res.json({ ok: true });
    },

    async deleteMeasurement(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const measurementId = Number(req.params.measurementId);
      if (!Number.isInteger(measurementId) || measurementId <= 0) return res.status(422).json({ error: "ID de ensaio inválido." });
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteMeasurementTable(measurementId, report.id);
      return res.status(204).end();
    },

    // ---- Dados UPS: Leituras Alber + Medições UPS + Event Logs ----------
    async getUpsData(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const report = await service.ensureReportForOrder(orderId, order.title);
      const [alberRows, upsRows, eventRows] = await Promise.all([
        repo.listLeiturasAlberByReport(report.id).catch(() => []),
        repo.listUpsMeasuresByReport(report.id).catch(() => []),
        repo.listEventLogsByReport(report.id).catch(() => [])
      ]);
      const alber = (alberRows || []).map((a) => ({
        id: a.id,
        location_name: a.location_name || "",
        battery_name: a.battery_name || "",
        model_number: a.model_number || "",
        total_strings: a.total_strings ?? 0,
        nome_arquivo: a.nome_arquivo || "",
        cell_count: Array.isArray(a.celulas) ? a.celulas.length : jsonArr(a.celulas).length,
        created_at: a.created_at || null
      }));
      const upsMeasures = (upsRows || []).map((u) => ({
        id: u.id, seq_id: u.seq_id ?? u.id, title: u.title || "",
        sections: jsonArr(u.sections_json).length, rows: countSectionRows(u.sections_json)
      }));
      const eventLogs = (eventRows || []).map((e) => ({
        id: e.id, seq_id: e.seq_id ?? e.id, title: e.title || "",
        sections: jsonArr(e.sections_json).length, rows: countSectionRows(e.sections_json)
      }));
      const locked = String(order.status || "").toLowerCase() === "approved";
      return res.json({ alber, upsMeasures, eventLogs, locked });
    },

    async importAlber(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ ok: false, error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!buffer.length) return res.status(400).json({ ok: false, error: "Arquivo vazio." });
      const fileName = sanitize(decodeURIComponent(String(req.headers["x-file-name"] || "arquivo.csv")));
      const parsed = parseAlberCsv(buffer.toString("utf-8"), fileName);
      if (!parsed.isValid) return res.status(422).json({ ok: false, error: (parsed.errors || []).join(" | ") || "Arquivo inválido." });
      const { header, celulas } = parsed;
      const stringNums = [...new Set(celulas.map((c) => c.stringNum))].sort((a, b) => a - b);
      const stringLabels = {};
      stringNums.forEach((n) => { stringLabels[String(n)] = `Banco ${n}`; });
      const report = await service.ensureReportForOrder(orderId);
      await repo.createLeituraAlber({
        serviceReportId: report.id,
        locationName: header.locationName, batteryName: header.batteryName, modelNumber: header.modelNumber,
        installDate: header.installDate, totalStrings: header.totalStrings, nomeArquivo: header.nomeArquivo,
        stringLabels, celulas
      });
      return res.status(201).json({ ok: true });
    },

    async deleteAlber(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteLeituraAlber(Number(req.params.leituraId), report.id);
      return res.status(204).end();
    },

    async importUpsMeasures(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ ok: false, error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!buffer.length) return res.status(400).json({ ok: false, error: "Arquivo vazio." });
      const fileName = sanitize(decodeURIComponent(String(req.headers["x-file-name"] || "Measures.xls")));
      let parsed;
      try { parsed = parseUpsMeasuresWorkbook(buffer, fileName); }
      catch (err) { return res.status(422).json({ ok: false, error: err && err.message ? err.message : "Falha ao processar o arquivo." }); }
      if (!parsed.sections.length && !parsed.header.length) return res.status(422).json({ ok: false, error: "Nenhum dado reconhecido no arquivo." });
      const report = await service.ensureReportForOrder(orderId);
      await repo.createUpsMeasures({
        serviceReportId: report.id,
        title: sanitize(parsed.title) || "Medições UPS",
        header: Array.isArray(parsed.header) ? parsed.header : [],
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        notes: "", sortOrder: 0
      });
      return res.status(201).json({ ok: true });
    },

    async deleteUpsMeasures(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteUpsMeasures(Number(req.params.upsId), report.id);
      return res.status(204).end();
    },

    async importEventLog(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ ok: false, error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!buffer.length) return res.status(400).json({ ok: false, error: "Arquivo vazio." });
      const fileName = sanitize(decodeURIComponent(String(req.headers["x-file-name"] || "Event Log.xls")));
      let parsed;
      try { parsed = parseEventLogWorkbook(buffer, fileName); }
      catch (err) { return res.status(422).json({ ok: false, error: err && err.message ? err.message : "Falha ao processar o arquivo." }); }
      if (!parsed.sections.length && !parsed.header.length) return res.status(422).json({ ok: false, error: "Nenhum dado reconhecido no arquivo." });
      const report = await service.ensureReportForOrder(orderId);
      await repo.createEventLog({
        serviceReportId: report.id,
        title: sanitize(parsed.title) || "Event Log UPS",
        header: Array.isArray(parsed.header) ? parsed.header : [],
        sections: Array.isArray(parsed.sections) ? parsed.sections : [],
        notes: "", sortOrder: 0
      });
      return res.status(201).json({ ok: true });
    },

    async deleteEventLog(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteEventLog(Number(req.params.eventLogId), report.id);
      return res.status(204).end();
    },

    // ---- Componentes: customização visual da tabela por IA --------------
    // O SPA envia JSON: currentStyle é objeto (ou ausente); no legado vinha como string.
    async componentsStyleAi(req, res) {
      const orderId = Number(req.params.id);
      const { instruction, apply, currentStyle } = req.body || {};
      const report = await service.ensureReportForOrder(orderId);
      const reportId = Number(report.id);
      const parsedCurrentStyle = currentStyle || null;
      const defaultStyle = await getDefaultComponentsStyleConfig();
      const activeStyle = parsedCurrentStyle || report.components_style_config || defaultStyle || null;

      if (!String(instruction || "").trim()) {
        if (apply === true && parsedCurrentStyle) {
          await repo.updateReportComponentsStyleConfig(reportId, parsedCurrentStyle);
          return res.json({ previewHtml: buildComponentsPreviewHtml(reportId, parsedCurrentStyle), styleConfig: parsedCurrentStyle });
        }
        return res.json({ previewHtml: buildComponentsPreviewHtml(reportId, activeStyle), styleConfig: activeStyle });
      }

      const currentCss = (activeStyle && activeStyle.customCss) || generateDefaultComponentsCss(reportId);
      const newCss = await applyComponentsStyleViaAi(currentCss, reportId, String(instruction).trim(), reviseTextWithAi);
      const newStyleConfig = { customCss: newCss };
      if (apply === true) await repo.updateReportComponentsStyleConfig(reportId, newStyleConfig);
      return res.json({ previewHtml: buildComponentsPreviewHtml(reportId, newStyleConfig), styleConfig: newStyleConfig });
    },

    async componentsStyleReset(req, res) {
      const orderId = Number(req.params.id);
      const report = await service.ensureReportForOrder(orderId);
      const reportId = Number(report.id);
      await repo.updateReportComponentsStyleConfig(reportId, null);
      const defaultStyle = await getDefaultComponentsStyleConfig();
      return res.json({ previewHtml: buildComponentsPreviewHtml(reportId, defaultStyle || null), styleConfig: defaultStyle || null });
    },

    async componentsStyleDefault(req, res) {
      const orderId = Number(req.params.id);
      const { currentStyle } = req.body || {};
      const report = await service.ensureReportForOrder(orderId);
      const reportId = Number(report.id);
      const styleConfig = buildComponentsStyleConfig(currentStyle || report.components_style_config || { customCss: generateDefaultComponentsCss(reportId) });
      if (!styleConfig.customCss) return res.status(400).json({ error: "Nenhum estilo válido para salvar como padrão." });
      await saveDefaultComponentsStyleConfig(styleConfig);
      await repo.updateReportComponentsStyleConfig(reportId, styleConfig);
      return res.json({ previewHtml: buildComponentsPreviewHtml(reportId, styleConfig), styleConfig });
    },

    // ---- Anexos da OS (arquivos) ----------------------------------------
    async listOrderAttachments(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      const attachments = await repo.listOrderAttachments(orderId);
      return res.json({ ok: true, data: attachments });
    },

    async uploadOrderAttachment(req, res) {
      const orderId = parsePositiveInt(req.params.id);
      if (!orderId) return res.status(400).json({ ok: false, error: "ID inválido." });
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });

      let fileNameRaw = "arquivo";
      try { fileNameRaw = decodeURIComponent(String(req.headers["x-file-name"] || "arquivo")); }
      catch (_err) { fileNameRaw = String(req.headers["x-file-name"] || "arquivo"); }
      fileNameRaw = sanitize(fileNameRaw);
      const originalName = path.basename(fileNameRaw).replace(/[^a-zA-Z0-9._\- ]/g, "").slice(0, 200) || "arquivo";

      let labelRaw = "";
      try { labelRaw = decodeURIComponent(String(req.headers["x-label"] || "")); }
      catch (_err) { labelRaw = String(req.headers["x-label"] || ""); }
      const label = sanitize(labelRaw).slice(0, 200);

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!buffer.length) return res.status(400).json({ ok: false, error: "Arquivo vazio." });
      if (buffer.length > 50 * 1024 * 1024) return res.status(413).json({ ok: false, error: "Arquivo muito grande. Limite: 50 MB." });

      const ext = path.extname(originalName).toLowerCase();
      if ([".html", ".htm", ".svg", ".js", ".mjs"].includes(ext)) {
        return res.status(415).json({ ok: false, error: "Tipo de arquivo não permitido para anexos." });
      }
      const baseSafe = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "arquivo";
      const unique = crypto.randomBytes(6).toString("hex");
      const storedName = `${Date.now()}-${baseSafe}-${unique}${ext}`;

      await objectStorage.putObject(
        path.join("dados", "order-attachments", String(orderId), storedName),
        buffer,
        { contentType: String(req.headers["content-type"] || "application/octet-stream").split(";")[0].trim() }
      );

      const mimeType = String(req.headers["content-type"] || "").split(";")[0].trim();
      const uploadedBy = sanitize(String(res.locals.adminUsername || res.locals.adminEmail || ""));

      const created = await repo.createOrderAttachment({
        serviceOrderId: orderId,
        originalName,
        storedName,
        label,
        fileSize: buffer.length,
        mimeType,
        uploadedBy
      });

      return res.status(201).json({ ok: true, data: { id: created.id, originalName, storedName, label, fileSize: buffer.length } });
    },

    async deleteOrderAttachment(req, res) {
      const orderId = Number(req.params.id);
      const attachmentId = Number(req.params.attachmentId);
      if (!Number.isInteger(attachmentId) || attachmentId <= 0) return res.status(400).json({ ok: false, error: "ID inválido." });
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      const attachment = await repo.getOrderAttachmentById(attachmentId);
      if (!attachment || Number(attachment.service_order_id) !== orderId) return res.status(404).json({ ok: false, error: "Anexo não encontrado." });
      await repo.deleteOrderAttachment(attachmentId);
      await objectStorage.deleteObject(path.join("dados", "order-attachments", String(orderId), attachment.stored_name));
      return res.json({ ok: true });
    },

    async downloadOrderAttachment(req, res) {
      const orderId = parsePositiveInt(req.params.id);
      const attachmentId = parsePositiveInt(req.params.attachmentId);
      if (!orderId || !attachmentId) return res.status(400).send("ID inválido.");
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).send("OS não encontrada.");
      const attachment = await repo.getOrderAttachmentById(attachmentId);
      if (!attachment || Number(attachment.service_order_id) !== orderId) return res.status(404).send("Anexo não encontrado.");
      const storageKey = path.join("dados", "order-attachments", String(orderId), attachment.stored_name);
      if (!await objectStorage.existsObject(storageKey)) return res.status(404).send("Arquivo não encontrado no servidor.");
      const safeName = attachment.original_name.replace(/[^a-zA-Z0-9._\- ]/g, "_");
      setNoSniff(res);
      return objectStorage.sendObjectDownload(res, storageKey, safeName, attachment.mime_type || "application/octet-stream");
    },

    // ---- Anexos do cadastro de equipamento (manuais, parâmetros, etc.) ---
    async listEquipmentAttachments(req, res) {
      const equipmentId = parsePositiveInt(req.params.id);
      if (!equipmentId) return res.status(400).json({ ok: false, error: "ID inválido." });
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).json({ ok: false, error: "Equipamento não encontrado." });
      const attachments = await repo.listEquipmentAttachments(equipmentId);
      return res.json({ ok: true, data: attachments });
    },

    async uploadEquipmentAttachment(req, res) {
      const equipmentId = parsePositiveInt(req.params.id);
      if (!equipmentId) return res.status(400).json({ ok: false, error: "ID inválido." });
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).json({ ok: false, error: "Equipamento não encontrado." });

      let fileNameRaw = "arquivo";
      try { fileNameRaw = decodeURIComponent(String(req.headers["x-file-name"] || "arquivo")); }
      catch (_err) { fileNameRaw = String(req.headers["x-file-name"] || "arquivo"); }
      fileNameRaw = sanitize(fileNameRaw);
      const originalName = path.basename(fileNameRaw).replace(/[^a-zA-Z0-9._\- ]/g, "").slice(0, 200) || "arquivo";

      let labelRaw = "";
      try { labelRaw = decodeURIComponent(String(req.headers["x-label"] || "")); }
      catch (_err) { labelRaw = String(req.headers["x-label"] || ""); }
      const label = sanitize(labelRaw).slice(0, 200);

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!buffer.length) return res.status(400).json({ ok: false, error: "Arquivo vazio." });
      if (buffer.length > 50 * 1024 * 1024) return res.status(413).json({ ok: false, error: "Arquivo muito grande. Limite: 50 MB." });

      const ext = path.extname(originalName).toLowerCase();
      if ([".html", ".htm", ".svg", ".js", ".mjs"].includes(ext)) {
        return res.status(415).json({ ok: false, error: "Tipo de arquivo não permitido para anexos." });
      }
      const baseSafe = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "arquivo";
      const unique = crypto.randomBytes(6).toString("hex");
      const storedName = `${Date.now()}-${baseSafe}-${unique}${ext}`;

      await objectStorage.putObject(
        path.join("dados", "equipment-attachments", String(equipmentId), storedName),
        buffer,
        { contentType: String(req.headers["content-type"] || "application/octet-stream").split(";")[0].trim() }
      );

      const mimeType = String(req.headers["content-type"] || "").split(";")[0].trim();
      const uploadedBy = sanitize(String(res.locals.adminUsername || res.locals.adminEmail || ""));

      const created = await repo.createEquipmentAttachment({
        equipmentId,
        originalName,
        storedName,
        label,
        fileSize: buffer.length,
        mimeType,
        uploadedBy
      });

      return res.status(201).json({ ok: true, data: { id: created.id, originalName, storedName, label, fileSize: buffer.length } });
    },

    async deleteEquipmentAttachment(req, res) {
      const equipmentId = parsePositiveInt(req.params.id);
      const attachmentId = parsePositiveInt(req.params.attachmentId);
      if (!equipmentId || !attachmentId) return res.status(400).json({ ok: false, error: "ID inválido." });
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).json({ ok: false, error: "Equipamento não encontrado." });
      const attachment = await repo.getEquipmentAttachmentById(attachmentId);
      if (!attachment || Number(attachment.equipment_id) !== equipmentId) return res.status(404).json({ ok: false, error: "Anexo não encontrado." });
      await repo.deleteEquipmentAttachment(attachmentId);
      await objectStorage.deleteObject(path.join("dados", "equipment-attachments", String(equipmentId), attachment.stored_name));
      return res.json({ ok: true });
    },

    async downloadEquipmentAttachment(req, res) {
      const equipmentId = parsePositiveInt(req.params.id);
      const attachmentId = parsePositiveInt(req.params.attachmentId);
      if (!equipmentId || !attachmentId) return res.status(400).send("ID inválido.");
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).send("Equipamento não encontrado.");
      const attachment = await repo.getEquipmentAttachmentById(attachmentId);
      if (!attachment || Number(attachment.equipment_id) !== equipmentId) return res.status(404).send("Anexo não encontrado.");
      const storageKey = path.join("dados", "equipment-attachments", String(equipmentId), attachment.stored_name);
      if (!await objectStorage.existsObject(storageKey)) return res.status(404).send("Arquivo não encontrado no servidor.");
      const safeName = attachment.original_name.replace(/[^a-zA-Z0-9._\- ]/g, "_");
      setNoSniff(res);
      return objectStorage.sendObjectDownload(res, storageKey, safeName, attachment.mime_type || "application/octet-stream");
    },

    // ---- Enviar OS por e-mail -------------------------------------------
    async sendOsCreatedEmail(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });

      const technicians = await repo.listTechniciansByOrder(orderId);
      const toFromTechs = technicians.map((t) => String(t.email || "").trim()).filter((e) => isValidEmailAddress(e));
      const extraTo = parseEmailList(req.body.to);
      const cc = parseEmailList(req.body.cc);
      const to = Array.from(new Set([...toFromTechs, ...extraTo])).filter((e) => isValidEmailAddress(e));

      if (!to.length) return res.status(422).json({ ok: false, error: "Nenhum destinatário válido (nenhum técnico com e-mail e nenhum destinatário extra).", errorCode: "no_recipients" });
      if (cc.some((item) => !isValidEmailAddress(item))) return res.status(422).json({ ok: false, error: "CC contém e-mail inválido.", errorCode: "invalid_cc" });

      const emailSettings = await getReportServiceEmailSettings();
      if (!emailSettings.smtp || !emailSettings.smtp.host || !emailSettings.smtp.from) {
        return res.status(400).json({ ok: false, error: "SMTP não configurado. Verifique as configurações de e-mail.", errorCode: "smtp" });
      }

      try {
        const transporter = nodemailer.createTransport({
          host: emailSettings.smtp.host,
          port: emailSettings.smtp.port,
          secure: emailSettings.smtp.secure,
          auth: emailSettings.smtp.user ? { user: emailSettings.smtp.user, pass: emailSettings.smtp.pass } : undefined
        });

        const osVars = buildOsTemplateVariables(order, technicians);
        const osTemplate = getTemplateByPurpose(emailSettings.emailTemplates, emailSettings.defaultTemplateId, "nova_os");
        const orderDisplay = order.service_order_display || order.service_order_code || `OS-${orderId}`;
        const subject = sanitizeSubjectHeaderValue(
          osTemplate && osTemplate.subject ? renderEmailPlaceholder(osTemplate.subject, osVars) : `Nova OS: ${orderDisplay}`
        );
        let htmlBody;
        if (osTemplate && osTemplate.html) {
          htmlBody = `<!doctype html><html><body>${renderEmailPlaceholder(osTemplate.html, osVars)}</body></html>`;
        } else {
          htmlBody = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;"><p style="margin:0 0 12px 0;">Uma nova Ordem de Servico foi criada e voce foi designado como tecnico responsavel.</p><p style="margin:0 0 8px 0;"><strong>OS:</strong> ${orderDisplay}</p><p style="margin:0 0 8px 0;"><strong>Titulo:</strong> ${order.title || "-"}</p><p style="margin:0 0 8px 0;"><strong>Cliente:</strong> ${order.customer_name || "-"}</p><p style="margin:0 0 8px 0;"><strong>Local:</strong> ${order.site_name || "-"}</p><p style="margin:0 0 8px 0;"><strong>Data de abertura:</strong> ${osVars.data_abertura || "-"}</p><p style="margin:12px 0 0 0;color:#6b7280;font-size:12px;">E-mail enviado pelo modulo Service Report.</p></body></html>`;
        }

        await transporter.sendMail({ from: emailSettings.smtp.from, to, cc: cc.length ? cc : undefined, subject, html: htmlBody });
        return res.json({ ok: true, recipients: to, cc });
      } catch (_err) {
        return res.status(502).json({ ok: false, error: "Falha ao enviar o e-mail da OS. Verifique a configuração SMTP.", errorCode: "send_failed" });
      }
    },

    // ---- Report editor: capítulos/seções --------------------------------
    async getReportEditor(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const report = await service.ensureReportForOrder(orderId, order.title);
      const [sections, allImages, reportConfig, signatures, signRequests] = await Promise.all([
        repo.listSections(report.id),
        repo.listImages(report.id),
        getReportConfigSettings(),
        repo.listSignatures(report.id).catch(() => []),
        repo.listSignRequestsByReportId(report.id).catch(() => [])
      ]);
      const images = (allImages || []).filter((img) => String(img.section_key || "") === "__tag__");
      const locked = String(order.status || "").toLowerCase() === "approved";
      const reportTemplates = getReportTemplateOptions();
      const templateKey = normalizeReportTemplateKey(reportConfig.templateKey);
      const signRequestGuard = buildElectronicSignatureLinkGuard({ order, signatures });
      const reportLanguage = normalizeReportLanguageKey(report.document_language);
      return res.json({
        order, report, sections, images, locked, reportTemplates, templateKey,
        signatures, signRequests, signRequestGuard,
        reportLanguages: REPORT_LANGUAGES, reportLanguage
      });
    },

    // ---- Tradução do relatório (job assíncrono com progresso) -----------
    // Delega aos handlers JSON do web controller legado (mesma pipeline de IA + job store no banco).
    startTranslateReportJob(req, res) { return web().startTranslateReportJob(req, res); },
    getTranslateReportJob(req, res) { return web().getTranslateReportJob(req, res); },

    // HTML do preview do relatório (renderizado no servidor) para o iframe do SPA.
    async getReportPreviewHtml(req, res) {
      const orderId = Number(req.params.id);
      const report = await service.ensureReportForOrder(orderId);
      const payload = await service.buildReportAggregate(report.id);
      if (!payload) return res.status(404).json({ error: "Relatório não encontrado." });
      const reportConfig = await getReportConfigSettings();
      const templateKey = normalizeReportTemplateKey(sanitize(req.query.templateKey || "") || reportConfig.templateKey);
      const bodyHtml = await renderReportPreviewHtml(payload, { reportConfig, templateKey, previewMode: true });
      const cacheVersion = Date.now();
      // Inclui o overlay + o script de ciclo da paginação: o report-pagination.js
      // adiciona html.report-paginating (que zera a opacidade do report-doc via CSS) e
      // essa classe SÓ é removida no evento reportPaginationReady — sem isto o conteúdo some.
      const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=960, initial-scale=1.0" />
  <link href="/public/css/report-preview.css" rel="stylesheet" />
  <link href="/public/css/report-print.css" rel="stylesheet" />
  <script src="/public/js/report-pagination.js?v=${cacheVersion}" defer></script>
</head>
<body>
<div id="report-loading-overlay" class="report-loading-overlay" role="status" aria-live="polite" aria-label="Carregando documento">
  <div class="report-loading-spinner"></div>
  <p class="report-loading-label">Preparando documento...</p>
</div>
<script>
(function () {
  var startTime = Date.now();
  var MIN_DELAY = 500;
  document.documentElement.classList.add("report-paginating");
  function hideOverlay() {
    document.documentElement.classList.remove("report-paginating");
    var overlay = document.getElementById("report-loading-overlay");
    if (!overlay) return;
    overlay.style.opacity = "0";
    setTimeout(function () { overlay.style.display = "none"; }, 300);
  }
  var safetyTimer = setTimeout(function () {
    document.documentElement.classList.remove("report-paginating");
    var overlay = document.getElementById("report-loading-overlay");
    if (overlay) overlay.style.display = "none";
  }, 15000);
  document.addEventListener("reportPaginationReady", function () {
    clearTimeout(safetyTimer);
    var remaining = Math.max(0, MIN_DELAY - (Date.now() - startTime));
    setTimeout(hideOverlay, remaining);
  }, { once: true });
})();
</script>
${bodyHtml}
<div id="rpt-image-modal" role="dialog" aria-modal="true" aria-label="Visualizacao da imagem" style="display:none;position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.75);align-items:center;justify-content:center;padding:16px;">
  <div style="position:relative;width:min(96vw,1400px);max-height:92vh;background:#111;border-radius:10px;padding:40px 16px 14px;display:flex;flex-direction:column;gap:10px;">
    <button class="rpt-image-close" type="button" aria-label="Fechar" style="position:absolute;top:8px;right:8px;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;">&times;</button>
    <img id="rpt-image-view" src="" alt="" style="max-width:100%;max-height:78vh;object-fit:contain;margin:0 auto;background:#111;border-radius:6px;" />
    <p id="rpt-image-caption" style="margin:0;color:#eaeaea;font:500 0.85rem/1.35 sans-serif;text-align:center;word-break:break-word;"></p>
  </div>
</div>
<script>
  (function () {
    var modal = document.getElementById("rpt-image-modal");
    var view = document.getElementById("rpt-image-view");
    var caption = document.getElementById("rpt-image-caption");
    if (!modal || !view || !caption) return;
    function openModal(src, text, rotation) {
      if (!src) return;
      view.src = src; view.alt = text || "Imagem"; caption.textContent = text || "";
      var deg = [90, 180, 270].indexOf(Number(rotation)) !== -1 ? Number(rotation) : 0;
      view.style.transform = deg ? "rotate(" + deg + "deg)" : "";
      modal.style.display = "flex"; document.body.style.overflow = "hidden";
    }
    function closeModal() { modal.style.display = "none"; document.body.style.overflow = ""; view.src = ""; view.style.transform = ""; caption.textContent = ""; }
    document.addEventListener("click", function (event) {
      var img = event.target && event.target.closest ? event.target.closest(".rich-output img") : null;
      if (img) { openModal(img.getAttribute("src") || "", img.getAttribute("alt") || "", img.getAttribute("data-rotation") || "0"); return; }
      if (event.target === modal || (event.target && event.target.closest && event.target.closest(".rpt-image-close"))) closeModal();
    });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeModal(); });
  })();
</script>
</body>
</html>`;
      // format=html → devolve o documento direto (para abrir em nova janela);
      // caso contrário, JSON para o iframe srcDoc do SPA.
      if (String(req.query.format || "") === "html") {
        setFrameIsolationHeaders(res);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(fullHtml);
      }
      setNoSniff(res);
      return res.json({ html: fullHtml, templateKey });
    },

    async createReportSection(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      const beforeSections = await repo.listSections(report.id);
      const title = sanitize(req.body.sectionTitle || req.body.section_title) || "NOVO CAPITULO";
      const sections = await service.createReportSection(report.id, {
        sectionTitle: title, sectionTitleText: title, contentText: "", contentHtml: "<p><br></p>", isVisible: true
      });
      const insertAfter = sanitize(req.body.insertAfter || req.body.insert_after || "").trim();
      if (insertAfter && insertAfter !== "end") {
        const beforeKeys = new Set(beforeSections.map((s) => s.section_key));
        const newSection = sections.find((s) => !beforeKeys.has(s.section_key));
        if (newSection) {
          const existingKeys = beforeSections.map((s) => s.section_key);
          const ordered = [];
          if (insertAfter === "start") {
            ordered.push(newSection.section_key, ...existingKeys);
          } else {
            let inserted = false;
            for (const key of existingKeys) {
              ordered.push(key);
              if (key === insertAfter) { ordered.push(newSection.section_key); inserted = true; }
            }
            if (!inserted) ordered.push(newSection.section_key);
          }
          await repo.reorderSections(report.id, ordered);
        }
      }
      return res.status(201).json({ ok: true });
    },

    async saveReportSection(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const sectionKey = sanitize(req.params.sectionKey).toLowerCase();
      const report = await service.ensureReportForOrder(orderId);
      await service.upsertReportSection(report.id, sectionKey, {
        sectionTitleHtml: req.body.sectionTitleHtml,
        sectionTitleText: sanitize(req.body.sectionTitleText),
        contentHtml: req.body.contentHtml || "",
        contentText: sanitize(req.body.contentText),
        isVisible: req.body.isVisible
      });
      return res.json({ ok: true });
    },

    async deleteReportSection(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const sectionKey = sanitize(req.params.sectionKey).toLowerCase();
      const report = await service.ensureReportForOrder(orderId);
      await service.deleteReportSection(report.id, sectionKey);
      return res.status(204).end();
    },

    async reorderReportSections(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      const orderedKeys = Array.isArray(req.body.sectionKeys) ? req.body.sectionKeys : [];
      if (!orderedKeys.length) return res.status(422).json({ error: "Lista de capítulos inválida." });
      const sections = await repo.listSections(report.id);
      const validKeys = new Set(sections.map((s) => s.section_key));
      const cleanKeys = orderedKeys.map((k) => String(k)).filter((k) => validKeys.has(k));
      await repo.reorderSections(report.id, cleanKeys);
      const tocConfig = req.body.tocTablesConfig;
      if (tocConfig && typeof tocConfig === "object" && !Array.isArray(tocConfig)) {
        await repo.saveTocTablesConfig(report.id, tocConfig);
      }
      return res.json({ ok: true });
    },

    async getTocTables(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      const report = await service.ensureReportForOrder(orderId);
      const payload = await service.buildReportAggregate(report.id);
      if (!payload) return res.status(404).json({ ok: false, error: "Relatório não encontrado." });
      const reportConfig = await getReportConfigSettings();
      const templateKey = normalizeReportTemplateKey(reportConfig.templateKey);
      const model = buildPreviewModel(payload, { reportConfig, templateKey });
      return res.json({ ok: true, sections: model.tocTablesMeta });
    },

    async renameTocTables(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      const items = Array.isArray(req.body.tableNames) ? req.body.tableNames : [];
      if (!items.length) return res.json({ ok: true });
      const EDITABLE_TYPES = ["measurements", "discharge"];
      await Promise.all(items.map(async (item) => {
        const id = Number(item && item.id);
        const type = String(item && item.type || "");
        const title = String(item && item.title != null ? item.title : "").trim();
        if (!id || !EDITABLE_TYPES.includes(type)) return;
        if (type === "measurements") await repo.renameMeasurementTable(id, report.id, title);
        if (type === "discharge") await repo.renameDischargeTest(id, report.id, title);
      }));
      return res.json({ ok: true });
    },

    async reviseSectionText(req, res) {
      if (typeof reviseTextWithAi !== "function") return res.status(500).json({ error: "Serviço de IA indisponível." });
      const text = String(req.body.text || "");
      const html = String(req.body.html || "");
      const preserveFormatting = req.body.preserveFormatting === true || String(req.body.preserveFormatting) === "true";
      const prompt = sanitize(req.body.prompt || "") || "Revise o texto abaixo sem mudar muitas palavras";
      try {
        const result = await reviseTextWithAi({ text, html, prompt, preserveFormatting });
        return res.json({ ok: true, revisedText: result.revisedText || "", revisedHtml: sanitizeReportSectionHtml(result.revisedHtml || "") });
      } catch (err) {
        return res.status(err.statusCode || 422).json({ error: err.message || "Falha ao revisar texto com IA." });
      }
    },

    // ---- Report editor: banco de imagens (@img) -------------------------
    async uploadReportImage(req, res) {
      const orderId = parsePositiveInt(req.params.id);
      if (!orderId) return res.status(400).json({ ok: false, error: "ID inválido." });
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ ok: false, error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);

      let fileNameRaw = "imagem";
      try { fileNameRaw = decodeURIComponent(String(req.headers["x-file-name"] || "imagem")); }
      catch (_err) { fileNameRaw = String(req.headers["x-file-name"] || "imagem"); }
      fileNameRaw = sanitize(fileNameRaw);
      const fileNameBase = path.basename(fileNameRaw).replace(/[^a-zA-Z0-9._-]/g, "") || "imagem";
      const extFromName = path.extname(fileNameBase).toLowerCase();
      const mime = String(req.headers["content-type"] || "").toLowerCase();
      const extFromMime = mime.includes("png") ? ".png"
        : (mime.includes("jpeg") || mime.includes("jpg")) ? ".jpg"
          : mime.includes("webp") ? ".webp"
            : mime.includes("gif") ? ".gif" : "";
      const ext = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extFromName) ? extFromName : extFromMime;
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      if (!ext || !buffer.length) return res.status(400).json({ ok: false, error: "Arquivo de imagem inválido." });
      if (buffer.length > 15 * 1024 * 1024) return res.status(413).json({ ok: false, error: "Imagem muito grande. Limite: 15 MB." });

      const optimizedBuffer = await optimizeImageBuffer(buffer, ext);
      const fileSafeBase = path.basename(fileNameBase, extFromName || path.extname(fileNameBase)).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "imagem";
      const unique = crypto.randomBytes(6).toString("hex");
      const finalName = `${Date.now()}-${fileSafeBase}-${unique}${ext === ".jpeg" ? ".jpg" : ext}`;
      await objectStorage.putObject(path.join("dados", "report-img", finalName), optimizedBuffer, { contentType: mime || "application/octet-stream" });

      let captionRaw = "";
      try { captionRaw = decodeURIComponent(String(req.headers["x-caption"] || "")); }
      catch (_err) { captionRaw = String(req.headers["x-caption"] || ""); }
      const created = await repo.createImage({ serviceReportId: report.id, sectionKey: "__tag__", filePath: finalName, caption: sanitize(captionRaw), sortOrder: 0 });
      return res.status(201).json({ ok: true, data: { id: created.ref_id, filePath: finalName, sizeBytes: optimizedBuffer.length } });
    },

    async updateReportImageCaption(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const imageId = Number(req.params.imageId);
      if (!Number.isInteger(imageId) || imageId <= 0) return res.status(422).json({ error: "ID inválido." });
      const report = await service.ensureReportForOrder(orderId);
      await repo.updateImageCaptionByRefId(report.id, imageId, sanitize(req.body.caption || ""));
      return res.json({ ok: true });
    },

    async updateReportImageRotation(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ ok: false, error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const imageId = Number(req.params.imageId);
      if (!Number.isInteger(imageId) || imageId <= 0) return res.status(400).json({ ok: false, error: "ID inválido." });
      const rotation = Number(req.body.rotation);
      const report = await service.ensureReportForOrder(orderId);
      await repo.updateImageRotationByRefId(report.id, imageId, rotation);
      return res.json({ ok: true, rotation: [0, 90, 180, 270].includes(rotation) ? rotation : 0 });
    },

    async deleteReportImage(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const imageId = Number(req.params.imageId);
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteImageByRefId(report.id, imageId);
      return res.status(204).end();
    },

    // ---- Assinatura eletrônica: links (sign-requests) -------------------
    async createSignRequest(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      const signatures = await repo.listSignatures(report.id).catch(() => []);
      const guard = buildElectronicSignatureLinkGuard({ order, signatures });
      if (!guard.allowed) return res.status(409).json({ error: "Não é possível gerar o link.", errorCode: "sign_link_blocked", reasons: guard.reasons });

      const signerEmail = sanitize(req.body.signerEmail || req.body.signer_email) || "";
      if (!isValidEmailAddress(signerEmail)) return res.status(422).json({ error: "E-mail do signatário inválido.", errorCode: "invalid_signer_email" });
      const notifyTechnicians = req.body.notifyTechnicians !== false && req.body.notify_technicians !== false;
      const extraNotificationEmails = parseEmailList(req.body.notificationEmails || req.body.notification_emails);
      if (extraNotificationEmails.some((email) => !isValidEmailAddress(email))) return res.status(422).json({ error: "E-mail de notificação inválido.", errorCode: "invalid_notification_email" });

      const token = crypto.randomUUID();
      await repo.createSignRequest({
        serviceReportId: report.id,
        token,
        signerName: sanitize(req.body.signerName || req.body.signer_name) || "",
        signerEmail,
        signerRole: sanitize(req.body.signerRole || req.body.signer_role) || "",
        signerCompany: sanitize(req.body.signerCompany || req.body.signer_company) || "",
        notes: sanitize(req.body.notes) || ""
      });
      const signLink = `${resolveBaseUrl(req)}/r/sign/${encodeURIComponent(token)}`;

      const emailSettings = await getReportServiceEmailSettings();
      if (!emailSettings.smtp || !emailSettings.smtp.host || !emailSettings.smtp.from) {
        return res.status(201).json({ ok: true, link: signLink, emailStatus: "smtp" });
      }
      try {
        const technicians = await repo.listTechniciansByOrder(orderId);
        const transporter = nodemailer.createTransport({
          host: emailSettings.smtp.host,
          port: emailSettings.smtp.port,
          secure: emailSettings.smtp.secure,
          auth: emailSettings.smtp.user ? { user: emailSettings.smtp.user, pass: emailSettings.smtp.pass } : undefined
        });
        const linkTemplate = getTemplateByPurpose(emailSettings.emailTemplates, emailSettings.defaultTemplateId, "envio_assinatura");
        const technicianEmails = notifyTechnicians
          ? technicians.map((t) => String(t.email || "").trim()).filter((e) => isValidEmailAddress(e))
          : [];
        const notificationRecipients = dedupeEmailList([...technicianEmails, ...extraNotificationEmails])
          .filter((email) => email.toLowerCase() !== signerEmail.toLowerCase());
        const technicianNames = technicians.map((t) => String(t.name || "").trim()).filter(Boolean).join(", ");
        const vars = buildSignedReportTemplateVariables(order, report, signLink, {
          signatario: sanitize(req.body.signerName || req.body.signer_name) || "",
          signatario_email: signerEmail,
          tecnicos: technicianNames,
          emails_notificados: notificationRecipients.join(", ")
        });
        const orderDisplay = order.service_order_display || order.service_order_code || `OS-${orderId}`;
        const subject = sanitizeSubjectHeaderValue(linkTemplate && linkTemplate.subject ? renderEmailPlaceholder(linkTemplate.subject, vars) : `Solicitação de assinatura - ${report.report_number || orderDisplay}`);
        const htmlBody = linkTemplate && linkTemplate.html
          ? `<!doctype html><html><body>${renderEmailPlaceholder(linkTemplate.html, vars)}</body></html>`
          : `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;"><p style="margin:0 0 12px 0;">Foi solicitada sua assinatura eletrônica para o relatório técnico.</p><p style="margin:0 0 8px 0;"><strong>OS:</strong> ${escapeHtml(orderDisplay)}</p><p style="margin:0 0 8px 0;"><strong>Relatório:</strong> ${escapeHtml(report.report_number || "-")}</p><p style="margin:16px 0;"><a href="${escapeHtml(signLink)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#14532d;color:#fff;text-decoration:none;font-weight:600;">Abrir para assinar</a></p></body></html>`;
        await transporter.sendMail({ from: emailSettings.smtp.from, to: signerEmail, subject, html: htmlBody });

        if (notificationRecipients.length) {
          try {
            const notificationTemplate = getTemplateByPurpose(emailSettings.emailTemplates, emailSettings.defaultTemplateId, "notificacao_envio_assinatura");
            const notificationSubject = sanitizeSubjectHeaderValue(notificationTemplate && notificationTemplate.subject ? renderEmailPlaceholder(notificationTemplate.subject, vars) : `Relatório enviado para assinatura - ${report.report_number || orderDisplay}`);
            const notificationHtml = notificationTemplate && notificationTemplate.html
              ? `<!doctype html><html><body>${renderEmailPlaceholder(notificationTemplate.html, vars)}</body></html>`
              : `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1f2937;"><p>O relatório foi enviado ao cliente responsável para assinatura.</p><p><strong>OS:</strong> ${escapeHtml(orderDisplay)}</p><p><strong>Cliente responsável:</strong> ${escapeHtml(vars.signatario || "-")} (${escapeHtml(signerEmail)})</p></body></html>`;
            await transporter.sendMail({ from: emailSettings.smtp.from, to: notificationRecipients, subject: notificationSubject, html: notificationHtml });
          } catch (_notificationErr) {
            return res.status(201).json({ ok: true, link: signLink, emailStatus: "notification_failed" });
          }
        }
        return res.status(201).json({ ok: true, link: signLink, emailStatus: "sent" });
      } catch (_err) {
        return res.status(201).json({ ok: true, link: signLink, emailStatus: "send_failed" });
      }
    },

    async updateSignRequest(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const requestId = Number(req.params.requestId);
      const report = await service.ensureReportForOrder(orderId);
      const signRequests = await repo.listSignRequestsByReportId(report.id);
      const target = signRequests.find((item) => Number(item.id) === requestId);
      if (!target) return res.status(404).json({ error: "Link não encontrado." });
      if (String(target.status || "").toLowerCase() !== "pending") return res.status(409).json({ error: "Só é possível editar links pendentes.", errorCode: "sign_request_edit_blocked" });
      await repo.updateSignRequest(requestId, {
        signerName: sanitize(req.body.signerName || req.body.signer_name) || "",
        signerRole: sanitize(req.body.signerRole || req.body.signer_role) || "",
        signerCompany: sanitize(req.body.signerCompany || req.body.signer_company) || "",
        signerEmail: sanitize(req.body.signerEmail || req.body.signer_email) || "",
        notes: sanitize(req.body.notes) || ""
      });
      return res.json({ ok: true });
    },

    async cancelSignRequest(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      const requestId = Number(req.params.requestId);
      const signRequests = await repo.listSignRequestsByReportId(report.id);
      const target = signRequests.find((item) => Number(item.id) === requestId);
      if (!target) return res.status(404).json({ error: "Link não encontrado." });
      await repo.updateSignRequest(requestId, { status: "cancelled" });
      return res.json({ ok: true });
    },

    async deleteSignRequest(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteSignRequest(Number(req.params.requestId), report.id);
      return res.status(204).end();
    },

    // ---- Assinatura do técnico Vextrom (canvas) -------------------------
    async getSignReport(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const report = await service.ensureReportForOrder(orderId, order.title);
      const [technicians, allSignatures] = await Promise.all([
        repo.listTechniciansByOrder(orderId),
        repo.listSignatures(report.id).catch(() => [])
      ]);
      const signatures = (allSignatures || []).filter((s) => String(s.signer_type || "").toLowerCase() === "vextrom_technician");
      const canSign = String(order.status || "").toLowerCase() === "valid";
      return res.json({ order, report, technicians, signatures, canSign });
    },

    async createTechnicianSignature(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() !== "valid") {
        return res.status(409).json({ error: "A OS precisa estar com status 'valid' para assinar.", errorCode: "sign_locked" });
      }
      const signatureData = String(req.body.signatureData || req.body.signature_data || "").trim();
      if (!signatureData || signatureData === "data:,") {
        return res.status(422).json({ error: "Desenhe a assinatura antes de confirmar.", errorCode: "draw_required" });
      }
      if (!isPngDataUrl(signatureData)) {
        return res.status(422).json({ error: "Formato de assinatura inválido.", errorCode: "invalid_signature_format" });
      }
      const report = await service.ensureReportForOrder(orderId);
      const ipAddress = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 100);
      const userAgent = String(req.headers["user-agent"] || "").slice(0, 500);
      await service.createSignature(report.id, {
        signerType: "vextrom_technician",
        signerName: sanitize(req.body.signerName || req.body.signer_name),
        signerRole: sanitize(req.body.signerRole || req.body.signer_role),
        signerCompany: sanitize(req.body.signerCompany || req.body.signer_company),
        signatureData,
        ipAddress,
        userAgent
      });
      return res.status(201).json({ ok: true });
    },

    async deleteTechnicianSignature(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const report = await service.ensureReportForOrder(orderId);
      await repo.deleteSignature(Number(req.params.signatureId), report.id);
      return res.status(204).end();
    },

    // ---- Diário de bordo (daily logs) + conclusão por IA ----------------
    async saveDailyLog(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      const dailyLogId = Number(req.body.dailyLogId || req.body.daily_log_id || 0);
      const payload = {
        serviceOrderId: orderId,
        activityDate: sanitize(req.body.activityDate || req.body.activity_date),
        title: sanitize(req.body.title),
        content: sanitizeRichText(req.body.content),
        notes: sanitize(req.body.notes),
        sortOrder: Number(req.body.sortOrder || req.body.sort_order || 0)
      };
      if (Number.isInteger(dailyLogId) && dailyLogId > 0) {
        const updated = await repo.updateDailyLogByOrderAndId(orderId, dailyLogId, payload);
        if (!updated) return res.status(404).json({ error: "Registro não encontrado." });
        return res.json(updated);
      }
      const created = await repo.createDailyLog(payload);
      return res.status(201).json(created);
    },

    async deleteDailyLog(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });
      await repo.deleteDailyLogByOrderAndId(orderId, Number(req.params.dailyLogId));
      return res.status(204).end();
    },

    async reviseDailyLogText(req, res) {
      if (typeof reviseTextWithAi !== "function") return res.status(503).json({ error: "Serviço de IA indisponível." });
      try {
        const result = await reviseTextWithAi({
          text: String(req.body.text || ""),
          html: String(req.body.html || ""),
          prompt: sanitize(req.body.prompt) || "Revise o texto abaixo sem mudar muitas palavras",
          preserveFormatting: req.body.preserveFormatting === true || req.body.preserveFormatting === "true"
        });
        return res.json({ revisedText: result.revisedText || "", revisedHtml: sanitizeRichText(result.revisedHtml || "") });
      } catch (err) {
        return res.status(err.statusCode || 422).json({ error: err.message || "Falha ao revisar texto com IA." });
      }
    },

    async generateConclusion(req, res) {
      if (typeof reviseTextWithAi !== "function") return res.status(503).json({ error: "Serviço de IA indisponível." });
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") return res.status(409).json({ error: "OS aprovada — bloqueada.", errorCode: "ORDER_APPROVED_LOCKED" });

      const DEFAULT_PROMPT = "Crie um resumo de todas as atividades para servir como uma conclusao tecnica. Escreva em paragrafos claros, objetivos e resumidos, em portugues. Nao repita datas, sintetize o que foi feito. Separe cada paragrafo com uma linha em branco.";
      const rawPrompt = String(req.body.prompt || "").trim();
      const conclusionPrompt = rawPrompt.length >= 10 ? rawPrompt : DEFAULT_PROMPT;

      const dailyLogs = await repo.listDailyLogsByOrder(orderId);
      const sourceLogs = dailyLogs.filter((l) => String(l.notes || "").trim() !== "conclusaogeral");
      if (!sourceLogs.length) return res.status(422).json({ error: "Nenhum log diário cadastrado para gerar a conclusão." });

      const combinedText = sourceLogs.map((log, i) => {
        const dateLabel = log.activity_date ? String(log.activity_date).slice(0, 10) : `Log ${i + 1}`;
        const titlePart = log.title ? ` - ${log.title}` : "";
        return `[${dateLabel}${titlePart}] ${stripHtmlToText(log.content)}`;
      }).join("\n\n");

      try {
        const result = await reviseTextWithAi({ text: combinedText, html: "", prompt: conclusionPrompt, preserveFormatting: false });
        const plainText = String(result.revisedText || "").trim();
        if (!plainText) return res.status(422).json({ error: "A IA não retornou conteúdo para a conclusão." });
        const contentHtml = paragraphsToHtml(plainText);
        const existing = await repo.getDailyLogByTagForOrder(orderId, "conclusaogeral");
        let savedLog;
        if (existing) {
          savedLog = await repo.updateDailyLogByOrderAndId(orderId, existing.id, {
            activityDate: existing.activity_date,
            title: existing.title || "Conclusao Geral",
            content: contentHtml,
            notes: "conclusaogeral",
            sortOrder: existing.sort_order
          });
        } else {
          savedLog = await repo.createDailyLog({
            serviceOrderId: orderId,
            activityDate: localIsoDate(),
            title: "Conclusao Geral",
            content: contentHtml,
            notes: "conclusaogeral",
            sortOrder: 999
          });
        }
        return res.json({ ok: true, log: savedLog });
      } catch (err) {
        return res.status(err.statusCode || 422).json({ error: err.message || "Falha ao gerar conclusão com IA." });
      }
    },

    async addTimesheet(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") {
        return res.status(409).json({ error: "OS aprovada — apontamentos bloqueados.", errorCode: "ORDER_APPROVED_LOCKED" });
      }
      const created = await repo.createTimesheetEntry({ serviceOrderId: orderId, ...mapTimesheetBody(req.body) });
      return res.status(201).json(created);
    },

    async updateTimesheet(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") {
        return res.status(409).json({ error: "OS aprovada — apontamentos bloqueados.", errorCode: "ORDER_APPROVED_LOCKED" });
      }
      const updated = await repo.updateTimesheetEntry(Number(req.params.entryId), mapTimesheetBody(req.body));
      if (!updated) return res.status(404).json({ error: "Registro não encontrado." });
      return res.json(updated);
    },

    async deleteTimesheet(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      if (String(order.status || "").toLowerCase() === "approved") {
        return res.status(409).json({ error: "OS aprovada — apontamentos bloqueados.", errorCode: "ORDER_APPROVED_LOCKED" });
      }
      const ok = await repo.deleteTimesheetEntry(Number(req.params.entryId));
      if (!ok) return res.status(404).json({ error: "Registro não encontrado." });
      return res.status(204).end();
    },

    // ---- Equipments ------------------------------------------------------
    async listEquipments(_req, res) {
      const [equipments, customers, sites] = await Promise.all([
        repo.listEquipments(),
        repo.listCustomers(),
        repo.listSites()
      ]);
      return res.json({ equipments, customers, sites });
    },

    async createEquipment(req, res) {
      try {
        const created = await service.createEquipment(mapEquipmentBody(req.body));
        return res.status(201).json(created);
      } catch (err) {
        if (err && err.errorCode === "EQUIPMENT_TAG_DUPLICATE") {
          return res.status(409).json({ error: err.message, errorCode: err.errorCode });
        }
        throw err;
      }
    },

    async updateEquipment(req, res) {
      const id = Number(req.params.id);
      try {
        const updated = await service.updateEquipment(id, mapEquipmentBody(req.body));
      if (!updated) return res.status(404).json({ error: "Equipamento não encontrado." });
      return res.json(updated);
      } catch (err) {
        if (err && err.errorCode === "EQUIPMENT_TAG_DUPLICATE") {
          return res.status(409).json({ error: err.message, errorCode: err.errorCode });
        }
        throw err;
      }
    },

    async deleteEquipment(req, res) {
      const id = Number(req.params.id);
      try {
        // Coleta os anexos antes de excluir (o cascade do banco apaga as linhas, mas
        // os objetos no storage precisam ser removidos manualmente para não ficarem órfãos).
        const attachments = id > 0 ? await repo.listEquipmentAttachments(id).catch(() => []) : [];
        const ok = await service.deleteEquipment(id);
        if (!ok) return res.status(404).json({ error: "Equipamento não encontrado." });
        for (const att of attachments) {
          await objectStorage
            .deleteObject(path.join("dados", "equipment-attachments", String(id), att.stored_name))
            .catch(() => {});
        }
        return res.status(204).end();
      } catch (err) {
        if (err && err.code === "23503") {
          return res.status(409).json({
            error: "Equipamento possui registros vinculados e não pode ser excluído.",
            errorCode: "EQUIPMENT_HAS_DEPENDENTS"
          });
        }
        throw err;
      }
    },

    // ---- Analytics (dashboard) ------------------------------------------
    async analytics(req, res) {
      const payload = await analyticsService.getDashboardPayload(req.query);
      return res.json(payload);
    },

    // ---- Spare parts (catálogo) -----------------------------------------
    async listSpareParts(_req, res) {
      const [spareParts, equipments, customers] = await Promise.all([
        repo.listSpareParts(),
        repo.listEquipments(),
        repo.listCustomers()
      ]);
      return res.json({ spareParts, equipments, customers });
    },

    async createSparePart(req, res) {
      try {
        const created = await repo.createSparePart(mapSparePartBody(req.body));
        return res.status(201).json(created);
      } catch (err) {
        if (err && (err.code === "pn_duplicate" || err.statusCode === 409)) {
          return res.status(409).json({ error: "Part Number já cadastrado.", errorCode: "PN_DUPLICATE" });
        }
        throw err;
      }
    },

    async updateSparePart(req, res) {
      const id = Number(req.params.id);
      try {
        const updated = await repo.updateSparePart(id, mapSparePartBody(req.body));
        if (!updated) return res.status(404).json({ error: "Peça não encontrada." });
        return res.json(updated);
      } catch (err) {
        if (err && (err.code === "pn_duplicate" || err.statusCode === 409)) {
          return res.status(409).json({ error: "Part Number já cadastrado.", errorCode: "PN_DUPLICATE" });
        }
        throw err;
      }
    },

    async deleteSparePart(req, res) {
      const id = Number(req.params.id);
      try {
        const ok = await repo.deleteSparePart(id);
        if (!ok) return res.status(404).json({ error: "Peça não encontrada." });
        return res.status(204).end();
      } catch (err) {
        if (err && err.code === "23503") {
          return res.status(409).json({ error: "Peça vinculada a equipamentos e não pode ser excluída.", errorCode: "SPARE_HAS_DEPENDENTS" });
        }
        throw err;
      }
    },

    // ---- Config do relatório --------------------------------------------
    async getConfig(_req, res) {
      const reportConfig = await getReportConfigSettings();
      return res.json(reportConfig);
    },

    async saveConfig(req, res) {
      await saveReportConfigSettings({
        logoVextrom: sanitize(req.body.logoVextrom),
        logoChloride: sanitize(req.body.logoChloride),
        logoCover: sanitize(req.body.logoCover),
        templateKey: sanitize(req.body.templateKey),
        footerHtml: req.body.footerHtml !== undefined ? String(req.body.footerHtml) : undefined,
        defaultScopeHtml: req.body.defaultScopeHtml !== undefined ? String(req.body.defaultScopeHtml) : undefined,
        defaultRecommendationsHtml: req.body.defaultRecommendationsHtml !== undefined ? String(req.body.defaultRecommendationsHtml) : undefined
      });
      const reportConfig = await getReportConfigSettings();
      return res.json(reportConfig);
    },

    // ---- Assets globais (técnicos + instrumentos) -----------------------
    async listAssets(_req, res) {
      const [technicians, instruments] = await Promise.all([
        repo.listGlobalTechnicians(),
        repo.listGlobalInstruments()
      ]);
      return res.json({ technicians, instruments });
    },

    async createTechnician(req, res) {
      const created = await repo.createGlobalTechnician(mapTechnicianBody(req.body));
      return res.status(201).json(created);
    },

    async updateTechnician(req, res) {
      const updated = await repo.updateGlobalTechnician(Number(req.params.id), mapTechnicianBody(req.body));
      if (!updated) return res.status(404).json({ error: "Técnico não encontrado." });
      return res.json(updated);
    },

    async deleteTechnician(req, res) {
      try {
        const ok = await repo.deleteGlobalTechnician(Number(req.params.id));
        if (!ok) return res.status(404).json({ error: "Técnico não encontrado." });
        return res.status(204).end();
      } catch (err) {
        if (err && err.code === "23503") {
          return res.status(409).json({ error: "Técnico vinculado a registros e não pode ser excluído.", errorCode: "TECH_HAS_DEPENDENTS" });
        }
        throw err;
      }
    },

    async createInstrument(req, res) {
      const created = await repo.createGlobalInstrument(mapInstrumentBody(req.body));
      return res.status(201).json(created);
    },

    async updateInstrument(req, res) {
      const updated = await repo.updateGlobalInstrument(Number(req.params.id), mapInstrumentBody(req.body));
      if (!updated) return res.status(404).json({ error: "Instrumento não encontrado." });
      return res.json(updated);
    },

    async deleteInstrument(req, res) {
      const ok = await repo.deleteGlobalInstrument(Number(req.params.id));
      if (!ok) return res.status(404).json({ error: "Instrumento não encontrado." });
      return res.status(204).end();
    },

    // ---- Table styles (status + reset por tipo) -------------------------
    async listTableStyles(_req, res) {
      const types = await Promise.all(
        TABLE_STYLE_TYPES.map(async (t) => {
          const cfg = await t.get();
          return { key: t.key, label: t.label, hasCustomStyle: Boolean(cfg && cfg.customCss) };
        })
      );
      return res.json({ types });
    },

    async resetTableStyle(req, res) {
      const tableType = String(req.params.tableType || "").toLowerCase();
      const entry = TABLE_STYLE_TYPES.find((t) => t.key === tableType);
      if (!entry) return res.status(400).json({ error: "Tipo de tabela inválido." });
      await repo.upsertAppSetting(entry.settingKey, null);
      return res.json({ ok: true, key: entry.key, hasCustomStyle: false });
    },

    // ---- Technician tools (por técnico) ---------------------------------
    async tableStyleAi(req, res) {
      return web().tableStyleAi(req, res);
    },

    async resetTableStyleWithPreview(req, res) {
      return web().tableStyleReset(req, res);
    },

    async listTechnicianTools(req, res) {
      const techId = Number(req.params.techId);
      const technician = await repo.getGlobalTechnicianById(techId);
      if (!technician) return res.status(404).json({ error: "Técnico não encontrado." });
      const tools = await repo.listGlobalToolsByTechnician(techId);
      return res.json({ technician, tools });
    },

    async createTechnicianTool(req, res) {
      const techId = Number(req.params.techId);
      if (!sanitize(req.body.item)) return res.status(422).json({ error: "Item obrigatório." });
      const created = await repo.createGlobalTool({
        technicianId: techId,
        item: sanitize(req.body.item),
        quantity: Number(req.body.quantity || 1),
        description: sanitize(req.body.description),
        serialNumber: sanitize(req.body.serialNumber || req.body.serial_number),
        notes: sanitize(req.body.notes)
      });
      return res.status(201).json(created);
    },

    async updateTechnicianTool(req, res) {
      const techId = Number(req.params.techId);
      const toolId = Number(req.params.toolId);
      const updated = await repo.updateGlobalToolForTechnician(toolId, techId, {
        quantity: Number(req.body.quantity || 1),
        description: sanitize(req.body.description),
        serialNumber: sanitize(req.body.serialNumber || req.body.serial_number),
        notes: sanitize(req.body.notes)
      });
      if (!updated) return res.status(404).json({ error: "Ferramenta não encontrada." });
      return res.json(updated);
    },

    async deleteTechnicianTool(req, res) {
      const techId = Number(req.params.techId);
      const toolId = Number(req.params.toolId);
      const ok = await repo.deleteGlobalToolForTechnician(toolId, techId);
      if (!ok) return res.status(404).json({ error: "Ferramenta não encontrada." });
      return res.status(204).end();
    },

    // ---- PDF history (por OS) -------------------------------------------
    async listPdfHistory(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const report = await service.ensureReportForOrder(orderId);
      let pdfHistory = [];
      let signatures = [];
      try { pdfHistory = await repo.listPdfHistoryByOrderId(orderId); } catch (_e) { /* migração pendente */ }
      try { signatures = await repo.listSignatures(report.id); } catch (_e) { /* ignore */ }
      return res.json({ order, report, pdfHistory, signatures });
    },

    async deletePdfHistory(req, res) {
      const orderId = parsePositiveInt(req.params.id);
      const entryId = parsePositiveInt(req.params.entryId);
      if (!orderId || !entryId) return res.status(400).json({ error: "ID inválido." });
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).json({ error: "OS não encontrada." });
      const entry = await repo.getPdfHistoryEntry(entryId);
      if (!entry || Number(entry.service_order_id) !== orderId) return res.status(404).json({ error: "Registro não encontrado." });
      const ok = await repo.deletePdfHistoryEntry(entryId);
      if (!ok) return res.status(404).json({ error: "Registro não encontrado." });
      return res.status(204).end();
    },

    // ---- Spare parts: vínculo por equipamento (novo modelo) -------------
    async getEquipmentSpares(req, res) {
      const equipmentId = Number(req.params.equipmentId);
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });

      const [linkedSpares, catalog] = await Promise.all([
        repo.listEquipmentSpares(equipmentId),
        repo.listSpareParts()
      ]);
      const linkedSourceIds = new Set(
        linkedSpares.map((s) => Number(s.source_spare_part_id)).filter((id) => Number.isInteger(id) && id > 0)
      );
      const linkedPns = new Set(linkedSpares.map((s) => normalizePn(s.part_number)).filter(Boolean));
      const availableSpares = catalog.filter((item) => {
        if (linkedSourceIds.has(Number(item.id))) return false;
        const pn = normalizePn(item.part_number);
        if (pn && linkedPns.has(pn)) return false;
        return true;
      });
      return res.json({ equipment, linkedSpares, availableSpares });
    },

    // Consolidado para impressão: peças agrupadas por equipamento, com filtro
    // opcional de cliente/site. Equipamentos sem peças só entram com includeEmpty.
    async listSparesGroupedByEquipment(req, res) {
      const customerId = Number(req.query.customerId) || 0;
      const siteId = Number(req.query.siteId) || 0;
      const includeEmpty = String(req.query.includeEmpty || "") === "true";

      const equipments = await repo.listEquipments();
      const scoped = equipments.filter((e) =>
        (!customerId || Number(e.customer_id) === customerId) &&
        (!siteId || Number(e.site_id) === siteId));

      const spares = await repo.listEquipmentSparesByEquipmentIds(scoped.map((e) => e.id));
      const byEquipment = new Map();
      for (const spare of spares) {
        const key = Number(spare.equipment_id);
        if (!byEquipment.has(key)) byEquipment.set(key, []);
        byEquipment.get(key).push(spare);
      }

      const groups = scoped
        .map((equipment) => ({ equipment, spares: byEquipment.get(Number(equipment.id)) || [] }))
        .filter((group) => includeEmpty || group.spares.length > 0);

      return res.json({ groups });
    },

    // Copia a lista de peças de outro equipamento — restrito ao mesmo site, para
    // não misturar parque de instalações diferentes.
    async copyEquipmentSpares(req, res) {
      const targetId = Number(req.params.equipmentId);
      const sourceId = Number(req.body.sourceEquipmentId || req.body.source_equipment_id);
      const replace = Boolean(req.body.replace);

      if (!Number.isInteger(sourceId) || sourceId <= 0) {
        return res.status(422).json({ error: "Equipamento de origem inválido." });
      }
      if (sourceId === targetId) {
        return res.status(422).json({ error: "Origem e destino são o mesmo equipamento." });
      }

      const [target, source] = await Promise.all([
        repo.getEquipmentById(targetId),
        repo.getEquipmentById(sourceId)
      ]);
      if (!target) return res.status(404).json({ error: "Equipamento de destino não encontrado." });
      if (!source) return res.status(404).json({ error: "Equipamento de origem não encontrado." });

      if (!target.site_id || !source.site_id) {
        return res.status(422).json({
          error: "Os dois equipamentos precisam ter um site definido para a cópia.",
          errorCode: "SITE_REQUIRED"
        });
      }
      if (Number(target.site_id) !== Number(source.site_id)) {
        return res.status(422).json({
          error: "A cópia só é permitida entre equipamentos do mesmo site.",
          errorCode: "SITE_MISMATCH"
        });
      }

      const result = await repo.copyEquipmentSpares(sourceId, targetId, { replace });
      return res.json({ ok: true, ...result });
    },

    async linkSparePart(req, res) {
      const equipmentId = Number(req.params.equipmentId);
      const sparePartId = Number(req.body.sparePartId || req.body.spare_part_id);
      const quantity = Number(req.body.quantity || 1);
      if (!Number.isInteger(sparePartId) || sparePartId <= 0) {
        return res.status(422).json({ error: "Peça inválida." });
      }
      const [equipment, sparePart] = await Promise.all([
        repo.getEquipmentById(equipmentId),
        repo.getSparePartById(sparePartId)
      ]);
      if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
      if (!sparePart) return res.status(404).json({ error: "Peça não encontrada." });
      try {
        await repo.associateSparePartToEquipment(equipmentId, sparePartId, quantity > 0 ? quantity : 1);
      } catch (err) {
        if (err && err.code === "pn_duplicate") {
          return res.status(409).json({ error: "Part Number já vinculado a este equipamento.", errorCode: "PN_DUPLICATE" });
        }
        throw err;
      }
      return res.status(201).json({ ok: true });
    },

    async createEquipmentSpare(req, res) {
      const equipmentId = Number(req.params.equipmentId);
      const equipment = await repo.getEquipmentById(equipmentId);
      if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
      const payload = mapEquipmentSpareBody(req.body);
      if (!payload.description) return res.status(422).json({ error: "Descrição é obrigatória." });
      const sourceId = Number(req.body.sourceSparePartId || req.body.source_spare_part_id);
      try {
        const created = await repo.createEquipmentSpare(
          equipmentId,
          payload,
          Number.isInteger(sourceId) && sourceId > 0 ? sourceId : null
        );
        return res.status(201).json(created);
      } catch (err) {
        if (err && err.code === "pn_duplicate") {
          return res.status(409).json({ error: "Part Number já vinculado a este equipamento.", errorCode: "PN_DUPLICATE" });
        }
        throw err;
      }
    },

    async updateEquipmentSpare(req, res) {
      const spareId = Number(req.params.id);
      const payload = mapEquipmentSpareBody(req.body);
      if (!payload.description) return res.status(422).json({ error: "Descrição é obrigatória." });
      try {
        const updated = await repo.updateEquipmentSpare(spareId, payload);
        if (!updated) return res.status(404).json({ error: "Item não encontrado." });
        return res.json(updated);
      } catch (err) {
        if (err && err.code === "pn_duplicate") {
          return res.status(409).json({ error: "Part Number já vinculado a este equipamento.", errorCode: "PN_DUPLICATE" });
        }
        throw err;
      }
    },

    async deleteEquipmentSpare(req, res) {
      const spareId = Number(req.params.id);
      const ok = await repo.deleteEquipmentSpare(spareId);
      if (!ok) return res.status(404).json({ error: "Item não encontrado." });
      return res.status(204).end();
    },

    // ---- Spare parts: IA/PDF + bulk import ------------------------------
    async sparePartsAiConfig(_req, res) {
      return res.json({
        defaultPrompt: getSparePartsDefaultPrompt ? getSparePartsDefaultPrompt() : "",
        jsonSchema: getSparePartsJsonSchema ? getSparePartsJsonSchema() : ""
      });
    },

    async aiExtractSpareParts(req, res) {
      if (!extractSparePartsFromDocument) {
        return res.status(503).json({ error: "Serviço de IA não disponível." });
      }
      const fileBase64 = String(req.body.fileBase64 || "").trim();
      if (!fileBase64) return res.status(422).json({ error: "Arquivo PDF inválido ou vazio." });
      let fileBuffer;
      try {
        fileBuffer = Buffer.from(fileBase64, "base64");
      } catch (_e) {
        return res.status(422).json({ error: "Falha ao decodificar o arquivo." });
      }
      if (!fileBuffer.length) return res.status(422).json({ error: "Arquivo PDF inválido ou vazio." });
      const result = await extractSparePartsFromDocument({
        fileBuffer,
        fileName: sanitize(String(req.body.fileName || "documento.pdf")),
        mimeType: String(req.body.mimeType || "application/pdf").split(";")[0].trim() || "application/pdf",
        promptTemplate: sanitize(String(req.body.promptTemplate || ""))
      });
      return res.json({ spareParts: result.spareParts, count: result.spareParts.length });
    },

    async bulkImportSpareParts(req, res) {
      const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
      const normalized = rawItems.map(normalizeBulkItem).filter((item) => item.description);
      if (!normalized.length) {
        return res.status(422).json({ error: "Nenhum item com descrição válida para importar." });
      }
      const equipmentId = Number(req.body.equipmentId || req.body.equipment_id || 0);
      if (Number.isInteger(equipmentId) && equipmentId > 0) {
        const equipment = await repo.getEquipmentById(equipmentId);
        if (!equipment) return res.status(404).json({ error: "Equipamento não encontrado." });
        // O repositório consolida os repetidos somando quantity e devolve quantos juntou.
        const result = await repo.bulkUpsertEquipmentSpares(equipmentId, normalized);
        return res.json({ ok: true, scope: "equipment", merged: result.merged, inserted: result.inserted, updated: result.updated, linked: result.linked });
      }
      const result = await repo.bulkCreateSpareParts(normalized);
      return res.json({
        ok: true,
        scope: "catalog",
        inserted: result.inserted,
        skipped: result.skipped,
        skippedExisting: result.skippedExisting,
        skippedIntraJson: result.skippedIntraJson
      });
    }
  };

  function parseTimeToMinutes(value) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function computeWorkedHours(checkInClient, checkOutClient) {
    const a = parseTimeToMinutes(checkInClient);
    const b = parseTimeToMinutes(checkOutClient);
    return a !== null && b !== null && b > a ? Math.round(((b - a) / 60) * 100) / 100 : null;
  }

  function mapTimesheetBody(body) {
    const checkInClient = sanitize(body.checkInClient || body.check_in_client);
    const checkOutClient = sanitize(body.checkOutClient || body.check_out_client);
    return {
      activityDate: sanitize(body.activityDate || body.activity_date),
      checkInBase: sanitize(body.checkInBase || body.check_in_base),
      checkInClient,
      checkOutClient,
      checkOutBase: sanitize(body.checkOutBase || body.check_out_base),
      technicianName: sanitize(body.technicianName || body.technician_name),
      workedHours: computeWorkedHours(checkInClient, checkOutClient),
      notes: sanitize(body.notes)
    };
  }

  function normalizeTechIds(value) {
    return Array.from(new Set(
      [].concat(value || [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ));
  }

  function mapSparePartBody(body) {
    return {
      description: sanitize(body.description),
      manufacturer: sanitize(body.manufacturer),
      equipmentModel: sanitize(body.equipmentModel || body.equipment_model),
      partNumber: sanitize(body.partNumber || body.part_number),
      leadTime: sanitize(body.leadTime || body.lead_time),
      isObsolete: body.isObsolete === true || body.isObsolete === "true" || body.is_obsolete === "on",
      replacedByPartNumber: sanitize(body.replacedByPartNumber || body.replaced_by_part_number),
      equipmentFamily: sanitize(body.equipmentFamily || body.equipment_family)
    };
  }

  function mapTechnicianBody(body) {
    return {
      name: sanitize(body.name),
      role: sanitize(body.role),
      company: sanitize(body.company),
      email: sanitize(body.email),
      phone: sanitize(body.phone),
      isLead: body.isLead === true || body.isLead === "true" || body.is_lead === "on"
    };
  }

  function mapInstrumentBody(body) {
    return {
      name: sanitize(body.name),
      model: sanitize(body.model),
      serialNumber: sanitize(body.serialNumber || body.serial_number),
      certificateNumber: sanitize(body.certificateNumber || body.certificate_number),
      certificateLink: sanitize(body.certificateLink || body.certificate_link),
      responsibleTechnicianId: Number(body.responsibleTechnicianId || body.responsible_technician_id || 0),
      lastCalibrationDate: sanitize(body.lastCalibrationDate || body.last_calibration_date) || null,
      calibrationDueDate: sanitize(body.calibrationDueDate || body.calibration_due_date) || null,
      notes: sanitize(body.notes)
    };
  }

  function mapEquipmentBody(body) {
    return {
      customerId: Number(body.customerId || body.customer_id) || null,
      siteId: Number(body.siteId || body.site_id) || null,
      type: sanitize(body.type) || "Novo Equipamento",
      yearOfManufacture: sanitize(body.yearOfManufacture || body.year_of_manufacture),
      serialNumber: sanitize(body.serialNumber || body.serial_number),
      power: sanitize(body.power),
      ratedAcInputVoltage: sanitize(body.ratedAcInputVoltage || body.rated_ac_input_voltage),
      inputFrequency: sanitize(body.inputFrequency || body.input_frequency),
      ratedDcVoltage: sanitize(body.ratedDcVoltage || body.rated_dc_voltage),
      ratedAcOutputVoltage: sanitize(body.ratedAcOutputVoltage || body.rated_ac_output_voltage),
      outputFrequency: sanitize(body.outputFrequency || body.output_frequency),
      degreeOfProtection: sanitize(body.degreeOfProtection || body.degree_of_protection),
      mainLabel: sanitize(body.mainLabel || body.main_label),
      dtNumber: sanitize(body.dtNumber || body.dt_number),
      tagNumber: sanitize(body.tagNumber || body.tag_number),
      manufacturer: sanitize(body.manufacturer),
      modelFamily: sanitize(body.modelFamily || body.model_family),
      notes: sanitize(body.notes)
    };
  }
}

module.exports = { createReportServiceV2Controller };
