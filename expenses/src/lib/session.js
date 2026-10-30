const crypto = require("crypto");

// Token de sessão do módulo (cookie próprio, independente do hub):
// base64url(payload JSON) + "." + HMAC-SHA256. Payload: { uid, sv, iat, exp }.
// `sv` (session_version) permite derrubar sessões abertas no banco.

function createSessionCodec(secret) {
  if (!secret) throw new Error("Segredo de sessão do módulo de despesas não configurado.");
  // Chave derivada: o mesmo segredo base nunca assina dois tipos de token.
  const key = crypto.createHmac("sha256", String(secret)).update("expenses-session-v1").digest();
  const sign = (data) => crypto.createHmac("sha256", key).update(data).digest("base64url");

  function issue({ userId, sessionVersion, ttlMs }) {
    const now = Date.now();
    const payload = Buffer.from(JSON.stringify({ uid: userId, sv: sessionVersion, iat: now, exp: now + ttlMs })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  // Devolve o payload se assinatura e validade conferem; senão null.
  function verify(token) {
    const text = String(token || "");
    const dot = text.lastIndexOf(".");
    if (dot <= 0) return null;
    const payload = text.slice(0, dot);
    const given = Buffer.from(text.slice(dot + 1));
    const expected = Buffer.from(sign(payload));
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      if (!data || typeof data.uid !== "string" || !Number.isInteger(data.sv) || !(data.exp > Date.now())) return null;
      return data;
    } catch (_err) {
      return null;
    }
  }

  return { issue, verify };
}

module.exports = { createSessionCodec };
