/**
 * Verifica se o conteúdo de alguma página invade a faixa do rodapé no PDF.
 *
 * Replica o MESMO pipeline usado por serviceReportPdfService ao gerar o PDF:
 * monta o HTML do relatório, injeta report-preview.css + report-print.css +
 * report-pagination.js, carrega com setContent sob mídia `print` e dispara a
 * paginação. Em vez de emitir o PDF, mede no DOM final qual elemento cruza o
 * topo do rodapé — que é exatamente o defeito visível no PDF.
 *
 * Uso:  node scripts/check-report-footer-overlap.js <orderId> [templateKey]
 * Sai com código 1 se houver invasão (serve como teste de regressão).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const service = require("../report_service/src/services/serviceReportService");
const { renderReportPreviewHtml, normalizeReportTemplateKey } = require("../report_service/src/services/reportTemplateService");
const { getReportConfigSettings } = require("../report_service/src/services/reportConfigSettings");

const ORDER_ID = Number(process.argv[2] || 69);
const TEMPLATE_KEY = normalizeReportTemplateKey(process.argv[3] || "modern");

function readAsset(...parts) {
  return fs.readFileSync(path.resolve(__dirname, "..", ...parts), "utf8");
}

// Espelha o head montado em buildPdfBufferFromHtmlWithPuppeteer: a composição
// de CSS aqui é o que diferencia este caminho do preview servido por rota.
function buildFullHtml(reportHtml) {
  const cssPreview = readAsset("specflow", "public", "css", "report-preview.css");
  const cssPrint = readAsset("specflow", "public", "css", "report-print.css");
  const paginationJs = readAsset("specflow", "public", "js", "report-pagination.js");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>${cssPreview}</style>
  <style>${cssPrint}</style>
  <style>body,html{font-family:"Inter","Segoe UI",Tahoma,sans-serif;}</style>
</head>
<body>
${reportHtml}
<script>${paginationJs}</script>
</body>
</html>`;
}

function measureOverlaps() {
  const pages = Array.from(document.querySelectorAll(".report-page"));
  const findings = [];
  // Diagnóstico: página sem .report-footer seria pulada em silêncio, o que
  // produziria um "OK" falso. Precisa aparecer no relatório.
  const diagnostics = { pagesWithFooter: 0, pagesWithoutFooter: [], footerClasses: {} };

  pages.forEach((pageEl, index) => {
    const footer = pageEl.querySelector(".report-footer");
    if (!footer) {
      diagnostics.pagesWithoutFooter.push(index + 1);
      return;
    }
    diagnostics.pagesWithFooter += 1;
    const inner = footer.firstElementChild;
    const key = inner ? String(inner.className || "(sem classe)").slice(0, 40) : "(vazio)";
    diagnostics.footerClasses[key] = (diagnostics.footerClasses[key] || 0) + 1;
    const footerTop = footer.getBoundingClientRect().top;

    // Só o conteúdo do fluxo interessa; topbar e o próprio rodapé são fixos.
    const scopes = [pageEl.querySelector(".rich-output"), pageEl.querySelector(".report-section-title-rich")];
    let worst = null;

    scopes.filter(Boolean).forEach((scope) => {
      Array.from(scope.querySelectorAll("*")).forEach((el) => {
        if (!el.getClientRects().length) return;
        // Ignora quem só é alto por conter filhos: reporta o nó folha.
        if (el.children.length > 0) return;
        const overlap = el.getBoundingClientRect().bottom - footerTop;
        if (overlap <= 1) return;
        if (!worst || overlap > worst.overlapPx) {
          worst = {
            page: index + 1,
            overlapPx: Math.round(overlap),
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || "").slice(0, 70),
            text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 70)
          };
        }
      });
    });

    if (worst) findings.push(worst);
  });

  return { totalPages: pages.length, findings, diagnostics };
}

(async () => {
  const report = await service.ensureReportForOrder(ORDER_ID);
  const payload = await service.buildReportAggregate(report.id);
  if (!payload) throw new Error(`Relatorio da OS ${ORDER_ID} nao encontrado.`);

  // O rodapé vem do Config Report. Sem passar o reportConfig real, o template
  // não renderiza .report-footer e a verificação vira um falso "OK".
  const reportConfig = await getReportConfigSettings();
  const reportHtml = await renderReportPreviewHtml(payload, { reportConfig, templateKey: TEMPLATE_KEY });
  const fullHtml = buildFullHtml(reportHtml);

  const puppeteer = require("puppeteer");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    // A paginação precisa rodar com a mesma mídia do page.pdf().
    await page.emulateMediaType("print");
    await page.setContent(fullHtml, { waitUntil: "load" });

    await page.evaluate(async () => {
      const images = Array.from(document.images || []);
      await Promise.all(images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      }))));
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    });
    await page.evaluate(() => {
      window.__reportPaginationDone = false;
      window.dispatchEvent(new Event("resize"));
    });
    await page.waitForFunction(() => window.__reportPaginationDone === true, { timeout: 30000 });
    await page.evaluate(() => {
      document.documentElement.classList.remove("report-paginating");
      const doc = document.querySelector(".report-doc");
      if (doc) { doc.style.transition = "none"; doc.style.opacity = "1"; }
    });

    const result = await page.evaluate(measureOverlaps);
    console.log(`OS ${ORDER_ID} | template ${TEMPLATE_KEY} | ${result.totalPages} pagina(s)`);
    console.log(`  paginas com rodape: ${result.diagnostics.pagesWithFooter} | sem rodape: ${result.diagnostics.pagesWithoutFooter.join(", ") || "nenhuma"}`);
    console.log(`  tipos de rodape: ${JSON.stringify(result.diagnostics.footerClasses)}`);
    if (!result.findings.length) {
      console.log("OK - nenhum conteudo invade o rodape.");
      process.exit(0);
    }
    console.log(`FALHA - ${result.findings.length} pagina(s) com conteudo sobre o rodape:`);
    result.findings
      .sort((a, b) => b.overlapPx - a.overlapPx)
      .forEach((f) => console.log(`  pag ${String(f.page).padStart(2)}: +${f.overlapPx}px  <${f.tag} class="${f.cls}">  "${f.text}"`));
    process.exit(1);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error("ERRO:", err.message);
  process.exit(2);
});
