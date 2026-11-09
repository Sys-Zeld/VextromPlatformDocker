// Limpa o banco do módulo Relatório de Despesas e o recria do zero (migrations
// + dados padrão, como as categorias). Apaga relatórios, itens, pagamentos,
// auditoria, notificações, perfis, configurações e TODAS as contas do módulo.
//
//   npm run expenses:db:reset            (pede para digitar CONFIRMAR)
//   npm run expenses:db:reset -- --yes   (sem confirmação, para automação)
//
// Os arquivos de anexos/comprovantes no storage (local ou S3) não são apagados.
// Depois da limpeza, crie o primeiro administrador com expenses:admin:create.

/* eslint-disable no-console */
const readline = require("readline");
const pool = require("../src/db");
const { migrateExpenses } = require("../migrate");

function confirm() {
  if (process.argv.includes("--yes")) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      "\n⚠️  ATENÇÃO: todos os dados do módulo de Despesas (relatórios, pagamentos, usuários, configurações) serão apagados.\n" +
      "Faça um backup antes (npm run db:backup:expenses).\nDigite 'CONFIRMAR' para continuar: ",
      (answer) => {
        rl.close();
        resolve(answer.trim() === "CONFIRMAR");
      }
    );
  });
}

// Só aceita limpar um banco vazio ou que seja comprovadamente do módulo — evita
// apagar outro banco caso EXPENSES_DATABASE_URL esteja apontando errado.
async function assertExpensesDatabase(client) {
  const { rows } = await client.query(
    "SELECT COUNT(*)::int AS total FROM information_schema.tables WHERE table_schema = 'public'"
  );
  if (rows[0].total === 0) return false;
  const marker = await client.query("SELECT to_regclass('public.ex_module_meta') AS t");
  const schema = marker.rows[0].t
    ? (await client.query("SELECT value FROM ex_module_meta WHERE key = 'schema'")).rows[0]
    : null;
  if (!schema || schema.value !== "expenses") {
    throw new Error("O banco configurado em EXPENSES_DATABASE_URL não parece ser do módulo de Despesas. Nada foi apagado.");
  }
  return true;
}

async function countRows(client, table) {
  const exists = await client.query("SELECT to_regclass($1) AS t", [`public.${table}`]);
  if (!exists.rows[0].t) return 0;
  return (await client.query(`SELECT COUNT(*)::int AS total FROM ${table}`)).rows[0].total;
}

async function run() {
  if (!(await confirm())) {
    console.log("Operação cancelada.");
    return;
  }

  const client = await pool.connect();
  let summary = { reports: 0, users: 0 };
  try {
    if (await assertExpensesDatabase(client)) {
      summary = { reports: await countRows(client, "ex_reports"), users: await countRows(client, "ex_users") };
    }
    await client.query("BEGIN");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO CURRENT_USER");
    await client.query("GRANT ALL ON SCHEMA public TO public");
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const result = await migrateExpenses();
  console.log(
    `\n✅ Banco do módulo de Despesas limpo.\n` +
    `   Relatórios removidos : ${summary.reports}\n` +
    `   Usuários removidos   : ${summary.users}\n` +
    `   Migrations aplicadas : ${result.applied}/${result.total}\n\n` +
    "Próximo passo: crie o administrador com\n" +
    "   npm run expenses:admin:create -- --username <usuario> --email <email>\n" +
    "Obs.: os arquivos de anexos no storage não foram removidos."
  );
}

run()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Falha ao limpar o banco de Despesas:", err.message);
    pool.end().finally(() => process.exit(1));
  });
