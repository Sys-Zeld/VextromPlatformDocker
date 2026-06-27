// Controller do façade JSON /admin/api/v2 (consumido pelo SPA React).
// NÃO reimplementa regra de negócio: reusa os MESMOS repositories/services
// do web controller, apenas devolvendo res.json em vez de res.render.
const repo = require("../repositories/serviceReportRepository");
const service = require("../services/serviceReportService");
const analyticsService = require("../services/analyticsService");
const { getReportConfigSettings, saveReportConfigSettings } = require("../services/reportConfigSettings");

function createReportServiceV2Controller(deps) {
  const sanitize = typeof deps.sanitizeInput === "function" ? deps.sanitizeInput : (v) => v;

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

    // ---- Orders (lista + exclusão) --------------------------------------
    async listOrders(_req, res) {
      const [orders, customers, sites, technicians] = await Promise.all([
        repo.listOrders(),
        repo.listCustomers(),
        repo.listSites(),
        repo.listGlobalTechnicians()
      ]);
      return res.json({ orders, customers, sites, technicians });
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
    }
  };

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
