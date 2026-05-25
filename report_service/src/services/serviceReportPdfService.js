const fs = require("fs");
const PDFDocument = require("pdfkit");
const { formatServiceOrderDisplay } = require("../utils/serviceOrderDisplay");
const env = require("../../../specflow/config/env");
const path = require("path");
const os = require("os");
const objectStorage = require("../../../specflow/services/objectStorage");

function getPlaywrightOrNull() {
  try {
    // optional dependency in some environments
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require("playwright");
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND") return null;
    throw err;
  }
}

function getPuppeteerOrNull() {
  try {
    // optional dependency in some environments
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require("puppeteer");
  } catch (err) {
    if (err && err.code === "MODULE_NOT_FOUND") return null;
    throw err;
  }
}

function launchBrowser(playwright) {
  const chromium = playwright && playwright.chromium;
  if (!chromium) {
    const err = new Error("Playwright chromium nao esta disponivel.");
    err.code = "PLAYWRIGHT_CHROMIUM_UNAVAILABLE";
    throw err;
  }
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  return chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}

function drawTitle(doc, text) {
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#111").text(text || "-", { underline: false });
  doc.moveDown(0.4);
}

function drawLine(doc, label, value) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#222")
    .text(`${label}: `, { continued: true })
    .font("Helvetica")
    .text(String(value || "-"));
}

function drawSection(doc, title, content) {
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1f1f1f").text(title || "-");
  doc.moveDown(0.25);
  doc.font("Helvetica").fontSize(10).fillColor("#2a2a2a").text(String(content || "-"), {
    lineGap: 2
  });
}

function drawTable(doc, headers, rows) {
  const startX = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = Math.max(100, Math.floor(contentWidth / headers.length));
  const rowHeight = 20;

  function row(cells, header = false) {
    let x = startX;
    const y = doc.y;
    for (let index = 0; index < headers.length; index += 1) {
      const text = String(cells[index] || "-");
      doc.save();
      if (header) {
        doc.fillColor("#e7edf5").rect(x, y, colWidth, rowHeight).fill();
      }
      doc.strokeColor("#b7c2cf").rect(x, y, colWidth, rowHeight).stroke();
      doc.restore();
      doc
        .font(header ? "Helvetica-Bold" : "Helvetica")
        .fontSize(9)
        .fillColor("#1f1f1f")
        .text(text, x + 5, y + 6, { width: colWidth - 10, height: rowHeight - 6 });
      x += colWidth;
    }
    doc.y += rowHeight;
  }

  row(headers, true);
  (Array.isArray(rows) ? rows : []).forEach((cells) => row(cells, false));
}

function buildPdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const report = payload.report || {};
    const order = payload.order || {};
    const customer = payload.customer || {};
    const site = payload.site || {};

    drawTitle(doc, report.title || "Service Report");
    drawLine(doc, "Report Number", report.report_number);
    drawLine(doc, "Revision", report.revision);
    drawLine(doc, "Status", report.status);
    drawLine(doc, "Service Order", formatServiceOrderDisplay(order.service_order_code, order.year));
    drawLine(doc, "Customer", customer.name);
    drawLine(doc, "Site", site.site_name);
    drawLine(doc, "Issue Date", report.issue_date);
    drawLine(doc, "Last Modified", report.last_modified_at);

    drawTable(
      doc,
      ["Campo", "Valor"],
      [
        ["Prepared By", report.prepared_by],
        ["Reviewed By", report.reviewed_by],
        ["Approved By", report.approved_by]
      ]
    );

    const sections = Array.isArray(payload.sections) ? payload.sections : [];
    sections.forEach((section) => {
      const rawHtml = String(section.content_html || "");
      const normalizedText = rawHtml
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      drawSection(doc, section.section_title, normalizedText || "-");
    });

    doc.addPage();
    drawTitle(doc, "Timesheet Diario");
    drawTable(
      doc,
      ["Data", "Tecnico", "Entrada Cliente", "Saida Cliente"],
      (payload.timesheet || []).map((item) => [
        item.activity_date,
        item.technician_name,
        item.check_in_client,
        item.check_out_client
      ])
    );

    drawSection(doc, "Descricao do Atendimento Tecnico", "");
    (payload.dailyLogs || []).forEach((item) => {
      const dailyLogContent = item.content ? htmlToPlainText(item.content) : "";
      drawSection(doc, `${item.activity_date} ${item.title || ""}`.trim(), dailyLogContent || item.notes || "-");
    });

    drawSection(doc, "Componentes", "");
    drawTable(
      doc,
      ["Categoria", "Descricao", "Part Number", "Qtd"],
      (payload.components || []).map((item) => [
        item.category,
        item.description,
        item.part_number,
        item.quantity
      ])
    );

    drawSection(doc, "Assinaturas", "");
    drawTable(
      doc,
      ["Tipo", "Nome", "Cargo", "Empresa"],
      (payload.signatures || []).map((item) => [
        item.signer_type,
        item.signer_name,
        item.signer_role,
        item.signer_company
      ])
    );

    doc.end();
  });
}

function htmlToPlainText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Pixels acima deste limite disparam a compressão
const IMAGE_COMPRESS_THRESHOLD_PX = 1200;
// Largura máxima após redimensionamento (mantém proporção)
const IMAGE_MAX_WIDTH_PX = 1200;

function getSharpOrNull() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require("sharp");
  } catch (_) {
    return null;
  }
}

async function compressImageBuffer(buffer, ext) {
  const sharp = getSharpOrNull();
  if (!sharp) return { buffer, mime: ext === "png" ? "image/png" : "image/jpeg" };

  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;

    if (w <= IMAGE_COMPRESS_THRESHOLD_PX && h <= IMAGE_COMPRESS_THRESHOLD_PX) {
      // Imagem pequena — retorna original sem reprocessar
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      return { buffer, mime };
    }

    // Redimensiona e comprime
    const pipeline = img.resize({ width: IMAGE_MAX_WIDTH_PX, withoutEnlargement: true });
    let outBuffer;
    let mime;
    if (ext === "png") {
      outBuffer = await pipeline.png({ compressionLevel: 8, adaptiveFiltering: true }).toBuffer();
      mime = "image/png";
    } else {
      outBuffer = await pipeline.jpeg({ quality: 75, mozjpeg: true }).toBuffer();
      mime = "image/jpeg";
    }
    return { buffer: outBuffer, mime };
  } catch (_) {
    return { buffer, mime: ext === "png" ? "image/png" : "image/jpeg" };
  }
}

const IMG_MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml" };
let previewStaticAssetsPromise = null;
let sharedBrowserPromise = null;
let sharedPuppeteerBrowserPromise = null;
let activePdfJobs = 0;
const pdfQueue = [];
const REPORT_PDF_RENDERER = String(process.env.REPORT_PDF_RENDERER || "playwright").trim().toLowerCase();
const DEFAULT_PDF_CONCURRENCY = Math.max(1, Math.min(4, Number.parseInt(process.env.REPORT_PDF_CONCURRENCY || "", 10) || Math.ceil((os.cpus() || []).length / 2) || 2));
const IMAGE_PRELOAD_CONCURRENCY = Math.max(1, Number.parseInt(process.env.REPORT_PDF_IMAGE_PRELOAD_CONCURRENCY || "4", 10) || 4);
let warnedPlaywrightMissingRuntime = false;
let warnedPuppeteerMissingRuntime = false;

function buildImageRouteMap() {
  return [
    { prefix: "/docs/report/img/", dir: path.join(process.cwd(), "dados", "report-img") },
    { prefix: "/public/", dir: path.resolve(__dirname, "..", "..", "..", "specflow", "public") }
  ];
}

async function resolveImageFromPath(urlPath) {
  const routeMap = buildImageRouteMap();
  for (const route of routeMap) {
    if (urlPath.startsWith(route.prefix)) {
      const rel = decodeURIComponent(urlPath.slice(route.prefix.length));
      const filePath = path.join(route.dir, rel);
      const key = objectStorage.normalizeKey(path.relative(process.cwd(), filePath));
      if (!await objectStorage.existsObject(key)) return null;
      const ext = path.extname(filePath).replace(".", "").toLowerCase();
      const mime = IMG_MIME[ext];
      if (!mime) return null;
      const raw = await objectStorage.getObjectBuffer(key);
      if (ext === "svg") return { body: raw, mime };
      const compressExt = ext === "png" ? "png" : "jpeg";
      const { buffer, mime: outMime } = await compressImageBuffer(raw, compressExt);
      return { body: buffer, mime: outMime };
    }
  }
  return null;
}

// Pré-carrega e comprime todas as imagens referenciadas no HTML.
// Retorna um Map de URL-absoluta -> { body, mime } para uso síncrono no handler.
async function preloadImageCache(html, baseUrl) {
  const srcRegex = /src=(["'])([^"']+)\1/gi;
  const paths = new Set();
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = srcRegex.exec(html)) !== null) {
    const src = m[2];
    if (/^data:/i.test(src) || /^https?:\/\//i.test(src)) continue;
    if (src.startsWith("/")) paths.add(src);
  }

  const cache = new Map();
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const pathList = [...paths];
  let cursor = 0;
  async function worker() {
    while (cursor < pathList.length) {
      const index = cursor;
      cursor += 1;
      const urlPath = pathList[index];
      // eslint-disable-next-line no-await-in-loop
      const result = await resolveImageFromPath(urlPath);
      if (result) cache.set(base + urlPath, result);
    }
  }
  const workers = [];
  const workerCount = Math.min(IMAGE_PRELOAD_CONCURRENCY, pathList.length || 1);
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return cache;
}

async function loadPreviewStaticAssets() {
  if (!previewStaticAssetsPromise) {
    previewStaticAssetsPromise = Promise.all([
      fs.promises.readFile(path.resolve(__dirname, "..", "..", "..", "specflow", "public", "css", "report-preview.css"), "utf8"),
      fs.promises.readFile(path.resolve(__dirname, "..", "..", "..", "specflow", "public", "css", "report-print.css"), "utf8"),
      fs.promises.readFile(path.resolve(__dirname, "..", "..", "..", "specflow", "public", "js", "report-pagination.js"), "utf8")
    ]).then(([cssPreview, cssPrint, paginationJs]) => ({ cssPreview, cssPrint, paginationJs }))
      .catch((err) => {
        previewStaticAssetsPromise = null;
        throw err;
      });
  }
  return previewStaticAssetsPromise;
}

async function acquirePdfRenderSlot() {
  if (activePdfJobs < DEFAULT_PDF_CONCURRENCY) {
    activePdfJobs += 1;
    return;
  }
  await new Promise((resolve) => pdfQueue.push(resolve));
  activePdfJobs += 1;
}

function releasePdfRenderSlot() {
  activePdfJobs = Math.max(0, activePdfJobs - 1);
  const next = pdfQueue.shift();
  if (typeof next === "function") next();
}

async function withPdfRenderSlot(task) {
  await acquirePdfRenderSlot();
  try {
    return await task();
  } finally {
    releasePdfRenderSlot();
  }
}

async function getSharedBrowser(playwright) {
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = launchBrowser(playwright)
      .then((browser) => {
        browser.on("disconnected", () => {
          sharedBrowserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        sharedBrowserPromise = null;
        throw err;
      });
  }
  return sharedBrowserPromise;
}

async function getSharedPuppeteerBrowser(puppeteer) {
  if (!sharedPuppeteerBrowserPromise) {
    sharedPuppeteerBrowserPromise = launchPuppeteerBrowser(puppeteer)
      .then((browser) => {
        browser.on("disconnected", () => {
          sharedPuppeteerBrowserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        sharedPuppeteerBrowserPromise = null;
        throw err;
      });
  }
  return sharedPuppeteerBrowserPromise;
}

async function createPdfPage(playwright) {
  const browser = await getSharedBrowser(playwright);
  return browser.newPage();
}

async function createPuppeteerPdfPage(puppeteer) {
  const browser = await getSharedPuppeteerBrowser(puppeteer);
  return browser.newPage();
}

async function withPdfPage(playwright, task) {
  return withPdfRenderSlot(async () => {
    const page = await createPdfPage(playwright);
    try {
      return await task(page);
    } finally {
      await page.close().catch(() => {});
    }
  });
}

function isPlaywrightRuntimeMissingError(err) {
  const text = String((err && err.message) || "").toLowerCase();
  return text.includes("executable doesn't exist")
    || text.includes("playwright install")
    || text.includes("chrome-headless-shell");
}

function isPuppeteerRuntimeMissingError(err) {
  const text = String((err && err.message) || "").toLowerCase();
  return text.includes("could not find chrome")
    || text.includes("browser was not found")
    || text.includes("failed to launch the browser process")
    || text.includes("no usable sandbox")
    || text.includes("chrome");
}

function warnPlaywrightFallback(err) {
  if (warnedPlaywrightMissingRuntime) return;
  warnedPlaywrightMissingRuntime = true;
  const msg = err && err.message ? err.message : "Playwright runtime indisponivel.";
  // eslint-disable-next-line no-console
  console.warn(`[report-service] Playwright indisponivel, fallback para PDFKit: ${msg}`);
}

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

function htmlToPdfKitText(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|tr|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<td[^>]*>/gi, " ")
      .replace(/<\/td>/gi, " ")
      .replace(/<th[^>]*>/gi, " ")
      .replace(/<\/th>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const report = fallbackPayload && fallbackPayload.report ? fallbackPayload.report : {};
    drawTitle(doc, report.title || "Service Report");
    drawLine(doc, "Report Number", report.report_number);
    drawLine(doc, "Revision", report.revision);
    drawLine(doc, "Status", report.status);
    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#444").text("Preview HTML (renderer: PDFKit)");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9).fillColor("#222");
    doc.text(htmlToPdfKitText(html) || "-", {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 2
    });
    doc.end();
  });
}

async function buildPdfBufferFromHtmlWithPuppeteer(html, fallbackPayload = {}) {
  const puppeteer = getPuppeteerOrNull();
  if (!puppeteer) {
    return buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload || {});
  }

  const { cssPreview, cssPrint, paginationJs } = await loadPreviewStaticAssets();
  const appBaseUrl = String(env.appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const imageCache = await preloadImageCache(html, appBaseUrl);

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=960, initial-scale=1.0" />
  <base href="${appBaseUrl}/" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
  <style>${cssPreview}</style>
  <style>${cssPrint}</style>
  <style>body,html{font-family:"Inter","Segoe UI",Tahoma,sans-serif;}</style>
</head>
<body>
${html}
<script>${paginationJs}</script>
</body>
</html>`;

  if (process.env.PUPPETEER_SERVER_URL) {
    try {
      return await renderPdfViaServer(fullHtml, imageCache);
    } catch (err) {
      if (isPuppeteerRuntimeMissingError(err)) {
        warnPuppeteerFallback(err);
        return buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload || {});
      }
      throw err;
    }
  }

  try {
    return await withPuppeteerPdfPage(puppeteer, async (page) => {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const reqUrl = request.url();
        const cached = imageCache.get(reqUrl);
        if (cached) {
          request.respond({ status: 200, contentType: cached.mime, body: cached.body }).catch(() => {});
          return;
        }
        if (reqUrl.includes("fonts.googleapis.com") || reqUrl.includes("fonts.gstatic.com")) {
          request.continue().catch(() => {});
          return;
        }
        request.abort().catch(() => {});
      });

      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
      if (typeof page.emulateMediaType === "function") {
        await page.emulateMediaType("print");
      }
      await page.setContent(fullHtml, { waitUntil: "load" });

      await page.evaluate(async () => {
        const images = Array.from(document.images || []);
        await Promise.all(images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          });
        }));
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });
      await page.evaluate(() => {
        window.__reportPaginationDone = false;
        window.dispatchEvent(new Event("resize"));
      });
      await page.waitForFunction(() => window.__reportPaginationDone === true, { timeout: 10000 }).catch(() => {});
      await page.evaluate(() => {
        document.documentElement.classList.remove("report-paginating");
        const doc = document.querySelector(".report-doc");
        if (doc) { doc.style.transition = "none"; doc.style.opacity = "1"; }
      });

      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        preferCSSPageSize: true
      });
      return Buffer.from(buffer);
    });
  } catch (err) {
    if (isPuppeteerRuntimeMissingError(err)) {
      warnPuppeteerFallback(err);
      return buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload || {});
    }
    throw err;
  }
}

async function buildPdfBufferFromHtml(html, fallbackPayload) {
  if (REPORT_PDF_RENDERER === "pdfkit") {
    return buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload || {});
  }
  if (REPORT_PDF_RENDERER === "puppeteer") {
    return buildPdfBufferFromHtmlWithPuppeteer(html, fallbackPayload || {});
  }

  const playwright = getPlaywrightOrNull();
  if (!playwright) {
    return buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload || {});
  }
  const { cssPreview, cssPrint, paginationJs } = await loadPreviewStaticAssets();

  // Base URL fictícia — só usada internamente para que o Puppeteer resolva as URLs das imagens
  const appBaseUrl = String(env.appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");

  // Pré-carrega imagens ANTES de abrir o browser (handler síncrono)
  const imageCache = await preloadImageCache(html, appBaseUrl);

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=960, initial-scale=1.0" />
  <base href="${appBaseUrl}/" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet">
  <style>${cssPreview}</style>
  <style>${cssPrint}</style>
  <style>body,html{font-family:"Inter","Segoe UI",Tahoma,sans-serif;}</style>
</head>
<body>
${html}
<script>${paginationJs}</script>
</body>
</html>`;

  try {
    return await withPdfPage(playwright, async (page) => {

      await page.route("**/*", (route) => {
        const reqUrl = route.request().url();
        const cached = imageCache.get(reqUrl);
        if (cached) {
          return route.fulfill({ status: 200, contentType: cached.mime, body: cached.body });
        }
        if (reqUrl.includes("fonts.googleapis.com") || reqUrl.includes("fonts.gstatic.com")) {
          return route.continue();
        }
        return route.abort();
      });

      await page.setViewportSize({ width: 1240, height: 1754 });
      await page.setContent(fullHtml, { waitUntil: "load" });

      // Aguarda todas as imagens carregarem (ou falharem) + fonts + paginação
      await page.evaluate(async () => {
        const images = Array.from(document.images || []);
        await Promise.all(images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          });
        }));
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });
      await page.evaluate(() => {
        window.__reportPaginationDone = false;
        window.dispatchEvent(new Event("resize"));
      });
      await page.waitForFunction(() => window.__reportPaginationDone === true, { timeout: 10000 }).catch(() => {});
      await page.evaluate(() => {
        document.documentElement.classList.remove("report-paginating");
        const doc = document.querySelector(".report-doc");
        if (doc) { doc.style.transition = "none"; doc.style.opacity = "1"; }
      });

      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      return Buffer.from(buffer);
    });
  } catch (err) {
    if (isPlaywrightRuntimeMissingError(err)) {
      warnPlaywrightFallback(err);
      return buildPdfBufferFromHtmlWithPdfKit(html, fallbackPayload || {});
    }
    throw err;
  }
}

async function buildPdfBufferFromUrl(url, options = {}) {
  const playwright = getPlaywrightOrNull();
  if (!playwright) {
    const err = new Error("Playwright nao esta instalado no ambiente.");
    err.code = "PLAYWRIGHT_MISSING";
    throw err;
  }
  const targetUrl = String(url || "").trim();
  if (!targetUrl) {
    throw new Error("URL invalida para gerar PDF.");
  }

  const cookieHeader = String(options.cookieHeader || "").trim();

  return withPdfPage(playwright, async (page) => {
    await page.setViewportSize({
      width: 1240,
      height: 1754
    });
    if (cookieHeader) {
      await page.context().setExtraHTTPHeaders({ Cookie: cookieHeader });
    }
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      const images = Array.from(document.images || []);
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }));
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });
    await page.evaluate(() => {
      window.__reportPaginationDone = false;
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForFunction(() => window.__reportPaginationDone === true, { timeout: 10000 }).catch(() => {});
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(buffer);
  });
}

async function generatePdfToFile(payload, outputPath, htmlSource = "") {
  const buffer = htmlSource
    ? await buildPdfBufferFromHtml(htmlSource, payload)
    : await buildPdfBuffer(payload);
  await objectStorage.putObject(objectStorage.normalizeKey(path.relative(process.cwd(), outputPath)), buffer, {
    contentType: "application/pdf"
  });
  return outputPath;
}

function warnPuppeteerFallback(err) {
  if (warnedPuppeteerMissingRuntime) return;
  warnedPuppeteerMissingRuntime = true;
  const msg = err && err.message ? err.message : "Puppeteer runtime indisponivel.";
  // eslint-disable-next-line no-console
  console.warn(`[report-service] Puppeteer indisponivel, fallback para PDFKit: ${msg}`);
}

async function withPuppeteerPdfPage(puppeteer, task) {
  return withPdfRenderSlot(async () => {
    const page = await createPuppeteerPdfPage(puppeteer);
    try {
      return await task(page);
    } finally {
      await page.close().catch(() => {});
    }
  });
}

function resolveBrowserArgs(defaultArgs = []) {
  const raw = String(process.env.REPORT_PDF_BROWSER_ARGS || "").trim();
  if (!raw) return defaultArgs;
  return raw.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function launchPuppeteerBrowser(puppeteer) {
  if (!puppeteer || typeof puppeteer.launch !== "function") {
    const err = new Error("Puppeteer nao esta disponivel.");
    err.code = "PUPPETEER_UNAVAILABLE";
    throw err;
  }
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || undefined;
  return puppeteer.launch({
    headless: "new",
    executablePath,
    args: resolveBrowserArgs(["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]),
  });
}

async function renderPdfViaServer(fullHtml, imageCache) {
  const serverUrl = String(process.env.PUPPETEER_SERVER_URL || "").replace(/\/+$/, "");
  const imageCacheObj = {};
  imageCache.forEach(({ body, mime }, url) => {
    imageCacheObj[url] = { mime, data: body.toString("base64") };
  });
  const payload = JSON.stringify({ html: fullHtml, imageCache: imageCacheObj });
  const res = await fetch(`${serverUrl}/render-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`puppeteer-server ${res.status}: ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function buildAnalyticsPdfBufferFromHtml(html) {
  const playwright = getPlaywrightOrNull();
  if (!playwright) {
    throw new Error("Playwright nao esta instalado. Instale playwright para gerar o PDF do dashboard.");
  }
  return withPdfPage(playwright, async (page) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setContent(html, { waitUntil: "networkidle" });
    // Wait for Chart.js to finish rendering all canvases
    await page.waitForFunction(() => window.__analyticsPdfReady === true, { timeout: 15000 }).catch(() => {});
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "12mm", bottom: "14mm", left: "12mm" }
    });
    return Buffer.from(buffer);
  });
}

module.exports = {
  buildPdfBuffer,
  buildPdfBufferFromHtml,
  buildPdfBufferFromUrl,
  buildAnalyticsPdfBufferFromHtml,
  generatePdfToFile
};
