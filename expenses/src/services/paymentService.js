const crypto = require("crypto");
const path = require("path");
const pool = require("../db");
const { withTransaction } = require("../db");
const repo = require("../repositories/reportRepository");
const paymentRepo = require("../repositories/paymentRepository");
const profileService = require("./profileService");
const audit = require("./auditService");
const policy = require("../policies/expensePolicy");
const { STATUS, NOTIFICATION_EVENTS: EV } = require("../constants");
const { getCipher } = require("../lib/crypto");
const { sameAmount, formatBRL } = require("../lib/money");
const { validateUpload, sanitizeFileName } = require("../lib/fileSignature");
const { DomainError, conflict, unprocessable, notFound } = require("../lib/errors");

// Registro de reembolso (v1: pagamento integral único por relatório).
// Barreiras contra duplicidade: status APROVADO exigido sob FOR UPDATE + índice
// único parcial em ex_payments.

function decodeProof(proof, maxFileBytes) {
  if (!proof) return null;
  const buffer = Buffer.from(String(proof.dataBase64).replace(/^data:[^,]*,/, ""), "base64");
  const name = sanitizeFileName(proof.name);
  const check = validateUpload(buffer, name, maxFileBytes);
  if (check.error) throw new DomainError(check.status || 400, "EX_INVALID_FILE", `Comprovante de pagamento: ${check.error}`);
  return { buffer, name, mime: check.mime, ext: check.ext };
}

function createPaymentService({ storage, maxFileBytes, notifications }) {
  async function registerPayment(actor, reportId, input) {
    const proof = decodeProof(input.proof, maxFileBytes);
    let storedProofPath = null;
    let emails = [];

    try {
      const updated = await withTransaction(async (db) => {
        const report = await repo.getReport(db, reportId, { forUpdate: true });
        policy.assertTransition(actor, report, "PAY");
        if (!sameAmount(input.amount, report.approved_amount)) {
          throw unprocessable(
            "EX_PAYMENT_AMOUNT_MISMATCH",
            `O pagamento integral deve ser igual ao valor aprovado (${formatBRL(report.approved_amount)}).`
          );
        }

        // Snapshot dos dados bancários usados, cifrado e imutável.
        const profile = await profileService.loadProfile(db, report.user_id);
        const snapshot = profile ? profileService.bankSnapshot(profile) : null;

        if (proof) {
          storedProofPath = path.posix.join("dados", "expenses", String(report.id), "payment", `${crypto.randomUUID()}.${proof.ext}`);
          try {
            await storage.putObject(storedProofPath, proof.buffer, { contentType: proof.mime });
          } catch (_err) {
            storedProofPath = null;
            throw new DomainError(502, "EX_STORAGE_FAILURE", "Falha ao armazenar o comprovante. Tente novamente.");
          }
        }

        let payment;
        try {
          payment = await paymentRepo.insert(db, {
            reportId: report.id,
            amount: input.amount,
            paymentDate: input.paymentDate,
            paymentMethod: input.paymentMethod,
            transactionReference: input.transactionReference,
            proofPath: storedProofPath,
            proofName: proof ? proof.name : null,
            proofMime: proof ? proof.mime : null,
            bankSnapshotEnc: snapshot ? getCipher().encrypt(JSON.stringify(snapshot)) : null,
            notes: input.notes,
            recordedBy: actor.userId,
            recordedByName: actor.username
          });
        } catch (err) {
          if (err && err.code === "23505") throw conflict("EX_PAYMENT_DUPLICATE", "Este relatório já possui pagamento registrado.");
          throw err;
        }

        const next = await repo.updateStatus(db, report.id, STATUS.PAGO, {
          paid_amount: input.amount,
          paid_at: repo.NOW
        });
        await repo.insertHistory(db, {
          reportId: report.id,
          previousStatus: report.status,
          newStatus: STATUS.PAGO,
          action: "PAY",
          performedBy: actor.userId,
          performedByName: actor.username,
          reason: input.notes
        });
        await audit.record(db, actor, {
          reportId: report.id,
          action: "PAYMENT_RECORDED",
          entityType: "payment",
          entityId: payment.id,
          previousStatus: report.status,
          newStatus: STATUS.PAGO,
          metadata: {
            amount: input.amount,
            paymentDate: input.paymentDate,
            paymentMethod: input.paymentMethod,
            transactionReference: input.transactionReference,
            hasProof: Boolean(proof)
          }
        });
        emails = await notifications.notify(db, EV.PAID, next, actor);
        return next;
      });
      notifications.dispatch(emails);
      return updated;
    } catch (err) {
      if (storedProofPath) await storage.deleteObject(storedProofPath).catch(() => {});
      throw err;
    }
  }

  async function listPending(actor, query) {
    policy.assertManager(actor);
    return repo.listReports(pool, {
      statuses: [STATUS.APROVADO],
      search: query.search,
      project: query.project,
      sort: "submitted_at",
      dir: "asc",
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize
    });
  }

  async function listPayments(actor, query) {
    policy.assertManager(actor);
    return paymentRepo.listAll(pool, {
      from: query.from,
      to: query.to,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize
    });
  }

  // Comprovante bancário: gestão ou o próprio solicitante.
  async function getProofForDownload(actor, paymentId) {
    const payment = await paymentRepo.getRaw(pool, Number(paymentId));
    if (!payment || !payment.proof_path) throw notFound("Comprovante não encontrado", "EX_PROOF_NOT_FOUND");
    const report = await repo.getReport(pool, payment.report_id);
    policy.assertCanView(actor, report);
    return payment;
  }

  return { registerPayment, listPending, listPayments, getProofForDownload };
}

module.exports = { createPaymentService };
