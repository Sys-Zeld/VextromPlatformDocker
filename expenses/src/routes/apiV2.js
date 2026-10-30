const express = require("express");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
const env = require("../../../specflow/config/env");
const reportRepo = require("../repositories/reportRepository");
const paymentRepo = require("../repositories/paymentRepository");
const categoryRepo = require("../repositories/categoryRepository");
const auditRepo = require("../repositories/auditRepository");
const profileService = require("../services/profileService");
const dashboardService = require("../services/dashboardService");
const { createReportService } = require("../services/reportService");
const { createReviewService } = require("../services/reviewService");
const { createPaymentService } = require("../services/paymentService");
const { createNotificationService } = require("../services/notificationService");
const { buildReportPdf, buildReportZip } = require("../services/pdfService");
const policy = require("../policies/expensePolicy");
const v = require("../validators/expenseValidators");
const { DomainError, notFound, conflict } = require("../lib/errors");
const {
  STATUS,
  STATUS_LABELS,
  PAYMENT_METHODS,
  ACCOUNT_TYPES,
  PIX_KEY_TYPES,
  ALLOWED_FILE_TYPES
} = require("../constants");

// API do módulo (/api/expenses), consumida pela SPA em /app/expenses.
// Autenticação PRÓPRIA (cookie de sessão do módulo), independente do hub.
// deps (do hub): asyncHandler, csrfProtection, storage.
// services: auth (login/sessão), accounts (tela Usuários), email (SMTP do módulo).

function createExpensesV2Router(deps, { auth, accounts, email }) {
  const router = express.Router();
  const asyncHandler =
    deps.asyncHandler ||
    ((fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  const storage = deps.storage;
  const maxFileBytes = env.expenses.maxFileMb * 1024 * 1024;

  const notifications = createNotificationService(
    { listManagers: accounts.listApproverContacts, sendEmail: email.send },
    { emailEnabled: email.notificationsEnabled, appBaseUrl: env.appBaseUrl }
  );
  const reports = createReportService({ storage, maxFileBytes });
  const review = createReviewService({ notifications });
  const payments = createPaymentService({ storage, maxFileBytes, notifications });

  const actorOf = (req) => req.expensesActor;
  const id = (value) => {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n <= 0) throw notFound();
    return n;
  };

  // Respostas com dados pessoais/financeiros nunca vão para cache.
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  // Uso geral generoso; rotas de login/recuperação têm limite próprio, curto.
  router.use(rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  router.use(deps.csrfProtection);

  /* ---------------------------- Autenticação ------------------------------ */

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({
      error: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
      errorCode: "EX_RATE_LIMITED",
      details: null
    })
  });

  router.get("/auth/csrf-token", (req, res) => res.json({ csrfToken: req.csrfToken() }));

  router.post("/auth/login", authLimiter, asyncHandler(async (req, res) => {
    res.json({ user: await auth.login(req, res, v.parseLogin(req.body)) });
  }));

  router.post("/auth/forgot-password", authLimiter, asyncHandler(async (req, res) => {
    await auth.requestPasswordReset(v.parseForgotPassword(req.body).identifier);
    res.json({ ok: true });
  }));

  router.get("/auth/token", authLimiter, asyncHandler(async (req, res) => {
    res.json(await auth.tokenInfo(req.query.token));
  }));

  router.post("/auth/token", authLimiter, asyncHandler(async (req, res) => {
    const { token, newPassword } = v.parseTokenPassword(req.body);
    res.json(await auth.completeToken(token, newPassword));
  }));

  // Daqui para baixo, só com sessão do módulo.
  router.use(asyncHandler(async (req, res, next) => {
    const actor = await auth.resolveActor(req);
    if (!actor) {
      return res.status(401).json({ error: "Sessão expirada. Faça login novamente.", errorCode: "EX_UNAUTHENTICATED", details: null });
    }
    req.expensesActor = { ...actor, allowSelfApproval: env.expenses.allowSelfApproval };
    // Senha provisória: só libera trocar senha, consultar a sessão e sair.
    const allowed = ["/auth/me", "/auth/change-password", "/auth/logout"];
    if (actor.mustChangePassword && !allowed.includes(req.path)) {
      return res.status(403).json({ error: "Defina uma nova senha para continuar.", errorCode: "EX_PASSWORD_CHANGE_REQUIRED", details: null });
    }
    return next();
  }));

  router.get("/auth/me", asyncHandler(async (req, res) => {
    res.json({ user: await auth.me(actorOf(req)) });
  }));

  router.post("/auth/logout", asyncHandler(async (req, res) => {
    await auth.logout(req, res, actorOf(req));
    res.json({ ok: true });
  }));

  router.post("/auth/change-password", asyncHandler(async (req, res) => {
    res.json({ user: await auth.changePassword(req, res, actorOf(req), v.parseChangePassword(req.body)) });
  }));

  /* ------------------------------- Metadados ------------------------------ */

  router.get("/meta", asyncHandler(async (req, res) => {
    const actor = actorOf(req);
    res.json({
      actor: {
        userId: actor.userId,
        username: actor.username,
        canManage: actor.canManage,
        canApprove: actor.canApprove,
        canPay: actor.canPay,
        canManageUsers: actor.canManageUsers
      },
      categories: await categoryRepo.list(pool, { onlyActive: true }),
      statuses: Object.keys(STATUS).map((key) => ({ value: key, label: STATUS_LABELS[key] })),
      paymentMethods: PAYMENT_METHODS,
      accountTypes: ACCOUNT_TYPES,
      pixKeyTypes: PIX_KEY_TYPES,
      allowedExtensions: Object.keys(ALLOWED_FILE_TYPES),
      maxFileMb: env.expenses.maxFileMb
    });
  }));

  /* -------------------------------- Perfil -------------------------------- */

  router.get("/profile", asyncHandler(async (req, res) => {
    res.json(await profileService.getMyProfile(actorOf(req)));
  }));

  router.put("/profile", asyncHandler(async (req, res) => {
    res.json(await profileService.saveMyProfile(actorOf(req), v.parseProfile(req.body)));
  }));

  /* ------------------------------- Dashboard ------------------------------ */

  router.get("/dashboard", asyncHandler(async (req, res) => {
    res.json(await dashboardService.userDashboard(actorOf(req), v.parsePeriodQuery(req.query)));
  }));

  /* ------------------------------- Relatórios ----------------------------- */

  router.get("/reports", asyncHandler(async (req, res) => {
    const query = v.parseListQuery(req.query);
    const result = await reports.listReports(actorOf(req), query, { scope: "mine" });
    res.json({ ...result, page: query.page, pageSize: query.pageSize });
  }));

  router.post("/reports", asyncHandler(async (req, res) => {
    const report = await reports.createReport(actorOf(req), v.parseReport(req.body));
    res.status(201).json({ report });
  }));

  // Detalhe compartilhado: dono ou gestão (a política decide).
  router.get("/reports/:id", asyncHandler(async (req, res) => {
    res.json(await reports.getReportDetail(actorOf(req), id(req.params.id)));
  }));

  router.put("/reports/:id", asyncHandler(async (req, res) => {
    const report = await reports.updateReport(actorOf(req), id(req.params.id), v.parseReport(req.body));
    res.json({ report });
  }));

  router.delete("/reports/:id", asyncHandler(async (req, res) => {
    await reports.deleteReport(actorOf(req), id(req.params.id));
    res.status(204).end();
  }));

  router.get("/reports/:id/submission-check", asyncHandler(async (req, res) => {
    res.json(await review.checkSubmission(actorOf(req), id(req.params.id)));
  }));

  // Envio inicial (RASCUNHO) ou reenvio após devolução (DEVOLVIDO).
  router.post("/reports/:id/submit", asyncHandler(async (req, res) => {
    const reportId = id(req.params.id);
    const current = await reportRepo.getReport(pool, reportId);
    policy.assertCanView(actorOf(req), current);
    const action = current.status === STATUS.DEVOLVIDO ? "RESUBMIT" : "SUBMIT";
    res.json({ report: await review.transition(actorOf(req), reportId, action) });
  }));

  /* ------------------------------- Lançamentos ---------------------------- */

  router.post("/reports/:id/items", asyncHandler(async (req, res) => {
    res.status(201).json(await reports.addItem(actorOf(req), id(req.params.id), v.parseItem(req.body)));
  }));

  router.put("/reports/:id/items/:itemId", asyncHandler(async (req, res) => {
    res.json(await reports.updateItem(actorOf(req), id(req.params.id), id(req.params.itemId), v.parseItem(req.body)));
  }));

  router.delete("/reports/:id/items/:itemId", asyncHandler(async (req, res) => {
    res.json(await reports.deleteItem(actorOf(req), id(req.params.id), id(req.params.itemId)));
  }));

  /* ------------------------------ Comprovantes ---------------------------- */

  router.post(
    "/reports/:id/items/:itemId/attachments",
    express.raw({ type: () => true, limit: maxFileBytes + 1024 }),
    asyncHandler(async (req, res) => {
      let name = "arquivo";
      try { name = decodeURIComponent(String(req.headers["x-file-name"] || "arquivo")); } catch (_e) { /* mantém padrão */ }
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const result = await reports.uploadAttachment(actorOf(req), id(req.params.id), id(req.params.itemId), buffer, name);
      res.status(201).json(result);
    })
  );

  router.delete("/reports/:id/attachments/:attachmentId", asyncHandler(async (req, res) => {
    await reports.deleteAttachment(actorOf(req), id(req.params.id), id(req.params.attachmentId));
    res.status(204).end();
  }));

  // Conteúdo protegido: permissão checada a cada acesso; servido com CSP
  // restrita e só embutível pela própria aplicação (iframe/img na tela).
  async function sendStoredFile(res, storagePath, mime, fileName, download) {
    const safeAscii = String(fileName).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'");
    res.setHeader("Cache-Control", "private, no-store");
    let stream;
    try {
      stream = await storage.getObjectStream(storagePath);
    } catch (_err) {
      throw new DomainError(404, "EX_FILE_MISSING", "Arquivo não encontrado no armazenamento.");
    }
    stream.on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); });
    stream.pipe(res);
  }

  router.get("/attachments/:attachmentId/content", asyncHandler(async (req, res) => {
    const a = await reports.getAttachmentForDownload(actorOf(req), id(req.params.attachmentId));
    await sendStoredFile(res, a.storage_path, a.mime_type, a.original_name, req.query.download === "1");
  }));

  router.get("/payments/:paymentId/proof", asyncHandler(async (req, res) => {
    const p = await payments.getProofForDownload(actorOf(req), id(req.params.paymentId));
    await sendStoredFile(res, p.proof_path, p.proof_mime, p.proof_name || "comprovante", req.query.download === "1");
  }));

  /* ------------------------------- Exportação ----------------------------- */

  async function exportDetail(req) {
    const detail = await reports.getReportDetail(actorOf(req), id(req.params.id));
    await auditRepo.insertAudit(pool, {
      reportId: detail.report.id,
      actorId: actorOf(req).userId,
      actorName: actorOf(req).username,
      action: "REPORT_EXPORTED",
      entityType: "report",
      entityId: detail.report.id,
      metadata: { format: req.path.endsWith(".zip") ? "zip" : "pdf" }
    });
    return detail;
  }

  router.get("/reports/:id/pdf", asyncHandler(async (req, res) => {
    const detail = await exportDetail(req);
    const pdf = await buildReportPdf(detail, { companyName: env.expenses.companyName });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${detail.report.report_number}.pdf"`);
    res.send(pdf);
  }));

  router.get("/reports/:id/export.zip", asyncHandler(async (req, res) => {
    const detail = await exportDetail(req);
    const paths = await reportRepo.listAttachmentPaths(pool, detail.report.id);
    const withPaths = { ...detail, attachments: detail.attachments.map((a) => ({ ...a, storage_path: paths.get(String(a.id)) })) };
    const proofs = [];
    for (const p of detail.payments) {
      if (p.has_proof) proofs.push(await paymentRepo.getRaw(pool, p.id));
    }
    let zip;
    try {
      zip = await buildReportZip(withPaths, { storage, companyName: env.expenses.companyName, paymentProofs: proofs });
    } catch (err) {
      if (err instanceof DomainError) throw err;
      throw new DomainError(502, "EX_EXPORT_FAILURE", "Falha ao montar o pacote (arquivo ausente no armazenamento).");
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${detail.report.report_number}.zip"`);
    res.send(zip);
  }));

  /* ------------------------------ Notificações ---------------------------- */

  router.get("/notifications", asyncHandler(async (req, res) => {
    res.json(await auditRepo.listNotifications(pool, actorOf(req).userId, { unreadOnly: req.query.unread === "1" }));
  }));

  router.post("/notifications/read", asyncHandler(async (req, res) => {
    const target = req.body && req.body.id ? id(req.body.id) : null;
    await auditRepo.markRead(pool, actorOf(req).userId, target);
    res.json({ ok: true });
  }));

  router.get("/history", asyncHandler(async (req, res) => {
    const q = v.parseListQuery(req.query);
    const result = await reportRepo.listDecisions(pool, { userId: actorOf(req).userId, limit: q.pageSize, offset: (q.page - 1) * q.pageSize });
    res.json({ ...result, page: q.page, pageSize: q.pageSize });
  }));

  /* -------------------------------- Gestão -------------------------------- */

  const admin = express.Router();
  admin.use((req, _res, next) => {
    policy.assertManager(actorOf(req));
    next();
  });

  admin.get("/dashboard", asyncHandler(async (req, res) => {
    res.json(await dashboardService.adminDashboard(actorOf(req), v.parsePeriodQuery(req.query)));
  }));

  admin.get("/reports", asyncHandler(async (req, res) => {
    const query = v.parseListQuery(req.query);
    const result = await reports.listReports(actorOf(req), query, { scope: "all" });
    res.json({ ...result, page: query.page, pageSize: query.pageSize });
  }));

  const DECISIONS = { "start-review": "START_REVIEW", approve: "APPROVE", reject: "REJECT", return: "RETURN" };
  admin.post("/reports/:id/:decision(start-review|approve|reject|return)", asyncHandler(async (req, res) => {
    const { reason } = v.parseDecision(req.body);
    const report = await review.transition(actorOf(req), id(req.params.id), DECISIONS[req.params.decision], { reason });
    res.json({ report });
  }));

  // Dados bancários completos — só para efetuar o pagamento, sempre auditado.
  admin.get("/reports/:id/bank-details", asyncHandler(async (req, res) => {
    policy.assertFinance(actorOf(req));
    const report = await reportRepo.getReport(pool, id(req.params.id));
    policy.assertCanView(actorOf(req), report);
    if (report.status !== STATUS.APROVADO) {
      throw conflict("EX_BANK_DETAILS_UNAVAILABLE", "Dados bancários disponíveis apenas para relatórios aprovados.");
    }
    res.json({ bankDetails: await profileService.revealBankDetails(actorOf(req), report) });
  }));

  admin.post("/reports/:id/payment", asyncHandler(async (req, res) => {
    const report = await payments.registerPayment(actorOf(req), id(req.params.id), v.parsePayment(req.body));
    res.status(201).json({ report });
  }));

  admin.get("/reimbursements/pending", asyncHandler(async (req, res) => {
    const query = v.parseListQuery(req.query);
    const result = await payments.listPending(actorOf(req), query);
    res.json({ ...result, page: query.page, pageSize: query.pageSize });
  }));

  admin.get("/payments", asyncHandler(async (req, res) => {
    const query = v.parseListQuery(req.query);
    const result = await payments.listPayments(actorOf(req), query);
    res.json({ ...result, page: query.page, pageSize: query.pageSize });
  }));

  admin.get("/history", asyncHandler(async (req, res) => {
    const q = v.parseListQuery(req.query);
    const result = await reportRepo.listDecisions(pool, { limit: q.pageSize, offset: (q.page - 1) * q.pageSize });
    res.json({ ...result, page: q.page, pageSize: q.pageSize });
  }));

  admin.get("/audit", asyncHandler(async (req, res) => {
    const q = v.parseListQuery(req.query);
    const reportId = req.query.reportId ? id(req.query.reportId) : null;
    const result = await auditRepo.listAudit(pool, { reportId, search: q.search, limit: q.pageSize, offset: (q.page - 1) * q.pageSize });
    res.json({ ...result, page: q.page, pageSize: q.pageSize });
  }));

  admin.get("/categories", asyncHandler(async (_req, res) => {
    res.json({ categories: await categoryRepo.list(pool) });
  }));

  admin.post("/categories", asyncHandler(async (req, res) => {
    policy.assertApprover(actorOf(req));
    try {
      res.status(201).json({ category: await categoryRepo.create(pool, v.parseCategory(req.body)) });
    } catch (err) {
      if (err.code === "23505") throw conflict("EX_CATEGORY_DUP", "Já existe uma categoria com esse nome.");
      throw err;
    }
  }));

  admin.put("/categories/:categoryId", asyncHandler(async (req, res) => {
    policy.assertApprover(actorOf(req));
    let category;
    try {
      category = await categoryRepo.update(pool, id(req.params.categoryId), v.parseCategory(req.body));
    } catch (err) {
      if (err.code === "23505") throw conflict("EX_CATEGORY_DUP", "Já existe uma categoria com esse nome.");
      throw err;
    }
    if (!category) throw notFound("Categoria não encontrada", "EX_CATEGORY_NOT_FOUND");
    res.json({ category });
  }));

  /* ------------------------------- Usuários ------------------------------- */

  // Ids de conta: "ex:<uuid>".
  const userIdParam = (value) => {
    const text = String(value || "");
    if (!/^ex:[0-9a-f-]{36}$/.test(text)) throw notFound("Usuário não encontrado", "EX_USER_NOT_FOUND");
    return text;
  };

  admin.get("/users", asyncHandler(async (req, res) => {
    res.json({ users: await accounts.listUsers(actorOf(req)) });
  }));

  admin.post("/users", asyncHandler(async (req, res) => {
    res.status(201).json(await accounts.createUser(actorOf(req), v.parseUserCreate(req.body)));
  }));

  admin.put("/users/:userId", asyncHandler(async (req, res) => {
    res.json({ user: await accounts.updateUser(actorOf(req), userIdParam(req.params.userId), v.parseUserUpdate(req.body)) });
  }));

  admin.delete("/users/:userId", asyncHandler(async (req, res) => {
    res.json(await accounts.deleteUser(actorOf(req), userIdParam(req.params.userId)));
  }));

  // Reenvia convite (pendente) ou envia link de redefinição de senha (ativo).
  admin.post("/users/:userId/access-link", asyncHandler(async (req, res) => {
    res.json(await accounts.sendAccessLink(actorOf(req), userIdParam(req.params.userId)));
  }));

  /* ---------------------------- Configurações ----------------------------- */

  admin.get("/settings/email", asyncHandler(async (req, res) => {
    res.json({ email: await email.getConfig(actorOf(req)) });
  }));

  admin.put("/settings/email", asyncHandler(async (req, res) => {
    res.json({ email: await email.saveConfig(actorOf(req), v.parseEmailSettings(req.body)) });
  }));

  admin.post("/settings/email/test", asyncHandler(async (req, res) => {
    const { to } = v.parseEmailTest(req.body);
    res.json(await email.sendTest(actorOf(req), to));
  }));

  router.use("/admin", admin);

  /* -------------------------------- Erros --------------------------------- */

  // eslint-disable-next-line no-unused-vars
  router.use((err, req, res, _next) => {
    if (err instanceof DomainError) {
      return res.status(err.status).json({ error: err.message, errorCode: err.errorCode, details: err.details || null });
    }
    if (err && err.code === "EBADCSRFTOKEN") {
      return res.status(403).json({ error: "Sessão de formulário expirada. Recarregue a página.", errorCode: "EX_CSRF", details: null });
    }
    if (err && err.type === "entity.too.large") {
      return res.status(413).json({ error: `Arquivo muito grande. Limite: ${env.expenses.maxFileMb} MB.`, errorCode: "EX_FILE_TOO_LARGE", details: null });
    }
    // Violação de regra do banco (CHECK/FK/imutabilidade): erro de integridade, não 500 genérico.
    if (err && ["23514", "23503", "23P01"].includes(err.code)) {
      return res.status(409).json({ error: "Operação viola regra de integridade.", errorCode: "EX_INTEGRITY", details: null });
    }
    // eslint-disable-next-line no-console
    console.error("[expenses] erro não tratado:", err);
    return res.status(500).json({ error: "Erro interno", errorCode: "EX_INTERNAL", details: null });
  });

  return router;
}

module.exports = { createExpensesV2Router };
