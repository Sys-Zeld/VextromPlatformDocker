const express = require("express");
const repo = require("../repositories/techniciansRepository");
const integration = require("../services/reportServiceIntegration");
const { preScheduleOrders } = require("../services/technicianPreScheduleService");

function createTechniciansRouter(deps) {
  const router = express.Router();
  const asyncHandler = deps.asyncHandler || ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const respondError = (err, res) => {
    if (err.code === "SG_ORDER_INVALID") return res.status(404).json({ error: err.message, errorCode: err.code });
    if (["SG_ORDER_NOT_SCHEDULED", "SG_TECHNICIAN_INVALID", "SG_TECHNICIAN_SCHEDULE_CONFLICT"].includes(err.code)) return res.status(409).json({ error: err.message, errorCode: err.code, conflict: err.conflict || null });
    return null;
  };

  router.get("/", asyncHandler(async (_req, res) => res.json({ technicians: await repo.listTechnicians() })));
  router.get("/agenda", asyncHandler(async (req, res) => {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: "Período da agenda inválido.", errorCode: "SG_AGENDA_INVALID" });
    }
    res.json({ agenda: await repo.listTechnicianAgenda({ from, to, technicianId: Number(req.query.technicianId) || null }) });
  }));
  router.put("/agenda/orders/:orderId", asyncHandler(async (req, res) => {
    const startDate = String(req.body?.startDate || "");
    const executionDays = Number(req.body?.executionDays);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(executionDays) || executionDays < 1 || executionDays > 365) {
      return res.status(400).json({ error: "Data e duração da execução são obrigatórias.", errorCode: "SG_AGENDA_INVALID" });
    }
    try {
      res.json({ order: await repo.rescheduleOrder(Number(req.params.orderId), { startDate, executionDays }, actorOf(req)) });
    } catch (err) { if (!respondError(err, res)) throw err; }
  }));
  router.post("/", asyncHandler(async (req, res) => {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nome do técnico é obrigatório.", errorCode: "SG_VALIDATION_ERROR" });
    const technician = await repo.createTechnician({ ...req.body, name }, actorOf(req));
    res.status(201).json({ technician });
  }));
  router.get("/report-service", asyncHandler(async (_req, res) => res.json({ technicians: await integration.listReportServiceTechnicians() })));
  router.post("/import", asyncHandler(async (req, res) => res.status(201).json(await integration.importReportServiceTechnician(Number(req.body?.rsTechnicianId), actorOf(req)))));
  router.post("/pre-schedule", asyncHandler(async (req, res) => {
    try {
      res.json(await preScheduleOrders({
        technicianIds: req.body?.technicianIds,
        filters: req.body?.filters,
        apply: req.body?.apply === true
      }, actorOf(req)));
    } catch (err) {
      if (err.code === "SG_PRE_SCHEDULE_INVALID") return res.status(400).json({ error: err.message, errorCode: err.code });
      throw err;
    }
  }));
  router.post("/:id/export", asyncHandler(async (req, res) => res.json(await integration.exportTechnicianToReportService(Number(req.params.id)))));

  router.get("/orders/:orderId", asyncHandler(async (req, res) => res.json({ technicians: await repo.listOrderTechnicians(Number(req.params.orderId)) })));
  router.post("/orders/:orderId/:technicianId", asyncHandler(async (req, res) => {
    try { res.json({ technicians: await repo.linkTechnician(Number(req.params.orderId), Number(req.params.technicianId), actorOf(req)) }); }
    catch (err) { if (!respondError(err, res)) throw err; }
  }));
  router.delete("/orders/:orderId/:technicianId", asyncHandler(async (req, res) => {
    try { res.json({ technicians: await repo.unlinkTechnician(Number(req.params.orderId), Number(req.params.technicianId)) }); }
    catch (err) { if (!respondError(err, res)) throw err; }
  }));
  return router;
}

module.exports = { createTechniciansRouter };
