const express = require("express");
const pool = require("../db");
const { createClientsRouter } = require("./clients");
const { createSitesRouter } = require("./sites");
const { createAreasRouter } = require("./areas");
const { createLookupRouter } = require("./lookup");
const { createEquipmentModelsRouter } = require("./equipmentModels");
const { createEquipmentRouter } = require("./equipment");
const { createClientManagersRouter } = require("./clientManagers");
const { createContractsRouter } = require("./contracts");
const { createMaintenanceProgramsRouter } = require("./maintenancePrograms");
const { createEquipmentPlansRouter } = require("./equipmentPlans");
const { createChecklistsRouter } = require("./checklists");
const { createMaintenanceOrdersRouter } = require("./maintenanceOrders");
const { createOperationsRouter } = require("./operations");
const { lookupRepo } = require("../repositories/lookupRepository");

// Façade JSON — única superfície HTTP do módulo (ADR: sem telas legadas).
// Consumida pela SPA React/Vite em /app/sentinelgrid.
function createSentinelGridV2Router(deps) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));

  // Health/ping do módulo — usado pelo stub da SPA (Fatia 0.2) para confirmar
  // que o backend está montado e as migrations rodaram.
  router.get(
    "/health",
    asyncHandler(async (_req, res) => {
      let migrations = 0;
      try {
        const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM sg_schema_migrations");
        migrations = rows[0] ? rows[0].c : 0;
      } catch (_err) {
        migrations = 0;
      }
      res.json({ module: "sentinelgrid", status: "ok", migrations });
    })
  );

  // Fase 1 — cadastros base.
  router.use("/clients", createClientsRouter(deps));
  router.use("/sites", createSitesRouter(deps));
  router.use("/areas", createAreasRouter(deps));

  // Catálogo (fatia 1.4): fabricantes e tipos via lookup genérico; modelos com FKs.
  router.use(
    "/manufacturers",
    createLookupRouter(deps, {
      repo: lookupRepo("sg_manufacturers"),
      itemsKey: "manufacturers",
      notFound: { error: "Fabricante não encontrado", errorCode: "SG_MANUFACTURER_NOT_FOUND" },
      conflict: { error: "Já existe um fabricante com esse nome", errorCode: "SG_MANUFACTURER_DUP" }
    })
  );
  router.use(
    "/equipment-types",
    createLookupRouter(deps, {
      repo: lookupRepo("sg_equipment_types"),
      itemsKey: "equipmentTypes",
      notFound: { error: "Tipo de equipamento não encontrado", errorCode: "SG_EQUIPMENT_TYPE_NOT_FOUND" },
      conflict: { error: "Já existe um tipo com esse nome", errorCode: "SG_EQUIPMENT_TYPE_DUP" }
    })
  );
  router.use("/equipment-models", createEquipmentModelsRouter(deps));

  // Fatia 1.5 — Equipamento (entidade central).
  router.use("/equipment", createEquipmentRouter(deps));

  // Fatia 1.6 — Gestores do cliente e Contratos.
  router.use("/client-managers", createClientManagersRouter(deps));
  router.use("/contracts", createContractsRouter(deps));
  router.use("/maintenance-programs", createMaintenanceProgramsRouter(deps));
  router.use("/equipment-plans", createEquipmentPlansRouter(deps));
  router.use("/checklists", createChecklistsRouter(deps));
  router.use("/maintenance-orders", createMaintenanceOrdersRouter(deps));
  router.use("/", createOperationsRouter(deps));

  return router;
}

module.exports = { createSentinelGridV2Router };
