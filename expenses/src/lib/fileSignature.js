const path = require("path");
const { ALLOWED_FILE_TYPES } = require("../constants");

// Detecta o tipo REAL do arquivo pelos primeiros bytes (magic numbers). A
// extensão e o Content-Type enviados pelo cliente não são confiáveis.
function detectMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.slice(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.slice(0, 4).toString("latin1") === "RIFF" && buffer.slice(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}

// Nome de exibição seguro (sem diretórios, controles ou aspas); não é usado
// como nome no storage.
function sanitizeFileName(raw) {
  const base = path.basename(String(raw || "").replace(/\\/g, "/"));
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|:*?/\\]/g, "").trim().slice(0, 180);
  return clean || "arquivo";
}

// Valida extensão + assinatura + tamanho. Retorna { mime, ext } ou { error }.
function validateUpload(buffer, originalName, maxBytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return { error: "Arquivo vazio." };
  if (buffer.length > maxBytes) {
    return { error: `Arquivo muito grande. Limite: ${Math.round(maxBytes / (1024 * 1024))} MB.`, status: 413 };
  }
  const ext = path.extname(String(originalName || "")).slice(1).toLowerCase();
  const expectedMime = ALLOWED_FILE_TYPES[ext];
  if (!expectedMime) {
    return { error: `Formato não permitido. Aceitos: ${Object.keys(ALLOWED_FILE_TYPES).join(", ").toUpperCase()}.`, status: 415 };
  }
  const realMime = detectMime(buffer);
  if (!realMime || realMime !== expectedMime) {
    return { error: "O conteúdo do arquivo não corresponde à extensão informada.", status: 415 };
  }
  return { mime: realMime, ext: ext === "jpeg" ? "jpg" : ext };
}

module.exports = { detectMime, sanitizeFileName, validateUpload };
