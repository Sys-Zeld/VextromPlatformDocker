// Serviço HTTP de renderização de PDF via Puppeteer.
// Usado como container dedicado em dev (docker-compose.override.yml → puppeteer).
// O app envia o HTML + cache de imagens via POST /render-pdf e recebe o PDF pronto.

const http = require("http");
const puppeteer = require("puppeteer");

const PORT = Number(process.env.PUPPETEER_SERVER_PORT) || 4000;

let browserPromise = null;

function getBrowser() {
  if (browserPromise) return browserPromise;
  browserPromise = puppeteer
    .launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    })
    .then((browser) => {
      browser.on("disconnected", () => { browserPromise = null; });
      return browser;
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });
  return browserPromise;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

async function renderPdf(html, imageCache) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const reqUrl = request.url();
      const entry = imageCache && imageCache[reqUrl];
      if (entry) {
        request.respond({ status: 200, contentType: entry.mime, body: Buffer.from(entry.data, "base64") }).catch(() => {});
        return;
      }
      if (reqUrl.includes("fonts.googleapis.com") || reqUrl.includes("fonts.gstatic.com")) {
        request.continue().catch(() => {});
        return;
      }
      request.abort().catch(() => {});
    });

    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    if (typeof page.emulateMediaType === "function") await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "load" });

    await page.evaluate(async () => {
      const images = Array.from(document.images || []);
      await Promise.all(images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    await page.waitForFunction(() => window.__reportPaginationDone === true, { timeout: 10000 }).catch(() => {});

    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });
    return Buffer.from(buffer);
  } finally {
    await page.close().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && req.url === "/render-pdf") {
    try {
      const body = await readBody(req);
      const pdf = await renderPdf(body.html, body.imageCache || {});
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": String(pdf.length) });
      res.end(pdf);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Error: ${err.message}`);
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[puppeteer-server] HTTP on :${PORT}`);
  getBrowser()
    .then(() => console.log("[puppeteer-server] Browser ready"))
    .catch((err) => console.error(`[puppeteer-server] Browser startup error: ${err.message}`));
});
