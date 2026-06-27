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
  router.get("/customers", asyncHandler(controller.listCustomers));

  return router;
}

module.exports = { createReportServiceV2Router };
