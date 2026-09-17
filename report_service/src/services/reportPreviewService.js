const path = require("path");
const { SECTION_DEFINITIONS } = require("../constants");
const sanitizeHtml = require("sanitize-html");
const { withServiceOrderDisplay } = require("../utils/serviceOrderDisplay");

const REPORT_UI_LABELS = {
  pt: {
    metadata: "METADADOS",
    preparedBy: "Executado por",
    revision: "Revisao",
    lastRevision: "Ultima revisao",
    os: "OS",
    updatedAt: "Atualizado em",
    toc: "SUMARIO",
    tocEmpty: "Sem capitulos.",
    signatures: "ASSINATURAS",
    signatureAlt: "Assinatura",
    continuation: "",
    chapter: "CAPITULO",
    image: "Imagem",
    customer: "Cliente",
    site: "Site",
    reportLabel: "Relatorio",
    rev: "Rev.",
    logoPlaceholder: "Espaco para logo",
    dateLocale: "pt-BR"
  },
  en: {
    metadata: "METADATA",
    preparedBy: "Prepared by",
    revision: "Revision",
    lastRevision: "Last revision",
    os: "Work Order",
    updatedAt: "Updated at",
    toc: "TABLE OF CONTENTS",
    tocEmpty: "No chapters.",
    signatures: "SIGNATURES",
    signatureAlt: "Signature",
    continuation: "",
    chapter: "CHAPTER",
    image: "Image",
    customer: "Client",
    site: "Site",
    reportLabel: "Report",
    rev: "Rev.",
    logoPlaceholder: "Logo space",
    dateLocale: "en-US"
  },
  es: {
    metadata: "METADATOS",
    preparedBy: "Ejecutado por",
    revision: "Revision",
    lastRevision: "Ultima revision",
    os: "Orden de Servicio",
    updatedAt: "Actualizado en",
    toc: "SUMARIO",
    tocEmpty: "Sin capitulos.",
    signatures: "FIRMAS",
    signatureAlt: "Firma",
    continuation: "",
    chapter: "CAPITULO",
    image: "Imagen",
    customer: "Cliente",
    site: "Site",
    reportLabel: "Informe",
    rev: "Rev.",
    logoPlaceholder: "Espacio para logo",
    dateLocale: "es-ES"
  },
  fr: {
    metadata: "METADONNEES",
    preparedBy: "Execute par",
    revision: "Revision",
    lastRevision: "Derniere revision",
    os: "Ordre de service",
    updatedAt: "Mis a jour le",
    toc: "SOMMAIRE",
    tocEmpty: "Pas de chapitres.",
    signatures: "SIGNATURES",
    signatureAlt: "Signature",
    continuation: "",
    chapter: "CHAPITRE",
    image: "Image",
    customer: "Client",
    site: "Site",
    reportLabel: "Rapport",
    rev: "Rev.",
    logoPlaceholder: "Espace logo",
    dateLocale: "fr-FR"
  }
};

function getSectionContent(sections, key) {
  const section = (sections || []).find((item) => item.section_key === key);
  const isVisible = section?.is_visible !== false;
  return {
    title: section?.section_title || SECTION_DEFINITIONS.find((item) => item.key === key)?.title || key,
    html: isVisible ? section?.content_html || "" : "",
    text: isVisible ? section?.content_text || "" : "",
    isVisible
  };
}

function groupComponents(items) {
  const groups = {
    replaced: [],
    required: [],
    spare_recommended: []
  };
  (items || []).forEach((item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });
  return groups;
}

function normalizeTocTitle(section) {
  const fallback = SECTION_DEFINITIONS.find((d) => d.key === section?.section_key)?.title || section?.section_key || "-";
  const titleHtml = String(section?.section_title_html || "").trim();
  if (titleHtml) {
    const withLineBreaks = titleHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<\/div>\s*<div[^>]*>/gi, "\n");
    const plain = sanitizeHtml(withLineBreaks, { allowedTags: [], allowedAttributes: {} });
    const firstLine = plain
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (firstLine) return firstLine;
  }

  const raw = section?.section_title_text || section?.section_title || fallback;
  const normalized = String(raw || fallback).replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

const TOC_INLINE_TAGS = ["strong", "b", "em", "i", "u", "s", "strike", "span", "mark", "sup", "sub"];

function tocTitleHtml(section) {
  const raw = String(section?.section_title_html_preview || section?.section_title_html || "").trim();
  if (!raw) return escapeHtml(normalizeTocTitle(section));
  const firstBlock = raw
    .split(/<\/p>|<\/div>|<br\s*\/?>/i)[0]
    .replace(/<p[^>]*>|<div[^>]*>/gi, "");
  return sanitizeHtml(firstBlock, {
    allowedTags: TOC_INLINE_TAGS,
    allowedAttributes: { span: ["style", "class"], mark: ["style", "class"] }
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeHtmlEntities(str) {
  return String(str == null ? "" : str)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'");
}

function safeText(value) {
  return escapeHtml(decodeHtmlEntities(value));
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toImagePublicSrc(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";
  if (/^data:image\//i.test(raw)) return raw;
  const normalized = raw.replace(/\\/g, "/");
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const fileName = path.posix.basename(normalized);
  if (!fileName || fileName === "." || fileName === "/") return "";
  return `/docs/report/img/${encodeURIComponent(fileName)}`;
}

function renderInlineImageCard(image, requestedId = null, imageLabel = "Imagem") {
  const fallbackCaption = requestedId ? `${imageLabel} ${requestedId}` : imageLabel;
  const captionText = stripHtml((image && image.caption) || "") || fallbackCaption;
  const captionHtml = escapeHtml(captionText);
  const captionAlt = escapeHtml(stripHtml((image && image.caption) || "") || fallbackCaption);
  const publicSrc = toImagePublicSrc(image && image.filePath);
  if (!publicSrc) {
    return `<figure class="report-inline-image-card"><div class="report-inline-image-missing">${escapeHtml(`ID ${requestedId || "-"}`)}</div><figcaption class="report-inline-image-caption">${captionHtml}</figcaption></figure>`;
  }
  const safePath = escapeHtml(publicSrc);
  const rotation = [90, 180, 270].includes(Number(image && image.rotation)) ? Number(image.rotation) : 0;
  const rotateStyle = rotation ? `transform:rotate(${rotation}deg);` : "";
  const swapDims = rotation === 90 || rotation === 270;
  const wrapStyle = swapDims
    ? `display:flex;align-items:center;justify-content:center;width:250px;height:250px;overflow:hidden;`
    : `width:250px;height:250px;`;
  const imgStyle = `object-fit:cover;width:250px;height:250px;display:block;margin-top:auto;margin-bottom:0;${rotateStyle}`;
  return `<figure class="report-inline-image-card"><div style="${wrapStyle}"><img class="report-inline-image" src="${safePath}" alt="${captionAlt}" width="250" height="250" data-rotation="${rotation}" style="${imgStyle}" /></div><figcaption class="report-inline-image-caption">${captionHtml}</figcaption></figure>`;
}

function formatComponentQuantity(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) return String(Math.trunc(number)).padStart(2, "0");
  const raw = String(value || "").trim();
  return raw || "-";
}

function formatComponentDescription(value) {
  const source = String(value || "").trim();
  if (!source) return "-";
  const pattern = /\(\s*SPARE\s+A\s+BORDO\s*\)/gi;
  let lastIndex = 0;
  let output = "";
  let match;
  while ((match = pattern.exec(source)) !== null) {
    output += escapeHtml(source.slice(lastIndex, match.index));
    output += `<span class="report-inline-components-spare">${escapeHtml(match[0])}</span>`;
    lastIndex = match.index + match[0].length;
  }
  output += escapeHtml(source.slice(lastIndex));
  return output;
}

function getComponentRowsByCategory(componentItems, categoryKey) {
  const rows = Array.isArray(componentItems) ? componentItems : [];
  const normalized = String(categoryKey || "").trim().toLowerCase();
  if (!normalized) return rows;
  const normalizeCategory = (value) => String(value || "").trim().toLowerCase();
  const isCategoryAlias = (value, aliases) => aliases.includes(normalizeCategory(value));
  return rows.filter((item) => {
    const category = normalizeCategory(item?.category);
    if (normalized === "replaced") {
      return isCategoryAlias(category, ["replaced", "substituidos", "substituido"]);
    }
    if (normalized === "required") {
      return isCategoryAlias(category, ["required", "para_troca", "para troca"]);
    }
    if (normalized === "spare") {
      return isCategoryAlias(category, ["spare_recommended", "spare", "recomendados", "recomendado"]);
    }
    return false;
  });
}

function generateDefaultComponentsCss(reportId) {
  const s = `[data-components-report-id="${reportId}"]`;
  return [
    `${s} .report-inline-components-table{width:100%;border-collapse:collapse;font-size:11px;line-height:1.3;}`,
    `${s} .report-inline-components-table th,${s} .report-inline-components-table td{border:1px solid #222;padding:2px 6px;vertical-align:middle;}`,
    `${s} .report-inline-components-table thead th{background:#f4f6f5;color:#101715;font-size:10px;font-weight:600;text-align:center;}`,
    `${s} .report-inline-components-meta th{background:#0d4f20 !important;color:#eff7ef !important;font-size:10px;font-weight:600;}`,
    `${s} .report-inline-components-qty{width:74px;text-align:center;}`,
    `${s} .report-inline-components-desc{text-align:left;}`,
    `${s} .report-inline-components-part{width:160px;text-align:center;}`
  ].join("\n");
}

function renderSingleEquipmentComponentsTable(componentRows, reportId, css) {
  const rows = Array.isArray(componentRows) ? componentRows : [];
  const first = rows[0] || {};
  const equipmentName = escapeHtml(first.equipment_type || first.equipment_model_family || "COMPONENTES");
  const powerLabel = escapeHtml(first.equipment_power || "-");
  const serialLabel = escapeHtml(first.equipment_serial || "-");
  const tagLabel = escapeHtml(first.equipment_tag || "-");
  const rbLabel = escapeHtml(first.equipment_dt || "-");

  const bodyRows = rows.length
    ? rows.map((item) => `
      <tr>
        <td class="report-inline-components-qty">${escapeHtml(formatComponentQuantity(item.quantity))}</td>
        <td class="report-inline-components-desc">${formatComponentDescription(item.description)}</td>
        <td class="report-inline-components-part">${escapeHtml(item.part_number || "-")}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td class="report-inline-components-empty" colspan="3">Sem componentes cadastrados.</td>
      </tr>
    `;

  const styleTag = css ? `<style>${css}</style>` : "";
  const reportAttr = reportId ? ` data-components-report-id="${Number(reportId)}"` : "";
  return `
    <div class="report-inline-components-wrap avoid-break" data-table-title="${equipmentName}"${reportAttr}>${styleTag}
      <table class="report-inline-components-table">
        <thead>
          <tr class="report-inline-components-meta">
            <th>${equipmentName}</th>
            <th>Power: ${powerLabel}</th>
            <th>Serie: ${serialLabel}</th>
          </tr>
          <tr class="report-inline-components-meta">
            <th>TAG: ${tagLabel}</th>
            <th colspan="2">RB: ${rbLabel}</th>
          </tr>
          <tr>
            <th>Quantity</th>
            <th>Description</th>
            <th>Part Number</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function renderComponentsInlineTable(componentItems, reportId, styleConfig) {
  const rows = Array.isArray(componentItems) ? componentItems : [];
  const id = reportId ? Number(reportId) : null;
  const sc = (styleConfig && typeof styleConfig === "object") ? styleConfig : {};
  const css = (sc.customCss && typeof sc.customCss === "string") ? sc.customCss
    : (id ? generateDefaultComponentsCss(id) : null);

  if (!rows.length) return renderSingleEquipmentComponentsTable([], id, css);

  const groups = new Map();
  rows.forEach((item) => {
    const equipmentId = Number(item && item.equipment_id);
    const key = Number.isInteger(equipmentId) && equipmentId > 0
      ? `eq:${equipmentId}`
      : "__no_equipment__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return Array.from(groups.values())
    .map((groupRows, idx) => renderSingleEquipmentComponentsTable(groupRows, id, idx === 0 ? css : null))
    .join("");
}

function formatTimesheetDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "NA";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[tT ]/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
  }
  return raw;
}

function normalizeTimesheetValue(value) {
  const raw = String(value || "").trim();
  return raw ? raw.toUpperCase() : "NA";
}

function generateDefaultTimesheetCss() {
  return [
    `.report-inline-timesheet-title-row{border:1px solid #374151;background:#374151;color:#ffffff;padding:7px 9px;font-weight:700;font-size:13px;letter-spacing:0.01em;text-align:left;width:100%;box-sizing:border-box;}`,
    `.report-inline-timesheet-table thead th{border:1px solid #6b7280;background:#4b5563;color:#ffffff;padding:6px 9px;font-weight:600;font-size:11px;letter-spacing:0.04em;}`,
    `.report-inline-timesheet-table tbody td{border:1px solid #d1d5db;padding:5px 9px;font-size:11px;vertical-align:top;text-align:left;}`,
    `.report-inline-timesheet-table tbody tr:nth-child(even) td{background:#f3f4f6;}`
  ].join("\n");
}

function renderTimesheetInlineTable(timesheetItems, styleConfig) {
  const sc = styleConfig && typeof styleConfig === "object" ? styleConfig : {};
  const rows = Array.isArray(timesheetItems) ? timesheetItems : [];
  const bodyRows = rows.length
    ? rows.map((item) => `
      <tr>
        <td>${escapeHtml(formatTimesheetDate(item.activity_date || item.activityDate))}</td>
        <td>${escapeHtml(normalizeTimesheetValue(item.check_in_base || item.checkInBase))}</td>
        <td>${escapeHtml(normalizeTimesheetValue(item.check_in_client || item.checkInClient))}</td>
        <td>${escapeHtml(normalizeTimesheetValue(item.check_out_client || item.checkOutClient))}</td>
        <td>${escapeHtml(normalizeTimesheetValue(item.check_out_base || item.checkOutBase))}</td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="5" class="report-inline-timesheet-empty">Sem registros de timesheet.</td>
      </tr>
    `;

  const hasCustomCss = (sc.customCss && typeof sc.customCss === "string");
  const styleTag = hasCustomCss ? `<style>${sc.customCss}</style>` : "";
  const captionStyle = hasCustomCss ? "caption-side:top;box-sizing:border-box;border-bottom:none;" : "caption-side:top;text-align:left;box-sizing:border-box;border-bottom:none;";
  return `
    ${styleTag}<div class="report-inline-timesheet-wrap avoid-break" data-table-title="TIME SHEET">
      <table class="report-inline-timesheet-table">
        <caption class="report-inline-timesheet-title-row" style="${captionStyle}">TIME SHEET</caption>
        <thead>
          <tr>
            <th>Data</th>
            <th>Check in base</th>
            <th>Check in client</th>
            <th>Check out client</th>
            <th>Check out base</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function generateDefaultTechteamCss() {
  return [
    `.report-inline-techteam-title-row{border:1px solid #1e40af;background:#1e40af;color:#ffffff;padding:7px 9px;font-weight:700;font-size:13px;letter-spacing:0.01em;text-align:left;width:100%;box-sizing:border-box;}`,
    `.report-inline-techteam-table thead th{border:1px solid #3b82f6;background:#2563eb;color:#ffffff;padding:6px 9px;font-weight:600;font-size:11px;letter-spacing:0.04em;}`,
    `.report-inline-techteam-table tbody td{border:1px solid #bfdbfe;padding:5px 9px;font-size:11px;vertical-align:top;text-align:left;}`,
    `.report-inline-techteam-table tbody tr:nth-child(even) td{background:#eff6ff;}`
  ].join("\n");
}

function renderTechTeamInlineTable(technicianItems, styleConfig) {
  const sc = styleConfig && typeof styleConfig === "object" ? styleConfig : {};
  const rows = Array.isArray(technicianItems) ? technicianItems : [];
  const bodyRows = rows.length
    ? rows.map((item) => `
      <tr>
        <td>${escapeHtml(item.name || "-")}</td>
        <td>${escapeHtml(item.role || "-")}</td>
        <td>${escapeHtml(item.company || "-")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="report-inline-techteam-empty">Sem tecnicos cadastrados.</td></tr>`;

  const hasCustomCss = (sc.customCss && typeof sc.customCss === "string");
  const styleTag = hasCustomCss ? `<style>${sc.customCss}</style>` : "";
  const captionStyle = hasCustomCss ? "caption-side:top;box-sizing:border-box;border-bottom:none;" : "caption-side:top;text-align:left;box-sizing:border-box;border-bottom:none;";
  return `
    ${styleTag}<div class="report-inline-techteam-wrap avoid-break" data-table-title="EQUIPE TECNICA">
      <table class="report-inline-techteam-table">
        <caption class="report-inline-techteam-title-row" style="${captionStyle}">EQUIPE TECNICA</caption>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Funcao</th>
            <th>Empresa</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function normalizeMeasurementList(value) {
  return Array.isArray(value) ? value : [];
}

const MEAS_CSS_DEFAULTS = {
  headerBg: "#5d8f3d",
  headerText: "#ffffff",
  borderColor: "#87b86a",
  borderWidth: "1px",
  borderStyle: "solid",
  altRowBg: "#f0f5e8",
  titleFontSize: "16px",
  titleFontWeight: "700",
  titleTextAlign: "left",
  thFontSize: "11px",
  thFontWeight: "600",
  thFontStyle: "normal",
  thTextAlign: "left",
  tdFontSize: "12px",
  tdFontWeight: "normal",
  tdFontStyle: "normal",
  tdTextAlign: "left",
  cellPadding: "5px 9px",
  thPadding: "6px 9px",
  titlePadding: "7px 9px"
};

function generateDefaultCss(tableId) {
  const v = MEAS_CSS_DEFAULTS;
  const s = `[data-table-id="${tableId}"]`;
  const border = `${v.borderWidth} ${v.borderStyle} ${v.borderColor}`;
  const tdBase = `border:${border};padding:${v.cellPadding};height:22px;vertical-align:top;font-size:${v.tdFontSize};font-weight:${v.tdFontWeight};font-style:${v.tdFontStyle};text-align:${v.tdTextAlign};`;
  return [
    `${s} .meas-title{border:${border};border-bottom:none;background:${v.headerBg};color:${v.headerText};padding:${v.titlePadding};font-weight:${v.titleFontWeight};font-size:${v.titleFontSize};letter-spacing:0.01em;text-align:${v.titleTextAlign};width:100%;box-sizing:border-box;}`,
    `${s} .meas-th{border:${border};background:${v.headerBg};color:${v.headerText};padding:${v.thPadding};text-align:${v.thTextAlign};font-weight:${v.thFontWeight};font-style:${v.thFontStyle};font-size:${v.thFontSize};letter-spacing:0.04em;}`,
    `${s} .meas-td{${tdBase}}`,
    `${s} .meas-td-alt{${tdBase}background:${v.altRowBg};}`,
    `${s} .meas-notes{font-size:18px;line-height:1.4;margin-top:6px;white-space:pre-wrap;color:#374151;}`
  ].join("\n");
}

function renderMeasurementsInlineTable(measurementTables, requestedId, styleConfig) {
  const tagId = Number(requestedId);
  const list = normalizeMeasurementList(measurementTables);
  const table = list.find((item) => Number(item && item.seq_id) === tagId)
    || list.find((item) => Number(item && item.id) === tagId);
  if (!table) return "";
  const id = Number(table.id);

  const columns = normalizeMeasurementList(table.columns_json)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const safeColumns = columns.length ? columns : ["Teste", "Valor", "Observacoes"];
  const rows = normalizeMeasurementList(table.rows_json);

  const sc = (styleConfig && typeof styleConfig === "object") ? styleConfig
    : (table.style_config && typeof table.style_config === "object") ? table.style_config
    : {};

  const extraColumns = Array.isArray(sc.extraColumns) ? sc.extraColumns : [];
  const totalColCount = safeColumns.length + extraColumns.length;
  const css = (sc.customCss && typeof sc.customCss === "string") ? sc.customCss : generateDefaultCss(id);

  const extraColHeaders = extraColumns.map((ec, i) => {
    const colIdx = safeColumns.length + i;
    return `<th class="meas-th meas-col-${colIdx}"${ec.width ? ` width="${ec.width}"` : ""}>${safeText(ec.header || "")}</th>`;
  }).join("");

  const bodyRows = rows.length
    ? rows.map((row, rowIndex) => {
      const source = Array.isArray(row) ? row : [];
      const tdClass = rowIndex % 2 === 0 ? "meas-td" : "meas-td-alt";
      const cells = safeColumns.map((_, index) =>
        `<td class="${tdClass} meas-col-${index}">${safeText(source[index] || "")}</td>`
      ).join("");
      const extraCells = extraColumns.map((ec, i) => {
        const colIdx = safeColumns.length + i;
        return `<td class="${tdClass} meas-col-${colIdx}">${safeText(String(ec.value || ""))}</td>`;
      }).join("");
      return `<tr>${cells}${extraCells}</tr>`;
    }).join("")
    : `<tr><td colspan="${totalColCount}" class="meas-td" style="color:#6b7280;">Sem medições cadastradas.</td></tr>`;

  const title = decodeHtmlEntities(String(table.title || "")).trim();
  const notes = decodeHtmlEntities(String(table.notes || "")).trim();
  const titleCaption = title
    ? `<caption class="meas-title" style="caption-side:top;">${escapeHtml(title)}</caption>`
    : "";
  const notesHtml = notes
    ? `<div class="meas-notes"><strong>Observações:</strong> ${escapeHtml(notes)}</div>`
    : "";

  return `
    <div class="report-inline-measurements-wrap avoid-break" data-table-id="${id}" data-table-title="${escapeHtml(title)}" style="margin:8px 0 14px 0;break-inside:avoid;page-break-inside:avoid;">
      <style>${css}</style>
      <table class="report-inline-measurements-table" style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.3;">
        ${titleCaption}
        <thead>
          <tr>
            ${safeColumns.map((column, index) => `<th class="meas-th meas-col-${index}">${safeText(column)}</th>`).join("")}${extraColHeaders}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${notesHtml}
    </div>
  `;
}

// Cada tabela (cabeçalho e cada seção) é emitida em SEU PRÓPRIO wrapper com o mesmo
// data-table-id e o <style> escopado. Isso mantém o conjunto como tabelas de uma única
// tabela por bloco — o caminho que a paginação do preview (report-pagination.js) trata
// preservando data-table-id + <style> em cada página. Wrappers com várias tabelas caem
// em splitRichBlockByChildren, que separa as tabelas do ancestral [data-table-id] e
// perde o CSS escopado nas páginas de continuação.
function wrapScopedMeasureBlock(scopeId, css, innerHtml, tableTitle) {
  const titleAttr = tableTitle ? ` data-table-title="${escapeHtml(tableTitle)}"` : "";
  return `
    <div class="report-inline-measurements-wrap avoid-break" data-table-id="${scopeId}"${titleAttr} style="margin:8px 0 14px 0;break-inside:avoid;page-break-inside:avoid;">
      <style>${css}</style>
      ${innerHtml}
    </div>`;
}

function chunkRows(rows, size) {
  const source = normalizeMeasurementList(rows);
  const chunkSize = Number(size);
  if (!Number.isInteger(chunkSize) || chunkSize <= 0 || source.length <= chunkSize) return [source];

  const chunks = [];
  for (let i = 0; i < source.length; i += chunkSize) {
    chunks.push(source.slice(i, i + chunkSize));
  }
  return chunks;
}

function renderScopedMeasuresBlocks(item, scopeId, css, defaultColumns, emptyText, options = {}) {
  const header = normalizeMeasurementList(item.header_json)
    .map((h) => ({
      label: safeText(String(h && h.label != null ? h.label : "")),
      value: safeText(String(h && h.value != null ? h.value : ""))
    }))
    .filter((h) => h.label || h.value);

  const sections = normalizeMeasurementList(item.sections_json);
  const title = decodeHtmlEntities(String(item.title || "")).trim();
  const notes = decodeHtmlEntities(String(item.notes || "")).trim();
  const rowsPerBlock = Number(options && options.rowsPerBlock || 0);

  const pieces = [];

  if (header.length) {
    pieces.push(`
      <table class="report-inline-measurements-table" style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.3;">
        ${title ? `<caption class="meas-title" style="caption-side:top;">${escapeHtml(title)}</caption>` : ""}
        <tbody>
          ${header.map((h, i) => {
            const tdClass = i % 2 === 0 ? "meas-td" : "meas-td-alt";
            return `<tr><td class="${tdClass}" style="font-weight:600;width:55%;">${h.label}</td><td class="${tdClass}">${h.value}</td></tr>`;
          }).join("")}
        </tbody>
      </table>`);
  }

  sections.forEach((section) => {
    const columns = normalizeMeasurementList(section && section.columns)
      .map((c) => String(c || "").trim())
      .filter(Boolean);
    const safeColumns = columns.length ? columns : defaultColumns;
    const rows = normalizeMeasurementList(section && section.rows);
    const sectionTitle = decodeHtmlEntities(String(section && section.title || "")).trim();

    const rowChunks = rows.length ? chunkRows(rows, rowsPerBlock) : [[]];

    rowChunks.forEach((rowChunk, chunkIndex) => {
      const bodyRows = rowChunk.length
        ? rowChunk.map((row, rowIndex) => {
          const source = Array.isArray(row) ? row : [];
          const tdClass = rowIndex % 2 === 0 ? "meas-td" : "meas-td-alt";
          const cells = safeColumns.map((_, index) =>
            `<td class="${tdClass} meas-col-${index}">${safeText(String(source[index] == null ? "" : source[index]))}</td>`
          ).join("");
          return `<tr>${cells}</tr>`;
        }).join("")
        : `<tr><td colspan="${safeColumns.length}" class="meas-td" style="color:#6b7280;">${escapeHtml(emptyText)}</td></tr>`;
      const caption = chunkIndex === 0 && sectionTitle
        ? `<caption class="meas-title" style="caption-side:top;">${escapeHtml(sectionTitle)}</caption>`
        : "";

      pieces.push(`
      <table class="report-inline-measurements-table" style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.3;">
        ${caption}
        <thead>
          <tr>${safeColumns.map((column, index) => `<th class="meas-th meas-col-${index}">${safeText(column)}</th>`).join("")}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>`);
    });
  });

  if (!pieces.length) return "";

  if (notes) {
    pieces[pieces.length - 1] += `<div class="meas-notes"><strong>Observações:</strong> ${escapeHtml(notes)}</div>`;
  }

  // O primeiro bloco recebe data-table-title (vira a "Tabela X.Y" numerada/no sumário);
  // os demais são blocos escopados sem numeração própria.
  return pieces
    .map((inner, idx) => wrapScopedMeasureBlock(scopeId, css, inner, idx === 0 ? title : ""))
    .join("\n");
}

function resolveScopedStyleCss(item, scopeId, styleConfig) {
  const sc = (styleConfig && typeof styleConfig === "object") ? styleConfig
    : (item.style_config && typeof item.style_config === "object") ? item.style_config
    : {};
  return (sc.customCss && typeof sc.customCss === "string") ? sc.customCss : generateDefaultCss(scopeId);
}

function renderUpsMeasuresTable(upsMeasuresList, requestedId, styleConfig) {
  const tagId = Number(requestedId);
  const list = normalizeMeasurementList(upsMeasuresList);
  const item = list.find((entry) => Number(entry && entry.seq_id) === tagId)
    || list.find((entry) => Number(entry && entry.id) === tagId);
  if (!item) return "";
  const scopeId = `ups-${Number(item.id)}`;
  const css = resolveScopedStyleCss(item, scopeId, styleConfig);
  return renderScopedMeasuresBlocks(item, scopeId, css, ["ID", "Signal Name", "Signal Value", "Unit"], "Sem medições.");
}

function limitEventLogRowsForPreview(item, maxRows) {
  const limit = Number(maxRows);
  if (!Number.isInteger(limit) || limit <= 0) return item;

  const sections = normalizeMeasurementList(item && item.sections_json);
  let remaining = limit;
  let totalRows = 0;
  const limitedSections = [];

  sections.forEach((section) => {
    const rows = normalizeMeasurementList(section && section.rows);
    totalRows += rows.length;
    if (remaining <= 0) return;
    const take = rows.slice(0, remaining);
    if (!take.length) return;
    remaining -= take.length;
    limitedSections.push({ ...section, rows: take });
  });

  if (totalRows <= limit) return item;

  const baseNotes = decodeHtmlEntities(String(item && item.notes || "")).trim();
  const previewNote = `Preview limitado aos primeiros ${limit} de ${totalRows} eventos. O PDF completo inclui todas as linhas importadas.`;
  return {
    ...item,
    sections_json: limitedSections,
    notes: baseNotes ? `${baseNotes}\n${previewNote}` : previewNote
  };
}

function renderEventLogTable(eventLogList, requestedId, styleConfig, renderOptions = {}) {
  const tagId = Number(requestedId);
  const list = normalizeMeasurementList(eventLogList);
  const rawItem = list.find((entry) => Number(entry && entry.seq_id) === tagId)
    || list.find((entry) => Number(entry && entry.id) === tagId);
  if (!rawItem) return "";
  const item = limitEventLogRowsForPreview(rawItem, renderOptions && renderOptions.maxRows);
  if (!item) return "";
  const scopeId = `evlog-${Number(item.id)}`;
  const css = resolveScopedStyleCss(item, scopeId, styleConfig);
  return renderScopedMeasuresBlocks(
    item,
    scopeId,
    css,
    ["Source", "Event Name", "Status", "Start Date", "Start Time", "ID", "Type"],
    "Sem eventos.",
    { rowsPerBlock: 30 }
  );
}

function generateDefaultAlberCss(leituraId) {
  const s = `[data-alber-id="${leituraId}"]`;
  return [
    `${s} .alber-info-cell{padding:5px 12px;white-space:nowrap;border-right:1px solid #4a7a30;background:#5d8f3d;}`,
    `${s} .alber-info-label{font-size:9.5px;color:#d4e6c3;margin-right:4px;}`,
    `${s} .alber-info-value{font-size:11px;color:#ffffff;font-weight:700;}`,
    `${s} .alber-stat-cell{padding:7px 12px;border-right:1px solid #e2e8f0;background:#ffffff;}`,
    `${s} .alber-stat-label{font-size:9.5px;color:#64748b;margin-bottom:1px;}`,
    `${s} .alber-stat-value{font-size:15px;font-weight:700;color:#1e293b;line-height:1.1;}`,
    `${s} .alber-stat-unit{font-size:10px;font-weight:400;color:#94a3b8;margin-left:2px;}`,
    `${s} .alber-title-th{border:1px solid #87b86a;border-bottom:none;background:#5d8f3d;color:#ffffff;padding:7px 8px;font-size:13px;font-weight:600;letter-spacing:0.03em;text-align:left;width:100%;box-sizing:border-box;}`,
    `${s} .alber-th{border:1px solid #87b86a;background:#5d8f3d;color:#ffffff;padding:6px 8px;font-size:11px;font-weight:600;letter-spacing:0.03em;}`,
    `${s} .alber-td{border:1px solid #87b86a;padding:5px 8px;font-size:11px;vertical-align:middle;}`,
    `${s} .alber-td-alt{border:1px solid #87b86a;padding:5px 8px;font-size:11px;vertical-align:middle;background:#f0f5e8;}`,
    `${s} .alber-overall-th{border:1px solid #87b86a;background:#5d8f3d;color:#ffffff;padding:6px 8px;font-size:11px;font-weight:600;}`,
    `${s} .alber-overall-td{border:1px solid #87b86a;padding:5px 8px;font-size:11px;vertical-align:middle;}`
  ].join("\n");
}

function renderAlberLeituraTable(alberLeituras, requestedId, styleConfig) {
  const tagId = Number(requestedId);
  const list = Array.isArray(alberLeituras) ? alberLeituras : [];
  const leitura = list.find((item) => Number(item && item.seq_id) === tagId)
    || list.find((item) => Number(item && item.id) === tagId);
  if (!leitura) return "";
  const id = Number(leitura.id);

  const sc = (styleConfig && typeof styleConfig === "object") ? styleConfig
    : (leitura.style_config && typeof leitura.style_config === "object") ? leitura.style_config
    : {};
  const css = (sc.customCss && typeof sc.customCss === "string") ? sc.customCss : generateDefaultAlberCss(id);

  const celulas = Array.isArray(leitura.celulas) ? leitura.celulas : [];
  const stringLabels = leitura.string_labels && typeof leitura.string_labels === "object"
    ? leitura.string_labels : {};
  const displayConfig = leitura.display_config && typeof leitura.display_config === "object"
    ? leitura.display_config : {};
  const hidden = Array.isArray(displayConfig.hiddenColumns) ? displayConfig.hiddenColumns : [];
  const configuredRanges = displayConfig.ranges && typeof displayConfig.ranges === "object"
    ? displayConfig.ranges : displayConfig;

  const ALL_COLS = [
    { key: "string_num", label: "Nº String" },
    { key: "celula_num", label: "Nº Célula" },
    { key: "voltagem", label: "Voltagem (V)" },
    { key: "resistencia_interna", label: "Resist. Interna (mΩ)" }
  ];
  const visCols = ALL_COLS.filter((c) => !hidden.includes(c.key));
  const colCount = visCols.length;
  const showV = !hidden.includes("voltagem");
  const showIr = !hidden.includes("resistencia_interna");

  const stringNums = [...new Set(celulas.map((c) => Number(c.string_num)))].sort((a, b) => a - b);

  function statsForCells(cells) {
    const active = cells.filter((c) => c.ativa !== false);
    if (!active.length) return null;
    const volts = active.map((c) => Number(c.voltagem));
    const irs = active.map((c) => Number(c.resistencia_interna));
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    return {
      vMin: Math.min(...volts), vMed: avg(volts), vMax: Math.max(...volts),
      irMin: Math.min(...irs), irMed: avg(irs), irMax: Math.max(...irs)
    };
  }

  function fmtV(v) { return v == null ? "-" : Number(v).toFixed(3); }
  function fmtIr(v) { return v == null ? "-" : Math.round(Number(v)).toString(); }
  function fmtAvg(v) { return v == null ? "-" : Number(v).toFixed(2); }
  function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  function firstFiniteValue(keys) {
    for (const key of keys) {
      const value = toFiniteNumber(configuredRanges[key]);
      if (value !== null) return value;
    }
    return null;
  }
  function isOutsideRange(value, min, max) {
    const num = toFiniteNumber(value);
    if (num === null) return true;
    if (min !== null && num < min) return true;
    if (max !== null && num > max) return true;
    return false;
  }

  const voltageRange = {
    min: firstFiniteValue(["voltageMin", "voltagemMin", "tensaoMin", "tensao_min", "minVoltage", "min_voltagem"]),
    max: firstFiniteValue(["voltageMax", "voltagemMax", "tensaoMax", "tensao_max", "maxVoltage", "max_voltagem"])
  };
  const resistanceRange = {
    min: firstFiniteValue(["resistanceMin", "resistenciaMin", "resistencia_min", "irMin", "ir_min", "minResistance"]),
    max: firstFiniteValue(["resistanceMax", "resistenciaMax", "resistencia_max", "irMax", "ir_max", "maxResistance"])
  };
  const hasConfiguredVoltageRange = voltageRange.min !== null || voltageRange.max !== null;
  const hasConfiguredResistanceRange = resistanceRange.min !== null || resistanceRange.max !== null;
  const outOfRangeStyle = ' style="color:#b91c1c;font-weight:700;background:#fee2e2;"';

  const allActive = celulas.filter((c) => c.ativa !== false);
  const overallStats = statsForCells(allActive);
  const hTensaoMedia = allActive.length
    ? (allActive.reduce((s, c) => s + Number(c.voltagem), 0) / allActive.length).toFixed(3) : "-";
  const hResistMedia = allActive.length
    ? Math.round(allActive.reduce((s, c) => s + Number(c.resistencia_interna), 0) / allActive.length) : "-";
  const hTensaoMin = voltageRange.min !== null ? fmtV(voltageRange.min) : (overallStats ? fmtV(overallStats.vMin) : "-");
  const hTensaoMax = voltageRange.max !== null ? fmtV(voltageRange.max) : (overallStats ? fmtV(overallStats.vMax) : "-");
  const hResistMin = resistanceRange.min !== null ? fmtIr(resistanceRange.min) : (overallStats ? fmtIr(overallStats.irMin) : "-");
  const hResistMax = resistanceRange.max !== null ? fmtIr(resistanceRange.max) : (overallStats ? fmtIr(overallStats.irMax) : "-");
  const effectiveVoltageRange = {
    min: hasConfiguredVoltageRange ? voltageRange.min : (overallStats ? overallStats.vMin : null),
    max: hasConfiguredVoltageRange ? voltageRange.max : (overallStats ? overallStats.vMax : null)
  };
  const effectiveResistanceRange = {
    min: hasConfiguredResistanceRange ? resistanceRange.min : (overallStats ? overallStats.irMin : null),
    max: hasConfiguredResistanceRange ? resistanceRange.max : (overallStats ? overallStats.irMax : null)
  };
  const hasVoltageRange = effectiveVoltageRange.min !== null || effectiveVoltageRange.max !== null;
  const hasResistanceRange = effectiveResistanceRange.min !== null || effectiveResistanceRange.max !== null;

  const infoCell = (label, value) =>
    `<td class="alber-info-cell"><span class="alber-info-label">${label}</span><strong class="alber-info-value">${value}</strong></td>`;

  const headerHtml = `
    <table data-alber-id="${id}" style="width:100%;border-collapse:collapse;margin-bottom:0;page-break-inside:avoid;break-inside:avoid;">
      <tr>
        ${infoCell("Local", escapeHtml(leitura.location_name || "-"))}
        ${infoCell("Banco", escapeHtml(leitura.battery_name || "-"))}
        ${leitura.model_number ? infoCell("Modelo", escapeHtml(leitura.model_number)) : ""}
        ${infoCell("Instalação", escapeHtml(leitura.install_date || "-"))}
        ${leitura.manufacture_date ? infoCell("Fab. bateria", escapeHtml(leitura.manufacture_date)) : ""}
      </tr>
    </table>
    <table data-alber-id="${id}" style="width:100%;border-collapse:collapse;margin-bottom:0;page-break-inside:avoid;break-inside:avoid;">
      <tr>
        <td class="alber-stat-cell"><div class="alber-stat-label">Tensão média</div><div class="alber-stat-value">${escapeHtml(hTensaoMedia)}<span class="alber-stat-unit">V</span></div></td>
        <td class="alber-stat-cell"><div class="alber-stat-label">Resist. média</div><div class="alber-stat-value">${escapeHtml(String(hResistMedia))}<span class="alber-stat-unit">mΩ</span></div></td>
        <td class="alber-stat-cell"><div class="alber-stat-label">Tensão mínima</div><div class="alber-stat-value">${escapeHtml(hTensaoMin)}<span class="alber-stat-unit">V</span></div></td>
        <td class="alber-stat-cell"><div class="alber-stat-label">Tensão máxima</div><div class="alber-stat-value">${escapeHtml(hTensaoMax)}<span class="alber-stat-unit">V</span></div></td>
        <td class="alber-stat-cell"><div class="alber-stat-label">Resistência mínima</div><div class="alber-stat-value">${escapeHtml(hResistMin)}<span class="alber-stat-unit">mΩ</span></div></td>
        <td class="alber-stat-cell"><div class="alber-stat-label">Resistência máxima</div><div class="alber-stat-value">${escapeHtml(hResistMax)}<span class="alber-stat-unit">mΩ</span></div></td>
        <td class="alber-stat-cell" style="border-right:none;"><div class="alber-stat-label">Células ativas</div><div class="alber-stat-value">${allActive.length}<span class="alber-stat-unit">/ ${celulas.length}</span></div></td>
      </tr>
    </table>`;

  const allStats = [];
  const stringsHtml = stringNums.map((sNum) => {
    const strCells = celulas.filter((c) => Number(c.string_num) === sNum);
    const label = String(stringLabels[String(sNum)] || `Banco ${sNum}`);
    const stats = statsForCells(strCells);
    if (stats) allStats.push({ label, stats });
    const irHighThreshold = stats && showIr ? stats.irMed * 1.5 : Infinity;

    const rows = strCells.map((c, idx) => {
      const tdClass = idx % 2 === 0 ? "alber-td" : "alber-td-alt";
      const voltageOutOfRange = showV && hasVoltageRange && isOutsideRange(c.voltagem, effectiveVoltageRange.min, effectiveVoltageRange.max);
      const resistanceOutOfRange = showIr && (
        hasConfiguredResistanceRange
          ? isOutsideRange(c.resistencia_interna, effectiveResistanceRange.min, effectiveResistanceRange.max)
          : hasResistanceRange && c.ativa === false
            ? isOutsideRange(c.resistencia_interna, effectiveResistanceRange.min, effectiveResistanceRange.max)
          : c.ativa !== false && Number(c.resistencia_interna) > irHighThreshold
      );
      const vExtra = voltageOutOfRange ? outOfRangeStyle : "";
      const irExtra = resistanceOutOfRange ? outOfRangeStyle : "";
      const inativo = c.ativa === false ? `<span style="color:#9ca3af;font-style:italic;"> (inativa)</span>` : "";
      const cells = [
        !hidden.includes("string_num") ? `<td class="${tdClass}">${escapeHtml(String(c.string_num))}</td>` : "",
        !hidden.includes("celula_num") ? `<td class="${tdClass}">${escapeHtml(String(c.celula_num))}${inativo}</td>` : "",
        showV ? `<td class="${tdClass}"${vExtra}>${escapeHtml(fmtV(c.voltagem))}</td>` : "",
        showIr ? `<td class="${tdClass}"${irExtra}>${escapeHtml(fmtIr(c.resistencia_interna))}</td>` : ""
      ].join("");
      return `<tr style="page-break-inside:avoid;break-inside:avoid;">${cells}</tr>`;
    }).join("");

    return `
      <div class="alber-string-block" data-alber-id="${id}" style="margin-bottom:16px;">
        <table style="width:100%;border-collapse:collapse;line-height:1.3;page-break-inside:auto;">
          <caption class="alber-title-th" style="caption-side:top;">${escapeHtml(label)}</caption>
          <thead style="display:table-header-group;">
            <tr style="page-break-inside:avoid;break-inside:avoid;">
              ${visCols.map((col) => `<th class="alber-th">${col.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  let overallHtml = "";
  if (allStats.length > 1 && (showV || showIr)) {
    const oStats = statsForCells(allActive);
    if (oStats) {
      const overallCols = [
        "Seção",
        ...(showV ? ["V mín", "V méd", "V máx"] : []),
        ...(showIr ? ["iR mín", "iR méd", "iR máx"] : [])
      ];
      overallHtml = `
        <div data-alber-id="${id}" class="alber-overall-th" style="display:block;width:100%;box-sizing:border-box;font-size:12px;padding:7px 8px;">Estatísticas Gerais</div>
        <table data-alber-id="${id}" style="width:100%;border-collapse:collapse;margin-top:0;">
          <thead>
            <tr>${overallCols.map((c) => `<th class="alber-overall-th">${c}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${allStats.map(({ label, stats }, i) => {
    const cls = i % 2 === 0 ? "alber-overall-td" : "alber-overall-td alber-td-alt";
    return `<tr>
                <td class="${cls}" style="font-weight:600;">${escapeHtml(label)}</td>
                ${showV ? `<td class="${cls}">${escapeHtml(fmtV(stats.vMin))}</td><td class="${cls}">${escapeHtml(fmtAvg(stats.vMed))}</td><td class="${cls}">${escapeHtml(fmtV(stats.vMax))}</td>` : ""}
                ${showIr ? `<td class="${cls}">${escapeHtml(fmtIr(stats.irMin))}</td><td class="${cls}">${escapeHtml(fmtAvg(stats.irMed))}</td><td class="${cls}">${escapeHtml(fmtIr(stats.irMax))}</td>` : ""}
              </tr>`;
  }).join("")}
          </tbody>
        </table>`;
    }
  }

  return `
    <div class="report-inline-alber-wrap" data-alber-id="${id}" style="margin:8px 0 16px 0;break-inside:avoid;page-break-inside:avoid;">
      <style>${css}</style>
      ${headerHtml}
      ${stringsHtml}
      ${overallHtml}
    </div>`;
}

function generateDefaultFluke521Css(leituraId) {
  const s = `[data-fluke521-id="${leituraId}"]`;
  return [
    `${s} .fluke521-info-cell{padding:5px 12px;white-space:nowrap;border-right:1px solid #1d4ed8;background:#2563eb;}`,
    `${s} .fluke521-info-label{font-size:9.5px;color:#bfdbfe;margin-right:4px;}`,
    `${s} .fluke521-info-value{font-size:11px;color:#ffffff;font-weight:700;}`,
    `${s} .fluke521-stat-cell{padding:7px 12px;border-right:1px solid #e2e8f0;background:#ffffff;}`,
    `${s} .fluke521-stat-label{font-size:9.5px;color:#64748b;margin-bottom:1px;}`,
    `${s} .fluke521-stat-value{font-size:15px;font-weight:700;color:#1e293b;line-height:1.1;}`,
    `${s} .fluke521-stat-unit{font-size:10px;font-weight:400;color:#94a3b8;margin-left:2px;}`,
    `${s} .fluke521-title-th{border:1px solid #3b82f6;border-bottom:none;background:#2563eb;color:#ffffff;padding:7px 8px;font-size:13px;font-weight:600;letter-spacing:0.03em;text-align:left;width:100%;box-sizing:border-box;}`,
    `${s} .fluke521-th{border:1px solid #3b82f6;background:#2563eb;color:#ffffff;padding:6px 8px;font-size:11px;font-weight:600;letter-spacing:0.03em;}`,
    `${s} .fluke521-td{border:1px solid #3b82f6;padding:5px 8px;font-size:11px;vertical-align:middle;}`,
    `${s} .fluke521-td-alt{border:1px solid #3b82f6;padding:5px 8px;font-size:11px;vertical-align:middle;background:#eff6ff;}`
  ].join("\n");
}

// Renderiza a tabela de resistência/tensão/temperatura por célula (leituras_fluke521 +
// celulas_fluke521). Estrutura análoga a renderAlberLeituraTable, mas sem agrupamento por
// string/banco (o BT521 não distingue strings nesse arquivo) e com coluna de temperatura
// opcional (só aparece se pelo menos uma célula tiver leitura de temperatura).
function renderFluke521LeituraTable(leituras, requestedId, styleConfig) {
  const tagId = Number(requestedId);
  const list = Array.isArray(leituras) ? leituras : [];
  const leitura = list.find((item) => Number(item && item.seq_id) === tagId)
    || list.find((item) => Number(item && item.id) === tagId);
  if (!leitura) return "";
  const id = Number(leitura.id);

  const sc = (styleConfig && typeof styleConfig === "object") ? styleConfig
    : (leitura.style_config && typeof leitura.style_config === "object") ? leitura.style_config
    : {};
  const css = (sc.customCss && typeof sc.customCss === "string") ? sc.customCss : generateDefaultFluke521Css(id);

  const celulas = Array.isArray(leitura.celulas) ? leitura.celulas : [];

  // Import só com a tabela de descarga: a leitura existe (metadados + vínculo com o teste)
  // mas não tem célula alguma. Renderizar daria um cabeçalho com estatísticas "-" e corpo
  // vazio — mesma decisão de renderDischargeTestTable quando não há leituras.
  if (!celulas.length) return "";

  function fmtR(v) { return (v == null || v === "") ? "-" : Number(v).toFixed(2); }
  function fmtV(v) { return (v == null || v === "") ? "-" : Number(v).toFixed(3); }
  function fmtT(v) { return (v == null || v === "") ? "-" : Number(v).toFixed(1); }
  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

  const rNums = celulas.map((c) => Number(c.resistenciaMohm)).filter((n) => Number.isFinite(n));
  const vNums = celulas.map((c) => Number(c.tensaoVdc)).filter((n) => Number.isFinite(n));
  const tNums = celulas
    .map((c) => (c.temperaturaC === null || c.temperaturaC === undefined ? NaN : Number(c.temperaturaC)))
    .filter((n) => Number.isFinite(n));

  const rMin = rNums.length ? Math.min(...rNums) : null;
  const rMax = rNums.length ? Math.max(...rNums) : null;
  const rMed = avg(rNums);
  const vMin = vNums.length ? Math.min(...vNums) : null;
  const vMax = vNums.length ? Math.max(...vNums) : null;
  const vMed = avg(vNums);
  const tMed = avg(tNums);

  // display_config.hiddenColumns: colunas que o usuário optou por ocultar (mesmo
  // mecanismo do Alber). Chaves: celula | resistencia | tensao | temperatura | hora.
  const displayConfig = leitura.display_config && typeof leitura.display_config === "object"
    ? leitura.display_config : {};
  const hidden = Array.isArray(displayConfig.hiddenColumns) ? displayConfig.hiddenColumns : [];
  const showCelula = !hidden.includes("celula");
  const showResistencia = !hidden.includes("resistencia");
  const showTensao = !hidden.includes("tensao");
  const showTemp = tNums.length > 0 && !hidden.includes("temperatura");

  const infoCell = (label, value) =>
    `<td class="fluke521-info-cell"><span class="fluke521-info-label">${label}</span><strong class="fluke521-info-value">${value}</strong></td>`;

  const headerHtml = `
    <table data-fluke521-id="${id}" style="width:100%;border-collapse:collapse;margin-bottom:0;page-break-inside:avoid;break-inside:avoid;">
      <tr>
        ${infoCell("Local", escapeHtml(leitura.location_name || "-"))}
        ${infoCell("Equipamento", escapeHtml(leitura.device_name || "-"))}
        ${leitura.battery_type ? infoCell("Tipo de bateria", escapeHtml(leitura.battery_type)) : ""}
        ${leitura.capacity ? infoCell("Capacidade", escapeHtml(leitura.capacity)) : ""}
      </tr>
    </table>
    <table data-fluke521-id="${id}" style="width:100%;border-collapse:collapse;margin-bottom:0;page-break-inside:avoid;break-inside:avoid;">
      <tr>
        ${showResistencia ? `
        <td class="fluke521-stat-cell"><div class="fluke521-stat-label">Resistência média</div><div class="fluke521-stat-value">${escapeHtml(fmtR(rMed))}<span class="fluke521-stat-unit">mΩ</span></div></td>
        <td class="fluke521-stat-cell"><div class="fluke521-stat-label">Resist. mínima</div><div class="fluke521-stat-value">${escapeHtml(fmtR(rMin))}<span class="fluke521-stat-unit">mΩ</span></div></td>
        <td class="fluke521-stat-cell"><div class="fluke521-stat-label">Resist. máxima</div><div class="fluke521-stat-value">${escapeHtml(fmtR(rMax))}<span class="fluke521-stat-unit">mΩ</span></div></td>` : ""}
        ${showTensao ? `
        <td class="fluke521-stat-cell"><div class="fluke521-stat-label">Tensão média</div><div class="fluke521-stat-value">${escapeHtml(fmtV(vMed))}<span class="fluke521-stat-unit">V</span></div></td>
        <td class="fluke521-stat-cell"><div class="fluke521-stat-label">Tensão mínima</div><div class="fluke521-stat-value">${escapeHtml(fmtV(vMin))}<span class="fluke521-stat-unit">V</span></div></td>
        <td class="fluke521-stat-cell"><div class="fluke521-stat-label">Tensão máxima</div><div class="fluke521-stat-value">${escapeHtml(fmtV(vMax))}<span class="fluke521-stat-unit">V</span></div></td>` : ""}
        ${showTemp ? `<td class="fluke521-stat-cell"><div class="fluke521-stat-label">Temp. média</div><div class="fluke521-stat-value">${escapeHtml(fmtT(tMed))}<span class="fluke521-stat-unit">°C</span></div></td>` : ""}
        <td class="fluke521-stat-cell" style="border-right:none;"><div class="fluke521-stat-label">Células</div><div class="fluke521-stat-value">${celulas.length}</div></td>
      </tr>
    </table>`;

  const showHora = celulas.some((c) => String(c.hora || "").trim()) && !hidden.includes("hora");
  const cols = [
    ...(showCelula ? ["Célula"] : []),
    ...(showResistencia ? ["Resistência (mΩ)"] : []),
    ...(showTensao ? ["Tensão (Vcc)"] : []),
    ...(showTemp ? ["Temperatura (°C)"] : []),
    ...(showHora ? ["Hora"] : [])
  ];
  const rows = celulas.map((c, idx) => {
    const tdClass = idx % 2 === 0 ? "fluke521-td" : "fluke521-td-alt";
    const cells = [
      ...(showCelula ? [`<td class="${tdClass}">${escapeHtml(String(c.celulaNum))}</td>`] : []),
      ...(showResistencia ? [`<td class="${tdClass}">${escapeHtml(fmtR(c.resistenciaMohm))}</td>`] : []),
      ...(showTensao ? [`<td class="${tdClass}">${escapeHtml(fmtV(c.tensaoVdc))}</td>`] : []),
      ...(showTemp ? [`<td class="${tdClass}">${escapeHtml(fmtT(c.temperaturaC))}</td>`] : []),
      ...(showHora ? [`<td class="${tdClass}">${escapeHtml(String(c.hora || "-").trim() || "-")}</td>`] : [])
    ].join("");
    return `<tr style="page-break-inside:avoid;break-inside:avoid;">${cells}</tr>`;
  }).join("");

  // O atributo de escopo é repetido na própria tabela de dados (e não só no wrapper) porque
  // a paginação do preview quebra blocos com mais de uma tabela em filhos separados por
  // página — sem isto, as células saem de baixo de [data-fluke521-id] e o CSS com escopo
  // (zebrado, bordas, cabeçalho) deixa de casar a partir da segunda página.
  // Com todas as colunas ocultas, mantém só cabeçalho/estatísticas (a tag continua
  // renderizando algo, em vez de ficar literal no relatório).
  const tableHtml = cols.length ? `
    <table data-fluke521-id="${id}" style="width:100%;border-collapse:collapse;line-height:1.3;page-break-inside:auto;">
      <caption class="fluke521-title-th" style="caption-side:top;">${escapeHtml(leitura.device_name || leitura.location_name || "Leitura Fluke BT521")}</caption>
      <thead style="display:table-header-group;">
        <tr style="page-break-inside:avoid;break-inside:avoid;">
          ${cols.map((c) => `<th class="fluke521-th">${c}</th>`).join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>` : "";

  return `
    <div class="report-inline-fluke521-wrap" data-fluke521-id="${id}" style="margin:8px 0 16px 0;break-inside:avoid;page-break-inside:avoid;">
      <style>${css}</style>
      ${headerHtml}
      ${tableHtml}
    </div>`;
}

function normalizeInlineCellValue(value, fallback = "-") {
  const raw = String(value == null ? "" : value).trim();
  return raw || fallback;
}

function generateDefaultEquipmentCss() {
  return [
    `.report-inline-equipments-title-row{border:1px solid #92400e;background:#92400e;color:#ffffff;padding:7px 9px;font-weight:700;font-size:13px;letter-spacing:0.01em;text-align:left;width:100%;box-sizing:border-box;}`,
    `.report-inline-equipments-table .report-inline-equipments-label{border:1px solid #d97706;background:#fef3c7;padding:5px 9px;font-size:11px;font-weight:600;text-align:left;vertical-align:top;}`,
    `.report-inline-equipments-table .report-inline-equipments-value{border:1px solid #d97706;padding:5px 9px;font-size:11px;text-align:left;vertical-align:top;}`
  ].join("\n");
}

function renderEquipmentsInlineTable(orderEquipments, styleConfig) {
  const sc = styleConfig && typeof styleConfig === "object" ? styleConfig : {};
  const rows = (Array.isArray(orderEquipments) ? orderEquipments : [])
    .slice()
    .sort((a, b) => Number(a?.ref_id || 0) - Number(b?.ref_id || 0) || Number(a?.id || 0) - Number(b?.id || 0));

  if (!rows.length) {
    return `
      <div class="report-inline-equipments-wrap avoid-break" data-table-title="Equipamentos">
        <table class="report-inline-equipments-table">
          <tbody>
            <tr><td class="report-inline-equipments-empty">Sem equipamentos vinculados na OS.</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const hasCustomCss = (sc.customCss && typeof sc.customCss === "string");
  const pairsPerRow = 3;
  const columnsPerRow = pairsPerRow * 2;

  const renderPairsRows = (pairs) => {
    const chunks = [];
    for (let i = 0; i < pairs.length; i += pairsPerRow) {
      chunks.push(pairs.slice(i, i + pairsPerRow));
    }
    return chunks.map((chunk) => {
      const cells = chunk.map((pair) => `
        <th class="report-inline-equipments-label">${escapeHtml(pair.label)}</th>
        <td class="report-inline-equipments-value">${escapeHtml(normalizeInlineCellValue(pair.value))}</td>
      `).join("");
      const missingPairs = Math.max(0, pairsPerRow - chunk.length);
      const filler = missingPairs ? `<td colspan="${missingPairs * 2}" class="report-inline-equipments-filler"></td>` : "";
      return `<tr>${cells}${filler}</tr>`;
    }).join("");
  };

  const tablesHtml = rows.map((item) => {
    const tagValue = normalizeInlineCellValue(item.tag_number);
    const tableTitle = tagValue !== "-"
      ? `TAG ${tagValue}`
      : `Equipamento ${normalizeInlineCellValue(item.ref_id)}`;

    const pairs = [
      { label: "Tipo", value: item.type },
      { label: "Power", value: item.power || item.rated_ac_input_voltage },
      { label: "Fabricante", value: item.manufacturer },
      { label: "Modelo/Família", value: item.model_family },
      { label: "Série", value: item.serial_number },
      { label: "DT", value: item.dt_number },
      { label: "Ano", value: item.year_of_manufacture },
      { label: "AC In (V)", value: item.rated_ac_input_voltage },
      { label: "In Freq", value: item.input_frequency },
      { label: "DC (V)", value: item.rated_dc_voltage },
      { label: "AC Out (V)", value: item.rated_ac_output_voltage },
      { label: "Out Freq", value: item.output_frequency },
      { label: "Grau Prot.", value: item.degree_of_protection },
      { label: "Main Label", value: item.main_label }
    ];

    return `
      <table class="report-inline-equipments-table">
        <caption class="report-inline-equipments-title-row" style="caption-side:top;${hasCustomCss ? "" : "text-align:left;"}box-sizing:border-box;">${escapeHtml(tableTitle)}</caption>
        <tbody>${renderPairsRows(pairs)}</tbody>
      </table>
    `;
  }).join("");

  const styleTag = hasCustomCss ? `<style>${sc.customCss}</style>` : "";
  return `${styleTag}<div class="report-inline-equipments-wrap avoid-break" data-table-title="Equipamentos">${tablesHtml}</div>`;
}

function renderEquipmentTagsInline(orderEquipments) {
  const rows = Array.isArray(orderEquipments) ? orderEquipments : [];
  if (!rows.length) return "-";

  const seen = new Set();
  const tags = [];
  rows.forEach((item) => {
    const label = String(item?.tag_number || item?.tag || "").trim();
    if (!label) return;
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    tags.push(label);
  });

  if (!tags.length) return "-";
  return escapeHtml(tags.join(", "));
}

function renderSiteInline(siteData) {
  const source = siteData && typeof siteData === "object" ? siteData : {};
  const siteLabel = String(source.site_name || source.name || source.title || "").trim();
  return siteLabel ? escapeHtml(siteLabel) : "-";
}

function renderDailyLogInlineItem(dailyLog, requestedId = null, context = null) {
  if (!dailyLog) return "";
  const contentHtml = String(dailyLog.content || "").trim();
  if (!contentHtml) return "";
  if (!context) return contentHtml;
  return injectTaggedImagesInHtml(
    contentHtml,
    context.imageById,
    context.componentItems,
    context.equipmentById,
    context.timesheetItems,
    context.dailyLogsById,
    context.dailyLogsOrdered,
    { expandDailyLogTags: false, imageLabel: context.imageLabel, timesheetStyleConfig: context.timesheetStyleConfig, techteamStyleConfig: context.techteamStyleConfig, equipmentStyleConfig: context.equipmentStyleConfig },
    context.technicianItems || [],
    context.orderEquipments || [],
    context.siteData || {},
    context.measurementTables || [],
    context.alberLeituras || [],
    context.dischargeTests || [],
    context.upsMeasures || [],
    context.eventLogs || [],
    context.leiturasFluke521 || []
  );
}

function renderAllDailyLogsInlineItems(dailyLogs, context = null) {
  const rows = Array.isArray(dailyLogs) ? dailyLogs : [];
  const rendered = rows
    .map((item) => renderDailyLogInlineItem(item, item && item.id, context))
    .filter((chunk) => String(chunk || "").trim().length > 0);
  return rendered.join("\n");
}

function wrapImageCardsIntoRows(html) {
  const figureRegex = /<figure class="report-inline-image-card">[\s\S]*?<\/figure>/gi;
  const tokenRegex = /<figure class="report-inline-image-card">[\s\S]*?<\/figure>|<br\s*\/?>/gi;

  function isSpacer(content) {
    const residue = String(content || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/\s+/g, "")
      .trim();
    return residue.length === 0;
  }

  function buildRowsFromTokens(tokens) {
    const lines = [[]];
    tokens.forEach((token) => {
      if (/^<br/i.test(String(token || ""))) {
        if (lines[lines.length - 1].length > 0) lines.push([]);
      } else {
        lines[lines.length - 1].push(token);
      }
    });
    const normalizedLines = lines.filter((line) => line.length > 0);
    if (!normalizedLines.length) return "";

    const rows = [];
    normalizedLines.forEach((lineFigures) => {
      for (let index = 0; index < lineFigures.length; index += 2) {
        rows.push(`<div class="report-inline-image-row">${lineFigures.slice(index, index + 2).join("")}</div>`);
      }
    });
    return rows.join("");
  }

  const source = String(html || "");
  if (!figureRegex.test(source)) return source;
  figureRegex.lastIndex = 0;

  const matches = [];
  let match;
  while ((match = tokenRegex.exec(source)) !== null) {
    matches.push({
      token: String(match[0] || ""),
      index: match.index,
      end: match.index + String(match[0] || "").length
    });
  }
  if (!matches.length) return source;

  let result = "";
  let cursor = 0;
  let i = 0;
  while (i < matches.length) {
    const current = matches[i];
    const leading = source.slice(cursor, current.index);
    result += leading;

    if (!/^<figure/i.test(current.token)) {
      result += current.token;
      cursor = current.end;
      i += 1;
      continue;
    }

    const runTokens = [current.token];
    let runEnd = current.end;
    let j = i + 1;
    while (j < matches.length) {
      const between = source.slice(runEnd, matches[j].index);
      if (!isSpacer(between)) break;
      runTokens.push(matches[j].token);
      runEnd = matches[j].end;
      j += 1;
    }

    result += buildRowsFromTokens(runTokens);
    cursor = runEnd;
    i = j;
  }

  if (cursor < source.length) result += source.slice(cursor);
  return result;
}

function extractMeasurementBlockBoundaries(html) {
  const OPEN_MARKER = 'data-table-title="';
  const boundaries = [];
  let searchPos = 0;

  while (searchPos < html.length) {
    const markerPos = html.indexOf(OPEN_MARKER, searchPos);
    if (markerPos === -1) break;

    let divStart = markerPos - 1;
    while (divStart >= 0 && html[divStart] !== "<") divStart--;
    if (divStart < 0) break;

    let depth = 1;
    let pos = markerPos + OPEN_MARKER.length;

    while (pos < html.length && depth > 0) {
      if (html.slice(pos, pos + 6) === "</div>") {
        depth--;
        if (depth === 0) {
          boundaries.push({ start: divStart, end: pos + 6 });
          searchPos = pos + 6;
          break;
        }
        pos += 6;
      } else if (html.slice(pos, pos + 4) === "<div") {
        depth++;
        pos += 4;
      } else {
        pos++;
      }
    }

    if (depth > 0) break;
  }

  return boundaries;
}

function isOnlyPaddingBetweenMeasurements(between) {
  // Accept whitespace and empty Quill paragraphs (<p><br></p>, <p>&nbsp;</p>, <p></p>)
  const stripped = between
    .replace(/\s+/g, "")
    .replace(/<p[^>]*>(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "");
  return stripped.length === 0;
}

function mergeSameTitleMeasurementTables(html) {
  const source = String(html || "");
  if (!source.includes('data-table-title=')) return source;

  const blocks = extractMeasurementBlockBoundaries(source);
  if (blocks.length < 2) return source;

  const groups = [];
  let i = 0;

  while (i < blocks.length) {
    const blockHtml = source.slice(blocks[i].start, blocks[i].end);
    const titleMatch = /data-table-title="([^"]+)"/.exec(blockHtml);
    const title = titleMatch ? titleMatch[1] : null;
    const blockType = getTableType(blockHtml);

    const group = [blocks[i]];

    // Component tables are already split per equipment by renderComponentsInlineTable
    // and must NEVER be merged — different equipment frequently share the same type
    // name (used as data-table-title), which would otherwise collapse them into one.
    // UPS blocks are composite (header + multiple section tables) and must never merge.
    if (title && blockType !== "components" && blockType !== "upsmeasures" && blockType !== "eventlog") {
      let j = i + 1;
      while (j < blocks.length) {
        const between = source.slice(group[group.length - 1].end, blocks[j].start);
        if (!isOnlyPaddingBetweenMeasurements(between)) break;
        const nextBlockHtml = source.slice(blocks[j].start, blocks[j].end);
        if (getTableType(nextBlockHtml) !== blockType) break;
        const nextTitleMatch = /data-table-title="([^"]+)"/.exec(nextBlockHtml);
        if ((nextTitleMatch ? nextTitleMatch[1] : null) !== title) break;
        group.push(blocks[j]);
        j++;
      }
    }

    groups.push(group);
    i += group.length;
  }

  let result = "";
  let cursor = 0;

  for (const group of groups) {
    result += source.slice(cursor, group[0].start);

    if (group.length === 1) {
      result += source.slice(group[0].start, group[0].end);
    } else {
      let merged = source.slice(group[0].start, group[0].end);

      for (let k = 1; k < group.length; k++) {
        const extraBlockHtml = source.slice(group[k].start, group[k].end);
        const tbodyMatch = /<tbody>([\s\S]*?)<\/tbody>/.exec(extraBlockHtml);
        if (tbodyMatch && tbodyMatch[1].trim()) {
          merged = merged.replace(/<\/tbody>/, tbodyMatch[1] + "</tbody>");
        }
      }

      result += merged;
    }

    cursor = group[group.length - 1].end;
  }

  result += source.slice(cursor);
  return result;
}

function getTableType(blockHtml) {
  if (blockHtml.includes('data-table-id="ups-')) return "upsmeasures";
  if (blockHtml.includes('data-table-id="evlog-')) return "eventlog";
  if (blockHtml.includes("report-inline-measurements-wrap")) return "measurements";
  if (blockHtml.includes("report-inline-discharge-wrap")) return "discharge";
  if (blockHtml.includes("report-inline-components-wrap")) return "components";
  if (blockHtml.includes("report-inline-timesheet-wrap")) return "timesheet";
  if (blockHtml.includes("report-inline-techteam-wrap")) return "techteam";
  if (blockHtml.includes("report-inline-equipments-wrap")) return "equipments";
  return "other";
}

function numberMeasurementTablesInHtml(html, chapterNum) {
  const source = String(html || "");
  if (!source.includes('data-table-title=')) {
    return { html: source, tables: [] };
  }

  const blocks = extractMeasurementBlockBoundaries(source);
  if (!blocks.length) return { html: source, tables: [] };

  const tables = [];
  let result = "";
  let cursor = 0;

  blocks.forEach((block, idx) => {
    result += source.slice(cursor, block.start);

    const blockHtml = source.slice(block.start, block.end);
    const titleMatch = /data-table-title="([^"]*)"/.exec(blockHtml);
    const title = decodeHtmlEntities(titleMatch ? titleMatch[1] : "");
    const tableNum = idx + 1;
    const label = `Tabela ${chapterNum}.${tableNum}`;
    const anchorId = `tbl-${chapterNum}-${tableNum}`;

    const tableType = getTableType(blockHtml);
    const tableIdMatch = /data-table-id="(?:ups-|evlog-)?(\d+)"/.exec(blockHtml);
    const dischargeIdMatch = /data-discharge-id="(\d+)"/.exec(blockHtml);
    const itemId = tableIdMatch ? Number(tableIdMatch[1]) : (dischargeIdMatch ? Number(dischargeIdMatch[1]) : null);
    tables.push({ label, title, anchorId, tableType, itemId });

    const captionHtml = `<div style="font-size:14px;color:#6b7280;margin-top:0;text-align:left;font-style:italic;">${escapeHtml(label)}</div>`;

    let numbered = blockHtml.replace(/^(<div\b)/, `$1 id="${anchorId}"`);
    const notesIdx = numbered.indexOf('<div class="report-inline-meas-notes"');
    if (notesIdx !== -1) {
      numbered = numbered.slice(0, notesIdx) + captionHtml + numbered.slice(notesIdx);
    } else {
      const lastDivIdx = numbered.lastIndexOf("</div>");
      numbered = numbered.slice(0, lastDivIdx) + captionHtml + numbered.slice(lastDivIdx);
    }

    result += numbered;
    cursor = block.end;
  });

  result += source.slice(cursor);
  return { html: result, tables };
}

/**
 * For block-level tags: replaces the entire <p>...</p> that wraps the tag
 * (including any inline wrappers like <span style="...">) with the block content.
 * Falls back to inline replacement for occurrences inside paragraphs that also
 * contain other text content.
 *
 * This prevents invalid HTML like <p><span><p>...</p></span></p> which causes
 * browsers to discard the outer <p>/<span> and lose inline formatting on nearby
 * paragraphs.
 */
function liftBlockTagFromParagraph(html, tagSrc, inlineReplacer) {
  const pPattern = new RegExp(
    `<p[^>]*>(?:<(?!\\/?p)[^>]*>|\\s|&nbsp;)*${tagSrc}(?:<\\/[^>]+>|\\s|&nbsp;)*<\\/p>`,
    "gi"
  );
  const extractPattern = new RegExp(tagSrc, "i");
  return html.replace(pPattern, (pMatch) => {
    const m = extractPattern.exec(pMatch);
    if (!m) return pMatch;
    return inlineReplacer(...m);
  });
}

function injectTaggedImagesInHtml(contentHtml, imageById, componentItems, equipmentById, timesheetItems, dailyLogsById, dailyLogsOrdered, options = {}, technicianItems = [], orderEquipments = [], siteData = {}, measurementTables = [], alberLeituras = [], dischargeTests = [], upsMeasures = [], eventLogs = [], leiturasFluke521 = []) {
  const source = String(contentHtml || "");
  if (!source) return "<p><br></p>";
  const opts = {
    expandDailyLogTags: options.expandDailyLogTags !== false,
    imageLabel: options.imageLabel || null,
    timesheetStyleConfig: options.timesheetStyleConfig || null,
    techteamStyleConfig: options.techteamStyleConfig || null,
    equipmentStyleConfig: options.equipmentStyleConfig || null,
    componentsStyleConfig: options.componentsStyleConfig || null,
    reportId: options.reportId || null,
    eventLogPreviewMaxRows: options.eventLogPreviewMaxRows || null
  };
  const equipmentTagPattern = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*equip(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi;
  const withEquipments = source.replace(equipmentTagPattern, (_match, rawId) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return _match;
    const equipment = equipmentById.get(id);
    const label = String(equipment?.tag || equipment?.type || "").trim();
    return label ? escapeHtml(label) : _match;
  });
  const imageTagPattern = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*img(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)(?:\s|&nbsp;)*(?:imagem)?/gi;
  const withImages = withEquipments.replace(imageTagPattern, (_match, rawId) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return _match;
    const image = imageById.get(id);
    return renderInlineImageCard(image, id, opts.imageLabel || "Imagem");
  });

  // Block-level table tags: lift out of <p> wrappers first, then inline fallback
  const tblcmprSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*tblcmpr/gi.source;
  const tblcmpqSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*tblcmpq/gi.source;
  const tblcmpsSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*tblcmps/gi.source;
  const replacedFn = () => renderComponentsInlineTable(getComponentRowsByCategory(componentItems, "replaced"), opts.reportId, opts.componentsStyleConfig);
  const requiredFn = () => renderComponentsInlineTable(getComponentRowsByCategory(componentItems, "required"), opts.reportId, opts.componentsStyleConfig);
  const spareFn = () => renderComponentsInlineTable(getComponentRowsByCategory(componentItems, "spare"), opts.reportId, opts.componentsStyleConfig);
  const withReplacedTable = liftBlockTagFromParagraph(withImages, tblcmprSrc, replacedFn);
  const r1 = withReplacedTable.replace(new RegExp(tblcmprSrc, "gi"), replacedFn);
  const withRequiredTable = liftBlockTagFromParagraph(r1, tblcmpqSrc, requiredFn);
  const r2 = withRequiredTable.replace(new RegExp(tblcmpqSrc, "gi"), requiredFn);
  const withTables = liftBlockTagFromParagraph(r2, tblcmpsSrc, spareFn);
  const r3 = withTables.replace(new RegExp(tblcmpsSrc, "gi"), spareFn);

  // @tagsequip and @site produce inline text — keep as simple inline replacement
  const equipmentTagsPattern = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*(?:tagsequip|tagequip(?:amentos)?)/gi;
  const withEquipmentTags = r3.replace(equipmentTagsPattern, () => renderEquipmentTagsInline(orderEquipments));
  const siteTagPattern = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*(?:site|nomesite)/gi;
  const withSite = withEquipmentTags.replace(siteTagPattern, () => renderSiteInline(siteData));

  // Block-level equipment/timesheet/techteam tables: lift out of <p> wrappers
  const tblequipSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*(?:tblequip(?:amentos)?)/gi.source;
  const timesheetSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*timesheet/gi.source;
  const techTeamSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*equipetecnica/gi.source;
  const equipTableFn = () => renderEquipmentsInlineTable(orderEquipments, opts.equipmentStyleConfig || null);
  const timesheetFn = () => renderTimesheetInlineTable(timesheetItems, opts.timesheetStyleConfig || null);
  const techTeamFn = () => renderTechTeamInlineTable(technicianItems, opts.techteamStyleConfig || null);
  const withEquipmentTable = liftBlockTagFromParagraph(withSite, tblequipSrc, equipTableFn);
  const r4 = withEquipmentTable.replace(new RegExp(tblequipSrc, "gi"), equipTableFn);
  const withTimesheet = liftBlockTagFromParagraph(r4, timesheetSrc, timesheetFn);
  const r5 = withTimesheet.replace(new RegExp(timesheetSrc, "gi"), timesheetFn);
  const withTechTeam = liftBlockTagFromParagraph(r5, techTeamSrc, techTeamFn);
  const r6 = withTechTeam.replace(new RegExp(techTeamSrc, "gi"), techTeamFn);
  const measurementsSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*ensaios(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const measurementsFn = (_match, rawId) => renderMeasurementsInlineTable(measurementTables, rawId) || _match;
  const withMeasurementsP = liftBlockTagFromParagraph(r6, measurementsSrc, measurementsFn);
  const r7 = mergeSameTitleMeasurementTables(withMeasurementsP.replace(new RegExp(measurementsSrc, "gi"), measurementsFn));

  const alberSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*alber(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const alberFn = (_match, rawId) => renderAlberLeituraTable(alberLeituras, rawId) || _match;
  const withAlberP = liftBlockTagFromParagraph(r7, alberSrc, alberFn);
  const r7b = withAlberP.replace(new RegExp(alberSrc, "gi"), alberFn);

  // @fluke521=ID -> tabela de resistência/tensão/temperatura por célula (Fluke BT521).
  // O teste de descarga do mesmo import usa @discharge=ID / @grafo=ID (discharge_tests).
  const fluke521Src = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*fluke521(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const fluke521Fn = (_match, rawId) => renderFluke521LeituraTable(leiturasFluke521, rawId) || _match;
  const withFluke521P = liftBlockTagFromParagraph(r7b, fluke521Src, fluke521Fn);
  const r7bf = withFluke521P.replace(new RegExp(fluke521Src, "gi"), fluke521Fn);

  const dischargeSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*discharge(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const dischargeFn = (_match, rawId) => renderDischargeTestTable(dischargeTests, rawId) || _match;
  const withDischargeP = liftBlockTagFromParagraph(r7bf, dischargeSrc, dischargeFn);
  const r7c = withDischargeP.replace(new RegExp(dischargeSrc, "gi"), dischargeFn);

  // @mesuaresUPS=ID -> cabeçalho (serial/firmware) + seções de medições importadas do Measures.xls
  const upsSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*mesuaresups(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const upsFn = (_match, rawId) => renderUpsMeasuresTable(upsMeasures, rawId) || _match;
  const withUpsP = liftBlockTagFromParagraph(r7c, upsSrc, upsFn);
  const r7cu = withUpsP.replace(new RegExp(upsSrc, "gi"), upsFn);

  // @eventlogUPS=ID -> cabeçalho (serial/firmware) + tabela de log de eventos importada do Event Log.xls
  const evlogSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*eventlogups(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const evlogFn = (_match, rawId) => renderEventLogTable(eventLogs, rawId, null, { maxRows: opts.eventLogPreviewMaxRows }) || _match;
  const withEvlogP = liftBlockTagFromParagraph(r7cu, evlogSrc, evlogFn);
  const r7ce = withEvlogP.replace(new RegExp(evlogSrc, "gi"), evlogFn);

  // @grafo=ID (total) | @grafo1=ID (célula 1) | @grafo2=ID (célula 2) ...
  const grafoSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*grafo(\d*)(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const grafoFn = (_match, rawCell, rawId) => {
    const cellIdx = (rawCell === "" || rawCell == null) ? -1 : (parseInt(rawCell, 10) - 1);
    return generateDischargeSvgChart(dischargeTests, rawId, cellIdx) || _match;
  };
  const withGrafoP = liftBlockTagFromParagraph(r7ce, grafoSrc, grafoFn);
  const r7d = withGrafoP.replace(new RegExp(grafoSrc, "gi"), grafoFn);

  if (!opts.expandDailyLogTags) return r7d;

  const nestedContext = {
    imageById,
    componentItems,
    equipmentById,
    timesheetItems,
    dailyLogsById,
    dailyLogsOrdered,
    technicianItems,
    orderEquipments,
    siteData,
    measurementTables,
    alberLeituras,
    leiturasFluke521,
    dischargeTests,
    upsMeasures,
    eventLogs,
    eventLogPreviewMaxRows: opts.eventLogPreviewMaxRows || null,
    timesheetStyleConfig: opts.timesheetStyleConfig || null,
    techteamStyleConfig: opts.techteamStyleConfig || null,
    equipmentStyleConfig: opts.equipmentStyleConfig || null,
    imageLabel: opts.imageLabel || "Imagem"
  };

  // @descricaodia=ID: lift out of <p> wrappers, then inline fallback
  const dailyLogTagSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*descricaodia(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const dailyLogReplacer = (_match, rawId) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return _match;
    return renderDailyLogInlineItem(dailyLogsById.get(id), id, nestedContext);
  };
  const withDailyLogsP = liftBlockTagFromParagraph(r7d, dailyLogTagSrc, dailyLogReplacer);
  const withDailyLogs = withDailyLogsP.replace(new RegExp(dailyLogTagSrc, "gi"), dailyLogReplacer);

  // @descricaodia (all logs): lift out of <p> wrappers, then inline fallback
  const dailyLogsForAll = dailyLogsOrdered.filter((l) => String(l.notes || "").trim() !== "conclusaogeral");
  const dailyLogsAllSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*descricaodia(?!((?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)))/gi.source;
  const dailyLogsAllFn = () => renderAllDailyLogsInlineItems(dailyLogsForAll, nestedContext);
  const withAllDailyLogsP = liftBlockTagFromParagraph(withDailyLogs, dailyLogsAllSrc, dailyLogsAllFn);
  const withAllDailyLogs = withAllDailyLogsP.replace(new RegExp(dailyLogsAllSrc, "gi"), dailyLogsAllFn);

  // @conclusaogeral: lift out of <p> wrappers, then inline fallback
  const conclusaoGeralLog = dailyLogsOrdered.find((l) => String(l.notes || "").trim() === "conclusaogeral");
  const conclusaoGeralSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*conclusaogeral/gi.source;
  const conclusaoGeralFn = () =>
    conclusaoGeralLog ? renderDailyLogInlineItem(conclusaoGeralLog, conclusaoGeralLog.id, nestedContext) : "";
  const withConclusaoGeralP = liftBlockTagFromParagraph(withAllDailyLogs, conclusaoGeralSrc, conclusaoGeralFn);
  const withConclusaoGeral = withConclusaoGeralP.replace(new RegExp(conclusaoGeralSrc, "gi"), conclusaoGeralFn);

  return wrapImageCardsIntoRows(mergeSameTitleMeasurementTables(withConclusaoGeral));
}

function buildPreviewModel(payload, options = {}) {
  const reportConfig = options && options.reportConfig && typeof options.reportConfig === "object"
    ? options.reportConfig
    : {};
  const templateKey = String(options && options.templateKey ? options.templateKey : reportConfig.templateKey || "").trim().toLowerCase();
  const rawOrder = payload.order || {};
  const order = withServiceOrderDisplay(rawOrder);
  const siteData = payload.site && typeof payload.site === "object" ? payload.site : {};
  const rawReport = payload.report || {};
  const signatures = Array.isArray(payload.signatures) ? payload.signatures : [];
  const vextromSignatures = signatures
    .filter((item) => String(item && item.signer_type || "").toLowerCase() === "vextrom_technician")
    .sort((a, b) => {
      const aDate = new Date(a && (a.signed_at || a.created_at || a.updated_at) || 0).getTime();
      const bDate = new Date(b && (b.signed_at || b.created_at || b.updated_at) || 0).getTime();
      if (aDate !== bDate) return bDate - aDate;
      return Number(b && b.id || 0) - Number(a && a.id || 0);
    });
  const signedTechnicianName = String(vextromSignatures[0] && vextromSignatures[0].signer_name || "").trim();
  const preparedByRaw = String(rawReport.prepared_by || "").trim();
  const systemUserFallback = String(rawOrder.created_by || rawOrder.updated_by || "").trim();
  const report = {
    ...rawReport,
    title: String(rawOrder.title || "").trim() || String(rawReport.title || "").trim(),
    prepared_by: signedTechnicianName || preparedByRaw || systemUserFallback
  };
  const documentLang = String(rawReport.document_language || "pt").trim().toLowerCase();
  const uiLabels = REPORT_UI_LABELS[documentLang] || REPORT_UI_LABELS.pt;
  const images = Array.isArray(payload.images) ? payload.images : [];
  const imageById = new Map(
    images
      .filter((item) => Number.isInteger(Number(item?.ref_id || item?.id)) && String(item?.file_path || "").trim())
      .map((item) => [
        Number(item.ref_id || item.id),
        {
          id: Number(item.ref_id || item.id),
          filePath: String(item.file_path || "").trim(),
          caption: String(item.caption || "").trim(),
          rotation: Number(item.rotation || 0)
        }
      ])
  );
  const imagesBySection = images.reduce((acc, item) => {
    const key = String(item?.section_key || "").trim().toLowerCase();
    const filePath = String(item?.file_path || "").trim();
    if (!key || !filePath) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  Object.keys(imagesBySection).forEach((key) => {
    imagesBySection[key].sort(
      (a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0)
    );
  });

  const sections = payload.sections || [];
  const previewSections = Array.isArray(sections) ? sections : [];
  const orderEquipments = Array.isArray(payload.orderEquipments) ? payload.orderEquipments : [];
  const equipmentById = new Map(
    orderEquipments
      .filter((item) => Number.isInteger(Number(item?.ref_id || item?.equipment_id)))
      .map((item) => [
        Number(item.ref_id || item.equipment_id),
        {
          id: Number(item.ref_id || item.equipment_id),
          tag: String(item.tag_number || "").trim(),
          type: String(item.type || "").trim(),
          serial: String(item.serial_number || "").trim()
        }
      ])
  );
  const componentItems = Array.isArray(payload.components) ? payload.components : [];
  const measurementTables = Array.isArray(payload.measurements) ? payload.measurements : [];
  const upsMeasures = Array.isArray(payload.upsMeasures) ? payload.upsMeasures : [];
  const eventLogs = Array.isArray(payload.eventLogs) ? payload.eventLogs : [];
  const alberLeituras = Array.isArray(payload.alberLeituras) ? payload.alberLeituras : [];
  const leiturasFluke521 = Array.isArray(payload.leiturasFluke521) ? payload.leiturasFluke521 : [];
  const dischargeTests = Array.isArray(payload.dischargeTests) ? payload.dischargeTests : [];
  const timesheetItems = Array.isArray(payload.timesheet) ? payload.timesheet : [];
  const technicianItems = Array.isArray(payload.technicians) ? payload.technicians : [];
  const timesheetStyleConfig = payload.timesheetStyleConfig || null;
  const techteamStyleConfig = payload.techteamStyleConfig || null;
  const equipmentStyleConfig = payload.equipmentStyleConfig || null;
  const componentsStyleConfig = (rawReport.components_style_config && typeof rawReport.components_style_config === "object") ? rawReport.components_style_config : null;
  const reportId = rawReport.id ? Number(rawReport.id) : null;
  const eventLogPreviewMaxRows = options && options.previewMode ? 300 : null;
  const dailyLogsOrdered = (Array.isArray(payload.dailyLogs) ? payload.dailyLogs : [])
    .filter((item) => Number.isInteger(Number(item?.id)) && Number(item.id) > 0)
    .map((item) => ({
      id: Number(item.id),
      orderSeq: Number(item.order_seq || item.id),
      activityDate: item.activity_date || "",
      title: item.title || "",
      content: item.content || "",
      notes: item.notes || ""
    }));
  const dailyLogsById = new Map(
    dailyLogsOrdered
      .filter((item) => Number.isInteger(item.orderSeq) && item.orderSeq > 0)
      .map((item) => [item.orderSeq, item])
  );
  const visibleSections = previewSections
    .filter((item) => item?.is_visible !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0));
  const orderedVisibleSections = (visibleSections.length ? visibleSections : previewSections)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id || 0) - Number(b.id || 0))
    .map((section, index) => {
      const sectionKey = String(section.section_key || "").trim().toLowerCase();
      const anchorKey = sectionKey.replace(/[^a-z0-9_]+/g, "-") || "secao";
      const anchorId = `section-${index + 1}-${anchorKey}`;
      const fromRegistry = imagesBySection[sectionKey] || [];
      let sectionImages = [];
      if (fromRegistry.length) {
        sectionImages = fromRegistry.map((item) => ({
          id: item.ref_id || item.id,
          filePath: toImagePublicSrc(item.file_path),
          caption: item.caption || "",
          sortOrder: item.sort_order
        }));
      } else {
        if (section.image_left_path) {
          sectionImages.push({
            id: null,
            filePath: toImagePublicSrc(section.image_left_path),
            caption: `${uiLabels.image} 1`,
            sortOrder: 1
          });
        }
        if (section.image_right_path) {
          sectionImages.push({
            id: null,
            filePath: toImagePublicSrc(section.image_right_path),
            caption: `${uiLabels.image} 2`,
            sortOrder: 2
          });
        }
      }

      return {
        ...section,
        anchor_id: anchorId,
        sectionImages,
        section_title_html_preview: injectTaggedImagesInHtml(
          section.section_title_html || `<p>${section.section_title || "-"}</p>`,
          imageById,
          componentItems,
          equipmentById,
          timesheetItems,
          dailyLogsById,
          dailyLogsOrdered,
          { imageLabel: uiLabels.image, timesheetStyleConfig, techteamStyleConfig, equipmentStyleConfig, componentsStyleConfig, reportId, eventLogPreviewMaxRows },
          technicianItems,
          orderEquipments,
          siteData,
          measurementTables,
          alberLeituras,
          dischargeTests,
          upsMeasures,
          eventLogs,
          leiturasFluke521
        ),
        content_html_preview: injectTaggedImagesInHtml(
          section.content_html || "<p><br></p>",
          imageById,
          componentItems,
          equipmentById,
          timesheetItems,
          dailyLogsById,
          dailyLogsOrdered,
          { imageLabel: uiLabels.image, timesheetStyleConfig, techteamStyleConfig, equipmentStyleConfig, componentsStyleConfig, reportId, eventLogPreviewMaxRows },
          technicianItems,
          orderEquipments,
          siteData,
          measurementTables,
          alberLeituras,
          dischargeTests,
          upsMeasures,
          eventLogs,
          leiturasFluke521
        ),
        section_title_html: section.section_title_html || `<p>${section.section_title || "-"}</p>`,
        section_title_text: section.section_title_text || section.section_title || "-",
        image_left_path: section.image_left_path || "",
        image_right_path: section.image_right_path || ""
      };
    });
  const rawTocConfig = payload.report && payload.report.toc_tables_config;
  const tocTablesConfig = rawTocConfig && typeof rawTocConfig === "object" && !Array.isArray(rawTocConfig)
    ? rawTocConfig
    : null;

  const sectionTableRegistry = [];
  const orderedVisibleSectionsNumbered = orderedVisibleSections.map((section, index) => {
    const { html, tables } = numberMeasurementTablesInHtml(section.content_html_preview, index + 1);
    const sectionKey = section.section_key || `section-${index + 1}`;
    const tablesWithMeta = tables.map((tbl, tblIdx) => {
      const configKey = `${sectionKey}:${tblIdx + 1}`;
      const visible = tocTablesConfig !== null && configKey in tocTablesConfig
        ? !!tocTablesConfig[configKey]
        : tbl.tableType === "measurements";
      return { ...tbl, configKey, visible };
    });
    sectionTableRegistry.push({ sectionKey, tables: tablesWithMeta });
    return { ...section, content_html_preview: html };
  });

  const sectionMap = {
    scope: getSectionContent(previewSections, "scope"),
    technicalDescription: getSectionContent(previewSections, "technical_description"),
    replacedComponents: getSectionContent(previewSections, "replaced_components"),
    requiredComponents: getSectionContent(previewSections, "required_components"),
    recommendedSpare: getSectionContent(previewSections, "recommended_spare"),
    recommendations: getSectionContent(previewSections, "recommendations"),
    conclusion: getSectionContent(previewSections, "conclusion")
  };
  const components = groupComponents(payload.components || []);

  const footerHtml = String(reportConfig && reportConfig.footerHtml != null ? reportConfig.footerHtml : "").trim();

  return {
    ...payload,
    report,
    order,
    orderedVisibleSections: orderedVisibleSectionsNumbered,
    signatures: Array.isArray(payload.signatures) ? payload.signatures : [],
    uiLabels,
    footerHtml,
    brandAssets: {
      logoVextrom: String(reportConfig.logoVextrom || process.env.SERVICE_REPORT_LOGO_VEXTROM || "/public/img/logo-vextrom.svg"),
      logoChloride: String(reportConfig.logoChloride || process.env.SERVICE_REPORT_LOGO_CHLORIDE || "").trim(),
      logoCover: String(
        reportConfig.logoCover
        || process.env.SERVICE_REPORT_LOGO_COVER
        || reportConfig.logoVextrom
        || process.env.SERVICE_REPORT_LOGO_VEXTROM
        || "/public/img/logo-vextrom.svg"
      ).trim(),
      chartMtbf: String(process.env.SERVICE_REPORT_CHART_MTBF || "").trim()
    },
    reportTemplateKey: templateKey || "modern",
    sectionMap,
    components,
    toc: orderedVisibleSectionsNumbered.map((item, index) => ({
      title: normalizeTocTitle(item),
      titleHtml: tocTitleHtml(item),
      startPage: index + 3,
      anchorId: item.anchor_id || "",
      tables: (sectionTableRegistry[index] ? sectionTableRegistry[index].tables : []).filter((t) => t.visible)
    })),
    tocTablesMeta: sectionTableRegistry.map((sec, index) => ({
      sectionKey: sec.sectionKey,
      label: normalizeTocTitle(orderedVisibleSectionsNumbered[index]),
      tables: sec.tables
    })),
    generatedAt: new Date().toISOString()
  };
}

function generateDefaultDischargeCss(testId) {
  const s = `[data-discharge-id="${testId}"]`;
  return [
    `${s} .discharge-th{border:1px solid #2d5a8e;background:#1e3a5f;color:#ffffff;padding:6px 10px;font-size:11px;font-weight:600;letter-spacing:0.03em;text-align:center;}`,
    `${s} .discharge-th-celula{border:1px solid #2d5a8e;background:#1e3a5f;color:#ffffff;padding:6px 10px;font-size:11px;font-weight:600;letter-spacing:0.03em;text-align:left;}`,
    `${s} .discharge-td{border:1px solid #cbd5e1;padding:5px 10px;font-size:11px;vertical-align:middle;text-align:center;}`,
    `${s} .discharge-td-alt{border:1px solid #cbd5e1;padding:5px 10px;font-size:11px;vertical-align:middle;text-align:center;background:#f0f4fa;}`,
    `${s} .discharge-td-celula{border:1px solid #cbd5e1;padding:5px 10px;font-size:11px;vertical-align:middle;text-align:left;font-weight:600;background:#f8fafc;}`,
    generateDischargeStatCardsCss(testId)
  ].join("\n");
}

// CSS dos cards de estatística, separado do resto de propósito: renderDischargeTestTable o
// emite SEMPRE, mesmo quando o teste tem style_config customizado. Sem isso, um teste já
// estilizado pela IA (cujo customCss não conhece estas classes) mostraria os cards crus —
// sem cor e com rótulo colado no número.
//
// O visual acompanha o da tabela: faixa de título no mesmo azul-marinho do <th>, corpo claro,
// número alinhado à direita. A mínima recebe âmbar porque num teste de descarga é o valor
// diagnóstico — é ela que denuncia a célula fraca.
function generateDischargeStatCardsCss(testId) {
  const s = `[data-discharge-id="${testId}"]`;
  return [
    `${s} .discharge-stat-cell{border:1px solid #2d5a8e;background:#ffffff;padding:0;vertical-align:top;text-align:left;}`,
    `${s} .discharge-stat-period{background:#1e3a5f;color:#ffffff;font-size:9.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:4px 8px;white-space:nowrap;overflow:hidden;}`,
    `${s} .discharge-stat-body{padding:4px 8px 5px;}`,
    // display:table/table-cell (em vez de flex) para o rótulo e o número ficarem nas
    // extremidades de forma previsível em qualquer renderizador de PDF.
    `${s} .discharge-stat-line{display:table;width:100%;line-height:1.5;white-space:nowrap;}`,
    `${s} .discharge-stat-line + .discharge-stat-line{border-top:1px solid #eef2f7;}`,
    `${s} .discharge-stat-key{display:table-cell;color:#64748b;font-size:9px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;text-align:left;vertical-align:middle;}`,
    `${s} .discharge-stat-val{display:table-cell;color:#1e3a5f;font-size:11.5px;font-weight:700;text-align:right;vertical-align:middle;font-variant-numeric:tabular-nums;}`,
    `${s} .discharge-stat-line-min .discharge-stat-val{color:#b45309;}`,
    `${s} .discharge-stat-line-avg .discharge-stat-val{color:#334155;}`,
    `${s} .discharge-block-title{font-size:12px;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 6px 0;padding-bottom:3px;border-bottom:2px solid #1e3a5f;}`,
    `${s} .discharge-limits-legend{margin:0 0 6px 0;font-size:9.5px;color:#475569;}`,
    `${s} .discharge-limits-title{font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-right:6px;}`,
    `${s} .discharge-limits-item{margin-right:12px;white-space:nowrap;}`,
    `${s} .discharge-limits-swatch{display:inline-block;width:9px;height:9px;border:1px solid #94a3b8;margin-right:4px;vertical-align:-1px;}`
  ].join("\n");
}

// Estatísticas por período do teste de descarga: para cada coluna (flutuação + cada
// checkpoint T<n>) devolve { max, min, avg, count } sobre TODAS as células, ignorando os
// valores não medidos (null). count = quantas células entraram na conta, para que a
// renderização possa mostrar "-" numa coluna sem nenhum valor em vez de 0 ou NaN.
//
// Fonte única da matemática: o relatório/PDF e as duas telas de edição consomem esta
// função, para que nenhuma delas calcule média de um jeito diferente.
function buildDischargeColumnStats(readings, options) {
  const rows = Array.isArray(readings) ? readings : [];
  const opts = options || {};
  const hourCount = Number(opts.hourCount) || 0;
  const includeFlutuacao = opts.includeFlutuacao !== false;

  const summarize = (values) => {
    const nums = values
      .map((v) => (v === null || v === undefined || v === "" ? NaN : Number(v)))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) return { max: null, min: null, avg: null, count: 0 };
    const sum = nums.reduce((a, b) => a + b, 0);
    return {
      max: Math.max(...nums),
      min: Math.min(...nums),
      avg: sum / nums.length,
      count: nums.length
    };
  };

  return {
    flutuacao: includeFlutuacao ? summarize(rows.map((r) => r.flutuacao)) : null,
    horas: Array.from({ length: hourCount }, (_, h) =>
      summarize(rows.map((r) => (Array.isArray(r.horas) ? r.horas[h] : null))))
  };
}

// Formato único dos valores da tabela de descarga: sempre 3 casas decimais e vírgula
// (x,xxx), como manda o laudo em pt-BR. As 3 casas são fixas de propósito — "2,3" e "2,300"
// não comunicam a mesma precisão de instrumento, e uma coluna com casas variando fica
// impossível de comparar a olho. Não medido continua "-".
//
// Exportada e injetada nas views (fmtDischargeValue) para que o relatório e as telas usem
// literalmente a mesma função, em vez de três cópias que podem divergir.
function formatDischargeValue(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(3).replace(".", ",");
}

// Cores padrão do destaque de limite. Amarelo nos dois lados por ser o pedido original;
// o usuário pode diferenciar min e max depois, e é por isso que são duas entradas.
const DISCHARGE_LIMIT_DEFAULT_COLORS = { min: "#fef08a", max: "#fef08a" };

// Lê display_config.{limits,colors} de um teste e devolve uma forma normalizada e segura.
// Um limite ausente/inválido vira null = "não compara desse lado", então dá para definir só
// a mínima (o caso comum num teste de descarga, onde o que interessa é a célula que caiu).
// A cor só é aceita como #rgb/#rrggbb: ela vai para dentro de um atributo style no HTML do
// relatório, e texto arbitrário vindo do banco ali seria injeção de CSS.
function resolveDischargeLimits(test) {
  const dc = test && test.display_config && typeof test.display_config === "object" ? test.display_config : {};
  const rawLimits = dc.limits && typeof dc.limits === "object" ? dc.limits : {};
  const rawColors = dc.colors && typeof dc.colors === "object" ? dc.colors : {};

  const num = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const color = (v, fallback) =>
    (typeof v === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())) ? v.trim() : fallback;

  const min = num(rawLimits.min);
  const max = num(rawLimits.max);
  return {
    min,
    max,
    // Limites invertidos (min > max) marcariam tudo: trata como não configurado.
    active: (min !== null || max !== null) && !(min !== null && max !== null && min > max),
    colors: {
      min: color(rawColors.min, DISCHARGE_LIMIT_DEFAULT_COLORS.min),
      max: color(rawColors.max, DISCHARGE_LIMIT_DEFAULT_COLORS.max)
    }
  };
}

// Qual lado do limite o valor violou: "min", "max" ou null. Valor não medido nunca é
// violação — "não medido" e "fora do limite" são coisas distintas num laudo.
function dischargeLimitBreach(value, limits) {
  if (!limits || !limits.active) return null;
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (limits.min !== null && n < limits.min) return "min";
  if (limits.max !== null && n > limits.max) return "max";
  return null;
}

function renderDischargeTestTable(dischargeTests, requestedId, styleConfig) {
  const tagId = Number(requestedId);
  const list = Array.isArray(dischargeTests) ? dischargeTests : [];
  const test = list.find((t) => Number(t && t.seq_id) === tagId)
    || list.find((t) => Number(t && t.id) === tagId);
  if (!test) return "";
  const id = Number(test.id);

  const sc = (styleConfig && typeof styleConfig === "object") ? styleConfig
    : (test.style_config && typeof test.style_config === "object") ? test.style_config
    : {};
  const css = (sc.customCss && typeof sc.customCss === "string") ? sc.customCss : generateDefaultDischargeCss(id);

  const hourLabels = Array.isArray(test.hour_labels) ? test.hour_labels : [];
  const readings = Array.isArray(test.readings) ? test.readings : [];

  if (!readings.length) return "";

  const celulaLabel = String(test.col_celula_label || "").trim() || "Célula";
  const flutuacaoLabel = String(test.col_flutuacao_label || "").trim() || "Flutuação (V)";

  // Importações do Fluke BT521 sem a tabela "mΩ-Volt" não têm tensão de flutuação (ela vem
  // do VDC dessa tabela). Uma coluna inteira de "-" não informa nada: omite-se o cabeçalho
  // e as células quando nenhuma leitura tem o valor.
  const hasFlutuacao = readings.some((row) => row.flutuacao != null);

  // Destaque por limite: a célula fora da faixa recebe a cor do lado violado, e a coluna
  // "Célula" da linha ganha uma marca na mesma cor — sem ela, achar a célula problemática
  // num banco de 180 linhas exigiria varrer a tabela inteira a olho.
  // Declarado aqui, antes dos cards: statCardsHtml é montado na sequência e já consulta os
  // limites, então deixar isto mais abaixo cairia na zona morta temporal do const.
  const limits = resolveDischargeLimits(test);

  const headerCells = [
    `<th class="discharge-th-celula">${escapeHtml(celulaLabel)}</th>`,
    ...(hasFlutuacao ? [`<th class="discharge-th">${escapeHtml(flutuacaoLabel)}</th>`] : []),
    ...hourLabels.map((h) => `<th class="discharge-th">${escapeHtml(String(h))}</th>`)
  ].join("");

  // Cards de estatística ACIMA da tabela: um card por período (mais o da flutuação, quando
  // existe), cada um com máxima/mínima/média daquela coluna. Mesmo padrão visual dos cards
  // de @fluke521/@alber, e por isso montados com <table>/<td> em vez de flex: é o layout
  // que o Puppeteer renderiza de forma previsível no PDF.
  const stats = buildDischargeColumnStats(readings, {
    hourCount: hourLabels.length,
    includeFlutuacao: hasFlutuacao
  });
  const fmtStat = formatDischargeValue;

  const statCards = [
    ...(hasFlutuacao ? [{ label: flutuacaoLabel, s: stats.flutuacao }] : []),
    ...stats.horas.map((s, h) => ({ label: String(hourLabels[h] || `T${h + 1}`), s }))
  ];

  const statLine = (kind, key, value, breach) => {
    const style = breach ? ` style="background:${limits.colors[breach]};border-radius:2px;padding:0 3px;"` : "";
    return `<div class="discharge-stat-line discharge-stat-line-${kind}">`
      + `<span class="discharge-stat-key">${key}</span>`
      + `<span class="discharge-stat-val"${style}>${escapeHtml(value)}</span></div>`;
  };

  // No card, destaca-se o próprio extremo que violou o limite: se a mínima do período está
  // abaixo do mínimo configurado, é ela que acende — é o resumo apontando onde olhar.
  const statCardCell = (card) => {
    const s = card.s;
    const minBreach = dischargeLimitBreach(s ? s.min : null, limits);
    const maxBreach = dischargeLimitBreach(s ? s.max : null, limits);
    return `<td class="discharge-stat-cell">`
      + `<div class="discharge-stat-period">${escapeHtml(card.label)}</div>`
      + `<div class="discharge-stat-body">`
      + statLine("max", "Máx", fmtStat(s ? s.max : null), maxBreach)
      + statLine("min", "Mín", fmtStat(s ? s.min : null), minBreach)
      + statLine("avg", "Méd", fmtStat(s ? s.avg : null), null)
      + `</div></td>`;
  };

  // Título do teste, acima dos cards. O data-table-title do wrapper alimenta o índice de
  // tabelas e a legenda "Tabela X.Y" do rodapé, mas não exibe o título no bloco — então
  // aqui não há duplicação. Título vazio não rende uma barra vazia.
  const blockTitle = String(test.title || "").trim();
  const blockTitleHtml = blockTitle
    ? `<div class="discharge-block-title">${escapeHtml(blockTitle)}</div>`
    : "";

  // Legenda: sem ela, uma célula amarela no PDF impresso não diz contra o que foi comparada.
  const limitsLegend = limits.active
    ? `<div class="discharge-limits-legend">`
      + `<span class="discharge-limits-title">Limites de comparação:</span>`
      + (limits.min !== null
        ? `<span class="discharge-limits-item"><span class="discharge-limits-swatch" style="background:${limits.colors.min};"></span>`
          + `abaixo de ${escapeHtml(formatDischargeValue(limits.min))}</span>` : "")
      + (limits.max !== null
        ? `<span class="discharge-limits-item"><span class="discharge-limits-swatch" style="background:${limits.colors.max};"></span>`
          + `acima de ${escapeHtml(formatDischargeValue(limits.max))}</span>` : "")
      + `</div>`
    : "";

  // Quebra em linhas de no máximo 6 cards: com muitos checkpoints, uma única linha
  // comprimiria cada card até os números ficarem ilegíveis na folha.
  const STAT_CARDS_PER_ROW = 6;
  const statCardRows = [];
  for (let c = 0; c < statCards.length; c += STAT_CARDS_PER_ROW) {
    statCardRows.push(statCards.slice(c, c + STAT_CARDS_PER_ROW));
  }
  const statCardsHtml = statCards.length
    ? `<table data-discharge-id="${id}" style="width:100%;border-collapse:collapse;margin:0 0 6px 0;table-layout:fixed;page-break-inside:avoid;break-inside:avoid;">`
      + statCardRows.map((row) => {
        // Preenche a última linha com células vazias para os cards não esticarem.
        const filler = row.length < STAT_CARDS_PER_ROW && statCardRows.length > 1
          ? `<td style="border:none;"></td>`.repeat(STAT_CARDS_PER_ROW - row.length)
          : "";
        return `<tr style="page-break-inside:avoid;break-inside:avoid;">${row.map(statCardCell).join("")}${filler}</tr>`;
      }).join("")
      + `</table>`
    : "";

  const breachStyle = (breach) => {
    if (!breach) return "";
    const bg = limits.colors[breach];
    return ` style="background:${bg};font-weight:700;"`;
  };

  const rows = readings.map((row, idx) => {
    const tdClass = idx % 2 === 0 ? "discharge-td" : "discharge-td-alt";
    const horas = Array.isArray(row.horas) ? row.horas : [];

    const flutBreach = hasFlutuacao ? dischargeLimitBreach(row.flutuacao, limits) : null;
    const horaBreaches = horas.map((v) => dischargeLimitBreach(v, limits));
    // A marca da linha usa o primeiro lado violado encontrado na linha.
    const rowBreach = flutBreach || horaBreaches.find((b) => b) || null;

    const cells = [
      `<td class="discharge-td-celula"${breachStyle(rowBreach)}>${escapeHtml(String(row.celula))}</td>`,
      ...(hasFlutuacao ? [`<td class="${tdClass}"${breachStyle(flutBreach)}>${escapeHtml(formatDischargeValue(row.flutuacao))}</td>`] : []),
      ...horas.map((v, h) => `<td class="${tdClass}"${breachStyle(horaBreaches[h])}>${escapeHtml(formatDischargeValue(v))}</td>`)
    ].join("");
    return `<tr style="page-break-inside:avoid;break-inside:avoid;">${cells}</tr>`;
  }).join("");

  return `
    <div class="report-inline-discharge-wrap" data-discharge-id="${id}" data-table-title="${escapeHtml(test.title || "")}" style="margin:8px 0 16px 0;break-inside:avoid;page-break-inside:avoid;overflow-x:auto;">
      <!-- O CSS dos cards vem SEMPRE, e antes do css do teste: um style_config customizado
           (gerado pela IA antes destes cards existirem) não conhece as classes novas e
           deixaria os cards sem cor nem alinhamento. Vindo antes, segue sobrescrevível
           por uma customização futura que mencione as mesmas classes. -->
      <style>${generateDischargeStatCardsCss(id)}</style>
      <style>${css}</style>
      ${blockTitleHtml}
      ${statCardsHtml}
      ${limitsLegend}
      <table data-discharge-id="${id}" style="width:100%;border-collapse:collapse;line-height:1.3;white-space:nowrap;">
        <thead style="display:table-header-group;">
          <tr style="page-break-inside:avoid;break-inside:avoid;">${headerCells}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function generateDefaultDischargeChartCss(testId) {
  const s = `[data-discharge-chart-id="${testId}"]`;
  return [
    `${s} .dch-chart-header{background:linear-gradient(135deg,#1c3a0a 0%,#2f5c18 52%,#4a7a30 100%) !important;color:#ffffff !important;}`,
    `${s} .dch-chart-line{stroke:#4a7a30;stroke-width:2.5px;}`,
    `${s} .dch-chart-fill{fill:rgba(74,122,48,0.28);}`,
    `${s} .dch-chart-point{fill:#4a7a30;}`,
    `${s} .dch-chart-point-label{fill:#4a7a30;}`
  ].join("\n");
}

function generateDischargeSvgChart(dischargeTests, testId, seriesIndex, styleConfig) {
  const tagId = Number(testId);
  const list = Array.isArray(dischargeTests) ? dischargeTests : [];
  const test = list.find((t) => Number(t && t.seq_id) === tagId)
    || list.find((t) => Number(t && t.id) === tagId);
  if (!test) return "";
  const id = Number(test.id);

  const hourLabels = Array.isArray(test.hour_labels) ? test.hour_labels : [];
  const readings   = Array.isArray(test.readings) ? test.readings : [];
  if (!readings.length) return "";

  const cellIdx = Number(seriesIndex); // -1 = tensão total; 0+ = índice da célula (0-based)

  // Sem tensão de flutuação (import do BT521 só com a tabela de descarga) o ponto inicial
  // somaria nulos e o gráfico começaria num zero inexistente: o eixo começa no 1º checkpoint.
  const hasFlutuacao = readings.some((row) => row.flutuacao != null);
  const xLabels = hasFlutuacao
    ? [String(test.col_flutuacao_label || "").trim() || "Flutuação", ...hourLabels]
    : [...hourLabels];
  const n = xLabels.length;
  const hourAt = (ci) => (hasFlutuacao ? ci - 1 : ci); // índice em row.horas para a coluna ci

  let yValues, seriesLabel, isTotal;
  if (cellIdx < 0) {
    isTotal = true;
    seriesLabel = "Tensão Total";
    yValues = xLabels.map((_, ci) =>
      readings.reduce((sum, row) => {
        const v = (hasFlutuacao && ci === 0)
          ? parseFloat(row.flutuacao)
          : parseFloat((Array.isArray(row.horas) ? row.horas : [])[hourAt(ci)]);
        return sum + (isNaN(v) ? 0 : v);
      }, 0)
    );
  } else {
    isTotal = false;
    const reading = readings[cellIdx];
    if (!reading) return "";
    seriesLabel = String(reading.celula || `Célula ${cellIdx + 1}`);
    yValues = xLabels.map((_, ci) => {
      const v = (hasFlutuacao && ci === 0)
        ? parseFloat(reading.flutuacao)
        : parseFloat((Array.isArray(reading.horas) ? reading.horas : [])[hourAt(ci)]);
      return isNaN(v) ? null : v;
    });
  }

  const validVals = yValues.filter((v) => v !== null && !isNaN(v));
  if (!validVals.length) return "";

  const chartCss = (styleConfig && styleConfig.customCss)
    ? styleConfig.customCss
    : (test.style_config && test.style_config.chartCustomCss)
    ? test.style_config.chartCustomCss
    : generateDefaultDischargeChartCss(id);

  const f = (num) => Number(num).toFixed(2);

  // Layout
  const W = 660, H = 270;
  const mL = 66, mR = 16, mT = 28, mB = 54;
  const pW = W - mL - mR;
  const pH = H - mT - mB;

  const minY = Math.min(...validVals);
  const maxY = Math.max(...validVals);
  const rangeY = maxY - minY;
  const padY = rangeY > 0 ? rangeY * 0.18 : (maxY * 0.05 || 1);
  const yMin = Math.max(0, minY - padY);
  const yMax = maxY + padY;
  const yRange = yMax - yMin || 1;

  const toX = (i) => mL + (n > 1 ? (i / (n - 1)) : 0.5) * pW;
  const toY = (v) => v === null ? null : mT + (1 - (v - yMin) / yRange) * pH;

  const points = yValues.map((v, i) => ({ x: toX(i), y: toY(v) }));

  // Smooth bezier (catmull-rom → cubic)
  function smoothPath(pts) {
    const vp = pts.filter((p) => p.y !== null);
    if (!vp.length) return "";
    if (vp.length === 1) return `M ${f(vp[0].x)} ${f(vp[0].y)}`;
    const t = 0.3;
    let d = `M ${f(vp[0].x)} ${f(vp[0].y)}`;
    for (let i = 0; i < vp.length - 1; i++) {
      const p0 = vp[Math.max(0, i - 1)];
      const p1 = vp[i];
      const p2 = vp[i + 1];
      const p3 = vp[Math.min(vp.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${f(cp1x)} ${f(cp1y)} ${f(cp2x)} ${f(cp2y)} ${f(p2.x)} ${f(p2.y)}`;
    }
    return d;
  }

  const linePath = smoothPath(points);
  const vpts = points.filter((p) => p.y !== null);
  const fillPath = vpts.length && linePath
    ? `${linePath} L ${f(vpts[vpts.length - 1].x)} ${f(mT + pH)} L ${f(vpts[0].x)} ${f(mT + pH)} Z`
    : "";

  const lineColor = isTotal ? "#4a7a30" : "#6aaa42";
  const gradId    = `dchG_${id}_${cellIdx < 0 ? "t" : cellIdx}`;
  const gradTop   = isTotal ? "rgba(74,122,48,0.32)"  : "rgba(106,170,66,0.26)";
  const gradMid   = isTotal ? "rgba(93,143,61,0.10)"  : "rgba(106,170,66,0.08)";

  const nTicks = 5;
  const yTicks = Array.from({ length: nTicks }, (_, i) => ({
    v: yMin + yRange * i / (nTicks - 1),
    y: toY(yMin + yRange * i / (nTicks - 1))
  }));

  const decimals  = isTotal ? 2 : 3;
  const initVal   = yValues[0];
  const finalVal  = yValues[yValues.length - 1];
  const dropV     = (initVal !== null && finalVal !== null) ? initVal - finalVal : null;
  const dropPct   = (dropV !== null && initVal > 0) ? (dropV / initVal * 100) : null;
  const testTitle = String(test.title || `Teste de Descarga #${id}`);
  const subtitle  = isTotal
    ? `Curva de Tensão Total — ${readings.length} célula${readings.length !== 1 ? "s" : ""}`
    : `Curva da Célula ${escapeHtml(seriesLabel)}`;

  // ── Header ──────────────────────────────────────────
  let html = `<div class="report-inline-discharge-chart-wrap avoid-break" data-discharge-chart-id="${id}" style="margin:10px 0 20px 0;break-inside:avoid;page-break-inside:avoid;font-family:'Segoe UI',Arial,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">`;
  html += `<style>${chartCss}</style>`;
  html += `<div class="dch-chart-header" style="background:linear-gradient(135deg,#1c3a0a 0%,#2f5c18 52%,#4a7a30 100%);padding:11px 16px 9px;color:#fff;">`;
  html += `<div style="font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.5;margin-bottom:3px;font-weight:600;">CURVA DE DESCARGA</div>`;
  html += `<div style="font-size:13px;font-weight:700;line-height:1.25;">${escapeHtml(testTitle)}</div>`;
  html += `<div style="font-size:9.5px;opacity:.65;margin-top:2px;">${subtitle}`;
  if (test.measurement_date) html += ` &nbsp;&middot;&nbsp; ${escapeHtml(String(test.measurement_date))}`;
  html += `</div></div>`;

  // ── Stats bar ────────────────────────────────────────
  if (initVal !== null && finalVal !== null) {
    const sc = "flex:1;padding:9px 12px;border-right:1px solid #f1f5f9;text-align:center;min-width:0;";
    const sl = "display:block;font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;";
    const su = "font-size:9px;font-weight:400;color:#94a3b8;margin-left:1px;";
    const sv = (clr) => `font-size:16px;font-weight:700;color:${clr || "#3d6b22"};line-height:1.1;`;
    const dropColor = (dropV || 0) > 0.001 ? "#dc2626" : ((dropV || 0) < -0.001 ? "#16a34a" : "#3d6b22");
    const sign = (dropV || 0) >= 0 ? "−" : "+";

    html += `<div style="display:flex;background:#fff;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;">`;
    html += `<div style="${sc}"><span style="${sl}">Tensão inicial</span><div style="${sv()}">` + initVal.toFixed(decimals) + `<span style="${su}">V</span></div></div>`;
    html += `<div style="${sc}"><span style="${sl}">Tensão final</span><div style="${sv((dropV || 0) > 0.001 ? "#b45309" : "#3d6b22")}">` + finalVal.toFixed(decimals) + `<span style="${su}">V</span></div></div>`;
    if (dropV !== null) {
      html += `<div style="${sc}"><span style="${sl}">Queda total</span><div style="${sv(dropColor)}">${sign}` + Math.abs(dropV).toFixed(decimals) + `<span style="${su}">V</span>`;
      if (dropPct !== null) html += `<span style="font-size:9px;color:${dropColor};margin-left:3px;">(${Math.abs(dropPct).toFixed(1)}%)</span>`;
      html += `</div></div>`;
    }
    html += isTotal
      ? `<div style="${sc}"><span style="${sl}">Células</span><div style="${sv()}">${readings.length}</div></div>`
      : `<div style="${sc}"><span style="${sl}">Célula</span><div style="${sv()};font-size:14px;">${escapeHtml(seriesLabel)}</div></div>`;
    if (isTotal && test.nominal_voltage) {
      html += `<div style="${sc}border-right:none;"><span style="${sl}">V nominal</span><div style="${sv()}">` + parseFloat(test.nominal_voltage).toFixed(0) + `<span style="${su}">V</span></div></div>`;
    }
    html += `</div>`;
  }

  // ── SVG chart ────────────────────────────────────────
  html += `<div style="background:#fff;border-left:1px solid #f1f5f9;border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;border-radius:0 0 8px 8px;padding:10px 6px 4px;">`;
  html += `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;" xmlns="http://www.w3.org/2000/svg">`;
  html += `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">`;
  html += `<stop offset="0%" stop-color="${gradTop}"/>`;
  html += `<stop offset="55%" stop-color="${gradMid}"/>`;
  html += `<stop offset="100%" stop-color="rgba(0,0,0,0)"/>`;
  html += `</linearGradient></defs>`;

  // Plot background
  html += `<rect x="${mL}" y="${mT}" width="${pW}" height="${pH}" fill="#f9fafb" rx="3"/>`;

  // Y grid + labels
  yTicks.forEach((tick) => {
    html += `<line x1="${mL}" y1="${f(tick.y)}" x2="${mL + pW}" y2="${f(tick.y)}" stroke="#eef2f7" stroke-width="1"/>`;
    html += `<text x="${mL - 6}" y="${f(tick.y + 3.5)}" text-anchor="end" font-size="9.5" fill="#94a3b8" font-family="Segoe UI,Arial,sans-serif">${tick.v.toFixed(decimals)}</text>`;
  });

  // Y axis title (rotated)
  const yAxisLabel = isTotal ? "Tensão Total (V)" : `${escapeHtml(seriesLabel)} (V)`;
  html += `<text transform="rotate(-90,${mL - 46},${f(mT + pH / 2)})" x="${mL - 46}" y="${f(mT + pH / 2 + 3)}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="Segoe UI,Arial,sans-serif">${yAxisLabel}</text>`;

  // X grid + labels
  const needsRotate = n > 7;
  xLabels.forEach((label, i) => {
    const x = toX(i);
    if (i > 0 && i < n - 1) {
      html += `<line x1="${f(x)}" y1="${mT}" x2="${f(x)}" y2="${f(mT + pH)}" stroke="#eef2f7" stroke-width="1" stroke-dasharray="3 3"/>`;
    }
    const ty = mT + pH + (needsRotate ? 13 : 16);
    if (needsRotate) {
      html += `<text transform="rotate(-38,${f(x)},${ty})" x="${f(x)}" y="${ty}" text-anchor="end" font-size="9.5" fill="#64748b" font-family="Segoe UI,Arial,sans-serif">${escapeHtml(String(label))}</text>`;
    } else {
      html += `<text x="${f(x)}" y="${ty}" text-anchor="middle" font-size="9.5" fill="#64748b" font-family="Segoe UI,Arial,sans-serif">${escapeHtml(String(label))}</text>`;
    }
  });

  // Axes
  html += `<line x1="${mL}" y1="${mT}" x2="${mL}" y2="${f(mT + pH)}" stroke="#e2e8f0" stroke-width="1.5"/>`;
  html += `<line x1="${mL}" y1="${f(mT + pH)}" x2="${f(mL + pW)}" y2="${f(mT + pH)}" stroke="#e2e8f0" stroke-width="1.5"/>`;

  // Fill area
  if (fillPath) html += `<path class="dch-chart-fill" d="${fillPath}" fill="url(#${gradId})"/>`;

  // Line
  if (linePath) html += `<path class="dch-chart-line" d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Points + value labels
  const showLabels = n <= 10;
  points.forEach((p, i) => {
    if (p.y === null) return;
    html += `<circle class="dch-chart-point" cx="${f(p.x)}" cy="${f(p.y)}" r="4.5" fill="${lineColor}" stroke="#fff" stroke-width="2"/>`;
    if (showLabels && yValues[i] !== null) {
      html += `<text class="dch-chart-point-label" x="${f(p.x)}" y="${f(p.y - 8)}" text-anchor="middle" font-size="9" fill="${lineColor}" font-family="Segoe UI,Arial,sans-serif" font-weight="600">${yValues[i].toFixed(decimals)}</text>`;
    }
  });

  html += `</svg></div></div>`;
  return html;
}

module.exports = {
  buildPreviewModel,
  renderMeasurementsInlineTable,
  renderUpsMeasuresTable,
  renderEventLogTable,
  generateDefaultCss,
  renderAlberLeituraTable,
  generateDefaultAlberCss,
  renderFluke521LeituraTable,
  generateDefaultFluke521Css,
  renderDischargeTestTable,
  buildDischargeColumnStats,
  formatDischargeValue,
  resolveDischargeLimits,
  dischargeLimitBreach,
  generateDefaultDischargeCss,
  generateDischargeSvgChart,
  generateDefaultDischargeChartCss,
  renderTimesheetInlineTable,
  generateDefaultTimesheetCss,
  renderTechTeamInlineTable,
  generateDefaultTechteamCss,
  renderEquipmentsInlineTable,
  generateDefaultEquipmentCss,
  renderComponentsInlineTable,
  generateDefaultComponentsCss
};
