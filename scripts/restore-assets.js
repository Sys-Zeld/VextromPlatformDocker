const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const objectStorage = require("../specflow/services/objectStorage");

const ASSETS_BACKUP_PREFIX = "assets-backup-";
const ASSETS_BACKUP_DATE_REGEX = /-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.zip$/i;

const ALLOWED_ZIP_FOLDERS = [
  "dados/docs",
  "dados/service-report-pdfs",
  "dados/service-report-html",
  "dados/report-img",
  "dados/order-attachments",
  "docs/report/img"  // caminho legado — remapeado para dados/report-img na extração
];

function resolveZipFileFromArgs() {
  const arg = process.argv.slice(2).find((item) => String(item).startsWith("--file="));
  if (arg) {
    const filePath = path.resolve(String(arg).slice("--file=".length).trim());
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo nao encontrado: ${filePath}`);
    }
    return filePath;
  }
  return null;
}

async function findLatestAssetsBackup() {
  const backupDir = path.join(process.cwd(), "dados", "backups");
  if (!fs.existsSync(backupDir) && !objectStorage.isS3Enabled()) {
    throw new Error(`Diretorio de backups nao encontrado: ${backupDir}`);
  }

  const localFiles = fs.existsSync(backupDir)
    ? fs.readdirSync(backupDir)
      .filter((f) => f.startsWith(ASSETS_BACKUP_PREFIX) && f.endsWith(".zip"))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        return { fullPath, mtime: fs.statSync(fullPath).mtimeMs, name: f, nameDateMs: parseNameDateMs(f) };
      })
    : [];

  let remoteFiles = [];
  if (objectStorage.isS3Enabled()) {
    const remoteKeys = await objectStorage.listObjects("dados/backups");
    remoteFiles = remoteKeys
      .map((key) => path.basename(key))
      .filter((f) => f.startsWith(ASSETS_BACKUP_PREFIX) && f.endsWith(".zip"))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        return { fullPath, mtime: 0, name: f, remote: true, nameDateMs: parseNameDateMs(f) };
      });
  }

  const files = [...localFiles, ...remoteFiles]
    .filter((file, index, all) => all.findIndex((item) => item.name === file.name) === index)
    .map((file) => {
      if (file.remote && !fs.existsSync(file.fullPath)) return file;
      return {
        fullPath: file.fullPath,
        mtime: fs.existsSync(file.fullPath) ? fs.statSync(file.fullPath).mtimeMs : file.mtime,
        name: file.name,
        nameDateMs: file.nameDateMs
      };
    })
    .sort((a, b) => (b.nameDateMs || b.mtime || 0) - (a.nameDateMs || a.mtime || 0));

  if (!files.length) {
    throw new Error(`Nenhum arquivo assets-backup-*.zip encontrado em: ${backupDir}`);
  }

  return objectStorage.ensureLocalFile(path.join("dados", "backups", files[0].name));
}

function parseNameDateMs(fileName) {
  const match = String(fileName || "").match(ASSETS_BACKUP_DATE_REGEX);
  if (!match) return 0;
  const parsed = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${match[7]}Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shouldSkipClean() {
  return process.argv.includes("--no-clean");
}

function isAllowedEntry(entryPath) {
  return ALLOWED_ZIP_FOLDERS.some(
    (folder) => entryPath === folder || entryPath.startsWith(folder + "/") || entryPath.startsWith(folder + "\\")
  );
}

async function extractZip(zipFile) {
  const directory = await unzipper.Open.file(zipFile);
  const skipClean = shouldSkipClean();

  if (!skipClean) {
    // Collect folders present in zip to selectively clean
    const foldersInZip = new Set();
    for (const entry of directory.files) {
      const entryPath = String(entry.path || "").replace(/\\/g, "/");
      const matched = ALLOWED_ZIP_FOLDERS.find(
        (folder) => entryPath === folder || entryPath.startsWith(folder + "/")
      );
      if (matched) {
        // Normaliza legado para o destino real
        const dest = matched === "docs/report/img" ? "dados/report-img" : matched;
        foldersInZip.add(dest);
      }
    }

    for (const folder of foldersInZip) {
      const destPath = path.join(process.cwd(), folder);
      if (objectStorage.isS3Enabled()) {
        const keys = await objectStorage.listObjects(folder);
        for (const key of keys) {
          // eslint-disable-next-line no-await-in-loop
          await objectStorage.deleteObject(key);
        }
      }
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true, force: true });
        // eslint-disable-next-line no-console
        console.log(`Limpando destino: ${destPath}`);
      }
    }
  }

  let extractedCount = 0;

  for (const entry of directory.files) {
    const entryPath = String(entry.path || "").replace(/\\/g, "/");

    if (!isAllowedEntry(entryPath)) continue;

    // Remapeia caminho legado docs/report/img → dados/report-img
    const resolvedPath = entryPath.startsWith("docs/report/img")
      ? entryPath.replace("docs/report/img", "dados/report-img")
      : entryPath;

    const destPath = path.join(process.cwd(), resolvedPath);

    if (entry.type === "Directory") {
      fs.mkdirSync(destPath, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    await new Promise((resolve, reject) => {
      entry.stream()
        .pipe(fs.createWriteStream(destPath))
        .on("finish", resolve)
        .on("error", reject);
    });

    await objectStorage.uploadLocalFile(
      objectStorage.normalizeKey(path.relative(process.cwd(), destPath)),
      destPath
    );

    extractedCount += 1;
  }

  return extractedCount;
}

async function run() {
  const manualFile = resolveZipFileFromArgs();
  const zipFile = manualFile || await findLatestAssetsBackup();

  // eslint-disable-next-line no-console
  console.log(`Restaurando assets de: ${path.basename(zipFile)}`);

  const extractedCount = await extractZip(zipFile);

  // eslint-disable-next-line no-console
  console.log(`\nRestore de assets concluido: ${extractedCount} arquivo(s) extraido(s).`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Falha no restore de assets:", err.message);
  process.exit(1);
});
