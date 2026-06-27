// Controller do façade JSON /admin/api/v2 (consumido pelo SPA React).
// NÃO reimplementa regra de negócio: reusa os MESMOS repositories/services
// do web controller, apenas devolvendo res.json em vez de res.render.
const repo = require("../repositories/serviceReportRepository");
const service = require("../services/serviceReportService");
const analyticsService = require("../services/analyticsService");
const { getReportConfigSettings, saveReportConfigSettings } = require("../services/reportConfigSettings");
const {
  getDefaultTimesheetStyleConfig,
  getDefaultTechteamStyleConfig,
  getDefaultEquipmentStyleConfig,
  getDefaultComponentsStyleConfig,
  getDefaultUpsStyleConfig,
  getDefaultEventLogStyleConfig
} = require("../services/measurementStyleService");

const TABLE_STYLE_TYPES = [
  { key: "timesheet", label: "Timesheet", get: getDefaultTimesheetStyleConfig, settingKey: "report.preview.timesheet.style.default" },
  { key: "techteam", label: "Equipe técnica", get: getDefaultTechteamStyleConfig, settingKey: "report.preview.techteam.style.default" },
  { key: "equipment", label: "Equipamentos", get: getDefaultEquipmentStyleConfig, settingKey: "report.preview.equipment.style.default" },
  { key: "components", label: "Componentes", get: getDefaultComponentsStyleConfig, settingKey: "report.preview.components.style.default" },
  { key: "upsmeasures", label: "Medições UPS", get: getDefaultUpsStyleConfig, settingKey: "report.preview.upsmeasures.style.default" },
  { key: "eventlog", label: "Event Log", get: getDefaultEventLogStyleConfig, settingKey: "report.preview.eventlog.style.default" }
];

function createReportServiceV2Controller(deps) {
  const sanitize = typeof deps.sanitizeInput === "function" ? deps.sanitizeInput : (v) => v;
  const extractSparePartsFromDocument = deps.extractSparePartsFromDocument;
  const getSparePartsDefaultPrompt = deps.getSparePartsDefaultPrompt;
  const getSparePartsJsonSchema = deps.getSparePartsJsonSchema;

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
      return res.json({
        authenticated: Boolean(req.adminUsername),
        username: req.adminUsername || null,
        role: req.adminRole || null,
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
      const technicianIdsByOrder = links.reduce((acc, row) => {
        const orderId = Number(row.order_id);
        const techId = Number(row.technician_id);
        if (!Number.isInteger(orderId) || !Number.isInteger(techId)) return acc;
        (acc[orderId] = acc[orderId] || []).push(techId);
        return acc;
      }, {});
      return res.json({ orders, customers, sites, technicians, technicianIdsByOrder });
    },

    async createOrder(req, res) {
      if (String(req.adminRole || "").toLowerCase() !== "admin") {
        return res.status(403).json({ error: "Apenas administradores do sistema podem criar OS." });
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
      const created = await service.createEquipment(mapEquipmentBody(req.body));
      return res.status(201).json(created);
    },

    async updateEquipment(req, res) {
      const id = Number(req.params.id);
      const updated = await service.updateEquipment(id, mapEquipmentBody(req.body));
      if (!updated) return res.status(404).json({ error: "Equipamento não encontrado." });
      return res.json(updated);
    },

    async deleteEquipment(req, res) {
      const id = Number(req.params.id);
      try {
        const ok = await service.deleteEquipment(id);
        if (!ok) return res.status(404).json({ error: "Equipamento não encontrado." });
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
      const entryId = Number(req.params.entryId);
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
        const result = await repo.bulkUpsertEquipmentSpares(equipmentId, normalized);
        return res.json({ ok: true, scope: "equipment", inserted: result.inserted, updated: result.updated, linked: result.linked });
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
