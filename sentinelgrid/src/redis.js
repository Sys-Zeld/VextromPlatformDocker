const Redis = require("ioredis");
const env = require("../../specflow/config/env");

// Cliente Redis do módulo (infra compartilhada — ADR-002). Usado para o estado de
// "ciente" dos alertas (TTL 24h). Degrada em silêncio se o Redis estiver fora.
let client = null;

function getRedis() {
  if (!client) {
    client = new Redis(env.redis.url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true
    });
    client.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[sentinelgrid][redis]", err.message);
    });
  }
  return client;
}

module.exports = { getRedis };
