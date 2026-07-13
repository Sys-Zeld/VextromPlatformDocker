const express = require("express");
const { getRedis } = require("../redis");
const mapRepo = require("../repositories/calendarMapRepository");

const ACK_TTL_SECONDS = 24 * 60 * 60; // 24h
const ackKey = (user) => `sg:alert:ack:${user || "anon"}`;
const positionKey = (user) => `sg:alert:popup-position:${user || "anon"}`;

function alertRange() {
  const iso = (d) => d.toISOString().slice(0, 10);
  const now = new Date();
  const from = new Date(now); from.setFullYear(from.getFullYear() - 1); // atrasadas até 1 ano
  const to = new Date(now); to.setFullYear(to.getFullYear() + 1);       // próximas até 1 ano
  return { from: iso(from), to: iso(to) };
}

function createAlertsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const userOf = (req) => String(req.adminUsername || "anon");

  // Lista de alertas por prioridade (usada pelo popup e pela tela de alertas).
  router.get("/", asyncHandler(async (req, res) => {
    const { from, to } = alertRange();
    const result = await mapRepo.listAlerts({
      from,
      to,
      clientId: Number(req.query.clientId) || null,
      siteId: Number(req.query.siteId) || null,
      equipmentId: Number(req.query.equipmentId) || null
    });
    res.json(result);
  }));

  // Estado de "ciente" do usuário (TTL 24h). Redis fora → considera não-ciente.
  router.get("/ack", asyncHandler(async (req, res) => {
    try {
      const ttl = await getRedis().ttl(ackKey(userOf(req)));
      const acknowledged = ttl > 0;
      res.json({ acknowledged, until: acknowledged ? Date.now() + ttl * 1000 : null });
    } catch (_err) {
      res.json({ acknowledged: false, until: null });
    }
  }));

  // Registra que o usuário viu os alertas — some por 24h.
  router.post("/ack", asyncHandler(async (req, res) => {
    try {
      await getRedis().set(ackKey(userOf(req)), String(Date.now()), "EX", ACK_TTL_SECONDS);
      res.json({ acknowledged: true, until: Date.now() + ACK_TTL_SECONDS * 1000 });
    } catch (_err) {
      res.json({ acknowledged: false, until: null, warning: "redis indisponivel" });
    }
  }));

  // Reset — limpa o "ciente": o popup volta a aparecer.
  router.delete("/ack", asyncHandler(async (req, res) => {
    try {
      await getRedis().del(ackKey(userOf(req)));
    } catch (_err) {
      /* Redis fora → já é considerado não-ciente */
    }
    res.json({ acknowledged: false, until: null });
  }));

  // Posição preferida do popup, persistida por usuário no Redis.
  router.get("/popup-position", asyncHandler(async (req, res) => {
    try {
      const raw = await getRedis().get(positionKey(userOf(req)));
      const parsed = raw ? JSON.parse(raw) : null;
      const valid = parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top);
      res.json(valid ? { left: parsed.left, top: parsed.top } : { left: null, top: null });
    } catch (_err) {
      res.json({ left: null, top: null });
    }
  }));

  router.put("/popup-position", asyncHandler(async (req, res) => {
    const left = Number(req.body?.left);
    const top = Number(req.body?.top);
    if (!Number.isFinite(left) || !Number.isFinite(top) || left < -10000 || left > 10000 || top < -10000 || top > 10000) {
      return res.status(400).json({ error: "Coordenadas invalidas", errorCode: "SG_ALERT_POSITION_INVALID" });
    }
    const position = { left: Math.round(left), top: Math.round(top) };
    try {
      await getRedis().set(positionKey(userOf(req)), JSON.stringify(position));
      res.json(position);
    } catch (_err) {
      res.status(503).json({ error: "Redis indisponivel", errorCode: "SG_REDIS_UNAVAILABLE" });
    }
  }));

  return router;
}

module.exports = { createAlertsRouter };
