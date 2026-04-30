const Redis = require("ioredis");
const env = require("../config/env");

const KEYS = {
  notBefore: "vextrom:admin:sessionNotBefore",
  rateLimiterReset: "vextrom:admin:rateLimiterResetAfter"
};

let redisClient = null;
let cachedState = {
  adminSessionNotBefore: 0,
  rateLimiterResetAfter: 0
};

function createRedisClient() {
  const client = new Redis(env.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false
  });
  client.on("error", (err) => {
    // Loga mas não derruba o processo — a app continua com o cache em memória
    // eslint-disable-next-line no-console
    console.error("[Redis] connection error:", err.message);
  });
  return client;
}

async function initialize() {
  redisClient = createRedisClient();
  await redisClient.connect();
  const [nb, rlr] = await Promise.all([
    redisClient.get(KEYS.notBefore),
    redisClient.get(KEYS.rateLimiterReset)
  ]);
  cachedState.adminSessionNotBefore = nb ? Number(nb) : 0;
  cachedState.rateLimiterResetAfter = rlr ? Number(rlr) : 0;
}

function persistToRedis(key, value) {
  if (!redisClient || redisClient.status !== "ready") return;
  redisClient.set(key, String(value)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[Redis] failed to persist state:", err.message);
  });
}

function getAdminSessionNotBefore() {
  const value = Number(cachedState.adminSessionNotBefore || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function invalidateAllAdminSessions() {
  const now = Date.now();
  cachedState.adminSessionNotBefore = now;
  persistToRedis(KEYS.notBefore, now);
  return now;
}

function getRateLimiterResetAfter() {
  const value = Number(cachedState.rateLimiterResetAfter || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function requestAllRateLimitersReset() {
  const now = Date.now();
  cachedState.rateLimiterResetAfter = now;
  persistToRedis(KEYS.rateLimiterReset, now);
  return now;
}

module.exports = {
  initialize,
  getAdminSessionNotBefore,
  invalidateAllAdminSessions,
  getRateLimiterResetAfter,
  requestAllRateLimitersReset
};
