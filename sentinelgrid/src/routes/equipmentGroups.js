const express = require("express");
const { parseEquipmentGroupInput, parseGroupMembersInput } = require("../validators/equipmentGroupValidators");
const { toValidationError, isForeignKeyError } = require("./httpErrors");
const repo = require("../repositories/equipmentGroupsRepository");

function createEquipmentGroupsRouter(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const actorOf = (req) => String(req.adminUsername || "");
  const notFound = { error: "Grupo não encontrado", errorCode: "SG_GROUP_NOT_FOUND" };
  const invalidSite = { error: "Site inválido ou inexistente", errorCode: "SG_GROUP_SITE_INVALID" };

  const handleWrite = async (fn, res) => {
    try { return await fn(); }
    catch (err) { if (isForeignKeyError(err)) return res.status(400).json(invalidSite); throw err; }
  };

  router.get("/", asyncHandler(async (req, res) => {
    const { groups, total } = await repo.listGroups({
      siteId: Number(req.query.siteId) || null,
      clientId: Number(req.query.clientId) || null,
      search: String(req.query.search || "").trim()
    });
    res.json({ groups, total });
  }));

  router.get("/:id", asyncHandler(async (req, res) => {
    const group = await repo.getGroup(Number(req.params.id));
    if (!group) return res.status(404).json(notFound);
    res.json({ group });
  }));

  router.post("/", asyncHandler(async (req, res) => {
    let input;
    try { input = parseEquipmentGroupInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const group = await handleWrite(() => repo.createGroup(input, actorOf(req)), res);
    if (res.headersSent) return;
    res.status(201).json({ group });
  }));

  router.put("/:id", asyncHandler(async (req, res) => {
    let input;
    try { input = parseEquipmentGroupInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const group = await handleWrite(() => repo.updateGroup(Number(req.params.id), input, actorOf(req)), res);
    if (res.headersSent) return;
    if (!group) return res.status(404).json(notFound);
    res.json({ group });
  }));

  router.delete("/:id", asyncHandler(async (req, res) => {
    const ok = await repo.softDeleteGroup(Number(req.params.id), actorOf(req));
    if (!ok) return res.status(404).json(notFound);
    res.status(204).end();
  }));

  // Adiciona equipamentos ao grupo (só os do mesmo site do grupo).
  router.post("/:id/members", asyncHandler(async (req, res) => {
    let input;
    try { input = parseGroupMembersInput(req.body); } catch (err) { return res.status(400).json(toValidationError(err)); }
    const result = await repo.addMembers(Number(req.params.id), input.equipmentIds);
    if (!result) return res.status(404).json(notFound);
    res.status(201).json(result);
  }));

  router.delete("/:id/members/:equipmentId", asyncHandler(async (req, res) => {
    const ok = await repo.removeMember(Number(req.params.id), Number(req.params.equipmentId));
    if (!ok) return res.status(404).json({ error: "Equipamento não está no grupo", errorCode: "SG_GROUP_MEMBER_NOT_FOUND" });
    res.status(204).end();
  }));

  return router;
}

module.exports = { createEquipmentGroupsRouter };
