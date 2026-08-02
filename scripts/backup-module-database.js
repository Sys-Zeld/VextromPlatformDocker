const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const env = require("../specflow/config/env");
const db = require("../configdb/db");
const { upsertBackupFileRecord } = require("../specflow/services/backups");
const objectStorage = require("../specflow/services/objectStorage");
const { resolvePostgresCommand, buildNotFoundHint } = require("./utils/postgres-cli");

const MODULE_CONFIG = {
  specflow: {
    dbUrl: env.databases.specflow.url,
    filePrefix: "specflow-backup"
  },
  config: {
    dbUrl: env.databases.config.url,
    filePrefix: "config-backup"
  },
  "module-spec": {
    dbUrl: env.databases.moduleSpec.url,
    filePrefix: "module-spec-backup"
  },
  "report-service": {
    dbUrl: env.databases.reportService.url,
    filePrefix: "report-service-backup"
  },
  sentinelgrid: {
    dbUrl: env.databases.sentinelgrid.url,
    filePrefix: "sentinelgrid-backup"
  }
};

function buildBackupPath(prefix) {
  const backupDir = path.join(process.cwd(), "dados", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(backupDir, `${prefix}-${timestamp}.sql`);
}

function runPgDump(databaseUrl, outputFile) {
  return new Promise((resolve, reject) => {
    const pgDumpCommand = resolvePostgresCommand("pg_dump");
    const args = [
      "--no-owner",
      "--no-privileges",
      "--file",
      outputFile,
      databaseUrl
    ];

    const child = spawn(pgDumpCommand, args, {
      stdio: "inherit",
      shell: false,
      windowsHide: true
    });

    child.on("error", (err) => {
      if (err && err.code === "ENOENT") {
        reject(new Error(buildNotFoundHint("pg_dump")));
        return;
      }
      reject(new Error(`Falha ao iniciar pg_dump: ${err.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pg_dump retornou codigo ${code}.`));
    });
  });
}

function normalizeTargets(rawTarget) {
  const target = String(rawTarget || "").trim().toLowerCase();
  if (!target || target === "all") {
    return ["specflow", "config", "module-spec", "report-service", "sentinelgrid"];
  }
  if (!Object.prototype.hasOwnProperty.call(MODULE_CONFIG, target)) {
    throw new Error("Modulo invalido. Use: specflow | config | module-spec | report-service | sentinelgrid | all.");
  }
  return [target];
}

async function run() {
  const targets = normalizeTargets(process.argv[2]);
  let remoteUploadEnabled = true;

  for (const target of targets) {
    const config = MODULE_CONFIG[target];
    if (!config || !config.dbUrl) {
      throw new Error(`URL de banco nao configurada para modulo: ${target}.`);
    }
    const outputFile = buildBackupPath(config.filePrefix);
    await runPgDump(config.dbUrl, outputFile);
    try {
      const backupRow = await upsertBackupFileRecord(outputFile, { backupTimestamp: new Date() });
      // eslint-disable-next-line no-console
      console.log(`Backup ${target} concluido: ${outputFile} (catalogo id=${backupRow.id})`);
    } catch (catalogErr) {
      // eslint-disable-next-line no-console
      console.log(`Backup ${target} concluido: ${outputFile}`);
      // eslint-disable-next-line no-console
      console.warn(`Aviso: falha ao registrar no catalogo: ${catalogErr.message}`);
    }
    if (remoteUploadEnabled) {
      try {
        await objectStorage.uploadLocalFile(
          objectStorage.normalizeKey(path.relative(process.cwd(), outputFile)),
          outputFile,
          { contentType: "application/sql" }
        );
      } catch (storageErr) {
        // O dump local já está íntegro e catalogado. Indisponibilidade temporária
        // do MinIO/S3 não deve interromper backup:all nem impedir os próximos bancos.
        remoteUploadEnabled = false;
        // eslint-disable-next-line no-console
        console.warn(`Aviso: backup local concluido, mas o envio ao storage remoto falhou: ${storageErr.message}`);
        // eslint-disable-next-line no-console
        console.warn("Aviso: uploads remotos restantes foram ignorados nesta execucao; os dumps locais continuarao normalmente.");
      }
    }
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Falha no backup por modulo:", err.message);
  process.exit(1);
}).finally(async () => {
  try {
    await db.end();
  } catch (_err) {
    // noop
  }
});
