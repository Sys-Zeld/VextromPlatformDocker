const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const objectStorage = require("../specflow/services/objectStorage");

const ASSET_DIRS = [
  {
    label: "docs (specflow)",
    srcPath: path.join(process.cwd(), "dados", "docs"),
    zipFolder: "dados/docs"
  },
  {
    label: "service-report-pdfs",
    srcPath: path.join(process.cwd(), "dados", "service-report-pdfs"),
    zipFolder: "dados/service-report-pdfs"
  },
  {
    label: "service-report-html",
    srcPath: path.join(process.cwd(), "dados", "service-report-html"),
    zipFolder: "dados/service-report-html"
  },
  {
    label: "report img (imagens e logos)",
    srcPath: path.join(process.cwd(), "dados", "report-img"),
    zipFolder: "dados/report-img"
  },
  {
    label: "order attachments (arquivos das OS)",
    srcPath: path.join(process.cwd(), "dados", "order-attachments"),
    zipFolder: "dados/order-attachments"
  }
];

function buildOutputPath() {
  const backupDir = path.join(process.cwd(), "dados", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(backupDir, `assets-backup-${timestamp}.zip`);
}

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      count += 1;
    } else if (entry.isDirectory()) {
      count += countFiles(path.join(dirPath, entry.name));
    }
  }
  return count;
}

async function resolvePresentDirs() {
  const presentDirs = [];
  for (const dir of ASSET_DIRS) {
    // eslint-disable-next-line no-await-in-loop
    const objectKeys = await objectStorage.listObjects(dir.zipFolder);
    if (fs.existsSync(dir.srcPath) || objectKeys.length) {
      presentDirs.push({ ...dir, objectKeys });
    }
  }
  return presentDirs;
}

async function appendAssetDir(archive, dir) {
  const fileCount = Math.max(countFiles(dir.srcPath), dir.objectKeys.length);
  // eslint-disable-next-line no-console
  console.log(`Adicionando: ${dir.label} (${fileCount} arquivo(s)) -> ${dir.zipFolder}/`);

  if (!objectStorage.isS3Enabled()) {
    archive.directory(dir.srcPath, dir.zipFolder);
    return;
  }

  for (const key of dir.objectKeys) {
    // eslint-disable-next-line no-await-in-loop
    archive.append(await objectStorage.getObjectStream(key), { name: objectStorage.normalizeKey(key) });
  }
}

async function run() {
  const outputFile = buildOutputPath();

  const presentDirs = await resolvePresentDirs();
  const missingDirs = ASSET_DIRS.filter((dir) => !fs.existsSync(dir.srcPath));

  if (missingDirs.length) {
    missingDirs.forEach((dir) => {
      // eslint-disable-next-line no-console
      console.warn(`Aviso: pasta nao encontrada (sera ignorada se tambem nao existir no S3): ${dir.srcPath}`);
    });
  }

  if (!presentDirs.length) {
    throw new Error("Nenhuma pasta de assets encontrada para fazer backup.");
  }

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    (async () => {
      for (const dir of presentDirs) {
        // eslint-disable-next-line no-await-in-loop
        await appendAssetDir(archive, dir);
      }
      archive.finalize();
    })().catch(reject);
  });

  await objectStorage.uploadLocalFile(
    objectStorage.normalizeKey(path.relative(process.cwd(), outputFile)),
    outputFile,
    { contentType: "application/zip" }
  );

  const stat = fs.statSync(outputFile);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`\nBackup de assets concluido: ${outputFile}`);
  // eslint-disable-next-line no-console
  console.log(`Tamanho: ${sizeMb} MB`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Falha no backup de assets:", err.message);
  process.exit(1);
});
