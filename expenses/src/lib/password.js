const crypto = require("crypto");

// Hash de senha com scrypt (salt aleatório por senha).
// Formato armazenado: "scrypt$<salt hex>$<hash hex>".
const KEYLEN = 64;

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, KEYLEN, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

// Hash fixo usado quando o usuário não existe: o tempo de resposta do login
// fica igual e não revela quais usuários existem.
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(KEYLEN * 2)}`;

async function verifyPassword(password, stored) {
  const [scheme, salt, hex] = String(stored || DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !salt || !hex) {
    await scrypt(password, "0".repeat(32));
    return false;
  }
  const expected = Buffer.from(hex, "hex");
  const actual = await scrypt(password, salt);
  // Sem senha cadastrada (convite pendente/usuário inexistente) nunca autentica.
  return Boolean(stored) && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Senha provisória legível (sem caracteres ambíguos) e que atende à política.
function generateTemporaryPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%*?"];
  const all = sets.join("");
  const chars = sets.map((s) => s[crypto.randomInt(s.length)]);
  while (chars.length < 16) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

module.exports = { hashPassword, verifyPassword, generateTemporaryPassword };
