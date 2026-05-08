const fs = require("fs");
const path = require("path");
const env = require("../specflow/config/env");
const objectStorage = require("../specflow/services/objectStorage");

const ROOT_DIR = process.cwd();
const KEEP_BASENAMES = new Set([".gitkeep", ".keep"]);

const TARGET_DIRS = [
  {
    label: "docs (specflow)",
    dirPath: path.resolve(env.storage.docsDir),
    storagePrefix: "dados/docs"
  },
  {
    label: "service-report-pdfs",
    dirPath: path.join(ROOT_DIR, "dados", "service-report-pdfs"),
    storagePrefix: "dados/service-report-pdfs"
  },
  {
    label: "service-report-html",
    dirPath: path.join(ROOT_DIR, "dados", "service-report-html"),
    storagePrefix: "dados/service-report-html"
  },
  {
    label: "report img (dados/report-img)",
    dirPath: path.join(ROOT_DIR, "dados", "report-img"),
    storagePrefix: "dados/report-img"
  },
  {
    label: "order attachments (dados/order-attachments)",
    dirPath: path.join(ROOT_DIR, "dados", "order-attachments"),
    storagePrefix: "dados/order-attachments"
  }
];

function isInsideRoot(targetPath) {
  const relative = path.relative(ROOT_DIR, targetPath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function cleanDirectoryContents(dirPath) {
  if (!isInsideRoot(dirPath)) {
    throw new Error(`Destino fora do projeto bloqueado: ${dirPath}`);
  }

  fs.mkdirSync(dirPath, { recursive: true });
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let removedCount = 0;

  for (const entry of entries) {
    if (KEEP_BASENAMES.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    fs.rmSync(fullPath, { recursive: true, force: true });
    removedCount += 1;
  }

  return removedCount;
}

async function cleanStoragePrefix(prefix) {
  if (!objectStorage.isS3Enabled()) return 0;
  const keys = await objectStorage.listObjects(prefix);
  let removed = 0;
  for (const key of keys) {
    // eslint-disable-next-line no-await-in-loop
    await objectStorage.deleteObject(key);
    removed += 1;
  }
  return removed;
}

async function run() {
  let totalRemoved = 0;

  for (const target of TARGET_DIRS) {
    const removed = cleanDirectoryContents(target.dirPath);
    // eslint-disable-next-line no-await-in-loop
    const storageRemoved = await cleanStoragePrefix(target.storagePrefix);
    totalRemoved += removed + storageRemoved;
    // eslint-disable-next-line no-console
    console.log(`Limpo: ${target.label} -> ${target.dirPath} (${removed} local, ${storageRemoved} S3)`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nLimpeza de assets concluida. Total removido: ${totalRemoved} item(ns).`);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Falha na limpeza de assets:", err.message);
  process.exit(1);
});

