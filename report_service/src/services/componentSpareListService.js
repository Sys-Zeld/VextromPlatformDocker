const XLSX = require("xlsx");

function cleanText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizePartNumber(value) {
  return cleanText(value).toLocaleUpperCase("pt-BR");
}

function positiveQuantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function categoryLabel(value) {
  const clean = cleanText(value);
  const normalized = clean.toLocaleLowerCase("pt-BR");
  if (["substituidos", "substituído", "substituido"].includes(normalized)) return "Substituídos";
  if (["para_troca", "para troca", "required"].includes(normalized)) return "Para troca";
  if (["recomendados", "recomendado", "spare", "spare_recommended"].includes(normalized)) return "Recomendados para spare";
  return clean;
}

function uniquePush(list, value) {
  const clean = cleanText(value);
  if (clean && !list.some((item) => item.toLocaleLowerCase("pt-BR") === clean.toLocaleLowerCase("pt-BR"))) {
    list.push(clean);
  }
}

function preferredDescription(counts) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0], "pt-BR", { sensitivity: "base" }))[0]?.[0] || "";
}

function buildComponentSpareList(order, components = []) {
  const grouped = new Map();
  let omittedMissingPartNumber = 0;

  (Array.isArray(components) ? components : []).forEach((component) => {
    const partNumber = cleanText(component && component.part_number);
    const key = normalizePartNumber(partNumber);
    if (!key) {
      omittedMissingPartNumber += 1;
      return;
    }

    if (!grouped.has(key)) {
      grouped.set(key, {
        partNumber,
        quantity: 0,
        sourceRows: 0,
        categories: [],
        equipmentTags: [],
        equipments: [],
        notes: [],
        descriptionCounts: new Map()
      });
    }

    const item = grouped.get(key);
    item.quantity += positiveQuantity(component.quantity);
    item.sourceRows += 1;
    uniquePush(item.categories, categoryLabel(component.category));
    uniquePush(item.equipmentTags, component.equipment_tag);
    uniquePush(item.notes, component.notes);

    const equipmentLabel = [
      cleanText(component.equipment_type),
      cleanText(component.equipment_serial) && `S/N ${cleanText(component.equipment_serial)}`
    ].filter(Boolean).join(" - ");
    uniquePush(item.equipments, equipmentLabel);

    const description = cleanText(component.description);
    if (description) item.descriptionCounts.set(description, (item.descriptionCounts.get(description) || 0) + 1);
  });

  const items = [...grouped.values()]
    .map((item) => ({
      partNumber: item.partNumber,
      description: preferredDescription(item.descriptionCounts),
      quantity: item.quantity,
      categories: item.categories,
      equipmentTags: item.equipmentTags,
      equipments: item.equipments,
      notes: item.notes,
      sourceRows: item.sourceRows
    }))
    .sort((a, b) => a.partNumber.localeCompare(b.partNumber, "pt-BR", { numeric: true, sensitivity: "base" }));

  return {
    order: {
      id: Number(order && order.id),
      code: cleanText(order && order.service_order_code) || `OS-${Number(order && order.id)}`,
      title: cleanText(order && order.title),
      customer: cleanText(order && order.customer_name),
      site: cleanText(order && order.site_name)
    },
    generatedAt: new Date().toISOString(),
    summary: {
      distinctPartNumbers: items.length,
      sourceComponents: items.reduce((sum, item) => sum + item.sourceRows, 0),
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      omittedMissingPartNumber
    },
    items
  };
}

function buildComponentSpareListWorkbook(document) {
  const rows = [
    ["LISTA CONSOLIDADA DE SPARE PARTS PARA COMPRA"],
    ["OS", document.order.code, "Cliente", document.order.customer],
    ["Título", document.order.title, "Site", document.order.site],
    ["PN distintos", document.summary.distinctPartNumbers, "Quantidade total", document.summary.totalQuantity],
    [],
    ["Item", "Part Number", "Descrição", "Quantidade", "Categorias", "TAGs", "Equipamentos", "Observações"]
  ];

  document.items.forEach((item, index) => {
    rows.push([
      index + 1,
      item.partNumber,
      item.description,
      item.quantity,
      item.categories.join(", "),
      item.equipmentTags.join(", "),
      item.equipments.join(" | "),
      item.notes.join(" | ")
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  sheet["!cols"] = [
    { wch: 8 }, { wch: 22 }, { wch: 52 }, { wch: 14 },
    { wch: 24 }, { wch: 24 }, { wch: 38 }, { wch: 42 }
  ];
  sheet["!autofilter"] = { ref: `A6:H${Math.max(6, rows.length)}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Lista de spare parts");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
}

module.exports = {
  buildComponentSpareList,
  buildComponentSpareListWorkbook,
  normalizePartNumber
};
