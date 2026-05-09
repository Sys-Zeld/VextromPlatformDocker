const db = require("../../configdb/db");

const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo — Brasília, São Paulo (UTC-3)" },
  { value: "America/Manaus", label: "America/Manaus — Manaus (UTC-4)" },
  { value: "America/Belem", label: "America/Belem — Belém (UTC-3)" },
  { value: "America/Fortaleza", label: "America/Fortaleza — Fortaleza, Recife, Maceió (UTC-3)" },
  { value: "America/Bahia", label: "America/Bahia — Salvador (UTC-3)" },
  { value: "America/Cuiaba", label: "America/Cuiaba — Cuiabá (UTC-4)" },
  { value: "America/Porto_Velho", label: "America/Porto_Velho — Porto Velho (UTC-4)" },
  { value: "America/Boa_Vista", label: "America/Boa_Vista — Boa Vista (UTC-4)" },
  { value: "America/Rio_Branco", label: "America/Rio_Branco — Rio Branco (UTC-5)" },
  { value: "America/Noronha", label: "America/Noronha — Fernando de Noronha (UTC-2)" },
  { value: "America/New_York", label: "America/New_York — Nova York (UTC-5/-4)" },
  { value: "America/Chicago", label: "America/Chicago — Chicago (UTC-6/-5)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles — Los Angeles (UTC-8/-7)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon — Lisboa (UTC+0/+1)" },
  { value: "Europe/London", label: "Europe/London — Londres (UTC+0/+1)" },
  { value: "Europe/Berlin", label: "Europe/Berlin — Berlim, Paris (UTC+1/+2)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo — Tóquio (UTC+9)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai — Xangai (UTC+8)" },
  { value: "Australia/Sydney", label: "Australia/Sydney — Sydney (UTC+10/+11)" }
];

function isValidIANATimezone(tz) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: String(tz || "").trim() });
    return true;
  } catch (_) {
    return false;
  }
}

async function getSystemSetting(key, defaultValue = "") {
  try {
    const result = await db.query(
      "SELECT value FROM system_settings WHERE key = $1 LIMIT 1",
      [String(key)]
    );
    return result.rows[0]?.value ?? defaultValue;
  } catch (err) {
    if (err && err.code === "42P01") return defaultValue;
    throw err;
  }
}

async function setSystemSetting(key, value) {
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [String(key), String(value)]
  );
}

async function getSystemTimezone() {
  const stored = await getSystemSetting("system_timezone", "");
  if (stored && isValidIANATimezone(stored)) return stored;
  const envTz = process.env.TZ || "";
  if (envTz && isValidIANATimezone(envTz)) return envTz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (_) {
    return "UTC";
  }
}

async function setSystemTimezone(timezone) {
  const tz = String(timezone || "").trim();
  if (!tz || !isValidIANATimezone(tz)) {
    throw new Error(`Timezone invalido: "${tz}".`);
  }
  await setSystemSetting("system_timezone", tz);
}

function formatDatetimeInTimezone(date, timezone) {
  try {
    const tz = timezone && isValidIANATimezone(timezone) ? timezone : "UTC";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).format(date instanceof Date ? date : new Date(date));
  } catch (_) {
    return (date instanceof Date ? date : new Date(date)).toLocaleString("pt-BR");
  }
}

function getTimezoneOffsetLabel(timezone) {
  try {
    const tz = timezone && isValidIANATimezone(timezone) ? timezone : "UTC";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset"
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart ? tzPart.value : "";
  } catch (_) {
    return "";
  }
}

module.exports = {
  COMMON_TIMEZONES,
  isValidIANATimezone,
  getSystemTimezone,
  setSystemTimezone,
  formatDatetimeInTimezone,
  getTimezoneOffsetLabel
};
