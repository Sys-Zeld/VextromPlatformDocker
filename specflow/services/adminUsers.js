const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("../../configdb/db");
const env = require("../config/env");
const accessControl = require("./accessControl");
const passwordPolicy = require("./passwordPolicy");
const { sanitizeInput } = require("../utils/sanitize");

const USERS_FILE = path.resolve(env.admin.usersFile);
const SCRYPT_KEY_LENGTH = 64;
const MODULE_KEYS = ["specflow", "module-spec", "report-service", "sentinelgrid"];
const MODULE_SET = new Set(MODULE_KEYS);

// Tokens de convite (definir a primeira senha) e de recuperação.
const TOKEN_KINDS = { INVITE: "invite", RESET: "reset" };
const TOKEN_TTL_MS = {
  [TOKEN_KINDS.INVITE]: 72 * 60 * 60 * 1000, // 72h — o convite costuma esperar o usuário
  [TOKEN_KINDS.RESET]: 60 * 60 * 1000        // 1h — recuperação é sensível, janela curta
};

const USER_STATUS = { ACTIVE: "active", INVITED: "invited", DISABLED: "disabled" };

let ensureStoragePromise = null;

function safeTimingEqualText(a, b) {
  const buffA = Buffer.from(String(a || ""));
  const buffB = Buffer.from(String(b || ""));
  if (buffA.length !== buffB.length) return false;
  return crypto.timingSafeEqual(buffA, buffB);
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

// Perfis antigos ("admin"/"user") continuam entrando: o accessControl converte.
function normalizeRole(role) {
  return accessControl.normalizeRole(role);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Validação deliberadamente простая: um @, algo antes e um domínio com ponto.
// Regex de e-mail "completa" rejeita endereços válidos — quem valida de verdade
// é o token enviado para a caixa postal.
function isValidEmail(email) {
  const value = normalizeEmail(email);
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  return Object.values(USER_STATUS).includes(value) ? value : USER_STATUS.ACTIVE;
}

function normalizeModuleAccess(moduleAccess, role = "technician") {
  const normalizedRole = normalizeRole(role);
  if (accessControl.isAdministrator(normalizedRole)) return [...MODULE_KEYS];
  if (moduleAccess === null || moduleAccess === undefined) return [...MODULE_KEYS];

  let source = moduleAccess;
  if (typeof source === "string") {
    const text = source.trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        source = JSON.parse(text);
      } catch (_err) {
        source = [];
      }
    } else if (text) {
      source = text.split(",").map((item) => item.trim());
    } else {
      source = [];
    }
  }

  const list = Array.isArray(source) ? source : [];
  const unique = new Set();
  list.forEach((item) => {
    const key = String(item || "").trim().toLowerCase();
    if (MODULE_SET.has(key)) unique.add(key);
  });

  return Array.from(unique);
}

function normalizeAdminUserRow(row) {
  if (!row) return null;
  const role = normalizeRole(row.role);
  return {
    id: String(row.id || ""),
    username: normalizeUsername(row.username),
    email: normalizeEmail(row.email),
    emailVerifiedAt: row.email_verified_at || row.emailVerifiedAt || null,
    status: normalizeStatus(row.status),
    role,
    capabilities: accessControl.capabilitiesForRole(role),
    moduleAccess: normalizeModuleAccess(row.module_access || row.moduleAccess, row.role),
    uiFont: String(row.ui_font || row.uiFont || "").trim().toLowerCase(),
    salt: String(row.salt || ""),
    passwordHash: String(row.password_hash || row.passwordHash || ""),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null
  };
}

function readLegacyUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const users = Array.isArray(parsed.users) ? parsed.users : [];
    return users
      .filter((user) => user && typeof user === "object")
      .map(normalizeAdminUserRow)
      .filter((user) => user.username && user.salt && user.passwordHash);
  } catch (_err) {
    return [];
  }
}

function scryptAsync(value, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(value || ""), String(salt || ""), SCRYPT_KEY_LENGTH, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

async function passwordMatchesHash(password, salt, expectedHash) {
  const rawPassword = String(password ?? "");
  const rawHash = await scryptAsync(rawPassword, salt);
  if (safeTimingEqualText(rawHash, expectedHash)) return true;

  // Compatibilidade com contas criadas antes da correção: o fluxo antigo
  // aplicava sanitize-html à senha antes de armazená-la.
  const legacyPassword = sanitizeInput(rawPassword);
  if (legacyPassword === rawPassword) return false;
  const legacyHash = await scryptAsync(legacyPassword, salt);
  return safeTimingEqualText(legacyHash, expectedHash);
}

async function ensureAdminUsersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'user',
      module_access JSONB NOT NULL DEFAULT '["specflow","module-spec","report-service"]'::jsonb,
      ui_font TEXT NOT NULL DEFAULT 'inter',
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`
    ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS module_access JSONB NOT NULL DEFAULT '["specflow","module-spec","report-service"]'::jsonb;
  `);
  await db.query(`
    ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS ui_font TEXT NOT NULL DEFAULT 'inter';
  `);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username_unique ON admin_users (username);`);

  // ---- Identidade por e-mail ------------------------------------------
  // Nulo é permitido: os usuários já cadastrados não têm e-mail ainda e
  // continuam entrando pelo nome de usuário até alguém preencher.
  await db.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email TEXT;`);
  await db.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;`);
  await db.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';`);
  // Índice parcial: só vale para quem tem e-mail, então vários NULL convivem.
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_email_unique
    ON admin_users (LOWER(email))
    WHERE email IS NOT NULL AND email <> '';
  `);

  // ---- Perfis: modelo antigo (admin/user) para os quatro níveis --------
  // Decisão de migração: "user" vira coordenador para ninguém perder acesso.
  await db.query(`UPDATE admin_users SET role = 'administrator' WHERE LOWER(role) = 'admin';`);
  await db.query(`UPDATE admin_users SET role = 'coordinator' WHERE LOWER(role) = 'user';`);

  // ---- Tokens de convite e recuperação --------------------------------
  // Guardamos só o hash do token: vazamento do banco não permite usar o link.
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_user_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_admin_user_tokens_user ON admin_user_tokens (user_id, kind);`);

  // ---- SentinelGrid entrou na lista de módulos por usuário ---------------
  // Backfill de execução ÚNICA: quem já existia foi cadastrado quando o módulo
  // não era selecionável e apareceria como "sem acesso". Precisa da trava —
  // rodando a cada boot, desfaria todo desmarque feito pelo administrador.
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_users_migrations (
      key TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const backfillKey = "module_access_add_sentinelgrid";
  const applied = await db.query("SELECT 1 FROM admin_users_migrations WHERE key = $1", [backfillKey]);
  if (!applied.rows[0]) {
    await db.query(`
      UPDATE admin_users
      SET module_access = module_access || '["sentinelgrid"]'::jsonb, updated_at = NOW()
      WHERE NOT (module_access @> '["sentinelgrid"]'::jsonb);
    `);
    await db.query("INSERT INTO admin_users_migrations (key) VALUES ($1) ON CONFLICT DO NOTHING", [backfillKey]);
  }
  await db.query(`
    ALTER TABLE admin_users
    ALTER COLUMN module_access
    SET DEFAULT '["specflow","module-spec","report-service","sentinelgrid"]'::jsonb;
  `);
}

async function migrateLegacyUsersFile() {
  const legacyUsers = readLegacyUsers();
  if (!legacyUsers.length) return;

  const existing = await db.query("SELECT COUNT(*)::int AS count FROM admin_users");
  if (Number(existing.rows[0] && existing.rows[0].count) > 0) return;

  await db.query("BEGIN");
  try {
    for (const user of legacyUsers) {
      await db.query(
        `
          INSERT INTO admin_users (id, username, role, module_access, salt, password_hash, created_at, updated_at)
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
          ON CONFLICT (username) DO NOTHING
        `,
        [
          user.id || crypto.randomUUID(),
          user.username,
          user.role,
          JSON.stringify(user.moduleAccess || MODULE_KEYS),
          user.salt,
          user.passwordHash,
          user.createdAt || new Date().toISOString(),
          user.updatedAt || user.createdAt || new Date().toISOString()
        ]
      );
    }
    await db.query("COMMIT");
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

async function ensureAdminUsersStorageReady() {
  if (!ensureStoragePromise) {
    ensureStoragePromise = (async () => {
      await ensureAdminUsersTable();
      await migrateLegacyUsersFile();
    })().catch((err) => {
      ensureStoragePromise = null;
      throw err;
    });
  }
  return ensureStoragePromise;
}

async function runAdminUsersQuery(queryText, params = []) {
  try {
    return await db.query(queryText, params);
  } catch (err) {
    // 42P01 = relation does not exist
    if (err && err.code === "42P01") {
      ensureStoragePromise = null;
      await ensureAdminUsersStorageReady();
      return db.query(queryText, params);
    }
    throw err;
  }
}

async function listAdminUsers() {
  await ensureAdminUsersStorageReady();
  const result = await runAdminUsersQuery(`
    SELECT id, username, email, email_verified_at, status, role, module_access, ui_font, created_at, updated_at
    FROM admin_users
    ORDER BY created_at DESC, username ASC
  `);
  return result.rows.map((row) => {
    const user = normalizeAdminUserRow(row);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
      status: user.status,
      role: user.role,
      roleLabel: accessControl.roleLabel(user.role),
      moduleAccess: user.moduleAccess,
      uiFont: user.uiFont,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  });
}

async function getAdminUserRoleByUsername(username) {
  await ensureAdminUsersStorageReady();
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const result = await runAdminUsersQuery(
    `
      SELECT role
      FROM admin_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalized]
  );
  if (!result.rows[0]) return null;
  return normalizeRole(result.rows[0].role);
}

async function getAdminUserAccessByUsername(username) {
  await ensureAdminUsersStorageReady();
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const result = await runAdminUsersQuery(
    `
      SELECT role, module_access, ui_font
      FROM admin_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalized]
  );
  if (!result.rows[0]) return null;
  const role = normalizeRole(result.rows[0].role);
  return {
    role,
    capabilities: accessControl.capabilitiesForRole(role),
    moduleAccess: normalizeModuleAccess(result.rows[0].module_access, result.rows[0].role),
    uiFont: String(result.rows[0].ui_font || "").trim().toLowerCase()
  };
}

// O identificador aceita e-mail OU nome de usuário no mesmo campo: os cadastros
// antigos não têm e-mail e ficariam sem acesso se exigíssemos só e-mail.
// O hash continua sendo scrypt com o salt de cada usuário, então as senhas já
// cadastradas seguem valendo sem nenhuma migração.
async function verifyAdminUserCredentials(identifier, password) {
  await ensureAdminUsersStorageReady();
  const normalized = normalizeUsername(identifier);
  if (!normalized || !password) return null;
  const result = await runAdminUsersQuery(
    `
      SELECT id, username, email, email_verified_at, status, role, module_access,
             salt, password_hash, created_at, updated_at
      FROM admin_users
      WHERE username = $1 OR LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [normalized]
  );
  const user = normalizeAdminUserRow(result.rows[0]);
  if (!user) return null;
  // Convidado ainda sem senha definida, ou conta desativada: não entra.
  if (user.status === USER_STATUS.DISABLED) return null;
  if (!user.passwordHash || !user.salt) return null;
  if (!await passwordMatchesHash(password, user.salt, user.passwordHash)) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    role: user.role,
    capabilities: user.capabilities,
    moduleAccess: user.moduleAccess,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function getAdminUserByUsername(username) {
  await ensureAdminUsersStorageReady();
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  const result = await runAdminUsersQuery(
    `
      SELECT id, username, role, module_access, ui_font, created_at, updated_at
      FROM admin_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalized]
  );
  const user = normalizeAdminUserRow(result.rows[0]);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    moduleAccess: user.moduleAccess,
    uiFont: user.uiFont,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function changeAdminUserPasswordByUsername({ username, currentPassword, newPassword }) {
  await ensureAdminUsersStorageReady();
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error("Usuario invalido.");
  if (!currentPassword) throw new Error("Informe a senha atual.");

  const result = await runAdminUsersQuery(
    `
      SELECT id, username, email, salt, password_hash
      FROM admin_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalizedUsername]
  );
  const user = normalizeAdminUserRow(result.rows[0]);
  if (!user) {
    throw new Error("Usuario nao encontrado na tabela admin_users.");
  }

  // Senha nova passa pela política forte; a antiga continua valendo até trocar.
  const problems = passwordPolicy.validatePassword(newPassword, { username: user.username, email: user.email });
  if (problems.length) throw new Error(problems.join(" "));

  if (!await passwordMatchesHash(currentPassword, user.salt, user.passwordHash)) {
    throw new Error("Senha atual invalida.");
  }
  if (safeTimingEqualText(String(currentPassword), String(newPassword))) {
    throw new Error("A nova senha deve ser diferente da atual.");
  }

  const nextSalt = crypto.randomBytes(16).toString("hex");
  const nextHash = await scryptAsync(newPassword, nextSalt);
  await runAdminUsersQuery(
    `
      UPDATE admin_users
      SET salt = $2, password_hash = $3, updated_at = NOW()
      WHERE username = $1
    `,
    [normalizedUsername, nextSalt, nextHash]
  );
}

/**
 * Cria um usuário. Sem `password`, a conta nasce como "invited" e sem senha —
 * o acesso é liberado quando o convidado define a senha pelo link do e-mail.
 * Devolve o id, para quem chamou emitir o convite.
 */
async function createAdminUser({ username, password = "", email = "", role = "technician", moduleAccess = null }) {
  await ensureAdminUsersStorageReady();
  const normalized = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const normalizedRole = normalizeRole(role);
  const normalizedModuleAccess = normalizeModuleAccess(moduleAccess, normalizedRole);
  if (!normalized) {
    throw new Error("Usuario invalido.");
  }
  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    throw new Error("E-mail invalido.");
  }
  if (!password && !normalizedEmail) {
    throw new Error("Informe uma senha ou um e-mail para enviar o convite.");
  }
  if (password) {
    const problems = passwordPolicy.validatePassword(password, { username: normalized, email: normalizedEmail });
    if (problems.length) throw new Error(problems.join(" "));
  }

  const exists = await runAdminUsersQuery(
    `
      SELECT 1
      FROM admin_users
      WHERE username = $1 OR (LOWER(email) = $2 AND $2 <> '')
      LIMIT 1
    `,
    [normalized, normalizedEmail]
  );
  if (exists.rows[0]) {
    throw new Error("Ja existe um usuario com este nome ou e-mail.");
  }

  const id = crypto.randomUUID();
  const salt = password ? crypto.randomBytes(16).toString("hex") : "";
  const passwordHash = password ? await scryptAsync(password, salt) : "";
  await runAdminUsersQuery(
    `
      INSERT INTO admin_users (id, username, email, status, role, module_access, salt, password_hash, created_at, updated_at)
      VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6::jsonb, $7, $8, NOW(), NOW())
    `,
    [
      id,
      normalized,
      normalizedEmail,
      password ? USER_STATUS.ACTIVE : USER_STATUS.INVITED,
      normalizedRole,
      JSON.stringify(normalizedModuleAccess),
      salt,
      passwordHash
    ]
  );
  return { id, username: normalized, email: normalizedEmail, role: normalizedRole };
}

async function updateAdminUser({ id, username, role, password, email, moduleAccess = null }) {
  await ensureAdminUsersStorageReady();
  const normalizedId = String(id || "").trim();
  const normalizedUsername = normalizeUsername(username);
  const normalizedRole = normalizeRole(role);
  const normalizedModuleAccess = normalizeModuleAccess(moduleAccess, normalizedRole);
  if (!normalizedId) throw new Error("Usuario invalido.");
  if (!normalizedUsername) throw new Error("Usuario invalido.");

  const existingResult = await runAdminUsersQuery(
    `
      SELECT id, username, email, email_verified_at, status, role, module_access, salt, password_hash, created_at, updated_at
      FROM admin_users
      WHERE id = $1
      LIMIT 1
    `,
    [normalizedId]
  );
  const existingUser = normalizeAdminUserRow(existingResult.rows[0]);
  if (!existingUser) throw new Error("Usuario nao encontrado.");

  // email undefined = não mexer; string vazia = limpar.
  const nextEmail = email === undefined ? existingUser.email : normalizeEmail(email);
  if (nextEmail && !isValidEmail(nextEmail)) throw new Error("E-mail invalido.");

  const duplicate = await runAdminUsersQuery(
    `
      SELECT 1
      FROM admin_users
      WHERE (username = $1 OR (LOWER(email) = $3 AND $3 <> '')) AND id <> $2
      LIMIT 1
    `,
    [normalizedUsername, normalizedId, nextEmail]
  );
  if (duplicate.rows[0]) {
    throw new Error("Ja existe outro usuario com este nome ou e-mail.");
  }

  let nextSalt = existingUser.salt;
  let nextPasswordHash = existingUser.passwordHash;
  if (password) {
    const problems = passwordPolicy.validatePassword(password, { username: normalizedUsername, email: nextEmail });
    if (problems.length) throw new Error(problems.join(" "));
    nextSalt = crypto.randomBytes(16).toString("hex");
    nextPasswordHash = await scryptAsync(password, nextSalt);
  }

  // Trocar o e-mail derruba a verificação: o novo endereço ainda não foi provado.
  const emailChanged = nextEmail !== existingUser.email;

  await runAdminUsersQuery(
    `
      UPDATE admin_users
      SET username = $2, role = $3, module_access = $4::jsonb, salt = $5, password_hash = $6,
          email = NULLIF($7, ''),
          email_verified_at = CASE WHEN $8 THEN NULL ELSE email_verified_at END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      normalizedId,
      normalizedUsername,
      normalizedRole,
      JSON.stringify(normalizedModuleAccess),
      nextSalt,
      nextPasswordHash,
      nextEmail,
      emailChanged
    ]
  );
}

async function deleteAdminUser(id) {
  await ensureAdminUsersStorageReady();
  const normalizedId = String(id || "").trim();
  if (!normalizedId) throw new Error("Usuario invalido.");

  const result = await runAdminUsersQuery(
    `
      DELETE FROM admin_users
      WHERE id = $1
      RETURNING id, username, role
    `,
    [normalizedId]
  );
  const removedUser = normalizeAdminUserRow(result.rows[0]);
  if (!removedUser) throw new Error("Usuario nao encontrado.");
  return {
    id: removedUser.id,
    username: removedUser.username,
    role: removedUser.role
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convite e recuperação de senha por e-mail
// ─────────────────────────────────────────────────────────────────────────────

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

/**
 * Gera um token de uso único e devolve o valor BRUTO — que só existe aqui e no
 * e-mail. O banco guarda apenas o hash.
 * Emitir um token novo invalida os anteriores do mesmo tipo.
 */
async function issueUserToken(userId, kind) {
  await ensureAdminUsersStorageReady();
  const normalizedKind = String(kind || "").trim().toLowerCase();
  if (!Object.values(TOKEN_KINDS).includes(normalizedKind)) throw new Error("Tipo de token invalido.");

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS[normalizedKind]);

  await runAdminUsersQuery(
    `UPDATE admin_user_tokens SET used_at = NOW() WHERE user_id = $1 AND kind = $2 AND used_at IS NULL`,
    [userId, normalizedKind]
  );
  await runAdminUsersQuery(
    `
      INSERT INTO admin_user_tokens (id, user_id, kind, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [crypto.randomUUID(), userId, normalizedKind, hashToken(rawToken), expiresAt.toISOString()]
  );

  return { token: rawToken, expiresAt };
}

/** Resolve um token bruto no usuário dono, sem consumir. Null se inválido/expirado/usado. */
async function peekUserToken(rawToken, kind) {
  await ensureAdminUsersStorageReady();
  if (!rawToken) return null;
  const result = await runAdminUsersQuery(
    `
      SELECT t.id AS token_id, t.kind, u.id, u.username, u.email, u.status, u.role
      FROM admin_user_tokens t
      JOIN admin_users u ON u.id = t.user_id
      WHERE t.token_hash = $1
        AND t.kind = $2
        AND t.used_at IS NULL
        AND t.expires_at > NOW()
      LIMIT 1
    `,
    [hashToken(rawToken), String(kind || "").trim().toLowerCase()]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenId: row.token_id,
    kind: row.kind,
    id: String(row.id),
    username: normalizeUsername(row.username),
    email: normalizeEmail(row.email),
    status: normalizeStatus(row.status),
    role: normalizeRole(row.role)
  };
}

/**
 * Define a senha a partir de um token de convite ou recuperação.
 * Consome o token, ativa a conta e marca o e-mail como verificado — clicar no
 * link prova que a caixa postal é do usuário.
 */
async function setPasswordWithToken({ token, kind, newPassword }) {
  const owner = await peekUserToken(token, kind);
  if (!owner) {
    const err = new Error("Link invalido ou expirado. Solicite um novo.");
    err.code = "invalid_token";
    throw err;
  }

  const problems = passwordPolicy.validatePassword(newPassword, { username: owner.username, email: owner.email });
  if (problems.length) {
    const err = new Error(problems.join(" "));
    err.code = "weak_password";
    err.problems = problems;
    throw err;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = await scryptAsync(newPassword, salt);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE admin_users
        SET salt = $2, password_hash = $3, status = 'active',
            email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
        WHERE id = $1
      `,
      [owner.id, salt, passwordHash]
    );
    await client.query(`UPDATE admin_user_tokens SET used_at = NOW() WHERE id = $1`, [owner.tokenId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { id: owner.id, username: owner.username, email: owner.email };
}

/** Busca por e-mail — usado pela recuperação de senha. */
async function findAdminUserByEmail(email) {
  await ensureAdminUsersStorageReady();
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const result = await runAdminUsersQuery(
    `
      SELECT id, username, email, email_verified_at, status, role, module_access, created_at, updated_at
      FROM admin_users
      WHERE LOWER(email) = $1
      LIMIT 1
    `,
    [normalized]
  );
  const user = normalizeAdminUserRow(result.rows[0]);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    status: user.status,
    role: user.role
  };
}

module.exports = {
  TOKEN_KINDS,
  USER_STATUS,
  isValidEmail,
  normalizeEmail,
  findAdminUserByEmail,
  issueUserToken,
  peekUserToken,
  setPasswordWithToken,
  getAdminUserRoleByUsername,
  getAdminUserAccessByUsername,
  getAdminUserByUsername,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  changeAdminUserPasswordByUsername,
  verifyAdminUserCredentials
};
