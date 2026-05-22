const express = require("express");
const { createMobileController } = require("../controllers/mobile/mobileController");

function createReportServiceMobileRouter(deps) {
  const router = express.Router();
  const { asyncHandler, requireAdminAuth, csrfProtection } = deps;
  const ctrl = createMobileController(deps);

  const auth = [csrfProtection, requireAdminAuth];
  const rawImage = express.raw({
    type: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
    limit: "10mb",
  });

  router.get("/",                                          ...auth, asyncHandler(ctrl.listOrders));
  router.get("/orders/:id",                               ...auth, asyncHandler(ctrl.orderEdit));
  router.get("/orders/:id/preview",                       ...auth, asyncHandler(ctrl.preview));
  router.get("/orders/:id/sign",                          ...auth, asyncHandler(ctrl.signPage));
  router.post("/orders/:id/sign",                         ...auth, asyncHandler(ctrl.createSign));
  router.post("/orders/:id/sign/:sigId/delete",           ...auth, asyncHandler(ctrl.deleteSign));

  router.post("/orders/:id/timesheet",                    ...auth, asyncHandler(ctrl.createTimesheet));
  router.post("/orders/:id/timesheet/:entryId/delete",    ...auth, asyncHandler(ctrl.deleteTimesheet));

  router.post("/orders/:id/daily-logs",                   ...auth, asyncHandler(ctrl.createDailyLog));
  router.post("/orders/:id/daily-logs/:logId/edit",       ...auth, asyncHandler(ctrl.updateDailyLog));
  router.post("/orders/:id/daily-logs/:logId/delete",     ...auth, asyncHandler(ctrl.deleteDailyLog));

  router.post("/orders/:id/equipments",                           ...auth, asyncHandler(ctrl.attachEquipment));
  router.post("/orders/:id/equipments/:equipmentId/detach",       ...auth, asyncHandler(ctrl.detachEquipment));
  router.post("/orders/:id/validate",                             ...auth, asyncHandler(ctrl.validateOrder));

  router.post("/orders/:id/images",                                ...auth, rawImage, asyncHandler(ctrl.uploadImage));
  router.post("/orders/:id/images/:imageRefId/delete",           ...auth, asyncHandler(ctrl.deleteImage));
  router.post("/orders/:id/images/:imageRefId/caption",          ...auth, asyncHandler(ctrl.updateImageCaption));

  router.post("/orders/:id/components",                          ...auth, asyncHandler(ctrl.createComponent));
  router.post("/orders/:id/components/:compId/delete",           ...auth, asyncHandler(ctrl.deleteComponent));

  return router;
}

module.exports = { createReportServiceMobileRouter };
