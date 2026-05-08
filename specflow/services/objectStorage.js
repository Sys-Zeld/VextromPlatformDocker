const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command
} = require("@aws-sdk/client-s3");
const env = require("../config/env");

let s3Client = null;

function isS3Enabled() {
  return env.storage.driver === "s3";
}

function normalizeKey(key) {
  return String(key || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.(\/|$)/g, "")
    .trim();
}

function localPathForKey(key) {
  const normalized = normalizeKey(key);
  return path.join(process.cwd(), normalized);
}

function applyKeyPrefix(key) {
  const normalized = normalizeKey(key);
  const prefix = normalizeKey(env.storage.s3.keyPrefix);
  return prefix ? `${prefix}/${normalized}` : normalized;
}

function stripKeyPrefix(key) {
  const normalized = normalizeKey(key);
  const prefix = normalizeKey(env.storage.s3.keyPrefix);
  if (!prefix) return normalized;
  return normalized.startsWith(`${prefix}/`) ? normalized.slice(prefix.length + 1) : normalized;
}

function getS3Client() {
  if (!isS3Enabled()) return null;
  if (!env.storage.s3.bucket) {
    throw new Error("S3_BUCKET nao configurado para STORAGE_DRIVER=s3.");
  }
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: env.storage.s3.endpoint || undefined,
      region: env.storage.s3.region,
      forcePathStyle: env.storage.s3.forcePathStyle,
      credentials: env.storage.s3.accessKeyId && env.storage.s3.secretAccessKey
        ? {
          accessKeyId: env.storage.s3.accessKeyId,
          secretAccessKey: env.storage.s3.secretAccessKey
        }
        : undefined
    });
  }
  return s3Client;
}

async function streamToBuffer(stream) {
  if (Buffer.isBuffer(stream)) return stream;
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function putObject(key, buffer, options = {}) {
  const normalized = normalizeKey(key);
  if (!normalized) throw new Error("Chave de storage invalida.");
  const localPath = localPathForKey(normalized);
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  await fs.promises.writeFile(localPath, buffer);

  if (!isS3Enabled()) return { key: normalized, localPath };

  await getS3Client().send(new PutObjectCommand({
    Bucket: env.storage.s3.bucket,
    Key: applyKeyPrefix(normalized),
    Body: buffer,
    ContentType: options.contentType || "application/octet-stream",
    Metadata: options.metadata || undefined
  }));
  return { key: normalized, localPath };
}

async function uploadLocalFile(key, filePath, options = {}) {
  const buffer = await fs.promises.readFile(filePath);
  return putObject(key, buffer, options);
}

async function existsObject(key) {
  const normalized = normalizeKey(key);
  if (!normalized) return false;
  try {
    await fs.promises.access(localPathForKey(normalized), fs.constants.F_OK);
    return true;
  } catch (_err) {
    // fall through to S3
  }
  if (!isS3Enabled()) return false;
  try {
    await getS3Client().send(new HeadObjectCommand({
      Bucket: env.storage.s3.bucket,
      Key: applyKeyPrefix(normalized)
    }));
    return true;
  } catch (_err) {
    return false;
  }
}

async function getObjectBuffer(key) {
  const normalized = normalizeKey(key);
  const localPath = localPathForKey(normalized);
  try {
    return await fs.promises.readFile(localPath);
  } catch (_err) {
    if (!isS3Enabled()) throw _err;
  }

  const result = await getS3Client().send(new GetObjectCommand({
    Bucket: env.storage.s3.bucket,
    Key: applyKeyPrefix(normalized)
  }));
  const buffer = await streamToBuffer(result.Body);
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  await fs.promises.writeFile(localPath, buffer).catch(() => {});
  return buffer;
}

async function getObjectStream(key) {
  const normalized = normalizeKey(key);
  const localPath = localPathForKey(normalized);
  try {
    await fs.promises.access(localPath, fs.constants.F_OK);
    return fs.createReadStream(localPath);
  } catch (_err) {
    if (!isS3Enabled()) throw _err;
  }
  const result = await getS3Client().send(new GetObjectCommand({
    Bucket: env.storage.s3.bucket,
    Key: applyKeyPrefix(normalized)
  }));
  return result.Body instanceof Readable ? result.Body : Readable.from(result.Body);
}

async function ensureLocalFile(key) {
  const normalized = normalizeKey(key);
  const localPath = localPathForKey(normalized);
  try {
    await fs.promises.access(localPath, fs.constants.F_OK);
    return localPath;
  } catch (_err) {
    const buffer = await getObjectBuffer(normalized);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, buffer);
    return localPath;
  }
}

async function deleteObject(key) {
  const normalized = normalizeKey(key);
  const localPath = localPathForKey(normalized);
  await fs.promises.unlink(localPath).catch(() => {});
  if (!isS3Enabled()) return;
  await getS3Client().send(new DeleteObjectCommand({
    Bucket: env.storage.s3.bucket,
    Key: applyKeyPrefix(normalized)
  })).catch(() => {});
}

async function listObjects(prefix) {
  const normalizedPrefix = normalizeKey(prefix);
  const keys = new Set();
  const localRoot = localPathForKey(normalizedPrefix);

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (_err) {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        keys.add(normalizeKey(path.relative(process.cwd(), absolute)));
      }
    }
  }
  await walk(localRoot);

  if (isS3Enabled()) {
    let continuationToken;
    do {
      const result = await getS3Client().send(new ListObjectsV2Command({
        Bucket: env.storage.s3.bucket,
        Prefix: applyKeyPrefix(normalizedPrefix),
        ContinuationToken: continuationToken
      }));
      (result.Contents || []).forEach((item) => {
        if (item.Key) keys.add(stripKeyPrefix(item.Key));
      });
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return [...keys].sort();
}

async function sendObjectDownload(res, key, fileName, contentType) {
  const stream = await getObjectStream(key);
  if (contentType) res.setHeader("Content-Type", contentType);
  if (fileName) {
    const safeName = String(fileName).replace(/["\r\n]/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  }
  return stream.pipe(res);
}

module.exports = {
  isS3Enabled,
  normalizeKey,
  localPathForKey,
  putObject,
  uploadLocalFile,
  existsObject,
  getObjectBuffer,
  getObjectStream,
  ensureLocalFile,
  deleteObject,
  listObjects,
  sendObjectDownload
};
