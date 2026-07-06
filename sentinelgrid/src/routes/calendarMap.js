const express = require("express");
const repo = require("../repositories/calendarMapRepository");

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Deriva a janela [from, to] a partir de from/to explícitos ou de year/month.
// Sem nada informado, limita ao ano corrente (evita varrer todo o histórico).
function resolveRange(q) {
  const from = String(q.from || "").trim();
  const to = String(q.to || "").trim();
  if (from || to) return { from: from || null, to: to || null };
  const year = Number(q.year) || null;
  const month = Number(q.month) || null;
  if (year && month) {
    const lastDay = new Date(year, month, 0).getDate();
    return { from: iso(year, month, 1), to: iso(year, month, lastDay) };
  }
  const y = year || new Date().getFullYear();
  return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
}

function parseFilters(q) {
  const { from, to } = resolveRange(q);
  const bool = (v) => v === "1" || v === "true";
  return {
    from,
    to,
    clientId: Number(q.clientId) || null,
    siteId: Number(q.siteId) || null,
    areaId: Number(q.areaId) || null,
    equipmentId: Number(q.equipmentId) || null,
    equipmentTypeId: Number(q.equipmentTypeId) || null,
    maintenanceType: String(q.maintenanceType || "").trim(),
    status: String(q.status || "").trim(),
    criticality: String(q.criticality || "").trim(),
    responsible: String(q.responsible || "").trim(),
    onlyCriticalRec: bool(q.onlyCriticalRec),
    onlyPendingApproval: bool(q.onlyPendingApproval),
    onlyPendingReport: bool(q.onlyPendingReport),
    limit: Number(q.limit) || undefined
  };
}

function createCalendarMapRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));

  router.get("/", asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query);
    const events = await repo.listMapEvents(filters);
    res.json({ events, range: { from: filters.from, to: filters.to }, total: events.length });
  }));

  router.get("/summary", asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query);
    const summary = await repo.mapSummary(filters);
    res.json({ ...summary, range: { from: filters.from, to: filters.to } });
  }));

  return router;
}

module.exports = { createCalendarMapRouter };
