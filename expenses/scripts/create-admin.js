// Cria uma conta de Administrador do módulo Relatório de Despesas (login próprio).
//
//   npm run expenses:admin:create -- --username admin.despesas --email voce@empresa.com [--name "Nome"] [--password "..."]
//
// Sem --password, gera uma senha provisória (exibida uma única vez) e obriga a
// troca no primeiro acesso. Com --password, a senha precisa atender à política.

const pool = require("../src/db");
const { withTransaction } = require("../src/db");
const userRepo = require("../src/repositories/userRepository");
const audit = require("../src/services/auditService");
const { hashPassword, generateTemporaryPassword } = require("../src/lib/password");
const passwordPolicy = require("../../specflow/services/passwordPolicy");
const { migrateExpenses } = require("../migrate");

function arg(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const inline = argv.find((a) => a.startsWith(`--${name}=`));
  return inline ? inline.slice(name.length + 3) : "";
}

async function run() {
  const username = arg("username").trim();
  const email = arg("email").trim();
  const fullName = arg("name").trim();
  const given = arg("password");

  if (!/^[A-Za-z0-9._@-]{3,60}$/.test(username)) {
    throw new Error("Informe --username (3 a 60 caracteres: letras, números, ponto, hífen, arroba ou sublinhado).");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  if (given) {
    const problems = passwordPolicy.validatePassword(given, { username, email });
    if (problems.length) throw new Error(`Senha fraca: ${problems.join(" ")}`);
  }

  await migrateExpenses();
  const password = given || generateTemporaryPassword();
  const user = await withTransaction(async (db) => {
    const created = await userRepo.insert(db, {
      username,
      fullName,
      email,
      passwordHash: await hashPassword(password),
      status: "active",
      isAdmin: true,
      isApprover: false,
      isFinance: false,
      mustChangePassword: !given,
      createdBy: "cli"
    });
    await audit.record(db, { userId: "cli", username: "linha de comando" }, {
      action: "USER_CREATED",
      entityType: "user",
      entityId: created.id,
      metadata: { username, email, roles: { admin: true }, method: given ? "cli_password" : "cli_temporary_password" }
    });
    return created;
  });

  /* eslint-disable no-console */
  console.log(`Administrador do módulo criado: ${user.username}`);
  if (!given) {
    console.log(`Senha provisória (anote agora; não será exibida de novo): ${password}`);
    console.log("A troca de senha será exigida no primeiro acesso.");
  }
  console.log("Acesse: /app/expenses/login");
  /* eslint-enable no-console */
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err && err.code === "23505" ? "Já existe uma conta com este usuário ou e-mail." : `Falha: ${err.message}`);
    pool.end().finally(() => process.exit(1));
  });
