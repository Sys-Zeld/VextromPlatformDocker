const XLSX = require("xlsx");

// Exportação em XLSX das listas de "Peças por equipamento" — mesma tabela
// exibida/impressa em EquipmentSparesPanel (frontend), tanto por equipamento
// quanto no consolidado por cliente/site.

const HEADER = ["#", "Descrição", "Part Number", "Fabricante", "Família", "Lead time", "Qtd.", "Status"];

function equipmentLabel(e) {
  const tag = String((e && e.tag_number) || "").trim();
  const rest = [e && e.type, e && e.serial_number && `S/N ${e.serial_number}`].filter(Boolean).join(" · ");
  if (tag && rest) return `TAG ${tag} — ${rest}`;
  if (tag) return `TAG ${tag}`;
  return rest || `Equipamento #${e && e.id}`;
}

function spareRow(s, idx) {
  return [
    idx + 1,
    s.description || "",
    s.part_number || "",
    s.manufacturer || "",
    s.equipment_family || "",
    s.lead_time || "",
    Number(s.quantity) || 0,
    s.is_obsolete ? "Obsoleta" : "Ativa"
  ];
}

const COLS = [
  { wch: 5 }, { wch: 42 }, { wch: 20 }, { wch: 20 },
  { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 12 }
];

function buildEquipmentSpareListWorkbook(equipment, spares) {
  const rows = [
    ["LISTA DE PEÇAS POR EQUIPAMENTO"],
    ["Equipamento", equipmentLabel(equipment)],
    ["Cliente", equipment.customer_name || "-", "Site", equipment.site_name || "-"],
    ["Itens", spares.length, "Quantidade total", spares.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)],
    []
  ];
  const headerRow = rows.length + 1;
  rows.push(HEADER);
  spares.forEach((s, idx) => rows.push(spareRow(s, idx)));

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
  sheet["!cols"] = COLS;
  sheet["!autofilter"] = { ref: `A${headerRow}:H${Math.max(headerRow, rows.length)}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Peças");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
}

// Consolidado: uma única tabela achatada (equipamento + peça por linha), que é
// o formato mais útil para filtro/tabela dinâmica no Excel.
function buildConsolidatedSpareListWorkbook(groups, filterLabel) {
  const totalItems = groups.reduce((sum, g) => sum + g.spares.length, 0);
  const totalQty = groups.reduce((sum, g) => sum + g.spares.reduce((n, s) => n + (Number(s.quantity) || 0), 0), 0);

  const rows = [
    ["LISTA DE PEÇAS POR EQUIPAMENTO — CONSOLIDADO"],
    ["Filtro", filterLabel || "Todos os clientes"],
    ["Equipamentos", groups.length, "Itens", totalItems, "Quantidade total", totalQty],
    []
  ];
  const headerRow = rows.length + 1;
  rows.push(["Cliente", "Site", "Equipamento", ...HEADER]);

  for (const g of groups) {
    g.spares.forEach((s, idx) => {
      const [num, description, partNumber, manufacturer, family, leadTime, quantity, status] = spareRow(s, idx);
      rows.push([
        g.equipment.customer_name || "",
        g.equipment.site_name || "",
        equipmentLabel(g.equipment),
        num, description, partNumber, manufacturer, family, leadTime, quantity, status
      ]);
    });
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];
  sheet["!cols"] = [{ wch: 24 }, { wch: 20 }, { wch: 30 }, ...COLS];
  sheet["!autofilter"] = { ref: `A${headerRow}:K${Math.max(headerRow, rows.length)}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Consolidado");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
}

module.exports = { buildEquipmentSpareListWorkbook, buildConsolidatedSpareListWorkbook };
