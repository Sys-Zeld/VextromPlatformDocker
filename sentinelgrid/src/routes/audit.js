const express = require("express");
const repo = require("../repositories/auditRepository");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Janela padrão: últimos 12 meses até hoje. O cliente pode sobrescrever com ?from=&to=.
function resolveRange(req) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()))
    .toISOString()
    .slice(0, 10);
  let f = String(req.query.from || "");
  let t = String(req.query.to || "");
  if (!DATE_RE.test(f)) f = from;
  if (!DATE_RE.test(t)) t = to;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

function createAuditRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler || ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));

  // Auditoria por equipamento: aderência das OMs à cadência do plano + lacunas.
  router.get(
    "/equipment/:equipmentId",
    asyncHandler(async (req, res) => {
      const equipmentId = Number(req.params.equipmentId);
      if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
        return res.status(400).json({ error: "Equipamento inválido.", errorCode: "SG_AUDIT_INVALID" });
      }
      const { from, to } = resolveRange(req);
      const result = await repo.auditEquipment({ equipmentId, from, to });
      if (!result) {
        return res.status(404).json({ error: "Equipamento inexistente.", errorCode: "SG_EQUIPMENT_INVALID" });
      }
      res.json(result);
    })
  );

  // Auditoria por cliente (+ site opcional): resumo de aderência de cada equipamento + agregado.
  router.get(
    "/client",
    asyncHandler(async (req, res) => {
      const clientId = Number(req.query.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({ error: "Selecione um cliente.", errorCode: "SG_AUDIT_INVALID" });
      }
      const siteId = Number(req.query.siteId) || null;
      const { from, to } = resolveRange(req);
      res.json(await repo.auditClient({ clientId, siteId, from, to }));
    })
  );

  return router;
}

module.exports = { createAuditRouter };
