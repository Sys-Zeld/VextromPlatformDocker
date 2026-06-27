const express = require("express");
const { createReportServiceV2Controller } = require("../controllers/createReportV2Controller");

// Façade JSON para o SPA React (Fase 0). Montado sob /admin/api/v2 com a MESMA
// auth de sessão/CSRF do admin legado. Reusa os services/repositories existentes.
function createReportServiceV2Router(deps) {
  const router = express.Router();
  const asyncHandler = deps.asyncHandler;
  const controller = createReportServiceV2Controller(deps);

  // Token CSRF para o cliente do SPA (csurf valida via header X-CSRF-Token).
  router.get("/csrf-token", (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  router.get("/session", asyncHandler(controller.session));

  // Customers + Sites (piloto Fase 2) — CRUD JSON reusando services/repositories.
  router.get("/customers", asyncHandler(controller.listCustomers));
  router.post("/customers", asyncHandler(controller.createCustomer));
  router.put("/customers/:id", asyncHandler(controller.updateCustomer));
  router.delete("/customers/:id", asyncHandler(controller.deleteCustomer));
  router.post("/sites", asyncHandler(controller.createSite));
  router.put("/sites/:id", asyncHandler(controller.updateSite));
  router.delete("/sites/:id", asyncHandler(controller.deleteSite));

  // Orders (lista + exclusão)
  router.get("/orders", asyncHandler(controller.listOrders));
  router.delete("/orders/:id", asyncHandler(controller.deleteOrder));

  // Equipments (CRUD)
  router.get("/equipments", asyncHandler(controller.listEquipments));
  router.post("/equipments", asyncHandler(controller.createEquipment));
  router.put("/equipments/:id", asyncHandler(controller.updateEquipment));
  router.delete("/equipments/:id", asyncHandler(controller.deleteEquipment));

  // Analytics (dashboard)
  router.get("/analytics", asyncHandler(controller.analytics));

  return router;
}

module.exports = { createReportServiceV2Router };
