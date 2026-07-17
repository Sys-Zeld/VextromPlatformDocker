const express = require("express");
const repo = require("../repositories/demandsRepository");
const integration = require("../services/reportServiceIntegration");
const { setGroupTechnicians, setGroupDuration } = require("../services/demandService");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CONFLICT_CODES = [
  "SG_ORDER_NOT_SCHEDULED",
  "SG_DEMAND_GROUP_MISMATCH",
  "SG_DEMAND_MULTIPLE_OS",
  "SG_DEMAND_DATE_REQUIRED",
  "SG_DEMAND_NO_TECHNICIAN",
  "SG_TECHNICIAN_INVALID",
  "SG_TECHNICIAN_SCHEDULE_CONFLICT"
];

function createDemandsRouter(deps) {
  const router = express.Router();
  const asyncHandler = deps.asyncHandler || ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");

  // Grupos de OM agendadas por (cliente, site, dia) — cada grupo vira UMA OS no Service Report.
  router.get("/scheduled", asyncHandler(async (req, res) => {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      return res.status(400).json({ error: "Período da demanda inválido.", errorCode: "SG_DEMAND_INVALID" });
    }
    const filters = {
      from,
      to,
      clientId: Number(req.query.clientId) || null,
      siteId: Number(req.query.siteId) || null,
      search: String(req.query.search || "").trim()
    };
    let groups = await repo.listScheduledDemands(filters);

    // A OS pode ter sido apagada no Report Service (DELETE físico, sem FK entre os bancos). Antes
    // de responder, confirma os carimbos do período: os órfãos são desfeitos e as OMs voltam a
    // aparecer como pendentes. Uma consulta em lote — só relê se algo mudou.
    const stamped = groups.flatMap((group) => group.orders)
      .filter((order) => order.rsServiceOrderId)
      .map((order) => order.orderId);
    if (stamped.length) {
      const { cleared } = await integration.clearOrphanServiceOrderLinks({ orderIds: stamped }, actorOf(req));
      if (cleared.length) groups = await repo.listScheduledDemands(filters);
    }
    res.json({ groups });
  }));

  // Reconciliação sob demanda: varre TODAS as OMs carimbadas (não só as do período em tela) e
  // desfaz o vínculo das que apontam para OS apagada. Também exposto via `npm run demands:reconcile`.
  router.post("/reconcile", asyncHandler(async (req, res) => {
    res.json(await integration.clearOrphanServiceOrderLinks({}, actorOf(req)));
  }));

  const respondError = (err, res) => {
    if (err.code === "SG_DEMAND_INVALID") return res.status(400).json({ error: err.message, errorCode: err.code });
    if (err.code === "SG_ORDER_INVALID") return res.status(404).json({ error: err.message, errorCode: err.code });
    if (CONFLICT_CODES.includes(err.code)) {
      return res.status(409).json({ error: err.message, errorCode: err.code, conflict: err.conflict || null });
    }
    return null;
  };

  // Equipe do grupo (a futura OS): a lista enviada é a final e vale para todas as OMs do grupo.
  // Se a OS já existe, a equipe dela é sincronizada junto.
  router.put("/technicians", asyncHandler(async (req, res) => {
    try {
      res.json(await setGroupTechnicians({
        orderIds: req.body?.orderIds,
        technicianIds: req.body?.technicianIds
      }, actorOf(req)));
    } catch (err) { if (!respondError(err, res)) throw err; }
  }));

  // Duração do grupo (a OS): aplicada a todas as OMs — é a mobilização que dura, não o equipamento.
  router.put("/duration", asyncHandler(async (req, res) => {
    try {
      res.json(await setGroupDuration({
        orderIds: req.body?.orderIds,
        executionDays: req.body?.executionDays
      }, actorOf(req)));
    } catch (err) { if (!respondError(err, res)) throw err; }
  }));

  // Gera a OS de cada grupo. O serviço revalida a chave (cliente/site/dia) das OMs — o payload
  // do cliente não decide o agrupamento.
  router.post("/generate", asyncHandler(async (req, res) => {
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
    if (!groups.length) {
      return res.status(400).json({ error: "Selecione ao menos um grupo para gerar.", errorCode: "SG_DEMAND_INVALID" });
    }

    const results = [];
    for (const group of groups) {
      const orderIds = Array.isArray(group?.orderIds) ? group.orderIds : [];
      try {
        const sent = await integration.sendOrderGroupToReportService(orderIds, actorOf(req));
        results.push({ groupKey: String(group?.groupKey || ""), ok: true, ...sent });
      } catch (err) {
        // Um grupo que falha não derruba os outros: o usuário costuma gerar o período inteiro.
        if (err.code === "SG_ORDER_INVALID" || CONFLICT_CODES.includes(err.code)) {
          results.push({ groupKey: String(group?.groupKey || ""), ok: false, error: err.message, errorCode: err.code });
          continue;
        }
        throw err;
      }
    }
    const failed = results.filter((result) => !result.ok).length;
    res.status(failed === results.length ? 409 : 200).json({ results, generated: results.length - failed, failed });
  }));

  return router;
}

module.exports = { createDemandsRouter };
