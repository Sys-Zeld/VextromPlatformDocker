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

  // Orders (lista + criação/edição/exclusão)
  router.get("/orders", asyncHandler(controller.listOrders));
  router.post("/orders", asyncHandler(controller.createOrder));
  router.put("/orders/:id", asyncHandler(controller.updateOrderRegistration));
  router.delete("/orders/:id", asyncHandler(controller.deleteOrder));

  // Order editor (fatia 1: cabeçalho + timesheet)
  router.get("/orders/:id/editor", asyncHandler(controller.getOrderEditor));
  router.post("/orders/:id/timesheet", asyncHandler(controller.addTimesheet));
  router.put("/orders/:id/timesheet/:entryId", asyncHandler(controller.updateTimesheet));
  router.delete("/orders/:id/timesheet/:entryId", asyncHandler(controller.deleteTimesheet));

  // Equipments (CRUD)
  router.get("/equipments", asyncHandler(controller.listEquipments));
  router.post("/equipments", asyncHandler(controller.createEquipment));
  router.put("/equipments/:id", asyncHandler(controller.updateEquipment));
  router.delete("/equipments/:id", asyncHandler(controller.deleteEquipment));

  // Analytics (dashboard)
  router.get("/analytics", asyncHandler(controller.analytics));

  // Spare parts (catálogo)
  router.get("/spare-parts", asyncHandler(controller.listSpareParts));
  router.get("/spare-parts/ai-config", asyncHandler(controller.sparePartsAiConfig));
  router.post("/spare-parts/ai-extract", asyncHandler(controller.aiExtractSpareParts));
  router.post("/spare-parts/bulk-import", asyncHandler(controller.bulkImportSpareParts));
  router.post("/spare-parts", asyncHandler(controller.createSparePart));
  router.put("/spare-parts/:id", asyncHandler(controller.updateSparePart));
  router.delete("/spare-parts/:id", asyncHandler(controller.deleteSparePart));

  // Spare parts: vínculo por equipamento (novo modelo de snapshots editáveis)
  router.get("/spare-parts/equipment/:equipmentId", asyncHandler(controller.getEquipmentSpares));
  router.post("/spare-parts/equipment/:equipmentId/link", asyncHandler(controller.linkSparePart));
  router.post("/spare-parts/equipment/:equipmentId/spares", asyncHandler(controller.createEquipmentSpare));
  router.put("/spare-parts/equipment-spares/:id", asyncHandler(controller.updateEquipmentSpare));
  router.delete("/spare-parts/equipment-spares/:id", asyncHandler(controller.deleteEquipmentSpare));

  // Config do relatório
  router.get("/config", asyncHandler(controller.getConfig));
  router.put("/config", asyncHandler(controller.saveConfig));

  // Assets globais (técnicos + instrumentos)
  router.get("/assets", asyncHandler(controller.listAssets));
  router.post("/assets/technicians", asyncHandler(controller.createTechnician));
  router.put("/assets/technicians/:id", asyncHandler(controller.updateTechnician));
  router.delete("/assets/technicians/:id", asyncHandler(controller.deleteTechnician));
  router.post("/assets/instruments", asyncHandler(controller.createInstrument));
  router.put("/assets/instruments/:id", asyncHandler(controller.updateInstrument));
  router.delete("/assets/instruments/:id", asyncHandler(controller.deleteInstrument));

  // Ferramentas por técnico
  router.get("/assets/technicians/:techId/tools", asyncHandler(controller.listTechnicianTools));
  router.post("/assets/technicians/:techId/tools", asyncHandler(controller.createTechnicianTool));
  router.put("/assets/technicians/:techId/tools/:toolId", asyncHandler(controller.updateTechnicianTool));
  router.delete("/assets/technicians/:techId/tools/:toolId", asyncHandler(controller.deleteTechnicianTool));

  // Estilos de tabela (status + reset)
  router.get("/table-styles", asyncHandler(controller.listTableStyles));
  router.post("/table-styles/:tableType/reset", asyncHandler(controller.resetTableStyle));

  // Histórico de PDFs por OS
  router.get("/orders/:id/pdf-history", asyncHandler(controller.listPdfHistory));
  router.delete("/orders/:id/pdf-history/:entryId", asyncHandler(controller.deletePdfHistory));

  return router;
}

module.exports = { createReportServiceV2Router };
