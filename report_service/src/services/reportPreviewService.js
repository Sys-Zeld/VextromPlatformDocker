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
  const imgStyle = swapDims
    ? `object-fit:cover;width:250px;height:250px;display:block;${rotateStyle}`
    : `object-fit:cover;width:250px;height:250px;display:block;${rotateStyle}`;
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

function renderSingleEquipmentComponentsTable(componentRows) {
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

  return `
    <div class="report-inline-components-wrap avoid-break" data-table-title="${equipmentName}">
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

function renderComponentsInlineTable(componentItems) {
  const rows = Array.isArray(componentItems) ? componentItems : [];
  if (!rows.length) return renderSingleEquipmentComponentsTable([]);

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
    .map((groupRows) => renderSingleEquipmentComponentsTable(groupRows))
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

function renderTimesheetInlineTable(timesheetItems) {
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

  return `
    <div class="report-inline-timesheet-wrap avoid-break" data-table-title="TIME SHEET">
      <table class="report-inline-timesheet-table">
        <thead>
          <tr class="report-inline-timesheet-title-row">
            <th colspan="5">TIME SHEET</th>
          </tr>
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

function renderTechTeamInlineTable(technicianItems) {
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

  return `
    <div class="report-inline-techteam-wrap avoid-break" data-table-title="EQUIPE TECNICA">
      <table class="report-inline-techteam-table">
        <thead>
          <tr class="report-inline-techteam-title-row">
            <th colspan="3">EQUIPE TECNICA</th>
          </tr>
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

function renderMeasurementsInlineTable(measurementTables, requestedId) {
  const id = Number(requestedId);
  const table = normalizeMeasurementList(measurementTables)
    .find((item) => Number(item && item.id) === id);
  if (!table) return "";

  const columns = normalizeMeasurementList(table.columns_json)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const safeColumns = columns.length ? columns : ["Teste", "Valor", "Observacoes"];
  const rows = normalizeMeasurementList(table.rows_json);

  const borderColor = "#87b86a";
  const thStyle = `border:1px solid ${borderColor};background:#5d8f3d;color:#ffffff;padding:6px 9px;text-align:left;font-weight:600;font-size:11px;letter-spacing:0.04em;`;
  const tdBase = `border:1px solid ${borderColor};padding:5px 9px;height:22px;vertical-align:top;font-size:12px;`;
  const tdAlt = `${tdBase}background:#f0f5e8;`;

  const bodyRows = rows.length
    ? rows.map((row, rowIndex) => {
      const source = Array.isArray(row) ? row : [];
      const tdStyle = rowIndex % 2 === 0 ? tdBase : tdAlt;
      const cells = safeColumns.map((_, index) => `<td style="${tdStyle}">${safeText(source[index] || "")}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("")
    : `<tr><td colspan="${safeColumns.length}" style="${tdBase}color:#6b7280;">Sem medicoes cadastradas.</td></tr>`;

  const title = decodeHtmlEntities(String(table.title || "")).trim();
  const notes = decodeHtmlEntities(String(table.notes || "")).trim();
  const titleTheadRow = title
    ? `<tr><th colspan="${safeColumns.length}" style="border:1px solid ${borderColor};background:#5d8f3d;color:#ffffff;padding:7px 9px;font-weight:700;font-size:16px;letter-spacing:0.01em;">${escapeHtml(title)}</th></tr>`
    : "";
  const notesHtml = notes
    ? `<div class="report-inline-meas-notes" style="font-size:18px;line-height:1.4;margin-top:6px;white-space:pre-wrap;color:#374151;"><strong>Observações:</strong> ${escapeHtml(notes)}</div>`
    : "";

  return `
    <div class="report-inline-measurements-wrap avoid-break" data-table-title="${escapeHtml(title)}" style="margin:8px 0 14px 0;break-inside:avoid;page-break-inside:avoid;">
      <table class="report-inline-measurements-table" style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.3;">
        <thead>
          ${titleTheadRow}
          <tr>
            ${safeColumns.map((column) => `<th style="${thStyle}">${safeText(column)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${notesHtml}
    </div>
  `;
}

function normalizeInlineCellValue(value, fallback = "-") {
  const raw = String(value == null ? "" : value).trim();
  return raw || fallback;
}

function renderEquipmentsInlineTable(orderEquipments) {
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
        <thead>
          <tr class="report-inline-equipments-title-row">
            <th colspan="${columnsPerRow}">${escapeHtml(tableTitle)}</th>
          </tr>
        </thead>
        <tbody>${renderPairsRows(pairs)}</tbody>
      </table>
    `;
  }).join("");

  return `<div class="report-inline-equipments-wrap avoid-break" data-table-title="Equipamentos">${tablesHtml}</div>`;
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
    { expandDailyLogTags: false, imageLabel: context.imageLabel },
    context.technicianItems || [],
    context.orderEquipments || [],
    context.siteData || {},
    context.measurementTables || []
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

    const group = [blocks[i]];

    if (title) {
      let j = i + 1;
      while (j < blocks.length) {
        const between = source.slice(group[group.length - 1].end, blocks[j].start);
        if (!isOnlyPaddingBetweenMeasurements(between)) break;
        const nextTitleMatch = /data-table-title="([^"]+)"/.exec(source.slice(blocks[j].start, blocks[j].end));
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
  if (blockHtml.includes("report-inline-measurements-wrap")) return "measurements";
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
    tables.push({ label, title, anchorId, tableType });

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

function injectTaggedImagesInHtml(contentHtml, imageById, componentItems, equipmentById, timesheetItems, dailyLogsById, dailyLogsOrdered, options = {}, technicianItems = [], orderEquipments = [], siteData = {}, measurementTables = []) {
  const source = String(contentHtml || "");
  if (!source) return "<p><br></p>";
  const opts = {
    expandDailyLogTags: options.expandDailyLogTags !== false
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
  const replacedFn = () => renderComponentsInlineTable(getComponentRowsByCategory(componentItems, "replaced"));
  const requiredFn = () => renderComponentsInlineTable(getComponentRowsByCategory(componentItems, "required"));
  const spareFn = () => renderComponentsInlineTable(getComponentRowsByCategory(componentItems, "spare"));
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
  const equipTableFn = () => renderEquipmentsInlineTable(orderEquipments);
  const timesheetFn = () => renderTimesheetInlineTable(timesheetItems);
  const techTeamFn = () => renderTechTeamInlineTable(technicianItems);
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

  if (!opts.expandDailyLogTags) return r7;

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
    imageLabel: opts.imageLabel || "Imagem"
  };

  // @descricaodia=ID: lift out of <p> wrappers, then inline fallback
  const dailyLogTagSrc = /(?:@|&#64;)(?:\s|&nbsp;|<[^>]+>)*descricaodia(?:\s|&nbsp;|<[^>]+>)*(?:=|&#61;)(?:\s|&nbsp;|<[^>]+>)*(\d+)/gi.source;
  const dailyLogReplacer = (_match, rawId) => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) return _match;
    return renderDailyLogInlineItem(dailyLogsById.get(id), id, nestedContext);
  };
  const withDailyLogsP = liftBlockTagFromParagraph(r7, dailyLogTagSrc, dailyLogReplacer);
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
  const timesheetItems = Array.isArray(payload.timesheet) ? payload.timesheet : [];
  const technicianItems = Array.isArray(payload.technicians) ? payload.technicians : [];
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
          { imageLabel: uiLabels.image },
          technicianItems,
          orderEquipments,
          siteData,
          measurementTables
        ),
        content_html_preview: injectTaggedImagesInHtml(
          section.content_html || "<p><br></p>",
          imageById,
          componentItems,
          equipmentById,
          timesheetItems,
          dailyLogsById,
          dailyLogsOrdered,
          { imageLabel: uiLabels.image },
          technicianItems,
          orderEquipments,
          siteData,
          measurementTables
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

module.exports = {
  buildPreviewModel
};
