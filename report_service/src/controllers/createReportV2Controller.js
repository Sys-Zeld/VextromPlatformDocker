// Controller do façade JSON /admin/api/v2 (consumido pelo SPA React).
// NÃO reimplementa regra de negócio: reusa os MESMOS repositories/services
// do web controller, apenas devolvendo res.json em vez de res.render.
const repo = require("../repositories/serviceReportRepository");

function createReportServiceV2Controller(_deps) {
  return {
    // Espelho leve da sessão de admin legada — valida que o cookie é reconhecido.
    async session(req, res) {
      return res.json({
        authenticated: Boolean(req.adminUsername),
        username: req.adminUsername || null,
        role: req.adminRole || null,
        lang: req.lang || "pt",
        reactAppEnabled: true
      });
    },

    // Page-load de "customers" como JSON (mesma fonte de dados do EJS legado).
    async listCustomers(req, res) {
      const [customers, sites] = await Promise.all([
        repo.listCustomers(),
        repo.listSites()
      ]);
      return res.json({ customers, sites });
    }
  };
}

module.exports = { createReportServiceV2Controller };
