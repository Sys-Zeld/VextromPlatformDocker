const pool = require("../db");
const { withTransaction } = require("../db");
const profileRepo = require("../repositories/profileRepository");
const audit = require("./auditService");
const { getCipher } = require("../lib/crypto");
const { isValidCpf, formatCpf, maskCpf, maskTail, maskPixKey } = require("../lib/cpf");

// Cadastro complementar. Campos sensíveis são cifrados em repouso; o titular
// vê os próprios dados completos; a gestão vê mascarado, exceto no registro de
// pagamento (acesso auditado).

function decryptProfile(row) {
  if (!row) return null;
  const cipher = getCipher();
  return {
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    cpf: cipher.decrypt(row.cpf_enc),
    email: row.email,
    phone: row.phone,
    bankCode: row.bank_code,
    bankName: row.bank_name,
    agency: row.agency,
    accountNumber: cipher.decrypt(row.account_number_enc),
    accountDigit: row.account_digit,
    accountType: row.account_type,
    pixKey: cipher.decrypt(row.pix_key_enc),
    pixKeyType: row.pix_key_type,
    updatedAt: row.updated_at
  };
}

// Meio de reembolso válido: identificação + (Pix ou conta completa).
function reimbursementReadiness(profile) {
  const missing = [];
  if (!profile) return { ready: false, missing: ["Cadastro de reembolso não preenchido"] };
  if (!profile.fullName) missing.push("Nome completo");
  if (!profile.cpf || !isValidCpf(profile.cpf)) missing.push("CPF válido");
  const hasPix = Boolean(profile.pixKey && profile.pixKeyType);
  const hasBank = Boolean(profile.bankCode && profile.agency && profile.accountNumber && profile.accountType);
  if (!hasPix && !hasBank) missing.push("Chave Pix ou dados bancários completos (banco, agência, conta e tipo)");
  return { ready: missing.length === 0, missing };
}

function maskedView(profile) {
  if (!profile) return null;
  return {
    fullName: profile.fullName,
    cpf: maskCpf(profile.cpf),
    email: profile.email,
    phone: profile.phone,
    bankCode: profile.bankCode,
    bankName: profile.bankName,
    agency: profile.agency,
    accountNumber: maskTail(profile.accountNumber, 2),
    accountDigit: profile.accountDigit ? "*" : "",
    accountType: profile.accountType,
    pixKey: maskPixKey(profile.pixKey, profile.pixKeyType),
    pixKeyType: profile.pixKeyType
  };
}

async function loadProfile(db, userId) {
  return decryptProfile(await profileRepo.getByUserId(db, userId));
}

async function getMyProfile(actor) {
  const profile = await loadProfile(pool, actor.userId);
  const readiness = reimbursementReadiness(profile);
  return {
    profile: profile
      ? { ...profile, cpf: formatCpf(profile.cpf), userId: undefined }
      : null,
    readiness
  };
}

async function saveMyProfile(actor, input) {
  const cipher = getCipher();
  return withTransaction(async (db) => {
    const before = await loadProfile(db, actor.userId);
    const saved = await profileRepo.upsert(db, {
      userId: actor.userId,
      username: actor.username,
      fullName: input.fullName,
      cpfEnc: cipher.encrypt(input.cpf),
      email: input.email,
      phone: input.phone,
      bankCode: input.bankCode,
      bankName: input.bankName,
      agency: input.agency,
      accountNumberEnc: cipher.encrypt(input.accountNumber),
      accountDigit: input.accountDigit.toUpperCase(),
      accountType: input.accountType,
      pixKeyEnc: cipher.encrypt(input.pixKey),
      pixKeyType: input.pixKey ? input.pixKeyType : ""
    });
    const after = decryptProfile(saved);
    // Só os NOMES dos campos alterados vão para a auditoria, nunca os valores.
    const changed = before
      ? Object.keys(after).filter((k) => !["updatedAt", "userId", "username"].includes(k) && before[k] !== after[k])
      : ["created"];
    await audit.record(db, actor, {
      action: before ? "PROFILE_UPDATED" : "PROFILE_CREATED",
      entityType: "profile",
      entityId: saved.id,
      metadata: { changedFields: changed }
    });
    return { profile: { ...after, cpf: formatCpf(after.cpf), userId: undefined }, readiness: reimbursementReadiness(after) };
  });
}

// Visão mascarada do solicitante para a gestão (análise do relatório).
async function getMaskedProfile(db, userId) {
  const profile = await loadProfile(db, userId);
  return { profile: maskedView(profile), readiness: reimbursementReadiness(profile) };
}

// Dados completos para efetuar o pagamento — somente gestão, sempre auditado.
async function revealBankDetails(actor, report) {
  return withTransaction(async (db) => {
    const profile = await loadProfile(db, report.user_id);
    await audit.record(db, actor, {
      reportId: report.id,
      action: "BANK_DETAILS_VIEWED",
      entityType: "profile",
      entityId: report.user_id
    });
    if (!profile) return null;
    return bankSnapshot(profile);
  });
}

// O que é preservado no pagamento (cifrado) e exibido para pagar.
function bankSnapshot(profile) {
  return {
    fullName: profile.fullName,
    cpf: formatCpf(profile.cpf),
    bankCode: profile.bankCode,
    bankName: profile.bankName,
    agency: profile.agency,
    accountNumber: profile.accountNumber,
    accountDigit: profile.accountDigit,
    accountType: profile.accountType,
    pixKey: profile.pixKey,
    pixKeyType: profile.pixKeyType
  };
}

module.exports = {
  decryptProfile,
  reimbursementReadiness,
  maskedView,
  loadProfile,
  getMyProfile,
  saveMyProfile,
  getMaskedProfile,
  revealBankDetails,
  bankSnapshot
};
