import { randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { database } from "../../database.js";
import { ApiError } from "../../types.js";

export const playbookForms = [
  "follow-up-checklist",
  "monthly-target",
  "activity-record-plan",
  "customer-list",
  "prospect-list",
  "daily-tasks",
  "monthly-side-volume",
] as const;

export type PlaybookForm = (typeof playbookForms)[number];

const exportColumns: Record<PlaybookForm, { key: string; label: string }[]> = {
  "follow-up-checklist": [
    { key: "rowNumber", label: "No" },
    { key: "name", label: "Name" },
    { key: "memberCode", label: "ID" },
    { key: "joinDate", label: "Join Date" },
    { key: "rank", label: "Rank" },
    { key: "consumeProduct", label: "Activities - Personal - Consume Product" },
    { key: "prospectList", label: "Activities - Personal - Prospect List" },
    { key: "welcomeToEskayvie", label: "Activities - Training - Welcome to Eskayvie" },
    { key: "product", label: "Activities - Training - Product" },
    { key: "marketingPlan", label: "Activities - Training - Marketing Plan" },
    { key: "hbo", label: "Activities - Training - HBO" },
    { key: "remarks", label: "Remarks" },
    { key: "status", label: "Status" },
  ],
  "monthly-target": [
    { key: "rowNumber", label: "No" },
    { key: "targetYear", label: "Year" },
    { key: "targetMonth", label: "Month" },
    { key: "dayOfMonth", label: "Date" },
    { key: "targetIncome", label: "Pendapatan / Income" },
    { key: "targetRecruit", label: "Rekrut / Recruit" },
    { key: "targetRo", label: "RO" },
    { key: "rank", label: "Peringkat / Rank" },
    { key: "effort", label: "Usaha yang dilakukan" },
    { key: "status", label: "Status" },
  ],
  "activity-record-plan": [
    { key: "rowNumber", label: "No" },
    { key: "planYear", label: "Year" },
    { key: "planMonth", label: "Month" },
    { key: "dayOfMonth", label: "Date" },
    { key: "activity", label: "Rencana Aktivitas / Plan Activities" },
    { key: "status", label: "Status" },
  ],
  "customer-list": [
    { key: "rowNumber", label: "No." },
    { key: "name", label: "Name" },
    { key: "phoneNumber", label: "Phone Number" },
    { key: "birthDate", label: "Birth Date" },
    { key: "orderDate", label: "Order Date" },
    { key: "notes", label: "Remarks / Catatan" },
    { key: "status", label: "Status" },
  ],
  "prospect-list": [
    { key: "rowNumber", label: "No." },
    { key: "name", label: "Name" },
    { key: "phoneNumber", label: "Phone Number" },
    { key: "domicile", label: "Domicile" },
    { key: "occupation", label: "Job / Profession" },
    { key: "prospectDate", label: "Date" },
    { key: "response", label: "Response" },
    { key: "reason", label: "Remarks / Catatan" },
    { key: "followUp", label: "Follow-up" },
    { key: "followUpDate", label: "Follow-up Date" },
  ],
  "daily-tasks": [
    { key: "rowNumber", label: "No" },
    { key: "taskYear", label: "Year" },
    { key: "taskMonth", label: "Month" },
    { key: "dayOfMonth", label: "Date" },
    { key: "learn", label: "1 / Belajar" },
    { key: "videoOnboarding", label: "2 / Video onboarding" },
    { key: "consumeProduct", label: "3 / Konsumsi produk" },
    { key: "repeatOrder", label: "4 / Repeat Order" },
    { key: "attendZoom", label: "5 / Attend meeting zoom" },
    { key: "contactUpline", label: "6 / Kontak upline" },
    { key: "sponsoring", label: "7 / Sponsoring" },
  ],
  "monthly-side-volume": [
    { key: "rowNumber", label: "No" },
    { key: "productName", label: "Produk" },
  ],
};

const booleanExportFields = new Set([
  "consumeProduct", "prospectList", "welcomeToEskayvie", "product", "marketingPlan", "hbo",
  "followUp", "learn", "videoOnboarding", "repeatOrder", "attendZoom", "contactUpline", "sponsoring",
]);

function csvCell(value: unknown, key: string) {
  if (value === null || value === undefined) return "";
  const isBooleanValue = typeof value === "boolean" || value === 0 || value === 1;
  let text = booleanExportFields.has(key) && isBooleanValue
    ? value === true || value === 1 ? "Yes" : "No"
    : String(value);
  if (["joinDate", "birthDate", "orderDate", "prospectDate", "followUpDate"].includes(key)) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (dateMatch) text = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1].slice(-2)}`;
  }
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function* streamPlaybookCsv(
  form: PlaybookForm,
  userId: string,
  period?: { month?: number; year?: number },
  search = "",
): AsyncGenerator<string> {
  const db = await database;
  let columns = [...exportColumns[form]];
  if (form === "customer-list") {
    const [products] = await db.execute<Array<RowDataPacket & { code: string; name: string }>>(
      "SELECT product_code AS code, product_name AS name FROM pb_products WHERE status = 'Active' ORDER BY product_name",
    );
    columns.splice(
      4,
      0,
      ...products.map(product => ({ key: `product:${product.code}`, label: product.name })),
    );
  }

  if (form === "monthly-side-volume") {
    const targetYear = period?.year ?? new Date().getFullYear();
    if (period?.month) {
      const targetMonth = period.month;
      const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long" })
        .format(new Date(targetYear, targetMonth - 1, 1));
      columns = [
        { key: "rowNumber", label: "No" },
        { key: "productName", label: "Produk" },
        { key: "targetValue", label: `${monthLabel} ${targetYear} - Target` },
        { key: "actualValue", label: `${monthLabel} ${targetYear} - Actual` },
      ];
      yield `\uFEFF${columns.map(column => csvCell(column.label, column.key)).join(",")}\r\n`;
      let lastProductName = "";
      let lastProductCode = "";
      let rowNumber = 0;
      const batchSize = 5000;

      while (true) {
        const params: Array<string | number> = [userId, targetYear, targetMonth];
        const filters = ["pr.status = 'Active'"];
        if (search.trim()) {
          filters.push("(pr.product_name LIKE ? OR pr.product_code LIKE ?)");
          params.push(`%${search.trim()}%`, `%${search.trim()}%`);
        }
        if (lastProductName) {
          filters.push("(pr.product_name > ? OR (pr.product_name = ? AND pr.product_code > ?))");
          params.push(lastProductName, lastProductName, lastProductCode);
        }
        params.push(batchSize);
        const [rows] = await db.execute<Array<RowDataPacket & Record<string, unknown>>>(
          `SELECT pr.product_code AS productCode, pr.product_name AS productName,
            MAX(e.target_value) AS targetValue, MAX(e.actual_value) AS actualValue
           FROM pb_products pr
           LEFT JOIN pb_side_volume_months m
             ON m.user_id = ? AND m.target_year = ? AND m.target_month = ?
           LEFT JOIN pb_side_volume_entries e
             ON e.side_volume_month_id = m.id AND e.product_code = pr.product_code
           WHERE ${filters.join(" AND ")}
           GROUP BY pr.product_code, pr.product_name
           ORDER BY pr.product_name, pr.product_code LIMIT ?`,
          params,
        );
        if (!rows.length) return;
        for (const row of rows) {
          rowNumber += 1;
          yield `${columns.map(column => csvCell(
            column.key === "rowNumber" ? rowNumber : row[column.key],
            column.key,
          )).join(",")}\r\n`;
        }
        const lastRow = rows[rows.length - 1];
        lastProductName = String(lastRow.productName);
        lastProductCode = String(lastRow.productCode);
      }
    }

    const monthHeaders = Array.from({ length: 12 }, (_, index) =>
      new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2020, index, 1)),
    );
    columns = [
      { key: "rowNumber", label: "No" },
      { key: "productName", label: "Produk" },
      ...monthHeaders.flatMap((name, index) => [
        { key: `target${index + 1}`, label: `${name} ${targetYear} - Target` },
        { key: `actual${index + 1}`, label: `${name} ${targetYear} - Actual` },
      ]),
      { key: "totalTarget", label: "Total - Target" },
      { key: "totalActual", label: "Total - Actual" },
    ];
    yield `\uFEFF${columns.map(column => csvCell(column.label, column.key)).join(",")}\r\n`;
    let lastProductName = "";
    let lastProductCode = "";
    let rowNumber = 0;
    const batchSize = 5000;
    const searchValue = search.trim();
    const sums = monthHeaders.flatMap((_, index) => [
      `COALESCE(SUM(IF(m.target_month = ${index + 1}, e.target_value, 0)), 0) AS target${index + 1}`,
      `COALESCE(SUM(IF(m.target_month = ${index + 1}, e.actual_value, 0)), 0) AS actual${index + 1}`,
    ]).join(", ");

    while (true) {
      const params: Array<string | number> = [userId, targetYear];
      const filters = ["pr.status = 'Active'"];
      if (searchValue) {
        filters.push("(pr.product_name LIKE ? OR pr.product_code LIKE ?)");
        params.push(`%${searchValue}%`, `%${searchValue}%`);
      }
      if (lastProductName) {
        filters.push("(pr.product_name > ? OR (pr.product_name = ? AND pr.product_code > ?))");
        params.push(lastProductName, lastProductName, lastProductCode);
      }
      params.push(batchSize);
      const [rows] = await db.execute<Array<RowDataPacket & Record<string, unknown>>>(
        `SELECT pr.product_code AS productCode, pr.product_name AS productName, ${sums},
          COALESCE(SUM(e.target_value), 0) AS totalTarget,
          COALESCE(SUM(e.actual_value), 0) AS totalActual
         FROM pb_products pr
          LEFT JOIN pb_side_volume_months m ON m.user_id = ? AND m.target_year = ?
          LEFT JOIN pb_side_volume_entries e
            ON e.side_volume_month_id = m.id AND e.product_code = pr.product_code
         WHERE ${filters.join(" AND ")}
         GROUP BY pr.product_code, pr.product_name
         ORDER BY pr.product_name, pr.product_code LIMIT ?`,
        params,
      );
      if (!rows.length) return;
      for (const row of rows) {
        rowNumber += 1;
        yield `${columns.map(column => csvCell(
          column.key === "rowNumber" ? rowNumber : row[column.key],
          column.key,
        )).join(",")}\r\n`;
      }
      const lastRow = rows[rows.length - 1];
      lastProductName = String(lastRow.productName);
      lastProductCode = String(lastRow.productCode);
    }
    return;
  }

  yield `\uFEFF${columns.map(column => csvCell(column.label, column.key)).join(",")}\r\n`;
  const batchSize = 5000;
  const normalizedSearch = search.trim();
  let lastId = 0;
  let rowNumber = 0;

  while (true) {
    let select = "";
    let from = "";
    let userColumn = "";
    let idColumn = "";
    let searchExpression = "";
    let searchAfterGroup = false;
    const filters: string[] = [];
    const params: Array<string | number> = [userId, lastId];

    switch (form) {
      case "follow-up-checklist":
        select = `f.id, f.name, f.member_code AS memberCode,
          DATE_FORMAT(f.join_date, '%Y-%m-%d') AS joinDate, r.rank_name AS rank,
          f.consume_product AS consumeProduct, f.prospect_list AS prospectList,
          f.welcome_to_eskayvie AS welcomeToEskayvie, f.product AS product,
          f.marketing_plan AS marketingPlan, f.hbo, f.remarks, f.status`;
        from = "FROM pb_followups f LEFT JOIN pb_ranks r ON r.rank_code = f.rank_code";
        userColumn = "f.user_id";
        idColumn = "f.id";
        searchExpression = `CONCAT_WS(' ', f.name, f.member_code, f.rank_code, r.rank_name, f.status, f.remarks,
          IF(f.consume_product = 1, 'Yes true', 'No false'), IF(f.prospect_list = 1, 'Yes true', 'No false'),
          IF(f.welcome_to_eskayvie = 1, 'Yes true', 'No false'), IF(f.product = 1, 'Yes true', 'No false'),
          IF(f.marketing_plan = 1, 'Yes true', 'No false'), IF(f.hbo = 1, 'Yes true', 'No false'))`;
        break;
      case "monthly-target":
        select = `e.id, e.day_of_month AS dayOfMonth, p.target_month AS targetMonth,
          p.target_year AS targetYear, e.target_income AS targetIncome,
          e.target_recruit AS targetRecruit, e.target_ro AS targetRo,
          r.rank_name AS rank, e.effort, s.status_name AS status`;
        from = `FROM pb_monthly_target_entries e
          JOIN pb_monthly_targets p ON p.id = e.monthly_target_id
          LEFT JOIN pb_ranks r ON r.rank_code = e.rank_code
          LEFT JOIN pb_statuses s ON s.id = e.status_id`;
        userColumn = "p.user_id";
        idColumn = "e.id";
        searchExpression = "CONCAT_WS(' ', e.day_of_month, e.target_income, e.target_recruit, e.target_ro, e.rank_code, r.rank_name, e.status_id, e.effort, s.status_name)";
        if (period?.month) {
          filters.push("p.target_month = ?");
          params.push(period.month);
        }
        if (period?.year) {
          filters.push("p.target_year = ?");
          params.push(period.year);
        }
        break;
      case "activity-record-plan":
        select = `e.id, e.day_of_month AS dayOfMonth, p.plan_month AS planMonth,
          p.plan_year AS planYear, e.activity, s.status_name AS status`;
        from = `FROM pb_activity_plan_entries e
          JOIN pb_activity_plans p ON p.id = e.activity_plan_id
          LEFT JOIN pb_statuses s ON s.id = e.status_id`;
        userColumn = "p.user_id";
        idColumn = "e.id";
        searchExpression = "CONCAT_WS(' ', e.day_of_month, e.activity, e.status_id, s.status_name)";
        if (period?.month) {
          filters.push("p.plan_month = ?");
          params.push(period.month);
        }
        if (period?.year) {
          filters.push("p.plan_year = ?");
          params.push(period.year);
        }
        break;
      case "customer-list":
        select = `c.id, c.name, c.phone_number AS phoneNumber,
          DATE_FORMAT(c.birth_date, '%Y-%m-%d') AS birthDate,
          DATE_FORMAT(c.order_date, '%Y-%m-%d') AS orderDate, c.notes, c.status,
          GROUP_CONCAT(DISTINCT cp.product_code ORDER BY cp.product_code SEPARATOR ',') AS productCodes`;
        from = `FROM pb_customers c
          LEFT JOIN pb_customer_products cp ON cp.customer_id = c.id
          LEFT JOIN pb_products pr ON pr.product_code = cp.product_code`;
        userColumn = "c.user_id";
        idColumn = "c.id";
        searchExpression = `CONCAT_WS(' ', c.name, c.phone_number, c.notes, c.status,
          GROUP_CONCAT(DISTINCT pr.product_name ORDER BY pr.product_name SEPARATOR ', '),
          GROUP_CONCAT(cp.product_code ORDER BY cp.product_code SEPARATOR ' '))`;
        searchAfterGroup = true;
        break;
      case "prospect-list":
        select = `p.id, p.name, p.phone_number AS phoneNumber, p.domicile, p.occupation,
          DATE_FORMAT(p.prospect_date, '%Y-%m-%d') AS prospectDate, p.response, p.reason,
          p.follow_up AS followUp, DATE_FORMAT(p.follow_up_date, '%Y-%m-%d') AS followUpDate`;
        from = "FROM pb_prospects p";
        userColumn = "p.user_id";
        idColumn = "p.id";
        searchExpression = "CONCAT_WS(' ', p.name, p.phone_number, p.domicile, p.occupation, p.response, p.reason, IF(p.follow_up = 1, 'Yes true', 'No false'))";
        break;
      case "daily-tasks":
        select = `e.id, e.day_of_month AS dayOfMonth, m.task_month AS taskMonth,
          m.task_year AS taskYear, e.learn, e.video_onboarding AS videoOnboarding,
          e.consume_product AS consumeProduct, e.repeat_order AS repeatOrder,
          e.attend_zoom AS attendZoom, e.contact_upline AS contactUpline, e.sponsoring`;
        from = `FROM pb_daily_task_entries e
          JOIN pb_daily_task_months m ON m.id = e.month_record_id`;
        userColumn = "m.user_id";
        idColumn = "e.id";
        searchExpression = `CONCAT_WS(' ', e.day_of_month, m.task_month, m.task_year,
          IF(e.learn = 1, 'Yes true', 'No false'), IF(e.video_onboarding = 1, 'Yes true', 'No false'),
          IF(e.consume_product = 1, 'Yes true', 'No false'), IF(e.repeat_order = 1, 'Yes true', 'No false'),
          IF(e.attend_zoom = 1, 'Yes true', 'No false'), IF(e.contact_upline = 1, 'Yes true', 'No false'),
          IF(e.sponsoring = 1, 'Yes true', 'No false'))`;
        if (period?.month) {
          filters.push("m.task_month = ?");
          params.push(period.month);
        }
        if (period?.year) {
          filters.push("m.task_year = ?");
          params.push(period.year);
        }
        break;
    }

    const where = [`${userColumn} = ?`, `${idColumn} > ?`, ...filters];
    if (normalizedSearch && !searchAfterGroup) {
      where.push(`${searchExpression} LIKE ?`);
      params.push(`%${normalizedSearch}%`);
    }
    params.push(batchSize);
    const groupBy = form === "customer-list" ? " GROUP BY c.id" : "";
    const having = normalizedSearch && searchAfterGroup ? " HAVING " + searchExpression + " LIKE ?" : "";
    if (having) params.splice(params.length - 1, 0, `%${normalizedSearch}%`);
    const [rows] = await db.execute<Array<RowDataPacket & Record<string, unknown>>>(
      `SELECT ${select} ${from} WHERE ${where.join(" AND ")}${groupBy}${having}
       ORDER BY ${idColumn} ASC LIMIT ?`,
      params,
    );
    if (!rows.length) return;

    for (const row of rows) {
      rowNumber += 1;
      const productCodes = new Set(String(row.productCodes ?? "").split(",").filter(Boolean));
      yield `${columns.map(column => {
        let value = column.key === "rowNumber"
          ? rowNumber
          : column.key.startsWith("product:")
            ? productCodes.has(column.key.slice("product:".length)) ? "Yes" : "No"
            : row[column.key];
        if (form === "daily-tasks" && column.key === "dayOfMonth" && value !== undefined) {
          value = String(value).padStart(2, "0");
        }
        return csvCell(value, column.key.startsWith("product:") ? "productSelection" : column.key);
      }).join(",")}\r\n`;
    }
    lastId = Number(rows[rows.length - 1].id);
  }
}

const optionalText = z.string().trim().max(5000).nullable().optional();
const optionalDate = z.string().date().nullable().optional();
const month = z.coerce.number().int().min(1).max(12);
const year = z.coerce.number().int().min(2000).max(2200);
const day = z.coerce.number().int().min(1).max(31);
const optionalInteger = z.coerce.number().int().min(0).max(1_000_000_000_000).nullable().optional();
const optionalCount = z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional();
const recordStatus = z.enum(["Active", "Inactive"]).default("Active");

const schemas = {
  "follow-up-checklist": z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    memberCode: z.string().trim().max(20).optional().transform(value => value || undefined),
    rankCode: z.string().trim().max(10).nullable().optional(),
    joinDate: optionalDate,
    status: recordStatus,
    consumeProduct: z.boolean().default(false),
    productName: z.string().trim().max(100).nullable().optional(),
    consumeDate: optionalDate,
    prospectList: z.boolean().default(false),
    welcomeToEskayvie: z.boolean().default(false),
    product: z.boolean().default(false),
    marketingPlan: z.boolean().default(false),
    hbo: z.boolean().default(false),
    remarks: z.string().trim().max(255).nullable().optional(),
  }),
  "monthly-target": z.object({
    targetMonth: month,
    targetYear: year,
    dayOfMonth: day,
    targetIncome: optionalInteger,
    targetRecruit: optionalCount,
    targetRo: optionalCount,
    rankCode: z.string().trim().max(10).nullable().optional(),
    effort: optionalText,
    statusId: z.coerce.number().int().positive().nullable().optional(),
  }),
  "activity-record-plan": z.object({
    planMonth: month,
    planYear: year,
    dayOfMonth: day,
    activity: optionalText,
    statusId: z.coerce.number().int().positive().nullable().optional(),
  }),
  "customer-list": z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    phoneNumber: z.string().trim().max(40).nullable().optional(),
    birthDate: optionalDate,
    orderDate: optionalDate,
    notes: optionalText,
    productCodes: z.array(z.string().trim().min(1).max(20)).max(50).default([]),
    status: recordStatus,
  }),
  "prospect-list": z.object({
    id: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).max(120),
    phoneNumber: z.string().trim().max(40).nullable().optional(),
    domicile: z.string().trim().max(120).nullable().optional(),
    occupation: z.string().trim().max(120).nullable().optional(),
    prospectDate: optionalDate,
    response: z.enum(["Baik", "Kurang Baik", "Tidak Baik"]).nullable().optional(),
    reason: optionalText,
    followUp: z.boolean().default(false),
    followUpDate: optionalDate,
  }),
  "daily-tasks": z.object({
    taskMonth: month,
    taskYear: year,
    dayOfMonth: day,
    learn: z.boolean().default(false),
    videoOnboarding: z.boolean().default(false),
    consumeProduct: z.boolean().default(false),
    repeatOrder: z.boolean().default(false),
    attendZoom: z.boolean().default(false),
    contactUpline: z.boolean().default(false),
    sponsoring: z.boolean().default(false),
  }),
  "monthly-side-volume": z.object({
    targetMonth: month,
    targetYear: year,
    productCode: z.string().trim().min(1).max(20),
    targetValue: optionalInteger,
    actualValue: optionalInteger,
  }),
} satisfies Record<PlaybookForm, z.ZodType>;

type CatalogRow = RowDataPacket & Record<string, unknown>;

function parseInput<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, "Playbook form validation failed.");
  return result.data;
}

async function getOrCreatePeriod(
  table: "pb_monthly_targets" | "pb_activity_plans" | "pb_daily_task_months" | "pb_side_volume_months",
  userId: string,
  monthColumn: "target_month" | "plan_month" | "task_month",
  monthValue: number,
  yearColumn: "target_year" | "plan_year" | "task_year",
  yearValue: number,
) {
  const db = await database;
  const [result] = await db.execute(
    `INSERT INTO ${table} (user_id, ${monthColumn}, ${yearColumn})
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [userId, monthValue, yearValue],
  );
  return Number(Reflect.get(result, "insertId"));
}

async function assertOwnedRecord(
  table: "pb_followups" | "pb_customers" | "pb_prospects",
  id: number,
  userId: string,
) {
  const db = await database;
  const [rows] = await db.execute<Array<RowDataPacket & { id: number }>>(
    `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
  if (!rows.length) throw new ApiError(404, "Playbook record was not found.");
}

async function assertCatalogValues(
  table: "pb_products" | "pb_ranks" | "pb_statuses",
  column: "product_code" | "rank_code" | "id",
  values: Array<string | number | null | undefined>,
) {
  const expected = values.filter((value): value is string | number => value !== null && value !== undefined);
  if (!expected.length) return;
  const db = await database;
  const placeholders = expected.map(() => "?").join(", ");
  const [rows] = await db.execute<Array<RowDataPacket & { value: string | number }>>(
    `SELECT ${column} AS value FROM ${table} WHERE ${column} IN (${placeholders})${table === "pb_products" ? " AND status = 'Active'" : ""}`,
    expected,
  );
  if (rows.length !== expected.length) {
    throw new ApiError(400, "One or more selected Playbook options are invalid.");
  }
}

export async function getPlaybookCatalogs() {
  const db = await database;
  const [[products], [ranks], [statuses]] = await Promise.all([
    db.execute<CatalogRow[]>(
      "SELECT product_code AS code, product_name AS name, product_price AS price FROM pb_products WHERE status = 'Active' ORDER BY product_name",
    ),
    db.execute<CatalogRow[]>(
      "SELECT rank_code AS code, rank_name AS name FROM pb_ranks ORDER BY sort_order",
    ),
    db.execute<CatalogRow[]>(
      "SELECT id, status_name AS name FROM pb_statuses ORDER BY sort_order",
    ),
  ]);
  return { products, ranks, statuses };
}

export async function listPlaybookRecords(
  form: PlaybookForm,
  userId: string,
  period?: { month?: number; year?: number },
) {
  const db = await database;
  switch (form) {
    case "follow-up-checklist": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; name: string; member_code: string; rank_code: string | null;
        rank_name: string | null; join_date: string | null; status: "Active" | "Inactive";
        consume_product: number; product_name: string | null; consume_date: string | null;
        prospect_list: number; welcome_to_eskayvie: number; product: number;
        marketing_plan: number; hbo: number; remarks: string | null;
      }>>(
        `SELECT f.id, f.name, f.member_code, f.rank_code, r.rank_name,
         DATE_FORMAT(f.join_date, '%Y-%m-%d') AS join_date, f.status,
         f.consume_product, f.product_name, DATE_FORMAT(f.consume_date, '%Y-%m-%d') AS consume_date,
         prospect_list, welcome_to_eskayvie, product, marketing_plan, hbo, remarks
         FROM pb_followups f LEFT JOIN pb_ranks r ON r.rank_code = f.rank_code
         WHERE f.user_id = ? ORDER BY f.name, f.member_code`,
        [userId],
      );
      return rows.map(row => ({
        id: row.id, name: row.name, memberCode: row.member_code, rankCode: row.rank_code,
        rankName: row.rank_name, joinDate: row.join_date, status: row.status,
        consumeProduct: Boolean(row.consume_product),
        productName: row.product_name, consumeDate: row.consume_date,
        prospectList: Boolean(row.prospect_list), welcomeToEskayvie: Boolean(row.welcome_to_eskayvie),
        product: Boolean(row.product), marketingPlan: Boolean(row.marketing_plan),
        hbo: Boolean(row.hbo), remarks: row.remarks,
      }));
    }
    case "monthly-target": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; target_month: number; target_year: number; day_of_month: number;
        target_income: string | null; target_recruit: number | null; target_ro: number | null;
        rank_code: string | null; effort: string | null; status_id: number | null;
      }>>(
        `SELECT e.id, p.target_month, p.target_year, e.day_of_month, e.target_income,
          e.target_recruit, e.target_ro, e.rank_code, e.effort, e.status_id
         FROM pb_monthly_target_entries e JOIN pb_monthly_targets p ON p.id = e.monthly_target_id
         WHERE p.user_id = ?${period?.month ? " AND p.target_month = ?" : ""}${period?.year ? " AND p.target_year = ?" : ""}
         ORDER BY p.target_year DESC, p.target_month DESC, e.day_of_month`,
        [userId, ...(period?.month ? [period.month] : []), ...(period?.year ? [period.year] : [])],
      );
      return rows.map(row => ({
        id: row.id, targetMonth: row.target_month, targetYear: row.target_year,
        dayOfMonth: row.day_of_month, targetIncome: row.target_income,
        targetRecruit: row.target_recruit, targetRo: row.target_ro, rankCode: row.rank_code,
        effort: row.effort, statusId: row.status_id,
      }));
    }
    case "activity-record-plan": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; plan_month: number; plan_year: number; day_of_month: number;
        activity: string | null; status_id: number | null;
      }>>(
        `SELECT e.id, p.plan_month, p.plan_year, e.day_of_month, e.activity, e.status_id
         FROM pb_activity_plan_entries e JOIN pb_activity_plans p ON p.id = e.activity_plan_id
         WHERE p.user_id = ?${period?.month ? " AND p.plan_month = ?" : ""}${period?.year ? " AND p.plan_year = ?" : ""}
         ORDER BY p.plan_year DESC, p.plan_month DESC, e.day_of_month`,
        [userId, ...(period?.month ? [period.month] : []), ...(period?.year ? [period.year] : [])],
      );
      return rows.map(row => ({
        id: row.id, planMonth: row.plan_month, planYear: row.plan_year,
        dayOfMonth: row.day_of_month, activity: row.activity, statusId: row.status_id,
      }));
    }
    case "customer-list": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; name: string; phone_number: string | null; birth_date: string | null;
        order_date: string | null; notes: string | null; product_codes: string | null;
        status: "Active" | "Inactive";
      }>>(
        `SELECT c.id, c.name, c.phone_number, DATE_FORMAT(c.birth_date, '%Y-%m-%d') AS birth_date,
          DATE_FORMAT(c.order_date, '%Y-%m-%d') AS order_date, c.notes, c.status,
          GROUP_CONCAT(cp.product_code ORDER BY cp.product_code) AS product_codes
         FROM pb_customers c LEFT JOIN pb_customer_products cp ON cp.customer_id = c.id
         WHERE c.user_id = ? GROUP BY c.id ORDER BY c.name`,
        [userId],
      );
      return rows.map(row => ({
        id: row.id, name: row.name, phoneNumber: row.phone_number,
        birthDate: row.birth_date, orderDate: row.order_date, notes: row.notes,
        productCodes: row.product_codes?.split(",") ?? [], status: row.status,
      }));
    }
    case "prospect-list": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; name: string; phone_number: string | null; domicile: string | null;
        occupation: string | null; prospect_date: string | null; response: string | null;
        reason: string | null; follow_up: number; follow_up_date: string | null;
      }>>(
        `SELECT id, name, phone_number, domicile, occupation,
          DATE_FORMAT(prospect_date, '%Y-%m-%d') AS prospect_date, response, reason,
          follow_up, DATE_FORMAT(follow_up_date, '%Y-%m-%d') AS follow_up_date
         FROM pb_prospects WHERE user_id = ? ORDER BY id DESC`,
        [userId],
      );
      return rows.map(row => ({
        id: row.id, name: row.name, phoneNumber: row.phone_number, domicile: row.domicile,
        occupation: row.occupation, prospectDate: row.prospect_date, response: row.response,
        reason: row.reason, followUp: Boolean(row.follow_up), followUpDate: row.follow_up_date,
      }));
    }
    case "daily-tasks": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; task_month: number; task_year: number; day_of_month: number;
        learn: number; video_onboarding: number; consume_product: number; repeat_order: number;
        attend_zoom: number; contact_upline: number; sponsoring: number;
      }>>(
        `SELECT e.id, m.task_month, m.task_year, e.day_of_month, e.learn, e.video_onboarding,
          e.consume_product, e.repeat_order, e.attend_zoom, e.contact_upline, e.sponsoring
         FROM pb_daily_task_entries e JOIN pb_daily_task_months m ON m.id = e.month_record_id
         WHERE m.user_id = ?${period?.month ? " AND m.task_month = ?" : ""}${period?.year ? " AND m.task_year = ?" : ""}
         ORDER BY m.task_year DESC, m.task_month DESC, e.day_of_month`,
        [userId, ...(period?.month ? [period.month] : []), ...(period?.year ? [period.year] : [])],
      );
      return rows.map(row => ({
        id: row.id, taskMonth: row.task_month, taskYear: row.task_year,
        dayOfMonth: row.day_of_month, learn: Boolean(row.learn),
        videoOnboarding: Boolean(row.video_onboarding), consumeProduct: Boolean(row.consume_product),
        repeatOrder: Boolean(row.repeat_order), attendZoom: Boolean(row.attend_zoom),
        contactUpline: Boolean(row.contact_upline), sponsoring: Boolean(row.sponsoring),
      }));
    }
    case "monthly-side-volume": {
      const [rows] = await db.execute<Array<RowDataPacket & {
        id: number; target_month: number; target_year: number; product_code: string;
        product_name: string; target_value: string | null; actual_value: string | null;
      }>>(
        `SELECT e.id, m.target_month, m.target_year, e.product_code, p.product_name,
          e.target_value, e.actual_value
         FROM pb_side_volume_entries e JOIN pb_side_volume_months m ON m.id = e.side_volume_month_id
         JOIN pb_products p ON p.product_code = e.product_code
         WHERE m.user_id = ?${period?.month ? " AND m.target_month = ?" : ""}${period?.year ? " AND m.target_year = ?" : ""}
         ORDER BY m.target_year DESC, m.target_month DESC, p.product_name`,
        [userId, ...(period?.month ? [period.month] : []), ...(period?.year ? [period.year] : [])],
      );
      return rows.map(row => ({
        id: row.id, targetMonth: row.target_month, targetYear: row.target_year,
        productCode: row.product_code, productName: row.product_name,
        targetValue: row.target_value, actualValue: row.actual_value,
      }));
    }
  }
}

export async function savePlaybookRecord(form: PlaybookForm, userId: string, value: unknown) {
  const db = await database;
  switch (form) {
    case "follow-up-checklist": {
      const input = parseInput(schemas["follow-up-checklist"], value);
      const {
        id, name, rankCode, joinDate, status, consumeProduct, productName, consumeDate,
        prospectList, welcomeToEskayvie, product, marketingPlan, hbo, remarks,
      } = input;
      await assertCatalogValues("pb_ranks", "rank_code", [rankCode]);
      let memberCode = input.memberCode;
      if (!memberCode) {
        const current = new Date();
        const prefix = `ESK${String(current.getFullYear()).slice(-2)}${String(current.getMonth() + 1).padStart(2, "0")}`;
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = `${prefix}${String(randomInt(1, 1_000_000)).padStart(6, "0")}`;
          const [matches] = await db.execute<Array<RowDataPacket>>(
            `SELECT 1 FROM pb_followups
             WHERE user_id = ? AND member_code = ?${id ? " AND id <> ?" : ""} LIMIT 1`,
            id ? [userId, candidate, id] : [userId, candidate],
          );
          if (!matches.length) {
            memberCode = candidate;
            break;
          }
        }
        if (!memberCode) throw new ApiError(503, "Could not generate a unique Member Code. Please retry.");
      }
      if (!memberCode) throw new ApiError(400, "Member Code is required when editing this record.");
      if (id) {
        await assertOwnedRecord("pb_followups", id, userId);
        await db.execute(
          `UPDATE pb_followups SET name = ?, member_code = ?, rank_code = ?, join_date = ?, status = ?,
           consume_product = ?, product_name = ?, consume_date = ?, prospect_list = ?,
           welcome_to_eskayvie = ?, product = ?, marketing_plan = ?, hbo = ?, remarks = ?
           WHERE id = ? AND user_id = ?`,
          [name, memberCode, rankCode ?? null, joinDate ?? null, status, consumeProduct,
            productName ?? null, consumeDate ?? null, prospectList, welcomeToEskayvie,
            product, marketingPlan, hbo, remarks ?? null, id, userId],
        );
        return { id, ...input, memberCode };
      }
      const [result] = await db.execute(
        `INSERT INTO pb_followups (user_id, name, member_code, rank_code, join_date, status,
         consume_product, product_name, consume_date, prospect_list, welcome_to_eskayvie,
         product, marketing_plan, hbo, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, memberCode, rankCode ?? null, joinDate ?? null, status, consumeProduct,
          productName ?? null, consumeDate ?? null, prospectList, welcomeToEskayvie,
          product, marketingPlan, hbo, remarks ?? null],
      );
      return { id: Number(Reflect.get(result, "insertId")), ...input, memberCode };
    }
    case "monthly-target": {
      const input = parseInput(schemas["monthly-target"], value);
      await assertCatalogValues("pb_ranks", "rank_code", [input.rankCode]);
      await assertCatalogValues("pb_statuses", "id", [input.statusId]);
      const parentId = await getOrCreatePeriod("pb_monthly_targets", userId, "target_month", input.targetMonth, "target_year", input.targetYear);
      const [result] = await db.execute(
        `INSERT INTO pb_monthly_target_entries
         (monthly_target_id, day_of_month, target_income, target_recruit, target_ro, rank_code, effort, status_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), target_income = VALUES(target_income),
         target_recruit = VALUES(target_recruit), target_ro = VALUES(target_ro), rank_code = VALUES(rank_code),
         effort = VALUES(effort), status_id = VALUES(status_id)`,
        [parentId, input.dayOfMonth, input.targetIncome ?? null, input.targetRecruit ?? null,
          input.targetRo ?? null, input.rankCode ?? null, input.effort ?? null, input.statusId ?? null],
      );
      return { id: Number(Reflect.get(result, "insertId")), ...input };
    }
    case "activity-record-plan": {
      const input = parseInput(schemas["activity-record-plan"], value);
      await assertCatalogValues("pb_statuses", "id", [input.statusId]);
      const parentId = await getOrCreatePeriod("pb_activity_plans", userId, "plan_month", input.planMonth, "plan_year", input.planYear);
      const [result] = await db.execute(
        `INSERT INTO pb_activity_plan_entries (activity_plan_id, day_of_month, activity, status_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), activity = VALUES(activity), status_id = VALUES(status_id)`,
        [parentId, input.dayOfMonth, input.activity ?? null, input.statusId ?? null],
      );
      return { id: Number(Reflect.get(result, "insertId")), ...input };
    }
    case "customer-list": {
      const input = parseInput(schemas["customer-list"], value);
      await assertCatalogValues("pb_products", "product_code", input.productCodes);
      const { id, name, phoneNumber, birthDate, orderDate, notes, productCodes, status } = input;
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        let customerId = id;
        if (customerId) {
          await assertOwnedRecord("pb_customers", customerId, userId);
          await connection.execute(
            `UPDATE pb_customers SET name = ?, phone_number = ?, birth_date = ?, order_date = ?, notes = ?, status = ?
             WHERE id = ? AND user_id = ?`,
            [name, phoneNumber ?? null, birthDate ?? null, orderDate ?? null, notes ?? null, status, customerId, userId],
          );
          await connection.execute("DELETE FROM pb_customer_products WHERE customer_id = ?", [customerId]);
        } else {
          const [result] = await connection.execute(
            `INSERT INTO pb_customers (user_id, name, phone_number, birth_date, order_date, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, phoneNumber ?? null, birthDate ?? null, orderDate ?? null, notes ?? null, status],
          );
          customerId = Number(Reflect.get(result, "insertId"));
        }
        for (const productCode of productCodes) {
          await connection.execute(
            "INSERT INTO pb_customer_products (customer_id, product_code) VALUES (?, ?)",
            [customerId, productCode],
          );
        }
        await connection.commit();
        return { id: customerId, ...input };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
    case "prospect-list": {
      const input = parseInput(schemas["prospect-list"], value);
      const { id, name, phoneNumber, domicile, occupation, prospectDate, response, reason, followUp, followUpDate } = input;
      if (id) {
        await assertOwnedRecord("pb_prospects", id, userId);
        await db.execute(
          `UPDATE pb_prospects SET name = ?, phone_number = ?, domicile = ?, occupation = ?, prospect_date = ?,
           response = ?, reason = ?, follow_up = ?, follow_up_date = ? WHERE id = ? AND user_id = ?`,
          [name, phoneNumber ?? null, domicile ?? null, occupation ?? null, prospectDate ?? null,
            response ?? null, reason ?? null, followUp, followUpDate ?? null, id, userId],
        );
        return { id, ...input };
      }
      const [result] = await db.execute(
        `INSERT INTO pb_prospects (user_id, name, phone_number, domicile, occupation, prospect_date,
         response, reason, follow_up, follow_up_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, phoneNumber ?? null, domicile ?? null, occupation ?? null, prospectDate ?? null,
          response ?? null, reason ?? null, followUp, followUpDate ?? null],
      );
      return { id: Number(Reflect.get(result, "insertId")), ...input };
    }
    case "daily-tasks": {
      const input = parseInput(schemas["daily-tasks"], value);
      const parentId = await getOrCreatePeriod("pb_daily_task_months", userId, "task_month", input.taskMonth, "task_year", input.taskYear);
      const [result] = await db.execute(
        `INSERT INTO pb_daily_task_entries
         (month_record_id, day_of_month, learn, video_onboarding, consume_product, repeat_order,
          attend_zoom, contact_upline, sponsoring) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), learn = VALUES(learn),
         video_onboarding = VALUES(video_onboarding), consume_product = VALUES(consume_product),
         repeat_order = VALUES(repeat_order), attend_zoom = VALUES(attend_zoom),
         contact_upline = VALUES(contact_upline), sponsoring = VALUES(sponsoring)`,
        [parentId, input.dayOfMonth, input.learn, input.videoOnboarding, input.consumeProduct,
          input.repeatOrder, input.attendZoom, input.contactUpline, input.sponsoring],
      );
      return { id: Number(Reflect.get(result, "insertId")), ...input };
    }
    case "monthly-side-volume": {
      const input = parseInput(schemas["monthly-side-volume"], value);
      await assertCatalogValues("pb_products", "product_code", [input.productCode]);
      const parentId = await getOrCreatePeriod("pb_side_volume_months", userId, "target_month", input.targetMonth, "target_year", input.targetYear);
      const [result] = await db.execute(
        `INSERT INTO pb_side_volume_entries (side_volume_month_id, product_code, target_value, actual_value)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), target_value = VALUES(target_value),
         actual_value = VALUES(actual_value)`,
        [parentId, input.productCode, input.targetValue ?? null, input.actualValue ?? null],
      );
      return { id: Number(Reflect.get(result, "insertId")), ...input };
    }
  }
}

export async function deletePlaybookRecord(form: PlaybookForm, userId: string, id: number) {
  const db = await database;
  const statements: Record<PlaybookForm, { sql: string; params: (string | number)[] }> = {
    "follow-up-checklist": {
      sql: "DELETE FROM pb_followups WHERE id = ? AND user_id = ?",
      params: [id, userId],
    },
    "monthly-target": {
      sql: `DELETE e FROM pb_monthly_target_entries e
        JOIN pb_monthly_targets p ON p.id = e.monthly_target_id
        WHERE e.id = ? AND p.user_id = ?`,
      params: [id, userId],
    },
    "activity-record-plan": {
      sql: `DELETE e FROM pb_activity_plan_entries e
        JOIN pb_activity_plans p ON p.id = e.activity_plan_id
        WHERE e.id = ? AND p.user_id = ?`,
      params: [id, userId],
    },
    "customer-list": {
      sql: "DELETE FROM pb_customers WHERE id = ? AND user_id = ?",
      params: [id, userId],
    },
    "prospect-list": {
      sql: "DELETE FROM pb_prospects WHERE id = ? AND user_id = ?",
      params: [id, userId],
    },
    "daily-tasks": {
      sql: `DELETE e FROM pb_daily_task_entries e
        JOIN pb_daily_task_months m ON m.id = e.month_record_id
        WHERE e.id = ? AND m.user_id = ?`,
      params: [id, userId],
    },
    "monthly-side-volume": {
      sql: `DELETE e FROM pb_side_volume_entries e
        JOIN pb_side_volume_months m ON m.id = e.side_volume_month_id
        WHERE e.id = ? AND m.user_id = ?`,
      params: [id, userId],
    },
  };
  const statement = statements[form];
  const [result] = await db.execute(statement.sql, statement.params);
  if (Number(Reflect.get(result, "affectedRows")) === 0) {
    throw new ApiError(404, "Playbook record was not found.");
  }
  return { deleted: true };
}
