const db = require("../../db");
const { SECTION_DEFINITIONS, SECTION_SEED_HTML } = require("../constants");
const EMPTY_DELTA = { ops: [{ insert: "\n" }] };
const DEFAULT_SECTION_CONFIG_KEYS = {
  scope: "report.preview.sections.scope.default_html",
  recommendations: "report.preview.sections.recommendations.default_html"
};

function toInt(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function stripHtmlToText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deltaFromText(value) {
  const text = String(value || "").trim();
  return {
    ops: [{ insert: `${text}\n` }]
  };
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "on", "yes"].includes(normalized);
}

async function getOrderCodeSequence(year) {
  const normalizedYear = Number(year);
  const yearForSequence = Number.isInteger(normalizedYear) ? normalizedYear : new Date().getFullYear();
  const seed = await getOrderCodeSeed(yearForSequence);
  const result = await db.query(
    `
      SELECT COUNT(*)::int AS total
      FROM service_report_orders
      WHERE year = $1
    `,
    [yearForSequence]
  );
  const byCount = Number(result.rows[0]?.total || 0) + 1;
  return Math.max(byCount, seed || 0);
}

async function getAppSetting(key) {
  const result = await db.query(
    `
      SELECT value
      FROM service_report_app_settings
      WHERE key = $1
      LIMIT 1
    `,
    [String(key || "")]
  );
  return result.rows[0]?.value || null;
}

async function upsertAppSetting(key, value) {
  await db.query(
    `
      INSERT INTO service_report_app_settings (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [String(key || ""), String(value || "")]
  );
}

async function touchReport(serviceReportId) {
  const id = Number(serviceReportId);
  if (!Number.isInteger(id) || id <= 0) return;
  await db.query(
    `UPDATE service_report_reports SET last_modified_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id]
  );
}

async function touchReportByOrderId(serviceOrderId) {
  const id = Number(serviceOrderId);
  if (!Number.isInteger(id) || id <= 0) return;
  await db.query(
    `UPDATE service_report_reports SET last_modified_at = NOW(), updated_at = NOW() WHERE service_order_id = $1`,
    [id]
  );
}

function buildOrderSeedKey(year) {
  return `order.code.seed.${Number(year)}`;
}

async function getOrderCodeSeed(year) {
  const raw = await getAppSetting(buildOrderSeedKey(year));
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  return parsed;
}

async function setOrderCodeSeed(year, sequence) {
  const numericYear = Number(year);
  const numericSequence = Number(sequence);
  if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 9999) {
    const err = new Error("Ano invalido para seed de OS.");
    err.statusCode = 422;
    throw err;
  }
  if (!Number.isInteger(numericSequence) || numericSequence <= 0) {
    const err = new Error("Sequencia invalida para seed de OS.");
    err.statusCode = 422;
    throw err;
  }
  await upsertAppSetting(buildOrderSeedKey(numericYear), String(numericSequence));
}

async function listOrders() {
  const result = await db.query(
    `
      SELECT
        o.*,
        c.name AS customer_name,
        s.site_name AS site_name
      FROM service_report_orders o
      INNER JOIN service_report_customers c ON c.id = o.customer_id
      LEFT JOIN service_report_customer_sites s ON s.id = o.site_id
      ORDER BY o.created_at DESC, o.id DESC
    `
  );
  return result.rows;
}

// Quais destes ids ainda existem. Consulta de existência em lote: usada por consumidores externos
// (SentinelGrid) para detectar OS apagadas sem puxar a OS inteira, uma a uma.
async function listExistingOrderIds(ids = []) {
  const normalized = Array.from(new Set(
    (Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
  ));
  if (!normalized.length) return [];
  const result = await db.query(
    "SELECT id FROM service_report_orders WHERE id = ANY($1::bigint[])",
    [normalized]
  );
  return result.rows.map((row) => Number(row.id));
}

async function getOrderById(id) {
  const result = await db.query(
    `
      SELECT
        o.*,
        c.name AS customer_name,
        s.site_name AS site_name
      FROM service_report_orders o
      INNER JOIN service_report_customers c ON c.id = o.customer_id
      LEFT JOIN service_report_customer_sites s ON s.id = o.site_id
      WHERE o.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function createOrder(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_orders (
        service_order_code,
        year,
        customer_id,
        site_id,
        title,
        proposal_number,
        description,
        status,
        opening_date,
        closing_date,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceOrderCode,
      payload.year,
      payload.customerId,
      payload.siteId,
      payload.title,
      payload.proposalNumber || "",
      payload.description || "",
      payload.status,
      payload.openingDate,
      payload.closingDate,
      payload.createdBy || "",
      payload.updatedBy || ""
    ]
  );
  return result.rows[0];
}

async function updateOrder(id, payload) {
  const result = await db.query(
    `
      UPDATE service_report_orders
      SET
        customer_id = $2,
        site_id = $3,
        title = $4,
        proposal_number = $5,
        description = $6,
        status = $7,
        opening_date = $8,
        closing_date = $9,
        updated_by = $10,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.customerId,
      payload.siteId,
      payload.title,
      payload.proposalNumber || "",
      payload.description || "",
      payload.status,
      payload.openingDate,
      payload.closingDate,
      payload.updatedBy || ""
    ]
  );
  return result.rows[0] || null;
}

async function deleteOrder(id) {
  const result = await db.query("DELETE FROM service_report_orders WHERE id = $1", [id]);
  return result.rowCount > 0;
}

async function listCustomers() {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_customers
      ORDER BY name ASC, id ASC
    `
  );
  return result.rows;
}

async function getCustomerById(id) {
  const result = await db.query(
    "SELECT * FROM service_report_customers WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] || null;
}

async function createCustomer(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_customers (name, customer_type, notes, external_source, external_id, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      RETURNING *
    `,
    [payload.name, payload.customerType || "others", payload.notes || "", payload.externalSource || "", payload.externalId || ""]
  );
  return result.rows[0];
}

// Referência externa (Fase 11) — correlação idempotente com outro módulo.
async function getByExternalRef(table, source, externalId) {
  if (!source || !externalId) return null;
  const result = await db.query(
    `SELECT * FROM ${table} WHERE external_source = $1 AND external_id = $2 LIMIT 1`,
    [String(source), String(externalId)]
  );
  return result.rows[0] || null;
}

const getCustomerByExternalRef = (source, id) => getByExternalRef("service_report_customers", source, id);
const getSiteByExternalRef = (source, id) => getByExternalRef("service_report_customer_sites", source, id);
const getEquipmentByExternalRef = (source, id) => getByExternalRef("service_report_equipments", source, id);

const SENTINELGRID_LINK_TABLES = {
  client: "service_report_customers",
  site: "service_report_customer_sites",
  equipment: "service_report_equipments"
};

// Lê a outra ponta do vínculo lógico. Existia só a escrita (setSentinelGridLink): sem esta leitura,
// um registro vinculado por importação (que tem sentinelgrid_id mas não tem external_id) não era
// encontrado na hora de gerar a OS — e virava duplicata.
async function getBySentinelGridId(entityType, sentinelgridId) {
  const table = SENTINELGRID_LINK_TABLES[entityType];
  const sgId = toInt(sentinelgridId);
  if (!table || !sgId) return null;
  const result = await db.query(
    `SELECT * FROM ${table} WHERE sentinelgrid_id = $1 LIMIT 1`,
    [sgId]
  );
  return result.rows[0] || null;
}

// Carimba a referência externa num registro que já existia no RS (adotado por vínculo ou chave
// natural). Assim a próxima geração de OS o encontra pelo caminho rápido e nunca duplica.
async function backfillExternalRef(entityType, id, source, externalId) {
  const table = SENTINELGRID_LINK_TABLES[entityType];
  const rowId = toInt(id);
  if (!table || !rowId || !source || !externalId) return null;
  const result = await db.query(
    `UPDATE ${table}
        SET external_source = $2, external_id = $3, updated_at = NOW()
      WHERE id = $1 AND COALESCE(external_id, '') = ''
      RETURNING *`,
    [rowId, String(source), String(externalId)]
  );
  return result.rows[0] || null;
}

// Chave natural do site: nome dentro do cliente. Um cliente não tem dois sites com o mesmo nome.
async function getSiteByNameForCustomer(customerId, siteName) {
  const id = toInt(customerId);
  const name = String(siteName || "").trim();
  if (!id || !name) return null;
  const result = await db.query(
    `SELECT * FROM service_report_customer_sites
      WHERE customer_id = $1 AND LOWER(TRIM(site_name)) = LOWER($2)
      ORDER BY id LIMIT 1`,
    [id, name]
  );
  return result.rows[0] || null;
}

// Normalização de nome para casamento: sem caixa, sem espaço nas pontas, sem acento. Evita depender
// da extensão unaccent (que pode não estar instalada no banco).
const NORMALIZE_NAME = (expr) => `LOWER(TRIM(TRANSLATE(${expr},
  'ÁÀÃÂÄáàãâäÉÈÊËéèêëÍÌÎÏíìîïÓÒÕÔÖóòõôöÚÙÛÜúùûüÇçÑñ',
  'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')))`;

// Chave natural do cliente: o nome. O SentinelGrid não conhece customer_type (manda sempre
// 'others'), então o tipo NÃO entra no casamento — era justamente o único campo que diferia entre
// o cliente original e a duplicata criada pela integração.
async function getCustomerByNormalizedName(name) {
  const value = String(name || "").trim();
  if (!value) return null;
  const result = await db.query(
    `SELECT * FROM service_report_customers
      WHERE ${NORMALIZE_NAME("name")} = ${NORMALIZE_NAME("$1")}
      ORDER BY id LIMIT 1`,
    [value]
  );
  return result.rows[0] || null;
}

// Chave natural do equipamento: a TAG dentro do cliente — é o que o RS já trata como única por site
// (ensureEquipmentTagUnique). O número de série NÃO serve sozinho: na base real o mesmo serial
// aparece em unidades diferentes (L13-0640 em duas, L07-0515 em três).
async function getEquipmentByTagForCustomer(customerId, tagNumber) {
  const id = toInt(customerId);
  const tag = String(tagNumber || "").trim();
  if (!id || !tag) return null;
  const result = await db.query(
    `SELECT * FROM service_report_equipments
      WHERE customer_id = $1 AND LOWER(TRIM(tag_number)) = LOWER($2)
      ORDER BY id LIMIT 1`,
    [id, tag]
  );
  return result.rows[0] || null;
}

// Série só casa quando é INEQUÍVOCA dentro do cliente: se dois equipamentos compartilham a série,
// adotar qualquer um deles seria chutar. Nesse caso devolve null e deixa criar.
async function getEquipmentBySerialForCustomer(customerId, serialNumber) {
  const id = toInt(customerId);
  const serial = String(serialNumber || "").trim();
  if (!id || !serial) return null;
  const result = await db.query(
    `SELECT * FROM service_report_equipments
      WHERE customer_id = $1 AND LOWER(TRIM(serial_number)) = LOWER($2)`,
    [id, serial]
  );
  return result.rows.length === 1 ? result.rows[0] : null;
}

// Equipamento adotado que estava órfão (sem cliente/site) ganha o dono. Só preenche o que está
// vazio — nunca sequestra um equipamento que já pertence a outro cliente.
async function backfillEquipmentOwner(id, customerId, siteId) {
  const rowId = toInt(id);
  const customer = toInt(customerId);
  if (!rowId || !customer) return null;
  const result = await db.query(
    `UPDATE service_report_equipments
        SET customer_id = COALESCE(customer_id, $2),
            site_id = COALESCE(site_id, $3),
            updated_at = NOW()
      WHERE id = $1 AND (customer_id IS NULL OR site_id IS NULL)
      RETURNING *`,
    [rowId, customer, toInt(siteId)]
  );
  return result.rows[0] || null;
}

// Persiste a outra ponta da FK externa lógica. A tabela é escolhida somente a
// partir da allowlist acima; entityType nunca é interpolado diretamente no SQL.
async function setSentinelGridLink(entityType, serviceReportId, sentinelgridId) {
  const table = SENTINELGRID_LINK_TABLES[entityType];
  if (!table) throw new Error(`Tipo de entidade de integração inválido: ${entityType}`);
  const rsId = toInt(serviceReportId);
  const sgId = toInt(sentinelgridId);
  if (!rsId || !sgId) return null;

  await db.query(
    `UPDATE ${table} SET sentinelgrid_id = NULL, updated_at = NOW()
      WHERE sentinelgrid_id = $1 AND id <> $2`,
    [sgId, rsId]
  );
  const result = await db.query(
    `UPDATE ${table} SET sentinelgrid_id = $2, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [rsId, sgId]
  );
  return result.rows[0] || null;
}

async function deleteCustomer(id) {
  const result = await db.query(
    `DELETE FROM service_report_customers WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
}

async function updateCustomer(id, payload) {
  const result = await db.query(
    `
      UPDATE service_report_customers
      SET
        name = $2,
        customer_type = $3,
        notes = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, payload.name, payload.customerType || "others", payload.notes || ""]
  );
  return result.rows[0] || null;
}

async function listSites(filters = {}) {
  const values = [];
  const where = [];
  if (filters.customerId) {
    values.push(filters.customerId);
    where.push(`s.customer_id = $${values.length}`);
  }
  const result = await db.query(
    `
      SELECT
        s.*,
        c.name AS customer_name
      FROM service_report_customer_sites s
      INNER JOIN service_report_customers c ON c.id = s.customer_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY s.site_name ASC, s.id ASC
    `,
    values
  );
  return result.rows;
}

async function getSiteById(id) {
  const result = await db.query(
    `
      SELECT s.*, c.name AS customer_name
      FROM service_report_customer_sites s
      INNER JOIN service_report_customers c ON c.id = s.customer_id
      WHERE s.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function createSite(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_customer_sites (
        customer_id,
        site_name,
        site_code,
        location,
        latitude,
        longitude,
        notes,
        external_source,
        external_id,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.customerId,
      payload.siteName,
      payload.siteCode || "",
      payload.location || "",
      payload.latitude != null ? Number(payload.latitude) : null,
      payload.longitude != null ? Number(payload.longitude) : null,
      payload.notes || "",
      payload.externalSource || "",
      payload.externalId || ""
    ]
  );
  return result.rows[0];
}

async function updateSite(id, payload) {
  const result = await db.query(
    `UPDATE service_report_customer_sites
     SET site_name=$2, site_code=$3, location=$4, latitude=$5, longitude=$6, notes=$7, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [
      id,
      payload.siteName,
      payload.siteCode || "",
      payload.location || "",
      payload.latitude != null ? Number(payload.latitude) : null,
      payload.longitude != null ? Number(payload.longitude) : null,
      payload.notes || ""
    ]
  );
  return result.rows[0] || null;
}

async function deleteSite(id) {
  const result = await db.query(
    `DELETE FROM service_report_customer_sites WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
}

async function listEquipments() {
  const result = await db.query(
    `
      SELECT
        e.*,
        c.name AS customer_name,
        s.site_name
      FROM service_report_equipments e
      LEFT JOIN service_report_customers c ON c.id = e.customer_id
      LEFT JOIN service_report_customer_sites s ON s.id = e.site_id
      ORDER BY e.created_at DESC, e.id DESC
    `
  );
  return result.rows;
}

async function getEquipmentById(id) {
  const result = await db.query(
    `
      SELECT
        e.*,
        c.name AS customer_name,
        s.site_name
      FROM service_report_equipments e
      LEFT JOIN service_report_customers c ON c.id = e.customer_id
      LEFT JOIN service_report_customer_sites s ON s.id = e.site_id
      WHERE e.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function findEquipmentBySiteTag(siteId, tagNumber, excludeId = null) {
  const cleanTag = String(tagNumber || "").trim();
  if (!cleanTag) return null;
  const params = [siteId, cleanTag.toLowerCase()];
  let where = "site_id = $1 AND LOWER(TRIM(tag_number)) = $2";
  if (excludeId) {
    params.push(excludeId);
    where += ` AND id <> $${params.length}`;
  }
  const result = await db.query(
    `SELECT * FROM service_report_equipments WHERE ${where} LIMIT 1`,
    params
  );
  return result.rows[0] || null;
}

async function createEquipment(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_equipments (
        customer_id,
        site_id,
        type,
        year_of_manufacture,
        serial_number,
        power,
        rated_ac_input_voltage,
        input_frequency,
        rated_dc_voltage,
        rated_ac_output_voltage,
        output_frequency,
        degree_of_protection,
        main_label,
        dt_number,
        tag_number,
        manufacturer,
        model_family,
        notes,
        external_source,
        external_id,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.customerId,
      payload.siteId,
      payload.type,
      payload.yearOfManufacture || "",
      payload.serialNumber || "",
      payload.power || "",
      payload.ratedAcInputVoltage || "",
      payload.inputFrequency || "",
      payload.ratedDcVoltage || "",
      payload.ratedAcOutputVoltage || "",
      payload.outputFrequency || "",
      payload.degreeOfProtection || "",
      payload.mainLabel || "",
      payload.dtNumber || "",
      payload.tagNumber || "",
      payload.manufacturer || "",
      payload.modelFamily || "",
      payload.notes || "",
      payload.externalSource || "",
      payload.externalId || ""
    ]
  );
  return result.rows[0];
}

async function updateEquipment(id, payload) {
  const result = await db.query(
    `
      UPDATE service_report_equipments
      SET
        customer_id = $2,
        site_id = $3,
        type = $4,
        year_of_manufacture = $5,
        serial_number = $6,
        power = $7,
        rated_ac_input_voltage = $8,
        input_frequency = $9,
        rated_dc_voltage = $10,
        rated_ac_output_voltage = $11,
        output_frequency = $12,
        degree_of_protection = $13,
        main_label = $14,
        dt_number = $15,
        tag_number = $16,
        manufacturer = $17,
        model_family = $18,
        notes = $19,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.customerId,
      payload.siteId,
      payload.type,
      payload.yearOfManufacture || "",
      payload.serialNumber || "",
      payload.power || "",
      payload.ratedAcInputVoltage || "",
      payload.inputFrequency || "",
      payload.ratedDcVoltage || "",
      payload.ratedAcOutputVoltage || "",
      payload.outputFrequency || "",
      payload.degreeOfProtection || "",
      payload.mainLabel || "",
      payload.dtNumber || "",
      payload.tagNumber || "",
      payload.manufacturer || "",
      payload.modelFamily || "",
      payload.notes || ""
    ]
  );
  return result.rows[0] || null;
}

async function deleteEquipment(id) {
  const result = await db.query(
    "DELETE FROM service_report_equipments WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

async function listSpareParts() {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_spare_parts
      ORDER BY created_at DESC, id DESC
    `
  );
  return result.rows;
}

async function getSparePartById(id) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_spare_parts
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function createSparePart(payload) {
  let result;
  try {
    result = await db.query(
      `
        INSERT INTO service_report_spare_parts (
          description,
          manufacturer,
          equipment_model,
          part_number,
          lead_time,
          is_obsolete,
          replaced_by_part_number,
          equipment_family,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
        RETURNING *
      `,
      [
        payload.description,
        payload.manufacturer || "",
        payload.equipmentModel || "",
        payload.partNumber || "",
        payload.leadTime || "",
        Boolean(payload.isObsolete),
        payload.replacedByPartNumber || "",
        payload.equipmentFamily || ""
      ]
    );
  } catch (err) {
    if (err.code === "23505") {
      const conflict = new Error("Part Number ja cadastrado.");
      conflict.statusCode = 409;
      conflict.code = "pn_duplicate";
      throw conflict;
    }
    throw err;
  }
  return result.rows[0];
}

async function getExistingPartNumbers(partNumbers) {
  if (!partNumbers.length) return new Set();
  const placeholders = partNumbers.map((_, i) => `$${i + 1}`).join(", ");
  const result = await db.query(
    `SELECT LOWER(part_number) AS pn FROM service_report_spare_parts WHERE LOWER(part_number) = ANY(ARRAY[${placeholders}]) AND part_number <> ''`,
    partNumbers.map((pn) => String(pn).toLowerCase())
  );
  return new Set(result.rows.map((r) => r.pn));
}

async function getSparePartsByPartNumbers(partNumbers) {
  if (!partNumbers.length) return [];
  const placeholders = partNumbers.map((_, i) => `$${i + 1}`).join(", ");
  const result = await db.query(
    `SELECT id, part_number FROM service_report_spare_parts WHERE LOWER(part_number) = ANY(ARRAY[${placeholders}]) AND part_number <> ''`,
    partNumbers.map((pn) => String(pn).toLowerCase())
  );
  return result.rows;
}

async function bulkCreateSpareParts(items) {
  if (!items || !items.length) return { inserted: 0, skipped: 0, skippedIntraJson: 0, skippedExisting: 0, items: [] };

  const withPn = items.filter((item) => String(item.partNumber || "").trim());
  const withoutPn = items.filter((item) => !String(item.partNumber || "").trim());

  // 1. Deduplica PNs dentro do próprio JSON (mantém primeira ocorrência, case-insensitive)
  const seenInJson = new Set();
  const uniqueWithPn = [];
  let skippedIntraJson = 0;
  for (const item of withPn) {
    const key = String(item.partNumber).trim().toLowerCase();
    if (seenInJson.has(key)) {
      skippedIntraJson++;
    } else {
      seenInJson.add(key);
      uniqueWithPn.push(item);
    }
  }

  // 2. Verifica PNs já existentes no banco
  const existingPns = await getExistingPartNumbers(
    uniqueWithPn.map((item) => String(item.partNumber).trim())
  );

  const newWithPn = uniqueWithPn.filter((item) => !existingPns.has(String(item.partNumber).trim().toLowerCase()));
  const skippedExisting = uniqueWithPn.length - newWithPn.length;

  const toInsert = [...newWithPn, ...withoutPn];

  const inserted = [];
  let skippedByConstraint = 0;
  for (const payload of toInsert) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const row = await createSparePart(payload);
      inserted.push(row);
    } catch (err) {
      if (err.code === "pn_duplicate") {
        skippedByConstraint++;
      } else {
        throw err;
      }
    }
  }

  const totalSkipped = skippedIntraJson + skippedExisting + skippedByConstraint;
  return {
    inserted: inserted.length,
    skipped: totalSkipped,
    skippedIntraJson,
    skippedExisting: skippedExisting + skippedByConstraint,
    items: inserted
  };
}

/**
 * Import/upsert spare parts for a given equipment.
 * Rules:
 *  - Row has a PN that matches an existing spare part → UPDATE the spare part record + link to equipment
 *  - Row has a PN that does NOT exist → CREATE the spare part + link to equipment
 *  - Row has no PN → CREATE (description-only) + link to equipment
 *  - quantity from XLSX is applied to the equipment link row
 */
async function bulkUpsertLinkedSpareParts(equipmentId, items) {
  let updated = 0;
  let inserted = 0;
  let linked = 0;

  for (const item of items) {
    const pn = String(item.partNumber || "").trim();
    const pnLower = pn.toLowerCase();
    let sparePartId = null;

    if (pn) {
      // Try to find existing spare part by PN
      const findRes = await db.query( // eslint-disable-line no-await-in-loop
        `SELECT id FROM service_report_spare_parts WHERE LOWER(part_number) = $1 AND part_number <> '' LIMIT 1`,
        [pnLower]
      );

      if (findRes.rows.length > 0) {
        // UPDATE existing record
        sparePartId = findRes.rows[0].id;
        await db.query( // eslint-disable-line no-await-in-loop
          `UPDATE service_report_spare_parts
           SET description = $2, manufacturer = $3, equipment_model = $4,
               lead_time = $5, is_obsolete = $6, replaced_by_part_number = $7,
               equipment_family = $8, updated_at = NOW()
           WHERE id = $1`,
          [
            sparePartId,
            item.description,
            item.manufacturer || "",
            item.equipmentModel || "",
            item.leadTime || "",
            Boolean(item.isObsolete),
            item.replacedByPartNumber || "",
            item.equipmentFamily || ""
          ]
        );
        updated++;
      }
    }

    if (!sparePartId) {
      // INSERT new spare part
      try {
        const row = await createSparePart(item); // eslint-disable-line no-await-in-loop
        sparePartId = row.id;
        inserted++;
      } catch (err) {
        // PN race condition — try to find it again
        if (err.code === "pn_duplicate" && pn) {
          const retryRes = await db.query( // eslint-disable-line no-await-in-loop
            `SELECT id FROM service_report_spare_parts WHERE LOWER(part_number) = $1 AND part_number <> '' LIMIT 1`,
            [pnLower]
          );
          if (retryRes.rows.length > 0) {
            sparePartId = retryRes.rows[0].id;
            updated++;
          }
        } else {
          throw err;
        }
      }
    }

    if (sparePartId) {
      const qty = Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1;
      await db.query( // eslint-disable-line no-await-in-loop
        `INSERT INTO service_report_equipment_spare_parts (equipment_id, spare_part_id, quantity, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (equipment_id, spare_part_id)
         DO UPDATE SET quantity = EXCLUDED.quantity`,
        [equipmentId, sparePartId, qty]
      );
      linked++;
    }
  }

  return { updated, inserted, linked };
}

async function updateSparePart(id, payload) {
  let result;
  try {
    result = await db.query(
      `
        UPDATE service_report_spare_parts
        SET
          description = $2,
          manufacturer = $3,
          equipment_model = $4,
          part_number = $5,
          lead_time = $6,
          is_obsolete = $7,
          replaced_by_part_number = $8,
          equipment_family = $9,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        id,
        payload.description,
        payload.manufacturer || "",
        payload.equipmentModel || "",
        payload.partNumber || "",
        payload.leadTime || "",
        Boolean(payload.isObsolete),
        payload.replacedByPartNumber || "",
        payload.equipmentFamily || ""
      ]
    );
  } catch (err) {
    if (err.code === "23505") {
      const conflict = new Error("Part Number ja cadastrado.");
      conflict.statusCode = 409;
      conflict.code = "pn_duplicate";
      throw conflict;
    }
    throw err;
  }
  return result.rows[0] || null;
}

async function deleteSparePart(id) {
  const result = await db.query(
    `DELETE FROM service_report_spare_parts WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
}

async function listSparePartsByEquipment(equipmentId) {
  const result = await db.query(
    `
      SELECT
        sp.*,
        link.quantity,
        link.created_at AS linked_at
      FROM service_report_equipment_spare_parts link
      INNER JOIN service_report_spare_parts sp ON sp.id = link.spare_part_id
      WHERE link.equipment_id = $1
      ORDER BY sp.description ASC, sp.id ASC
    `,
    [equipmentId]
  );
  return result.rows;
}

async function listSparePartsByEquipmentIds(equipmentIds = []) {
  const normalizedIds = (Array.isArray(equipmentIds) ? equipmentIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!normalizedIds.length) return [];

  const result = await db.query(
    `
      SELECT
        link.equipment_id,
        sp.*,
        link.quantity,
        link.created_at AS linked_at
      FROM service_report_equipment_spare_parts link
      INNER JOIN service_report_spare_parts sp ON sp.id = link.spare_part_id
      WHERE link.equipment_id = ANY($1::bigint[])
      ORDER BY link.equipment_id ASC, sp.description ASC, sp.id ASC
    `,
    [normalizedIds]
  );
  return result.rows;
}

async function linkSparePartToEquipment(equipmentId, sparePartId, quantity = 1) {
  const normalizedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0
    ? Number(quantity)
    : 1;
  await db.query(
    `
      INSERT INTO service_report_equipment_spare_parts (equipment_id, spare_part_id, quantity, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (equipment_id, spare_part_id)
      DO UPDATE SET quantity = EXCLUDED.quantity
    `,
    [equipmentId, sparePartId, normalizedQuantity]
  );
}

async function linkSparePartToEquipmentIfMissing(equipmentId, sparePartId, quantity = 1) {
  const normalizedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0
    ? Number(quantity)
    : 1;
  await db.query(
    `
      INSERT INTO service_report_equipment_spare_parts (equipment_id, spare_part_id, quantity, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (equipment_id, spare_part_id)
      DO NOTHING
    `,
    [equipmentId, sparePartId, normalizedQuantity]
  );
}

async function unlinkSparePartFromEquipment(equipmentId, sparePartId) {
  const result = await db.query(
    `
      DELETE FROM service_report_equipment_spare_parts
      WHERE equipment_id = $1 AND spare_part_id = $2
    `,
    [equipmentId, sparePartId]
  );
  return result.rowCount > 0;
}

async function updateSparePartQuantityByEquipment(equipmentId, sparePartId, quantity) {
  const normalizedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0
    ? Number(quantity)
    : 1;
  const result = await db.query(
    `
      UPDATE service_report_equipment_spare_parts
      SET quantity = $3
      WHERE equipment_id = $1 AND spare_part_id = $2
      RETURNING *
    `,
    [equipmentId, sparePartId, normalizedQuantity]
  );
  return result.rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-equipment spares (service_report_equipment_spares): independent, editable
// snapshots. The global catalog (service_report_spare_parts) is only a source to
// pull from when associating.
// ─────────────────────────────────────────────────────────────────────────────

function normalizeEquipmentSparePayload(payload = {}) {
  return {
    description: String(payload.description || "").trim(),
    manufacturer: String(payload.manufacturer || "").trim(),
    equipmentModel: String(payload.equipmentModel || "").trim(),
    partNumber: String(payload.partNumber || "").trim(),
    leadTime: String(payload.leadTime || "").trim(),
    isObsolete: Boolean(payload.isObsolete),
    replacedByPartNumber: String(payload.replacedByPartNumber || "").trim(),
    equipmentFamily: String(payload.equipmentFamily || "").trim(),
    quantity: Number.isInteger(Number(payload.quantity)) && Number(payload.quantity) > 0
      ? Number(payload.quantity)
      : 1
  };
}

async function listEquipmentSpares(equipmentId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_equipment_spares
      WHERE equipment_id = $1
      ORDER BY description ASC, id ASC
    `,
    [equipmentId]
  );
  return result.rows;
}

async function listEquipmentSparesByEquipmentIds(equipmentIds = []) {
  const normalizedIds = (Array.isArray(equipmentIds) ? equipmentIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!normalizedIds.length) return [];

  const result = await db.query(
    `
      SELECT *
      FROM service_report_equipment_spares
      WHERE equipment_id = ANY($1::bigint[])
      ORDER BY equipment_id ASC, description ASC, id ASC
    `,
    [normalizedIds]
  );
  return result.rows;
}

async function getEquipmentSpareById(id) {
  const result = await db.query(
    `SELECT * FROM service_report_equipment_spares WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findEquipmentSpareByPn(equipmentId, partNumber) {
  const pn = String(partNumber || "").trim();
  if (!pn) return null;
  const result = await db.query(
    `
      SELECT *
      FROM service_report_equipment_spares
      WHERE equipment_id = $1 AND LOWER(part_number) = LOWER($2) AND part_number <> ''
      LIMIT 1
    `,
    [equipmentId, pn]
  );
  return result.rows[0] || null;
}

function pnDuplicateError() {
  const conflict = new Error("Part Number ja associado a este equipamento.");
  conflict.statusCode = 409;
  conflict.code = "pn_duplicate";
  return conflict;
}

async function createEquipmentSpare(equipmentId, rawPayload, sourceSparePartId = null) {
  const payload = normalizeEquipmentSparePayload(rawPayload);
  if (payload.partNumber) {
    const existing = await findEquipmentSpareByPn(equipmentId, payload.partNumber);
    if (existing) throw pnDuplicateError();
  }
  const result = await db.query(
    `
      INSERT INTO service_report_equipment_spares (
        equipment_id, source_spare_part_id, description, manufacturer, equipment_model,
        part_number, lead_time, is_obsolete, replaced_by_part_number, equipment_family,
        quantity, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *
    `,
    [
      equipmentId,
      sourceSparePartId,
      payload.description,
      payload.manufacturer,
      payload.equipmentModel,
      payload.partNumber,
      payload.leadTime,
      payload.isObsolete,
      payload.replacedByPartNumber,
      payload.equipmentFamily,
      payload.quantity
    ]
  );
  return result.rows[0];
}

// Pull a catalog spare-part into an equipment's own list (snapshot copy).
async function associateSparePartToEquipment(equipmentId, sparePartId, quantity = 1) {
  const sparePart = await getSparePartById(sparePartId);
  if (!sparePart) {
    const err = new Error("Spare-part nao encontrado.");
    err.statusCode = 404;
    err.code = "spare_part_not_found";
    throw err;
  }
  return createEquipmentSpare(
    equipmentId,
    {
      description: sparePart.description,
      manufacturer: sparePart.manufacturer,
      equipmentModel: sparePart.equipment_model,
      partNumber: sparePart.part_number,
      leadTime: sparePart.lead_time,
      isObsolete: sparePart.is_obsolete,
      replacedByPartNumber: sparePart.replaced_by_part_number,
      equipmentFamily: sparePart.equipment_family,
      quantity
    },
    sparePart.id
  );
}

async function updateEquipmentSpare(id, rawPayload) {
  const payload = normalizeEquipmentSparePayload(rawPayload);
  const current = await getEquipmentSpareById(id);
  if (!current) return null;
  if (payload.partNumber) {
    const existing = await findEquipmentSpareByPn(current.equipment_id, payload.partNumber);
    if (existing && Number(existing.id) !== Number(id)) throw pnDuplicateError();
  }
  const result = await db.query(
    `
      UPDATE service_report_equipment_spares
      SET description = $2, manufacturer = $3, equipment_model = $4, part_number = $5,
          lead_time = $6, is_obsolete = $7, replaced_by_part_number = $8,
          equipment_family = $9, quantity = $10, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.description,
      payload.manufacturer,
      payload.equipmentModel,
      payload.partNumber,
      payload.leadTime,
      payload.isObsolete,
      payload.replacedByPartNumber,
      payload.equipmentFamily,
      payload.quantity
    ]
  );
  return result.rows[0] || null;
}

async function updateEquipmentSpareQuantity(id, quantity) {
  const normalizedQuantity = Number.isInteger(Number(quantity)) && Number(quantity) > 0
    ? Number(quantity)
    : 1;
  const result = await db.query(
    `
      UPDATE service_report_equipment_spares
      SET quantity = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, normalizedQuantity]
  );
  return result.rows[0] || null;
}

async function deleteEquipmentSpare(id) {
  const result = await db.query(
    `DELETE FROM service_report_equipment_spares WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
}

// Bulk upsert for AI/XLSX import: writes to the equipment's own list AND upserts
// the global catalog (so the library keeps growing with imported data).
async function bulkUpsertEquipmentSpares(equipmentId, items) {
  let updated = 0;
  let inserted = 0;
  let linked = 0;

  for (const raw of items) {
    const item = {
      description: String(raw.description || "").trim(),
      manufacturer: String(raw.manufacturer || "").trim(),
      equipmentModel: String(raw.equipmentModel || "").trim(),
      partNumber: String(raw.partNumber || "").trim(),
      leadTime: String(raw.leadTime || "").trim(),
      replacedByPartNumber: String(raw.replacedByPartNumber || "").trim(),
      equipmentFamily: String(raw.equipmentFamily || "").trim(),
      isObsolete: Boolean(raw.isObsolete),
      quantity: Number.isInteger(Number(raw.quantity)) && Number(raw.quantity) > 0 ? Number(raw.quantity) : 1
    };
    if (!item.description) continue;

    // 1) Upsert the global catalog (association + catalogo).
    let catalogId = null;
    const pnLower = item.partNumber.toLowerCase();
    if (item.partNumber) {
      const findRes = await db.query( // eslint-disable-line no-await-in-loop
        `SELECT id FROM service_report_spare_parts WHERE LOWER(part_number) = $1 AND part_number <> '' LIMIT 1`,
        [pnLower]
      );
      if (findRes.rows.length > 0) {
        catalogId = findRes.rows[0].id;
        await db.query( // eslint-disable-line no-await-in-loop
          `UPDATE service_report_spare_parts
           SET description = $2, manufacturer = $3, equipment_model = $4,
               lead_time = $5, is_obsolete = $6, replaced_by_part_number = $7,
               equipment_family = $8, updated_at = NOW()
           WHERE id = $1`,
          [catalogId, item.description, item.manufacturer, item.equipmentModel,
            item.leadTime, item.isObsolete, item.replacedByPartNumber, item.equipmentFamily]
        );
      }
    }
    if (!catalogId) {
      try {
        const row = await createSparePart(item); // eslint-disable-line no-await-in-loop
        catalogId = row.id;
      } catch (err) {
        if (err.code === "pn_duplicate" && item.partNumber) {
          const retryRes = await db.query( // eslint-disable-line no-await-in-loop
            `SELECT id FROM service_report_spare_parts WHERE LOWER(part_number) = $1 AND part_number <> '' LIMIT 1`,
            [pnLower]
          );
          if (retryRes.rows.length > 0) catalogId = retryRes.rows[0].id;
        } else {
          throw err;
        }
      }
    }

    // 2) Upsert the per-equipment snapshot (matched by PN within the equipment).
    const existingSpare = item.partNumber ? await findEquipmentSpareByPn(equipmentId, item.partNumber) : null; // eslint-disable-line no-await-in-loop
    if (existingSpare) {
      await db.query( // eslint-disable-line no-await-in-loop
        `UPDATE service_report_equipment_spares
         SET source_spare_part_id = COALESCE($2, source_spare_part_id),
             description = $3, manufacturer = $4, equipment_model = $5,
             lead_time = $6, is_obsolete = $7, replaced_by_part_number = $8,
             equipment_family = $9, quantity = $10, updated_at = NOW()
         WHERE id = $1`,
        [existingSpare.id, catalogId, item.description, item.manufacturer, item.equipmentModel,
          item.leadTime, item.isObsolete, item.replacedByPartNumber, item.equipmentFamily, item.quantity]
      );
      updated++;
    } else {
      await db.query( // eslint-disable-line no-await-in-loop
        `INSERT INTO service_report_equipment_spares (
           equipment_id, source_spare_part_id, description, manufacturer, equipment_model,
           part_number, lead_time, is_obsolete, replaced_by_part_number, equipment_family,
           quantity, created_at, updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        [equipmentId, catalogId, item.description, item.manufacturer, item.equipmentModel,
          item.partNumber, item.leadTime, item.isObsolete, item.replacedByPartNumber,
          item.equipmentFamily, item.quantity]
      );
      inserted++;
    }
    linked++;
  }

  return { updated, inserted, linked };
}

async function attachEquipmentToOrder(serviceOrderId, equipmentId, notes = "") {
  const result = await db.query(
    `
      WITH lock_order AS (
        SELECT id
        FROM service_report_orders
        WHERE id = $1
        FOR UPDATE
      ),
      next_ref AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE(
            (SELECT MAX(ref_id) FROM service_report_order_equipments WHERE service_order_id = $1),
            0
          ) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1
          FROM service_report_order_equipments oe2
          WHERE oe2.service_order_id = $1
            AND oe2.ref_id = gs
        )
        ORDER BY gs
        LIMIT 1
      )
      INSERT INTO service_report_order_equipments (service_order_id, equipment_id, ref_id, notes, created_at)
      VALUES ($1,$2,(SELECT next_id FROM next_ref),$3,NOW())
      ON CONFLICT (service_order_id, equipment_id)
      DO UPDATE SET notes = EXCLUDED.notes
      RETURNING *
    `,
    [serviceOrderId, equipmentId, notes]
  );
  return result.rows[0];
}

async function listOrderEquipments(serviceOrderId) {
  const result = await db.query(
    `
      SELECT
        oe.*,
        e.type,
        e.serial_number,
        e.tag_number,
        e.customer_id,
        e.site_id,
        e.year_of_manufacture,
        e.power,
        e.rated_ac_input_voltage,
        e.input_frequency,
        e.rated_dc_voltage,
        e.rated_ac_output_voltage,
        e.output_frequency,
        e.degree_of_protection,
        e.main_label,
        e.dt_number,
        e.manufacturer,
        e.model_family,
        e.notes AS equipment_notes,
        c.name AS customer_name,
        s.site_name
      FROM service_report_order_equipments oe
      INNER JOIN service_report_equipments e ON e.id = oe.equipment_id
      LEFT JOIN service_report_customers c ON c.id = e.customer_id
      LEFT JOIN service_report_customer_sites s ON s.id = e.site_id
      WHERE oe.service_order_id = $1
      ORDER BY oe.ref_id ASC, oe.id ASC
    `,
    [serviceOrderId]
  );
  return result.rows;
}

async function detachEquipmentFromOrder(serviceOrderId, equipmentId) {
  const result = await db.query(
    `
      DELETE FROM service_report_order_equipments
      WHERE service_order_id = $1 AND equipment_id = $2
    `,
    [serviceOrderId, equipmentId]
  );
  return result.rowCount > 0;
}

async function listTimesheetByOrder(serviceOrderId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_timesheet_entries
      WHERE service_order_id = $1
      ORDER BY activity_date ASC, id ASC
    `,
    [serviceOrderId]
  );
  return result.rows;
}

async function createTimesheetEntry(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_timesheet_entries (
        service_order_id,
        activity_date,
        check_in_base,
        check_in_client,
        check_out_client,
        check_out_base,
        technician_name,
        worked_hours,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceOrderId,
      payload.activityDate,
      payload.checkInBase || "",
      payload.checkInClient || "",
      payload.checkOutClient || "",
      payload.checkOutBase || "",
      payload.technicianName || "",
      payload.workedHours,
      payload.notes || ""
    ]
  );
  return result.rows[0];
}

async function updateTimesheetEntry(id, payload) {
  const result = await db.query(
    `
      UPDATE service_report_timesheet_entries
      SET
        activity_date = $2,
        check_in_base = $3,
        check_in_client = $4,
        check_out_client = $5,
        check_out_base = $6,
        technician_name = $7,
        worked_hours = $8,
        notes = $9,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.activityDate,
      payload.checkInBase || "",
      payload.checkInClient || "",
      payload.checkOutClient || "",
      payload.checkOutBase || "",
      payload.technicianName || "",
      payload.workedHours,
      payload.notes || ""
    ]
  );
  return result.rows[0] || null;
}

async function deleteTimesheetEntry(id) {
  const result = await db.query(
    "DELETE FROM service_report_timesheet_entries WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

async function listDailyLogsByOrder(serviceOrderId) {
  const result = await db.query(
    `
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY service_order_id
          ORDER BY activity_date ASC, sort_order ASC, id ASC
        ) AS order_seq
      FROM service_report_daily_logs
      WHERE service_order_id = $1
      ORDER BY activity_date ASC, sort_order ASC, id ASC
    `,
    [serviceOrderId]
  );
  return result.rows;
}

async function createDailyLog(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_daily_logs (
        service_order_id,
        activity_date,
        title,
        content,
        notes,
        sort_order,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceOrderId,
      payload.activityDate,
      payload.title || "",
      payload.content || "",
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  await touchReportByOrderId(payload.serviceOrderId);
  return result.rows[0];
}

async function getDailyLogByTagForOrder(serviceOrderId, tag) {
  const result = await db.query(
    `
      SELECT * FROM service_report_daily_logs
      WHERE service_order_id = $1 AND notes = $2
      ORDER BY id DESC LIMIT 1
    `,
    [serviceOrderId, tag]
  );
  return result.rows[0] || null;
}

async function updateDailyLogByOrderAndId(serviceOrderId, dailyLogId, payload) {
  const result = await db.query(
    `
      UPDATE service_report_daily_logs
      SET
        activity_date = $3,
        title = $4,
        content = $5,
        notes = $6,
        sort_order = $7,
        updated_at = NOW()
      WHERE id = $1
        AND service_order_id = $2
      RETURNING *
    `,
    [
      dailyLogId,
      serviceOrderId,
      payload.activityDate,
      payload.title || "",
      payload.content || "",
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  if (result.rows[0]) await touchReportByOrderId(serviceOrderId);
  return result.rows[0] || null;
}

async function deleteDailyLogByOrderAndId(serviceOrderId, dailyLogId) {
  const result = await db.query(
    `
      DELETE FROM service_report_daily_logs
      WHERE id = $1
        AND service_order_id = $2
    `,
    [dailyLogId, serviceOrderId]
  );
  if (result.rowCount > 0) await touchReportByOrderId(serviceOrderId);
  return result.rowCount > 0;
}

async function listReports() {
  const result = await db.query(
    `
      SELECT
        r.*,
        o.service_order_code,
        o.title AS order_title
      FROM service_report_reports r
      INNER JOIN service_report_orders o ON o.id = r.service_order_id
      ORDER BY r.updated_at DESC, r.id DESC
    `
  );
  return result.rows;
}

async function getReportById(id) {
  const result = await db.query(
    `
      SELECT
        r.*,
        o.service_order_code,
        o.title AS order_title
      FROM service_report_reports r
      INNER JOIN service_report_orders o ON o.id = r.service_order_id
      WHERE r.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function getReportByOrderId(serviceOrderId) {
  const result = await db.query(
    `
      SELECT
        r.*,
        o.service_order_code,
        o.title AS order_title
      FROM service_report_reports r
      INNER JOIN service_report_orders o ON o.id = r.service_order_id
      WHERE r.service_order_id = $1
      LIMIT 1
    `,
    [serviceOrderId]
  );
  return result.rows[0] || null;
}

async function createReport(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_reports (
        service_order_id,
        report_number,
        revision,
        title,
        status,
        issue_date,
        document_language,
        template_name,
        template_version,
        last_modified_at,
        prepared_by,
        reviewed_by,
        approved_by,
        pdf_path,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10,$11,$12,$13,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceOrderId,
      payload.reportNumber,
      payload.revision || "A",
      payload.title,
      payload.status || "draft",
      payload.issueDate,
      payload.documentLanguage || "pt",
      payload.templateName || "service-report-default",
      payload.templateVersion || "1.0.0",
      payload.preparedBy || "",
      payload.reviewedBy || "",
      payload.approvedBy || "",
      payload.pdfPath || ""
    ]
  );
  return result.rows[0];
}

async function updateReport(id, payload) {
  const result = await db.query(
    `
      UPDATE service_report_reports
      SET
        revision = $2,
        title = $3,
        status = $4,
        issue_date = $5,
        document_language = $6,
        template_name = $7,
        template_version = $8,
        prepared_by = $9,
        reviewed_by = $10,
        approved_by = $11,
        pdf_path = $12,
        last_modified_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.revision || "A",
      payload.title,
      payload.status || "draft",
      payload.issueDate,
      payload.documentLanguage || "pt",
      payload.templateName || "service-report-default",
      payload.templateVersion || "1.0.0",
      payload.preparedBy || "",
      payload.reviewedBy || "",
      payload.approvedBy || "",
      payload.pdfPath || ""
    ]
  );
  return result.rows[0] || null;
}

async function ensureDefaultSections(serviceReportId) {
  const [configuredScopeHtml, configuredRecommendationsHtml] = await Promise.all([
    getAppSetting(DEFAULT_SECTION_CONFIG_KEYS.scope),
    getAppSetting(DEFAULT_SECTION_CONFIG_KEYS.recommendations)
  ]);
  const scopeHtmlFromSettings = configuredScopeHtml == null
    ? SECTION_SEED_HTML.scope
    : configuredScopeHtml;
  const recommendationsHtmlFromSettings = configuredRecommendationsHtml == null
    ? SECTION_SEED_HTML.recommendations
    : configuredRecommendationsHtml;
  const seededContentBySection = {
    scope: String(scopeHtmlFromSettings || ""),
    recommendations: String(recommendationsHtmlFromSettings || "")
  };
  const defaultSections = [
    { key: "scope", title: "ESCOPO", sortOrder: 1 },
    { key: "technical_description", title: "DESCRIÇÃO TÉCNICA", sortOrder: 2 },
    { key: "recommendations", title: "RECOMENDAÇÕES", sortOrder: 3 },
    { key: "conclusion", title: "CONCLUSÃO", sortOrder: 4 }
  ];
  for (const section of defaultSections) {
    const seededHtml = String(seededContentBySection[section.key] || "");
    const seededText = stripHtmlToText(seededHtml);
    const hasSeededContent = Boolean(seededHtml.trim());
    const contentDelta = hasSeededContent ? deltaFromText(seededText) : EMPTY_DELTA;
    const contentHtml = hasSeededContent ? seededHtml : "<p><br></p>";
    const contentText = hasSeededContent ? seededText : "";

    // eslint-disable-next-line no-await-in-loop
    await db.query(
      `
        INSERT INTO service_report_sections (
          service_report_id,
          section_key,
          section_title,
          section_title_delta_json,
          section_title_html,
          section_title_text,
          content_delta_json,
          content_html,
          content_text,
          image_left_path,
          image_right_path,
          sort_order,
          is_rich_text,
          is_visible,
          is_locked,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,TRUE,FALSE,NOW(),NOW())
        ON CONFLICT (service_report_id, section_key)
        DO NOTHING
      `,
      [
        serviceReportId,
        section.key,
        section.title,
        deltaFromText(section.title),
        `<p>${section.title}</p>`,
        section.title,
        contentDelta,
        contentHtml,
        contentText,
        "",
        "",
        section.sortOrder
      ]
    );

    if (hasSeededContent) {
      // Se a secao ja existir (conflito), aplica o seed quando o conteudo ainda estiver vazio.
      // Isso garante que scope/recommendations carreguem content_html padrao na criacao da OS.
      // eslint-disable-next-line no-await-in-loop
      await db.query(
        `
          UPDATE service_report_sections
          SET
            content_delta_json = $3,
            content_html = $4,
            content_text = $5,
            updated_at = NOW()
          WHERE service_report_id = $1
            AND section_key = $2
            AND (
              content_html IS NULL
              OR BTRIM(content_html) = ''
              OR content_html = '<p><br></p>'
              OR content_text IS NULL
              OR BTRIM(content_text) = ''
            )
        `,
        [
          serviceReportId,
          section.key,
          contentDelta,
          contentHtml,
          contentText
        ]
      );
    }
  }
}

async function listSections(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_sections
      WHERE service_report_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function getSectionByKey(serviceReportId, sectionKey) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_sections
      WHERE service_report_id = $1 AND section_key = $2
      LIMIT 1
    `,
    [serviceReportId, sectionKey]
  );
  return result.rows[0] || null;
}

async function upsertSection(serviceReportId, sectionKey, payload = {}) {
  const match = SECTION_DEFINITIONS.find((section) => section.key === sectionKey);
  const title = payload.sectionTitle || match?.title || sectionKey;
  const sortOrder = Number.isFinite(Number(payload.sortOrder))
    ? Number(payload.sortOrder)
    : (match?.sortOrder || 99);
  await db.query(
    `
      INSERT INTO service_report_sections (
        service_report_id,
        section_key,
        section_title,
        section_title_delta_json,
        section_title_html,
        section_title_text,
        content_delta_json,
        content_html,
        content_text,
        image_left_path,
        image_right_path,
        sort_order,
        is_rich_text,
        is_visible,
        is_locked,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE,$13,COALESCE($14,FALSE),NOW(),NOW())
      ON CONFLICT (service_report_id, section_key)
      DO UPDATE SET
        section_title = EXCLUDED.section_title,
        section_title_delta_json = EXCLUDED.section_title_delta_json,
        section_title_html = EXCLUDED.section_title_html,
        section_title_text = EXCLUDED.section_title_text,
        content_delta_json = EXCLUDED.content_delta_json,
        content_html = EXCLUDED.content_html,
        content_text = EXCLUDED.content_text,
        image_left_path = EXCLUDED.image_left_path,
        image_right_path = EXCLUDED.image_right_path,
        sort_order = service_report_sections.sort_order,
        is_visible = EXCLUDED.is_visible,
        is_locked = EXCLUDED.is_locked,
        updated_at = NOW()
    `,
    [
      serviceReportId,
      sectionKey,
      title,
      payload.sectionTitleDeltaJson || deltaFromText(title),
      payload.sectionTitleHtml || `<p>${title}</p>`,
      payload.sectionTitleText || title,
      payload.contentDeltaJson || deltaFromText(payload.contentText || ""),
      payload.contentHtml || "",
      payload.contentText || "",
      payload.imageLeftPath || "",
      payload.imageRightPath || "",
      sortOrder,
      toBool(payload.isVisible, true),
      toBool(payload.isLocked, false)
    ]
  );
  await touchReport(serviceReportId);
}

async function getNextSectionSortOrder(serviceReportId) {
  const result = await db.query(
    `
      SELECT COALESCE(MAX(sort_order), 0)::int AS max_order
      FROM service_report_sections
      WHERE service_report_id = $1
    `,
    [serviceReportId]
  );
  return Number(result.rows[0]?.max_order || 0) + 1;
}

async function createSection(serviceReportId, payload = {}) {
  const sortOrder = payload.sortOrder || await getNextSectionSortOrder(serviceReportId);
  const base = String(payload.sectionTitleText || payload.sectionTitle || "capitulo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "capitulo";

  let sectionKey = base;
  let attempt = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await getSectionByKey(serviceReportId, sectionKey);
    if (!existing) break;
    attempt += 1;
    sectionKey = `${base}_${attempt}`;
  }

  await upsertSection(serviceReportId, sectionKey, {
    ...payload,
    sortOrder
  });
  return getSectionByKey(serviceReportId, sectionKey);
}

async function reorderSections(serviceReportId, orderedKeys) {
  for (let i = 0; i < orderedKeys.length; i++) {
    await db.query(
      `UPDATE service_report_sections SET sort_order = $1, updated_at = NOW() WHERE service_report_id = $2 AND section_key = $3`,
      [i + 1, serviceReportId, orderedKeys[i]]
    );
  }
  await touchReport(serviceReportId);
}

async function saveTocTablesConfig(reportId, config) {
  await db.query(
    `UPDATE service_report_reports SET toc_tables_config = $2, last_modified_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [reportId, JSON.stringify(config)]
  );
}

async function updateReportComponentsStyleConfig(reportId, styleConfig) {
  const result = await db.query(
    `UPDATE service_report_reports SET components_style_config = $2, last_modified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [reportId, styleConfig ? JSON.stringify(styleConfig) : null]
  );
  return result.rows[0] || null;
}

async function deleteSection(serviceReportId, sectionKey) {
  const result = await db.query(
    `
      DELETE FROM service_report_sections
      WHERE service_report_id = $1 AND section_key = $2
    `,
    [serviceReportId, sectionKey]
  );
  if (result.rowCount > 0) await touchReport(serviceReportId);
  return result.rowCount > 0;
}

async function listComponents(serviceReportId) {
  const result = await db.query(
    `
      SELECT
        ci.*,
        e.type AS equipment_type,
        e.model_family AS equipment_model_family,
        e.serial_number AS equipment_serial,
        e.tag_number AS equipment_tag,
        e.dt_number AS equipment_dt,
        COALESCE(NULLIF(e.power, ''), e.rated_ac_input_voltage) AS equipment_power
      FROM service_report_component_items ci
      LEFT JOIN service_report_equipments e ON e.id = ci.equipment_id
      WHERE ci.service_report_id = $1
      ORDER BY ci.category ASC, ci.sort_order ASC, ci.id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function createComponent(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_component_items (
        service_report_id,
        category,
        equipment_id,
        quantity,
        description,
        part_number,
        notes,
        sort_order,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.category,
      payload.equipmentId,
      payload.quantity || 1,
      payload.description || "",
      payload.partNumber || "",
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function updateComponent(id, payload) {
  const result = await db.query(
    `
      UPDATE service_report_component_items
      SET
        category = $2,
        equipment_id = $3,
        quantity = $4,
        description = $5,
        part_number = $6,
        notes = $7,
        sort_order = $8,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      payload.category,
      payload.equipmentId,
      payload.quantity || 1,
      payload.description || "",
      payload.partNumber || "",
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  const row = result.rows[0] || null;
  if (row) await touchReport(row.service_report_id);
  return row;
}

async function deleteComponent(id) {
  const result = await db.query(
    "DELETE FROM service_report_component_items WHERE id = $1 RETURNING service_report_id",
    [id]
  );
  if (result.rows[0]) await touchReport(result.rows[0].service_report_id);
  return result.rowCount > 0;
}

async function listMeasurementTables(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_measurement_tables
      WHERE service_report_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function createMeasurementTable(payload) {
  const result = await db.query(
    `
      WITH lock_report AS (
        SELECT id FROM service_report_reports WHERE id = $1 FOR UPDATE
      ),
      next_seq AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE((SELECT MAX(seq_id) FROM service_report_measurement_tables WHERE service_report_id = $1), 0) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1 FROM service_report_measurement_tables t2
          WHERE t2.service_report_id = $1 AND t2.seq_id = gs
        )
        ORDER BY gs LIMIT 1
      )
      INSERT INTO service_report_measurement_tables (
        service_report_id, seq_id, title, columns_json, rows_json, notes, sort_order, created_at, updated_at
      )
      VALUES ($1,(SELECT next_id FROM next_seq),$2,$3::jsonb,$4::jsonb,$5,$6,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.title || "",
      JSON.stringify(payload.columns || []),
      JSON.stringify(payload.rows || []),
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function updateMeasurementTable(id, serviceReportId, payload) {
  const result = await db.query(
    `
      UPDATE service_report_measurement_tables
      SET
        title = $3,
        columns_json = $4::jsonb,
        rows_json = $5::jsonb,
        notes = $6,
        sort_order = $7,
        updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [
      id,
      serviceReportId,
      payload.title || "",
      JSON.stringify(payload.columns || []),
      JSON.stringify(payload.rows || []),
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function updateMeasurementStyleConfig(id, serviceReportId, styleConfig) {
  const result = await db.query(
    `
      UPDATE service_report_measurement_tables
      SET style_config = $3::jsonb, updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [id, serviceReportId, JSON.stringify(styleConfig || null)]
  );
  return result.rows[0] || null;
}

async function deleteMeasurementTable(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM service_report_measurement_tables WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  if (result.rowCount > 0 && Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    await touchReport(serviceReportId);
  }
  return result.rowCount > 0;
}

async function listUpsMeasuresByReport(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_ups_measures
      WHERE service_report_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function getUpsMeasuresById(id, serviceReportId = null) {
  const values = [id];
  let query = "SELECT * FROM service_report_ups_measures WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  return result.rows[0] || null;
}

async function createUpsMeasures(payload) {
  const result = await db.query(
    `
      WITH lock_report AS (
        SELECT id FROM service_report_reports WHERE id = $1 FOR UPDATE
      ),
      next_seq AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE((SELECT MAX(seq_id) FROM service_report_ups_measures WHERE service_report_id = $1), 0) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1 FROM service_report_ups_measures t2
          WHERE t2.service_report_id = $1 AND t2.seq_id = gs
        )
        ORDER BY gs LIMIT 1
      )
      INSERT INTO service_report_ups_measures (
        service_report_id, seq_id, title, header_json, sections_json, notes, sort_order, created_at, updated_at
      )
      VALUES ($1,(SELECT next_id FROM next_seq),$2,$3::jsonb,$4::jsonb,$5,$6,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.title || "",
      JSON.stringify(payload.header || []),
      JSON.stringify(payload.sections || []),
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function updateUpsMeasures(id, serviceReportId, payload) {
  const result = await db.query(
    `
      UPDATE service_report_ups_measures
      SET
        title = $3,
        header_json = $4::jsonb,
        sections_json = $5::jsonb,
        notes = $6,
        sort_order = $7,
        updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [
      id,
      serviceReportId,
      payload.title || "",
      JSON.stringify(payload.header || []),
      JSON.stringify(payload.sections || []),
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function updateUpsMeasuresStyleConfig(id, serviceReportId, styleConfig) {
  const result = await db.query(
    `
      UPDATE service_report_ups_measures
      SET style_config = $3::jsonb, updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [id, serviceReportId, JSON.stringify(styleConfig || null)]
  );
  return result.rows[0] || null;
}

async function deleteUpsMeasures(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM service_report_ups_measures WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  if (result.rowCount > 0 && Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    await touchReport(serviceReportId);
  }
  return result.rowCount > 0;
}

async function listEventLogsByReport(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_event_logs
      WHERE service_report_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function getEventLogById(id, serviceReportId = null) {
  const values = [id];
  let query = "SELECT * FROM service_report_event_logs WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  return result.rows[0] || null;
}

async function createEventLog(payload) {
  const result = await db.query(
    `
      WITH lock_report AS (
        SELECT id FROM service_report_reports WHERE id = $1 FOR UPDATE
      ),
      next_seq AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE((SELECT MAX(seq_id) FROM service_report_event_logs WHERE service_report_id = $1), 0) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1 FROM service_report_event_logs t2
          WHERE t2.service_report_id = $1 AND t2.seq_id = gs
        )
        ORDER BY gs LIMIT 1
      )
      INSERT INTO service_report_event_logs (
        service_report_id, seq_id, title, header_json, sections_json, notes, sort_order, created_at, updated_at
      )
      VALUES ($1,(SELECT next_id FROM next_seq),$2,$3::jsonb,$4::jsonb,$5,$6,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.title || "",
      JSON.stringify(payload.header || []),
      JSON.stringify(payload.sections || []),
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function updateEventLog(id, serviceReportId, payload) {
  const result = await db.query(
    `
      UPDATE service_report_event_logs
      SET
        title = $3,
        header_json = $4::jsonb,
        sections_json = $5::jsonb,
        notes = $6,
        sort_order = $7,
        updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [
      id,
      serviceReportId,
      payload.title || "",
      JSON.stringify(payload.header || []),
      JSON.stringify(payload.sections || []),
      payload.notes || "",
      payload.sortOrder || 0
    ]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function updateEventLogStyleConfig(id, serviceReportId, styleConfig) {
  const result = await db.query(
    `
      UPDATE service_report_event_logs
      SET style_config = $3::jsonb, updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [id, serviceReportId, JSON.stringify(styleConfig || null)]
  );
  return result.rows[0] || null;
}

async function deleteEventLog(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM service_report_event_logs WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  if (result.rowCount > 0 && Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    await touchReport(serviceReportId);
  }
  return result.rowCount > 0;
}

async function listSignatures(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_signatures
      WHERE service_report_id = $1
      ORDER BY id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function createSignature(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_signatures (
        service_report_id,
        signer_type,
        signer_name,
        signer_role,
        signer_company,
        signature_data,
        signature_file_path,
        revision,
        ip_address,
        user_agent,
        signed_at,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.signerType,
      payload.signerName,
      payload.signerRole || "",
      payload.signerCompany || "",
      payload.signatureData || "",
      payload.signatureFilePath || "",
      payload.revision || "",
      payload.ipAddress || "",
      payload.userAgent || ""
    ]
  );
  return result.rows[0];
}

async function deleteSignature(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM service_report_signatures WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  return result.rowCount > 0;
}

// ---- Sign Requests ----

async function createSignRequest(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_sign_requests (
        service_report_id, token, status,
        signer_name, signer_email, signer_role, signer_company,
        notes, expires_at, created_at, updated_at
      )
      VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, NOW() + INTERVAL '30 days', NOW(), NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.token,
      payload.signerName || "",
      payload.signerEmail || "",
      payload.signerRole || "",
      payload.signerCompany || "",
      payload.notes || ""
    ]
  );
  return result.rows[0];
}

async function getSignRequestByToken(token) {
  const result = await db.query(
    `
      SELECT sr.*,
        rep.report_number, rep.title AS report_title, rep.status AS report_status,
        o.service_order_code, o.title AS order_title, o.id AS order_id,
        c.name AS customer_name
      FROM service_report_sign_requests sr
      JOIN service_report_reports rep ON rep.id = sr.service_report_id
      JOIN service_report_orders o ON o.id = rep.service_order_id
      JOIN service_report_customers c ON c.id = o.customer_id
      WHERE sr.token = $1
    `,
    [token]
  );
  return result.rows[0] || null;
}

async function listSignRequestsByReportId(serviceReportId) {
  const result = await db.query(
    `SELECT * FROM service_report_sign_requests WHERE service_report_id = $1 ORDER BY id DESC`,
    [serviceReportId]
  );
  return result.rows;
}

async function updateSignRequest(id, payload) {
  const fields = [];
  const values = [id];
  let idx = 2;

  if (payload.signerName !== undefined) { fields.push(`signer_name = $${idx++}`); values.push(payload.signerName); }
  if (payload.signerEmail !== undefined) { fields.push(`signer_email = $${idx++}`); values.push(payload.signerEmail); }
  if (payload.signerRole !== undefined) { fields.push(`signer_role = $${idx++}`); values.push(payload.signerRole); }
  if (payload.signerCompany !== undefined) { fields.push(`signer_company = $${idx++}`); values.push(payload.signerCompany); }
  if (payload.status !== undefined) { fields.push(`status = $${idx++}`); values.push(payload.status); }
  if (payload.signatureData !== undefined) { fields.push(`signature_data = $${idx++}`); values.push(payload.signatureData); }
  if (payload.signedAt !== undefined) { fields.push(`signed_at = $${idx++}`); values.push(payload.signedAt); }
  if (payload.ipAddress !== undefined) { fields.push(`ip_address = $${idx++}`); values.push(payload.ipAddress); }
  if (payload.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(payload.notes); }

  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);

  const result = await db.query(
    `UPDATE service_report_sign_requests SET ${fields.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

async function deleteSignRequest(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM service_report_sign_requests WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  return result.rowCount > 0;
}

// ---- Global Technicians ----

async function listGlobalTechnicians() {
  const result = await db.query(
    `SELECT * FROM service_report_global_technicians ORDER BY name ASC, id ASC`
  );
  return result.rows;
}

async function getGlobalTechnicianById(id) {
  const result = await db.query(
    `SELECT * FROM service_report_global_technicians WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createGlobalTechnician(payload) {
  const result = await db.query(
    `INSERT INTO service_report_global_technicians (name, role, company, email, phone, is_lead, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
    [payload.name, payload.role || "", payload.company || "", payload.email || "", payload.phone || "", Boolean(payload.isLead)]
  );
  return result.rows[0];
}

async function updateGlobalTechnician(id, payload) {
  const result = await db.query(
    `UPDATE service_report_global_technicians
     SET name=$2, role=$3, company=$4, email=$5, phone=$6, is_lead=$7, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id, payload.name, payload.role || "", payload.company || "", payload.email || "", payload.phone || "", Boolean(payload.isLead)]
  );
  return result.rows[0] || null;
}

async function deleteGlobalTechnician(id) {
  const result = await db.query(
    `DELETE FROM service_report_global_technicians WHERE id=$1`, [id]
  );
  return result.rowCount > 0;
}

// ---- Global Instruments ----

async function listGlobalInstruments() {
  const result = await db.query(
    `SELECT i.*, t.name AS responsible_technician_name
     FROM service_report_global_instruments i
     LEFT JOIN service_report_global_technicians t ON t.id = i.responsible_technician_id
     ORDER BY i.name ASC, i.id ASC`
  );
  return result.rows;
}

async function createGlobalInstrument(payload) {
  const result = await db.query(
    `INSERT INTO service_report_global_instruments (
       name, model, serial_number, certificate_number, certificate_link, responsible_technician_id, last_calibration_date, calibration_due_date, notes, created_at, updated_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
    [
      payload.name,
      payload.model || "",
      payload.serialNumber || "",
      payload.certificateNumber || "",
      payload.certificateLink || "",
      toInt(payload.responsibleTechnicianId),
      payload.lastCalibrationDate || null,
      payload.calibrationDueDate || null,
      payload.notes || ""
    ]
  );
  return result.rows[0];
}

async function updateGlobalInstrument(id, payload) {
  const result = await db.query(
    `UPDATE service_report_global_instruments
     SET name=$2, model=$3, serial_number=$4, certificate_number=$5, certificate_link=$6, responsible_technician_id=$7, last_calibration_date=$8, calibration_due_date=$9, notes=$10, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [
      id,
      payload.name,
      payload.model || "",
      payload.serialNumber || "",
      payload.certificateNumber || "",
      payload.certificateLink || "",
      toInt(payload.responsibleTechnicianId),
      payload.lastCalibrationDate || null,
      payload.calibrationDueDate || null,
      payload.notes || ""
    ]
  );
  return result.rows[0] || null;
}

async function deleteGlobalInstrument(id) {
  const result = await db.query(
    `DELETE FROM service_report_global_instruments WHERE id=$1`, [id]
  );
  return result.rowCount > 0;
}

// ---- Global Tools ----

async function listGlobalTools() {
  const result = await db.query(
    `SELECT tools.*, tech.name AS technician_name
     FROM service_report_global_tools tools
     LEFT JOIN service_report_global_technicians tech ON tech.id = tools.technician_id
     ORDER BY tech.name ASC NULLS LAST, tools.item ASC, tools.id ASC`
  );
  return result.rows;
}

async function listGlobalToolsByTechnician(technicianId) {
  const result = await db.query(
    `SELECT tools.*, tech.name AS technician_name
     FROM service_report_global_tools tools
     INNER JOIN service_report_global_technicians tech ON tech.id = tools.technician_id
     WHERE tools.technician_id = $1
     ORDER BY tools.item ASC, tools.id ASC`,
    [technicianId]
  );
  return result.rows;
}

function normalizeToolQuantity(value) {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

async function getNextGlobalToolItem(technicianId) {
  const result = await db.query(
    `
      SELECT COALESCE(MAX(
        CASE WHEN item ~ '^[0-9]+$' THEN item::int ELSE 0 END
      ), 0)::int AS last_item
      FROM service_report_global_tools
      WHERE technician_id = $1
    `,
    [technicianId]
  );
  return String(Number(result.rows[0]?.last_item || 0) + 1);
}

async function createGlobalTool(payload) {
  const technicianId = toInt(payload.technicianId);
  const item = String(payload.item || "").trim() || await getNextGlobalToolItem(technicianId);
  const result = await db.query(
    `INSERT INTO service_report_global_tools (
       technician_id, item, quantity, description, serial_number, notes, created_at, updated_at
     )
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
    [
      technicianId,
      item,
      normalizeToolQuantity(payload.quantity),
      payload.description || "",
      payload.serialNumber || "",
      payload.notes || ""
    ]
  );
  return result.rows[0];
}

async function updateGlobalTool(id, payload) {
  const result = await db.query(
    `UPDATE service_report_global_tools
     SET technician_id=$2, item=$3, quantity=$4, description=$5, serial_number=$6, notes=$7, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [
      id,
      toInt(payload.technicianId),
      payload.item,
      normalizeToolQuantity(payload.quantity),
      payload.description || "",
      payload.serialNumber || "",
      payload.notes || ""
    ]
  );
  return result.rows[0] || null;
}

async function updateGlobalToolForTechnician(id, technicianId, payload) {
  const result = await db.query(
    `UPDATE service_report_global_tools
     SET quantity=$3, description=$4, serial_number=$5, notes=$6, updated_at=NOW()
     WHERE id=$1 AND technician_id=$2 RETURNING *`,
    [
      id,
      technicianId,
      normalizeToolQuantity(payload.quantity),
      payload.description || "",
      payload.serialNumber || "",
      payload.notes || ""
    ]
  );
  return result.rows[0] || null;
}

async function deleteGlobalTool(id) {
  const result = await db.query(
    `DELETE FROM service_report_global_tools WHERE id=$1`, [id]
  );
  return result.rowCount > 0;
}

async function deleteGlobalToolForTechnician(id, technicianId) {
  const result = await db.query(
    `DELETE FROM service_report_global_tools WHERE id=$1 AND technician_id=$2`,
    [id, technicianId]
  );
  return result.rowCount > 0;
}

// ---- Order <-> Technician / Instrument links ----

async function listTechniciansByOrder(orderId) {
  const result = await db.query(
    `SELECT t.* FROM service_report_global_technicians t
     JOIN service_report_order_technicians ot ON ot.technician_id = t.id
     WHERE ot.order_id = $1 ORDER BY t.name ASC`,
    [orderId]
  );
  return result.rows;
}

async function linkTechnicianToOrder(orderId, technicianId) {
  await db.query(
    `INSERT INTO service_report_order_technicians (order_id, technician_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [orderId, technicianId]
  );
}

async function unlinkTechnicianFromOrder(orderId, technicianId) {
  await db.query(
    `DELETE FROM service_report_order_technicians WHERE order_id=$1 AND technician_id=$2`,
    [orderId, technicianId]
  );
}

async function replaceTechniciansByOrder(orderId, technicianIds = []) {
  const normalizedIds = Array.from(new Set(
    (Array.isArray(technicianIds) ? technicianIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  ));
  await db.query(`DELETE FROM service_report_order_technicians WHERE order_id = $1`, [orderId]);
  for (const technicianId of normalizedIds) {
    // eslint-disable-next-line no-await-in-loop
    await linkTechnicianToOrder(orderId, technicianId);
  }
}

async function listOrderTechnicianLinks(orderIds = []) {
  const normalizedOrderIds = Array.from(new Set(
    (Array.isArray(orderIds) ? orderIds : [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  ));
  if (!normalizedOrderIds.length) return [];
  const result = await db.query(
    `
      SELECT order_id, technician_id
      FROM service_report_order_technicians
      WHERE order_id = ANY($1::int[])
      ORDER BY order_id ASC, technician_id ASC
    `,
    [normalizedOrderIds]
  );
  return result.rows;
}

async function listInstrumentsByOrder(orderId) {
  const result = await db.query(
    `SELECT i.*, t.name AS responsible_technician_name
     FROM service_report_global_instruments i
     JOIN service_report_order_instruments oi ON oi.instrument_id = i.id
     LEFT JOIN service_report_global_technicians t ON t.id = i.responsible_technician_id
     WHERE oi.order_id = $1 ORDER BY i.name ASC`,
    [orderId]
  );
  return result.rows;
}

async function linkInstrumentToOrder(orderId, instrumentId) {
  await db.query(
    `INSERT INTO service_report_order_instruments (order_id, instrument_id)
     VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [orderId, instrumentId]
  );
}

async function unlinkInstrumentFromOrder(orderId, instrumentId) {
  await db.query(
    `DELETE FROM service_report_order_instruments WHERE order_id=$1 AND instrument_id=$2`,
    [orderId, instrumentId]
  );
}

async function listInstruments(serviceReportId) {
  const result = await db.query(
    `
      SELECT i.*, t.name AS responsible_technician_name
      FROM service_report_instruments i
      LEFT JOIN service_report_global_technicians t ON t.id = i.responsible_technician_id
      WHERE i.service_report_id = $1
      ORDER BY i.id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function createInstrument(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_instruments (
        service_report_id,
        name,
        model,
        serial_number,
        certificate_number,
        certificate_link,
        responsible_technician_id,
        last_calibration_date,
        calibration_due_date,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.name,
      payload.model || "",
      payload.serialNumber || "",
      payload.certificateNumber || "",
      payload.certificateLink || "",
      toInt(payload.responsibleTechnicianId),
      payload.lastCalibrationDate || null,
      payload.calibrationDueDate,
      payload.notes || ""
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function listTechnicians(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_technicians
      WHERE service_report_id = $1
      ORDER BY id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function createTechnician(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_technicians (
        service_report_id,
        name,
        role,
        company,
        email,
        phone,
        is_lead,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.name,
      payload.role || "",
      payload.company || "",
      payload.email || "",
      payload.phone || "",
      Boolean(payload.isLead)
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function updateTechnician(id, serviceReportId, payload) {
  const result = await db.query(
    `
      UPDATE service_report_technicians
      SET name = $3, role = $4, company = $5, email = $6, phone = $7, is_lead = $8, updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [
      id, serviceReportId,
      payload.name, payload.role || "", payload.company || "",
      payload.email || "", payload.phone || "", Boolean(payload.isLead)
    ]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function deleteTechnician(id, serviceReportId) {
  const result = await db.query(
    `DELETE FROM service_report_technicians WHERE id = $1 AND service_report_id = $2`,
    [id, serviceReportId]
  );
  if (result.rowCount > 0) await touchReport(serviceReportId);
  return result.rowCount > 0;
}

async function updateInstrument(id, serviceReportId, payload) {
  const result = await db.query(
    `
      UPDATE service_report_instruments
      SET name = $3, model = $4, serial_number = $5, certificate_number = $6, certificate_link = $7, responsible_technician_id = $8, last_calibration_date = $9, calibration_due_date = $10, notes = $11, updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [
      id, serviceReportId,
      payload.name, payload.model || "", payload.serialNumber || "",
      payload.certificateNumber || "",
      payload.certificateLink || "",
      toInt(payload.responsibleTechnicianId),
      payload.lastCalibrationDate || null,
      payload.calibrationDueDate || null,
      payload.notes || ""
    ]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function deleteInstrument(id, serviceReportId) {
  const result = await db.query(
    `DELETE FROM service_report_instruments WHERE id = $1 AND service_report_id = $2`,
    [id, serviceReportId]
  );
  if (result.rowCount > 0) await touchReport(serviceReportId);
  return result.rowCount > 0;
}

async function listImages(serviceReportId) {
  const result = await db.query(
    `
      SELECT *
      FROM service_report_images
      WHERE service_report_id = $1
      ORDER BY section_key ASC, sort_order ASC, ref_id ASC, id ASC
    `,
    [serviceReportId]
  );
  return result.rows;
}

async function createImage(payload) {
  const result = await db.query(
    `
      WITH lock_report AS (
        SELECT id
        FROM service_report_reports
        WHERE id = $1
        FOR UPDATE
      ),
      next_ref AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE(
            (SELECT MAX(ref_id) FROM service_report_images WHERE service_report_id = $1),
            0
          ) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1
          FROM service_report_images si2
          WHERE si2.service_report_id = $1
            AND si2.ref_id = gs
        )
        ORDER BY gs
        LIMIT 1
      )
      INSERT INTO service_report_images (
        service_report_id,
        ref_id,
        section_key,
        daily_log_id,
        file_path,
        caption,
        sort_order,
        created_at,
        updated_at
      )
      VALUES ($1,(SELECT next_id FROM next_ref),$2,$3,$4,$5,$6,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.sectionKey || "",
      payload.dailyLogId || null,
      payload.filePath,
      payload.caption || "",
      payload.sortOrder || 0
    ]
  );
  return result.rows[0];
}

async function updateImageCaption(imageId, caption) {
  await db.query(
    `UPDATE service_report_images SET caption = $1, updated_at = NOW() WHERE id = $2`,
    [String(caption || ""), Number(imageId)]
  );
}

async function updateImageCaptionByRefId(serviceReportId, imageRefId, caption) {
  await db.query(
    `
      UPDATE service_report_images
      SET caption = $1, updated_at = NOW()
      WHERE service_report_id = $2 AND ref_id = $3
    `,
    [String(caption || ""), Number(serviceReportId), Number(imageRefId)]
  );
}

async function updateImageRotationByRefId(serviceReportId, imageRefId, rotation) {
  const validRotations = [0, 90, 180, 270];
  const normalizedRotation = validRotations.includes(Number(rotation)) ? Number(rotation) : 0;
  await db.query(
    `
      UPDATE service_report_images
      SET rotation = $1, updated_at = NOW()
      WHERE service_report_id = $2 AND ref_id = $3
    `,
    [normalizedRotation, Number(serviceReportId), Number(imageRefId)]
  );
}

async function deleteImageByRefId(serviceReportId, imageRefId) {
  const result = await db.query(
    `
      DELETE FROM service_report_images
      WHERE ref_id = $1 AND service_report_id = $2
    `,
    [imageRefId, serviceReportId]
  );
  return result.rowCount > 0;
}

async function deleteImagesBySection(serviceReportId, sectionKey) {
  await db.query(
    `
      DELETE FROM service_report_images
      WHERE service_report_id = $1 AND section_key = $2
    `,
    [serviceReportId, sectionKey]
  );
}

async function replaceSectionImages(serviceReportId, sectionKey, items = []) {
  await deleteImagesBySection(serviceReportId, sectionKey);
  const normalized = (Array.isArray(items) ? items : [])
    .filter((item) => item && item.filePath)
    .map((item, index) => ({
      filePath: String(item.filePath || "").trim(),
      caption: String(item.caption || "").trim(),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index + 1
    }))
    .filter((item) => item.filePath);

  const created = [];
  for (const item of normalized) {
    // eslint-disable-next-line no-await-in-loop
    const row = await createImage({
      serviceReportId,
      sectionKey,
      filePath: item.filePath,
      caption: item.caption,
      sortOrder: item.sortOrder
    });
    created.push(row);
  }
  return created;
}

async function listOrderAttachments(serviceOrderId) {
  const result = await db.query(
    `
      SELECT id, service_order_id, original_name, stored_name, label, file_size, mime_type, uploaded_by, created_at
      FROM service_report_order_attachments
      WHERE service_order_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [serviceOrderId]
  );
  return result.rows;
}

async function createOrderAttachment(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_order_attachments
        (service_order_id, original_name, stored_name, label, file_size, mime_type, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      payload.serviceOrderId,
      payload.originalName,
      payload.storedName,
      payload.label || "",
      payload.fileSize || 0,
      payload.mimeType || "",
      payload.uploadedBy || ""
    ]
  );
  return result.rows[0];
}

async function getOrderAttachmentById(id) {
  const result = await db.query(
    `SELECT * FROM service_report_order_attachments WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function deleteOrderAttachment(id) {
  const result = await db.query(
    `DELETE FROM service_report_order_attachments WHERE id = $1 RETURNING stored_name, service_order_id`,
    [id]
  );
  return result.rows[0] || null;
}

// ---- PDF History ----

async function createPdfHistoryEntry(payload) {
  const result = await db.query(
    `
      INSERT INTO service_report_pdf_history
        (service_order_id, service_report_id, order_code, report_number, revision, object_key, file_name, generated_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `,
    [
      payload.serviceOrderId,
      payload.serviceReportId,
      payload.orderCode || "",
      payload.reportNumber || "",
      payload.revision || "",
      payload.objectKey || "",
      payload.fileName || "",
      payload.generatedBy || "auto"
    ]
  );
  return result.rows[0];
}

async function listPdfHistoryByOrderId(serviceOrderId) {
  const result = await db.query(
    `
      SELECT * FROM service_report_pdf_history
      WHERE service_order_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [serviceOrderId]
  );
  return result.rows;
}

async function getPdfHistoryEntry(id) {
  const result = await db.query(
    `SELECT * FROM service_report_pdf_history WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getLatestPdfHistoryByReportId(serviceReportId) {
  const result = await db.query(
    `SELECT * FROM service_report_pdf_history
     WHERE service_report_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [serviceReportId]
  );
  return result.rows[0] || null;
}

async function deletePdfHistoryEntry(id) {
  const result = await db.query(
    `DELETE FROM service_report_pdf_history WHERE id = $1`,
    [id]
  );
  return result.rowCount > 0;
}

// ---- Leituras Alber ----

async function createLeituraAlber(payload) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `
      WITH lock_report AS (
        SELECT id FROM service_report_reports WHERE id = $1 FOR UPDATE
      ),
      next_seq AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE((SELECT MAX(seq_id) FROM leituras_alber WHERE service_report_id = $1), 0) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1 FROM leituras_alber la2
          WHERE la2.service_report_id = $1 AND la2.seq_id = gs
        )
        ORDER BY gs LIMIT 1
      )
      INSERT INTO leituras_alber
         (service_report_id, seq_id, location_name, battery_name, model_number, install_date,
          total_strings, nome_arquivo, string_labels, importado_em)
       VALUES ($1,(SELECT next_id FROM next_seq),$2,$3,$4,$5,$6,$7,$8::jsonb,NOW())
       RETURNING *`,
      [
        payload.serviceReportId,
        payload.locationName || "",
        payload.batteryName || "",
        payload.modelNumber || "",
        payload.installDate || "",
        payload.totalStrings || 0,
        payload.nomeArquivo || "",
        JSON.stringify(payload.stringLabels || {})
      ]
    );
    const leitura = res.rows[0];

    const celulas = Array.isArray(payload.celulas) ? payload.celulas : [];
    for (const c of celulas) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO celulas_alber (leitura_id, string_num, celula_num, voltagem, resistencia_interna, ativa)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [leitura.id, c.stringNum, c.celulaNum, c.voltagem, c.resistencia, Boolean(c.ativa !== false)]
      );
    }

    await client.query("COMMIT");
    return leitura;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listLeiturasAlberByReport(serviceReportId) {
  const result = await db.query(
    `SELECT la.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id', ca.id,
             'string_num', ca.string_num,
             'celula_num', ca.celula_num,
             'voltagem', ca.voltagem,
             'resistencia_interna', ca.resistencia_interna,
             'ativa', ca.ativa
           ) ORDER BY ca.string_num ASC, ca.celula_num ASC
         ) FILTER (WHERE ca.id IS NOT NULL),
         '[]'::json
       ) AS celulas
     FROM leituras_alber la
     LEFT JOIN celulas_alber ca ON ca.leitura_id = la.id
     WHERE la.service_report_id = $1
     GROUP BY la.id
     ORDER BY la.importado_em DESC`,
    [serviceReportId]
  );
  return result.rows;
}

async function getLeituraAlberById(id, serviceReportId = null) {
  const values = [id];
  let where = "la.id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    where += " AND la.service_report_id = $2";
  }
  const result = await db.query(
    `SELECT la.*,
       COALESCE(
         json_agg(
           json_build_object(
             'id', ca.id,
             'string_num', ca.string_num,
             'celula_num', ca.celula_num,
             'voltagem', ca.voltagem,
             'resistencia_interna', ca.resistencia_interna,
             'ativa', ca.ativa
           ) ORDER BY ca.string_num ASC, ca.celula_num ASC
         ) FILTER (WHERE ca.id IS NOT NULL),
         '[]'::json
       ) AS celulas
     FROM leituras_alber la
     LEFT JOIN celulas_alber ca ON ca.leitura_id = la.id
     WHERE ${where}
     GROUP BY la.id`,
    values
  );
  return result.rows[0] || null;
}

async function updateLeituraAlber(id, serviceReportId, payload) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE leituras_alber
       SET location_name=$3, battery_name=$4, model_number=$5, install_date=$6,
           total_strings=$7, string_labels=$8::jsonb, display_config=$9::jsonb,
           manufacture_date=$10
       WHERE id=$1 AND service_report_id=$2`,
      [
        id,
        serviceReportId,
        payload.locationName || "",
        payload.batteryName || "",
        payload.modelNumber || "",
        payload.installDate || "",
        payload.totalStrings || 0,
        JSON.stringify(payload.stringLabels || {}),
        JSON.stringify(payload.displayConfig || {}),
        payload.manufactureDate || ""
      ]
    );

    // Replace all celulas
    await client.query(`DELETE FROM celulas_alber WHERE leitura_id = $1`, [id]);
    const celulas = Array.isArray(payload.celulas) ? payload.celulas : [];
    for (const c of celulas) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO celulas_alber (leitura_id, string_num, celula_num, voltagem, resistencia_interna, ativa)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, c.stringNum, c.celulaNum, c.voltagem, c.resistencia, Boolean(c.ativa !== false)]
      );
    }

    await client.query("COMMIT");
    await touchReport(serviceReportId);
    return getLeituraAlberById(id, serviceReportId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateLeituraAlberStyleConfig(id, serviceReportId, styleConfig) {
  const result = await db.query(
    `
      UPDATE leituras_alber
      SET style_config = $3::jsonb
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [id, serviceReportId, JSON.stringify(styleConfig || null)]
  );
  return result.rows[0] || null;
}

async function deleteLeituraAlber(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM leituras_alber WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  return result.rowCount > 0;
}

async function createDischargeTest(payload) {
  const result = await db.query(
    `
      WITH lock_report AS (
        SELECT id FROM service_report_reports WHERE id = $1 FOR UPDATE
      ),
      next_seq AS (
        SELECT gs AS next_id
        FROM generate_series(
          1,
          COALESCE((SELECT MAX(seq_id) FROM discharge_tests WHERE service_report_id = $1), 0) + 1
        ) AS gs
        WHERE NOT EXISTS (
          SELECT 1 FROM discharge_tests dt2
          WHERE dt2.service_report_id = $1 AND dt2.seq_id = gs
        )
        ORDER BY gs LIMIT 1
      )
      INSERT INTO discharge_tests (
        service_report_id, seq_id, title, measurement_date, nominal_voltage,
        notes, hour_labels, readings, col_celula_label, col_flutuacao_label, created_at, updated_at
      )
      VALUES ($1,(SELECT next_id FROM next_seq),$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.serviceReportId,
      payload.title || "",
      payload.measurementDate || "",
      payload.nominalVoltage || null,
      payload.notes || "",
      JSON.stringify(payload.hourLabels || []),
      JSON.stringify(payload.readings || []),
      payload.colCelulaLabel || "",
      payload.colFlutuacaoLabel || ""
    ]
  );
  await touchReport(payload.serviceReportId);
  return result.rows[0];
}

async function listDischargeTestsByReport(serviceReportId) {
  const result = await db.query(
    `SELECT * FROM discharge_tests WHERE service_report_id = $1 ORDER BY id ASC`,
    [serviceReportId]
  );
  return result.rows;
}

async function getDischargeTestById(id, serviceReportId) {
  const result = await db.query(
    `SELECT * FROM discharge_tests WHERE id = $1 AND service_report_id = $2`,
    [id, serviceReportId]
  );
  return result.rows[0] || null;
}

async function updateDischargeTest(id, serviceReportId, payload) {
  const result = await db.query(
    `
      UPDATE discharge_tests
      SET
        title = $3,
        measurement_date = $4,
        nominal_voltage = $5,
        notes = $6,
        hour_labels = $7::jsonb,
        col_celula_label = $8,
        col_flutuacao_label = $9,
        updated_at = NOW()
      WHERE id = $1 AND service_report_id = $2
      RETURNING *
    `,
    [
      id,
      serviceReportId,
      payload.title || "",
      payload.measurementDate || "",
      payload.nominalVoltage || null,
      payload.notes || "",
      JSON.stringify(Array.isArray(payload.hourLabels) ? payload.hourLabels : []),
      payload.colCelulaLabel || "",
      payload.colFlutuacaoLabel || ""
    ]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function updateDischargeTestStyleConfig(id, serviceReportId, styleConfig) {
  const result = await db.query(
    `UPDATE discharge_tests SET style_config = $3, updated_at = NOW() WHERE id = $1 AND service_report_id = $2 RETURNING *`,
    [id, serviceReportId, styleConfig ? JSON.stringify(styleConfig) : null]
  );
  if (result.rows[0]) await touchReport(serviceReportId);
  return result.rows[0] || null;
}

async function deleteDischargeTest(id, serviceReportId = null) {
  const values = [id];
  let query = "DELETE FROM discharge_tests WHERE id = $1";
  if (Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    values.push(Number(serviceReportId));
    query += " AND service_report_id = $2";
  }
  const result = await db.query(query, values);
  if (result.rowCount > 0 && Number.isInteger(Number(serviceReportId)) && Number(serviceReportId) > 0) {
    await touchReport(serviceReportId);
  }
  return result.rowCount > 0;
}

async function renameMeasurementTable(id, serviceReportId, title) {
  const result = await db.query(
    `UPDATE service_report_measurement_tables SET title = $3, updated_at = NOW() WHERE id = $1 AND service_report_id = $2 RETURNING id`,
    [id, serviceReportId, String(title || "")]
  );
  if (result.rowCount > 0) await touchReport(serviceReportId);
  return result.rowCount > 0;
}

async function renameDischargeTest(id, serviceReportId, title) {
  const result = await db.query(
    `UPDATE discharge_tests SET title = $3, updated_at = NOW() WHERE id = $1 AND service_report_id = $2 RETURNING id`,
    [id, serviceReportId, String(title || "")]
  );
  if (result.rowCount > 0) await touchReport(serviceReportId);
  return result.rowCount > 0;
}

module.exports = {
  getAppSetting,
  upsertAppSetting,
  touchReport,
  touchReportByOrderId,
  toInt,
  getOrderCodeSeed,
  setOrderCodeSeed,
  getOrderCodeSequence,
  listOrders,
  listExistingOrderIds,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  listCustomers,
  getCustomerById,
  getCustomerByExternalRef,
  setSentinelGridLink,
  getBySentinelGridId,
  backfillExternalRef,
  getCustomerByNormalizedName,
  getSiteByNameForCustomer,
  getEquipmentByTagForCustomer,
  getEquipmentBySerialForCustomer,
  backfillEquipmentOwner,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listSites,
  getSiteById,
  getSiteByExternalRef,
  createSite,
  updateSite,
  deleteSite,
  listEquipments,
  getEquipmentById,
  getEquipmentByExternalRef,
  createEquipment,
  findEquipmentBySiteTag,
  updateEquipment,
  deleteEquipment,
  listSpareParts,
  getSparePartById,
  createSparePart,
  bulkCreateSpareParts,
  bulkUpsertLinkedSpareParts,
  getSparePartsByPartNumbers,
  updateSparePart,
  deleteSparePart,
  listSparePartsByEquipment,
  listSparePartsByEquipmentIds,
  linkSparePartToEquipment,
  linkSparePartToEquipmentIfMissing,
  unlinkSparePartFromEquipment,
  updateSparePartQuantityByEquipment,
  listEquipmentSpares,
  listEquipmentSparesByEquipmentIds,
  getEquipmentSpareById,
  findEquipmentSpareByPn,
  createEquipmentSpare,
  associateSparePartToEquipment,
  updateEquipmentSpare,
  updateEquipmentSpareQuantity,
  deleteEquipmentSpare,
  bulkUpsertEquipmentSpares,
  attachEquipmentToOrder,
  listOrderEquipments,
  detachEquipmentFromOrder,
  listTimesheetByOrder,
  createTimesheetEntry,
  updateTimesheetEntry,
  deleteTimesheetEntry,
  listDailyLogsByOrder,
  getDailyLogByTagForOrder,
  createDailyLog,
  updateDailyLogByOrderAndId,
  deleteDailyLogByOrderAndId,
  listReports,
  getReportById,
  getReportByOrderId,
  createReport,
  updateReport,
  ensureDefaultSections,
  listSections,
  getSectionByKey,
  createSection,
  upsertSection,
  reorderSections,
  saveTocTablesConfig,
  updateReportComponentsStyleConfig,
  deleteSection,
  listComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  listMeasurementTables,
  createMeasurementTable,
  updateMeasurementTable,
  updateMeasurementStyleConfig,
  deleteMeasurementTable,
  listUpsMeasuresByReport,
  getUpsMeasuresById,
  createUpsMeasures,
  updateUpsMeasures,
  updateUpsMeasuresStyleConfig,
  deleteUpsMeasures,
  listEventLogsByReport,
  getEventLogById,
  createEventLog,
  updateEventLog,
  updateEventLogStyleConfig,
  deleteEventLog,
  listSignatures,
  createSignature,
  deleteSignature,
  listGlobalTechnicians,
  getGlobalTechnicianById,
  createGlobalTechnician,
  updateGlobalTechnician,
  deleteGlobalTechnician,
  listGlobalInstruments,
  createGlobalInstrument,
  updateGlobalInstrument,
  deleteGlobalInstrument,
  listGlobalTools,
  listGlobalToolsByTechnician,
  createGlobalTool,
  updateGlobalTool,
  updateGlobalToolForTechnician,
  deleteGlobalTool,
  deleteGlobalToolForTechnician,
  listTechniciansByOrder,
  linkTechnicianToOrder,
  unlinkTechnicianFromOrder,
  replaceTechniciansByOrder,
  listOrderTechnicianLinks,
  listInstrumentsByOrder,
  linkInstrumentToOrder,
  unlinkInstrumentFromOrder,
  listInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
  listTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  listImages,
  createImage,
  updateImageCaption,
  updateImageCaptionByRefId,
  updateImageRotationByRefId,
  deleteImageByRefId,
  deleteImagesBySection,
  replaceSectionImages,
  createSignRequest,
  getSignRequestByToken,
  listSignRequestsByReportId,
  updateSignRequest,
  deleteSignRequest,
  listOrderAttachments,
  createOrderAttachment,
  getOrderAttachmentById,
  deleteOrderAttachment,
  createPdfHistoryEntry,
  listPdfHistoryByOrderId,
  getPdfHistoryEntry,
  getLatestPdfHistoryByReportId,
  deletePdfHistoryEntry,
  createLeituraAlber,
  listLeiturasAlberByReport,
  getLeituraAlberById,
  updateLeituraAlber,
  updateLeituraAlberStyleConfig,
  deleteLeituraAlber,
  createDischargeTest,
  listDischargeTestsByReport,
  getDischargeTestById,
  updateDischargeTest,
  updateDischargeTestStyleConfig,
  deleteDischargeTest,
  renameMeasurementTable,
  renameDischargeTest
};

