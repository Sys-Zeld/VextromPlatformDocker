const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/operationsRepository");
const {
  parseMeasurementInput,
  parseReplacedPartInput,
  parseAssociatedReportInput,
  parseEventInput,
  parseAttachmentInput,
  parseCalendarGenerateInput,
  parseRecommendationInput,
  parseRecommendationStatusInput
} = require("../validators/operationsValidators");

function createOperationsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const invalidOrder = { error: "Ordem de manutencao invalida ou inexistente", errorCode: "SG_ORDER_INVALID" };
  const invalidEquipment = { error: "Equipamento invalido ou inexistente", errorCode: "SG_EQUIPMENT_INVALID" };
  const invalidRef = { error: "Referencia invalida", errorCode: "SG_OPERATION_FK" };
  const reportsDir = path.join(process.cwd(), "dados", "sentinelgrid", "order-reports");

  const handleWrite = async (fn, res) => {
    try {
      return await fn();
    } catch (err) {
      if (err && err.code === "SG_ORDER_INVALID") return res.status(404).json(invalidOrder);
      if (err && err.code === "SG_EQUIPMENT_INVALID") return res.status(404).json(invalidEquipment);
      if (isForeignKeyError(err)) return res.status(400).json(invalidRef);
      throw err;
    }
  };

  router.get("/measurements", asyncHandler(async (req, res) => {
    res.json({ measurements: await repo.listMeasurements({ orderId: Number(req.query.orderId) || null, equipmentId: Number(req.query.equipmentId) || null }) });
  }));
  router.post("/measurements", asyncHandler(async (req, res) => {
    let input; try { input = parseMeasurementInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const measurement = await handleWrite(() => repo.createMeasurement(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ measurement });
  }));

  router.get("/parts", asyncHandler(async (req, res) => {
    res.json({ parts: await repo.listParts({ orderId: Number(req.query.orderId) || null, equipmentId: Number(req.query.equipmentId) || null }) });
  }));
  router.post("/parts", asyncHandler(async (req, res) => {
    let input; try { input = parseReplacedPartInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const part = await handleWrite(() => repo.createPart(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ part });
  }));

  router.get("/reports", asyncHandler(async (req, res) => {
    res.json({ reports: await repo.listReports({ orderId: Number(req.query.orderId) || null, equipmentId: Number(req.query.equipmentId) || null }) });
  }));
  router.post("/reports", asyncHandler(async (req, res) => {
    let input; try { input = parseAssociatedReportInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const report = await handleWrite(() => repo.createReport(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ report });
  }));

  router.post("/reports/upload/:orderId", express.raw({ type: () => true, limit: "25mb" }), asyncHandler(async (req, res) => {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const mimeType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
    const originalName = path.basename(decodeURIComponent(String(req.headers["x-file-name"] || "relatorio.pdf"))).replace(/[^a-zA-Z0-9._\- ]/g, "").slice(0, 180);
    const title = decodeURIComponent(String(req.headers["x-report-title"] || path.parse(originalName).name || "Relatorio tecnico")).slice(0, 240);
    const valid = buffer.length > 0 && buffer.length <= 25 * 1024 * 1024 && mimeType === "application/pdf" && path.extname(originalName).toLowerCase() === ".pdf" && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    if (!valid) return res.status(400).json({ error: "Envie um PDF valido de ate 25 MB.", errorCode: "SG_REPORT_FILE_INVALID" });
    await fsp.mkdir(reportsDir, { recursive: true });
    const storedName = `report-${Number(req.params.orderId)}-${crypto.randomUUID()}.pdf`;
    await fsp.writeFile(path.join(reportsDir, storedName), buffer, { flag: "wx" });
    try {
      const report = await handleWrite(() => repo.createReport({
        orderId: Number(req.params.orderId), reportCode: "", title, issuedAt: null, technician: "",
        reportType: "pdf", fileRef: storedName, externalLink: "", externalId: "", notes: `Arquivo: ${originalName}`
      }, actorOf(req)), res);
      if (res.headersSent) { await fsp.unlink(path.join(reportsDir, storedName)).catch(() => {}); return; }
      res.status(201).json({ report });
    } catch (err) { await fsp.unlink(path.join(reportsDir, storedName)).catch(() => {}); throw err; }
  }));

  router.get("/reports/:id/file", asyncHandler(async (req, res) => {
    const report = await repo.getReportById(Number(req.params.id));
    if (!report || !report.file_ref) return res.status(404).json({ error: "Arquivo de relatorio nao encontrado." });
    const filePath = path.join(reportsDir, path.basename(report.file_ref));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo de relatorio nao encontrado." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(report.title || "relatorio.pdf")}.pdf`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    fs.createReadStream(filePath).pipe(res);
  }));

  router.get("/attachments", asyncHandler(async (req, res) => {
    res.json({ attachments: await repo.listAttachments({ entityType: String(req.query.entityType || ""), entityId: Number(req.query.entityId) || null }) });
  }));
  router.post("/attachments", asyncHandler(async (req, res) => {
    let input; try { input = parseAttachmentInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const attachment = await handleWrite(() => repo.createAttachment(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ attachment });
  }));

  router.get("/events", asyncHandler(async (req, res) => {
    res.json({ events: await repo.listEvents({ equipmentId: Number(req.query.equipmentId) || null }) });
  }));
  router.post("/events", asyncHandler(async (req, res) => {
    let input; try { input = parseEventInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const event = await handleWrite(() => repo.createEvent(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ event });
  }));

  router.get("/recommendations", asyncHandler(async (req, res) => {
    res.json({ recommendations: await repo.listRecommendations({
      equipmentId: Number(req.query.equipmentId) || null,
      orderId: Number(req.query.orderId) || null,
      status: String(req.query.status || "")
    }) });
  }));
  router.post("/recommendations", asyncHandler(async (req, res) => {
    let input; try { input = parseRecommendationInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const recommendation = await handleWrite(() => repo.createRecommendation(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ recommendation });
  }));
  router.put("/recommendations/:id/status", asyncHandler(async (req, res) => {
    let input; try { input = parseRecommendationStatusInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const recommendation = await handleWrite(() => repo.updateRecommendationStatus(Number(req.params.id), input, actorOf(req)), res);
    if (res.headersSent) return;
    if (!recommendation) return res.status(404).json({ error: "Recomendacao inexistente", errorCode: "SG_RECOMMENDATION_NOT_FOUND" });
    res.json({ recommendation });
  }));

  router.get("/history", asyncHandler(async (req, res) => {
    res.json({ history: await repo.listHistory({
      equipmentId: Number(req.query.equipmentId) || null,
      clientId: Number(req.query.clientId) || null,
      siteId: Number(req.query.siteId) || null
    }) });
  }));

  router.get("/calendar", asyncHandler(async (req, res) => {
    res.json({ entries: await repo.listCalendar({ year: Number(req.query.year) || new Date().getFullYear(), month: Number(req.query.month) || null, equipmentId: Number(req.query.equipmentId) || null }) });
  }));
  router.post("/calendar/generate", asyncHandler(async (req, res) => {
    let input; try { input = parseCalendarGenerateInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    res.status(201).json(await repo.generateCalendar(input, actorOf(req)));
  }));

  router.get("/dashboard", asyncHandler(async (req, res) => {
    res.json(await repo.dashboard({ clientId: Number(req.query.clientId) || null }));
  }));

  return router;
}

module.exports = { createOperationsRouter };
