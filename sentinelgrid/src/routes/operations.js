const express = require("express");
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
    res.json({ history: await repo.listHistory({ equipmentId: Number(req.query.equipmentId) || null }) });
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
