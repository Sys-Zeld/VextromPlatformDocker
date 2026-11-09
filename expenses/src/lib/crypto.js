const crypto = require("crypto");

// Cifra de campos sensíveis (CPF, conta, Pix, snapshot bancário) com
// AES-256-GCM. Formato armazenado: "v1:<iv b64>:<tag b64>:<cifra b64>".
// A chave é derivada (scrypt) de EXPENSES_DATA_KEY, ou do ADMIN_SESSION_SECRET
// quando a chave dedicada não existe.

const VERSION = "v1";
const SALT = "vextrom-expenses-data-v1";
const keyCache = new Map();

function deriveKey(secret) {
  if (!secret) throw new Error("Chave de dados do módulo de despesas não configurada.");
  if (!keyCache.has(secret)) keyCache.set(secret, crypto.scryptSync(String(secret), SALT, 32));
  return keyCache.get(secret);
}

function createCipher(secret) {
  const key = deriveKey(secret);

  function encrypt(plain) {
    if (plain === null || plain === undefined || plain === "") return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
  }

  function decrypt(payload) {
    if (!payload) return "";
    const [version, ivB64, tagB64, dataB64] = String(payload).split(":");
    if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
      throw new Error("Formato de dado cifrado inválido.");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  }

  return { encrypt, decrypt };
}

let defaultCipher = null;

// Cifra padrão, lida do env na primeira utilização.
function getCipher() {
  if (!defaultCipher) {
    const env = require("../../../specflow/config/env");
    defaultCipher = createCipher(env.expenses.dataKey || env.admin.sessionSecret);
  }
  return defaultCipher;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

module.exports = { createCipher, getCipher, sha256 };
