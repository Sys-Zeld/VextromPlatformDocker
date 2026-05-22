const path = require("path");
const crypto = require("crypto");
const repo = require("../../repositories/serviceReportRepository");
const service = require("../../services/serviceReportService");
const { withServiceOrderDisplay } = require("../../utils/serviceOrderDisplay");
const objectStorage = require("../../../../specflow/services/objectStorage");
const { renderReportPreviewHtml, normalizeReportTemplateKey } = require("../../services/reportTemplateService");
const { getReportConfigSettings } = require("../../services/reportConfigSettings");

const BASE = "/admin/report-service/mobile";

const STATUS_LABELS = { draft: "Rascunho", valid: "Validada", approved: "Aprovada" };

function fmt(isoDate) {
  if (!isoDate) return "-";
  const d = new Date(isoDate);
  return isNaN(d.getTime()) ? String(isoDate).slice(0, 10) : d.toLocaleDateString("pt-BR");
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function createMobileController(deps) {
  const sanitizeInput = deps.sanitizeInput;
  const sanitizeRichText = deps.sanitizeRichTextInput;

  return {
    // ── Lista de OS ───────────────────────────────────────────────────────────
    async listOrders(req, res) {
      const orders = (await repo.listOrders()).map(withServiceOrderDisplay);
      return res.render("report-service/mobile/orders", {
        pageTitle: "Ordens de Serviço",
        orders,
        STATUS_LABELS,
        fmt,
        flash: sanitizeInput(req.query.flash || ""),
        BASE,
      });
    },

    // ── Edição de OS (tabs: detalhes, timesheet, logs, imagens) ──────────────
    async orderEdit(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).send("OS não encontrada.");
      const orderView = withServiceOrderDisplay(order);
      const report = await service.ensureReportForOrder(orderId, order.title);
      const [timesheet, dailyLogs, images, orderEquipments, allEquipments, components] = await Promise.all([
        repo.listTimesheetByOrder(orderId),
        repo.listDailyLogsByOrder(orderId),
        repo.listImages(report.id),
        repo.listOrderEquipments(orderId),
        repo.listEquipments(),
        repo.listComponents(report.id),
      ]);
      const orderEquipmentIds = (orderEquipments || [])
        .map(e => Number(e.equipment_id))
        .filter(id => Number.isInteger(id) && id > 0);
      const orderSpares = orderEquipmentIds.length
        ? await repo.listSparePartsByEquipmentIds(orderEquipmentIds)
        : [];
      const availableEquipments = (allEquipments || []).filter(e =>
        Number(e.customer_id) === Number(order.customer_id)
      );
      const tab = req.query.tab || "details";
      return res.render("report-service/mobile/order-edit", {
        pageTitle: orderView.service_order_display || `OS #${orderId}`,
        order: orderView,
        timesheet,
        dailyLogs,
        images,
        orderEquipments,
        availableEquipments,
        components: components || [],
        orderSpares: orderSpares || [],
        tab,
        STATUS_LABELS,
        fmt,
        stripHtml,
        flash: sanitizeInput(req.query.flash || ""),
        flashType: req.query.flash_type === "danger" ? "danger" : "success",
        csrfToken: req.csrfToken(),
        BASE,
      });
    },

    // ── Preview HTML — renderiza direto sem redirect (evita mobileRedirect) ──
    async preview(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).send("OS não encontrada.");
      const orderView = withServiceOrderDisplay(order);
      const report = await service.ensureReportForOrder(orderId, order.title);
      const payload = await service.buildReportAggregate(report.id);
      if (!payload) return res.status(404).send("Relatório não encontrado.");
      const reportConfig = await getReportConfigSettings();
      const templateKey = normalizeReportTemplateKey(reportConfig.templateKey);
      const previewHtml = await renderReportPreviewHtml(payload, { reportConfig, templateKey });
      return res.render("report-service/mobile/preview", {
        pageTitle: `Preview — ${orderView.service_order_display || `OS #${orderId}`}`,
        order: orderView,
        previewHtml,
        BASE,
      });
    },

    // ── Timesheet: criar ──────────────────────────────────────────────────────
    async createTimesheet(req, res) {
      const orderId = Number(req.params.id);
      try {
        await repo.createTimesheetEntry({
          serviceOrderId: orderId,
          activityDate: sanitizeInput(req.body.activityDate),
          checkInBase: sanitizeInput(req.body.checkInBase) || null,
          checkInClient: sanitizeInput(req.body.checkInClient) || null,
          checkOutClient: sanitizeInput(req.body.checkOutClient) || null,
          checkOutBase: sanitizeInput(req.body.checkOutBase) || null,
          technicianName: sanitizeInput(req.body.technicianName) || null,
          notes: sanitizeInput(req.body.notes) || null,
        });
        return res.redirect(`${BASE}/orders/${orderId}?tab=timesheet&flash=Entrada+adicionada.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=timesheet&flash=Falha+ao+salvar.&flash_type=danger`);
      }
    },

    // ── Timesheet: excluir ────────────────────────────────────────────────────
    async deleteTimesheet(req, res) {
      const orderId = Number(req.params.id);
      const entryId = Number(req.params.entryId);
      try {
        await repo.deleteTimesheetEntry(entryId);
        return res.redirect(`${BASE}/orders/${orderId}?tab=timesheet&flash=Entrada+removida.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=timesheet&flash=Falha+ao+excluir.&flash_type=danger`);
      }
    },

    // ── Daily Logs: criar ─────────────────────────────────────────────────────
    async createDailyLog(req, res) {
      const orderId = Number(req.params.id);
      try {
        const content = sanitizeRichText(req.body.content) || "<p><br></p>";
        await repo.createDailyLog({
          serviceOrderId: orderId,
          activityDate: sanitizeInput(req.body.activityDate),
          title: sanitizeInput(req.body.title) || "",
          content,
          notes: "",
          sortOrder: 0,
        });
        return res.redirect(`${BASE}/orders/${orderId}?tab=logs&flash=Log+adicionado.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=logs&flash=Falha+ao+salvar.&flash_type=danger`);
      }
    },

    // ── Daily Logs: editar ────────────────────────────────────────────────────
    async updateDailyLog(req, res) {
      const orderId = Number(req.params.id);
      const logId = Number(req.params.logId);
      try {
        const content = sanitizeRichText(req.body.content) || "<p><br></p>";
        await repo.updateDailyLogByOrderAndId(orderId, logId, {
          activityDate: sanitizeInput(req.body.activityDate),
          title: sanitizeInput(req.body.title) || "",
          content,
          notes: "",
          sortOrder: 0,
        });
        return res.redirect(`${BASE}/orders/${orderId}?tab=logs&flash=Log+atualizado.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=logs&flash=Falha+ao+atualizar.&flash_type=danger`);
      }
    },

    // ── Daily Logs: excluir ───────────────────────────────────────────────────
    async deleteDailyLog(req, res) {
      const orderId = Number(req.params.id);
      const logId = Number(req.params.logId);
      try {
        await repo.deleteDailyLogByOrderAndId(orderId, logId);
        return res.redirect(`${BASE}/orders/${orderId}?tab=logs&flash=Log+removido.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=logs&flash=Falha+ao+excluir.&flash_type=danger`);
      }
    },

    // ── Equipamentos: associar ────────────────────────────────────────────────
    async attachEquipment(req, res) {
      const orderId = Number(req.params.id);
      const equipmentId = Number(sanitizeInput(req.body.equipmentId));
      try {
        if (!equipmentId) throw new Error("ID inválido.");
        const [order, equipment] = await Promise.all([
          repo.getOrderById(orderId),
          repo.getEquipmentById(equipmentId),
        ]);
        if (!order) throw new Error("OS não encontrada.");
        if (!equipment || Number(equipment.customer_id) !== Number(order.customer_id)) {
          throw new Error("Equipamento não pertence ao cliente desta OS.");
        }
        await repo.attachEquipmentToOrder(orderId, equipmentId);
        return res.redirect(`${BASE}/orders/${orderId}?flash=Equipamento+associado.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?flash=Falha+ao+associar.&flash_type=danger`);
      }
    },

    // ── Equipamentos: remover ─────────────────────────────────────────────────
    async detachEquipment(req, res) {
      const orderId = Number(req.params.id);
      const equipmentId = Number(req.params.equipmentId);
      try {
        await repo.detachEquipmentFromOrder(orderId, equipmentId);
        return res.redirect(`${BASE}/orders/${orderId}?flash=Equipamento+removido.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?flash=Falha+ao+remover.&flash_type=danger`);
      }
    },

    // ── Assinatura: página ────────────────────────────────────────────────────
    async signPage(req, res) {
      const orderId = Number(req.params.id);
      const order = await repo.getOrderById(orderId);
      if (!order) return res.status(404).send("OS não encontrada.");
      if (order.status !== "valid") {
        return res.redirect(`${BASE}/orders/${orderId}?tab=details&flash=OS+deve+estar+Validada+para+assinar.&flash_type=danger`);
      }
      const orderView = withServiceOrderDisplay(order);
      const report = await service.ensureReportForOrder(orderId, order.title);
      const [allSigs, technicians] = await Promise.all([
        repo.listSignatures(report.id),
        repo.listTechniciansByOrder(orderId),
      ]);
      const signatures = (allSigs || []).filter(s => String(s.signer_type || "") === "vextrom_technician");
      return res.render("report-service/mobile/sign", {
        pageTitle: `Assinar — ${orderView.service_order_display || `OS #${orderId}`}`,
        order: orderView,
        signatures,
        technicians: technicians || [],
        flash: sanitizeInput(req.query.flash || ""),
        flashType: req.query.flash_type === "danger" ? "danger" : "success",
        csrfToken: req.csrfToken(),
        BASE,
      });
    },

    // ── Assinatura: criar ─────────────────────────────────────────────────────
    async createSign(req, res) {
      const orderId = Number(req.params.id);
      try {
        const order = await repo.getOrderById(orderId);
        if (!order || order.status !== "valid") {
          return res.redirect(`${BASE}/orders/${orderId}?tab=details&flash=OS+deve+estar+Validada+para+assinar.&flash_type=danger`);
        }
        const signatureData = String(req.body.signature_data || "").trim();
        if (!signatureData || signatureData === "data:,") {
          return res.redirect(`${BASE}/orders/${orderId}/sign?flash=Desenhe+a+assinatura+antes+de+confirmar.&flash_type=danger`);
        }
        const report = await service.ensureReportForOrder(orderId, order.title);
        const signIp = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim().slice(0, 100);
        const signUa = String(req.headers["user-agent"] || "").slice(0, 500);
        await service.createSignature(report.id, {
          signerType:    "vextrom_technician",
          signerName:    sanitizeInput(req.body.signer_name),
          signerRole:    sanitizeInput(req.body.signer_role),
          signerCompany: sanitizeInput(req.body.signer_company),
          signatureData,
          ipAddress: signIp,
          userAgent: signUa,
        });
        return res.redirect(`${BASE}/orders/${orderId}/sign?flash=Assinatura+confirmada+com+sucesso.`);
      } catch (err) {
        return res.redirect(`${BASE}/orders/${orderId}/sign?flash=Falha+ao+registrar+assinatura.&flash_type=danger`);
      }
    },

    // ── Assinatura: excluir ───────────────────────────────────────────────────
    async deleteSign(req, res) {
      const orderId = Number(req.params.id);
      const sigId = Number(req.params.sigId);
      try {
        const order = await repo.getOrderById(orderId);
        const report = await service.ensureReportForOrder(orderId, order && order.title);
        await repo.deleteSignature(sigId, report.id);
        return res.redirect(`${BASE}/orders/${orderId}/sign?flash=Assinatura+removida.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}/sign?flash=Falha+ao+remover+assinatura.&flash_type=danger`);
      }
    },

    // ── Componentes: criar ────────────────────────────────────────────────────
    async createComponent(req, res) {
      const orderId = Number(req.params.id);
      try {
        const order = await repo.getOrderById(orderId);
        if (!order) throw new Error("OS não encontrada.");
        const rawEquipId = sanitizeInput(req.body.equipmentId) || null;
        if (rawEquipId) {
          const equipment = await repo.getEquipmentById(Number(rawEquipId));
          if (!equipment || Number(equipment.customer_id) !== Number(order.customer_id)) {
            throw new Error("Equipamento não pertence ao cliente desta OS.");
          }
        }
        const report = await service.ensureReportForOrder(orderId, order.title);
        await service.createComponent(report.id, {
          category:    sanitizeInput(req.body.category),
          equipmentId: rawEquipId,
          quantity:    sanitizeInput(req.body.quantity) || "1",
          description: sanitizeInput(req.body.description),
          partNumber:  sanitizeInput(req.body.partNumber) || null,
          notes:       sanitizeInput(req.body.notes) || null,
        });
        return res.redirect(`${BASE}/orders/${orderId}?flash=Componente+adicionado.`);
      } catch (err) {
        const msg = err.statusCode === 422
          ? encodeURIComponent(err.message)
          : "Falha+ao+adicionar+componente.";
        return res.redirect(`${BASE}/orders/${orderId}?flash=${msg}&flash_type=danger`);
      }
    },

    // ── Componentes: excluir ──────────────────────────────────────────────────
    async deleteComponent(req, res) {
      const orderId = Number(req.params.id);
      const compId  = Number(req.params.compId);
      try {
        await repo.deleteComponent(compId);
        return res.redirect(`${BASE}/orders/${orderId}?flash=Componente+removido.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?flash=Falha+ao+remover.&flash_type=danger`);
      }
    },

    // ── OS: validar ───────────────────────────────────────────────────────────
    async validateOrder(req, res) {
      const orderId = Number(req.params.id);
      try {
        await service.updateOrder(orderId, { status: "valid", updatedBy: "mobile" });
        return res.redirect(`${BASE}/orders/${orderId}?tab=details&flash=OS+validada.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=details&flash=Falha+ao+validar.&flash_type=danger`);
      }
    },

    // ── Imagens: excluir ──────────────────────────────────────────────────────
    async deleteImage(req, res) {
      const orderId = Number(req.params.id);
      const imageRefId = Number(req.params.imageRefId);
      try {
        const order = await repo.getOrderById(orderId);
        if (!order) return res.redirect(`${BASE}/orders/${orderId}?tab=images&flash=OS+não+encontrada.&flash_type=danger`);
        const report = await service.ensureReportForOrder(orderId, order.title);
        await repo.deleteImageByRefId(report.id, imageRefId);
        return res.redirect(`${BASE}/orders/${orderId}?tab=images&flash=Imagem+removida.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=images&flash=Falha+ao+excluir.&flash_type=danger`);
      }
    },

    // ── Imagens: editar legenda ───────────────────────────────────────────────
    async updateImageCaption(req, res) {
      const orderId = Number(req.params.id);
      const imageRefId = Number(req.params.imageRefId);
      try {
        const order = await repo.getOrderById(orderId);
        if (!order) return res.redirect(`${BASE}/orders/${orderId}?tab=images&flash=OS+não+encontrada.&flash_type=danger`);
        const report = await service.ensureReportForOrder(orderId, order.title);
        const caption = sanitizeInput(req.body.caption) || "";
        await repo.updateImageCaptionByRefId(report.id, imageRefId, caption);
        return res.redirect(`${BASE}/orders/${orderId}?tab=images&flash=Legenda+atualizada.`);
      } catch {
        return res.redirect(`${BASE}/orders/${orderId}?tab=images&flash=Falha+ao+atualizar.&flash_type=danger`);
      }
    },

    // ── Imagens: upload (raw binary via JS fetch) ────────────────────────────
    async uploadImage(req, res) {
      const orderId = Number(req.params.id);
      try {
        const order = await repo.getOrderById(orderId);
        if (!order) return res.status(404).json({ ok: false, error: "OS não encontrada." });
        const report = await service.ensureReportForOrder(orderId, order.title);
        let fileNameRaw = "imagem";
        try { fileNameRaw = decodeURIComponent(String(req.headers["x-file-name"] || "imagem")); } catch (_) { }
        fileNameRaw = sanitizeInput(fileNameRaw);
        const fileNameBase = path.basename(fileNameRaw).replace(/[^a-zA-Z0-9._-]/g, "") || "imagem";
        const extFromName = path.extname(fileNameBase).toLowerCase();
        const mime = String(req.headers["content-type"] || "").toLowerCase().split(";")[0].trim();
        const extFromMime = mime.includes("png") ? ".png" : mime.includes("jpeg") || mime.includes("jpg") ? ".jpg" : mime.includes("webp") ? ".webp" : "";
        const ext = [".png", ".jpg", ".jpeg", ".webp"].includes(extFromName) ? extFromName : extFromMime;
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
        if (!ext || !buffer.length) return res.status(400).json({ ok: false, error: "Imagem inválida." });
        let captionRaw = "";
        try { captionRaw = decodeURIComponent(String(req.headers["x-caption"] || "")); } catch (_) { }
        const fileSafeBase = path.basename(fileNameBase, extFromName).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "imagem";
        const finalName = `${Date.now()}-${fileSafeBase}-${crypto.randomBytes(4).toString("hex")}${ext === ".jpeg" ? ".jpg" : ext}`;
        await objectStorage.putObject(path.join("dados", "report-img", finalName), buffer, { contentType: mime || "application/octet-stream" });
        const created = await repo.createImage({ serviceReportId: report.id, sectionKey: "__tag__", filePath: finalName, caption: sanitizeInput(captionRaw), sortOrder: 0 });
        return res.status(201).json({ ok: true, id: created.ref_id, filePath: finalName });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message || "Falha ao enviar imagem." });
      }
    },
  };
}

module.exports = { createMobileController };
