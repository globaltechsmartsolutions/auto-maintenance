import { z } from "zod";

export const importKindSchema = z.enum(["EMPLOYEES", "WORKSITES", "SERVICES", "SHIFTS"]);
export type ImportKind = z.infer<typeof importKindSchema>;

const requiredHeaders: Record<ImportKind, string[]> = {
  EMPLOYEES: ["firstName", "lastName", "email"],
  WORKSITES: ["name", "address", "city"],
  SERVICES: ["customer", "title", "serviceType"],
  SHIFTS: ["worksite", "title", "scheduledStart", "scheduledEnd"],
};

function parseRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delimiter = (csv.split(/\r?\n/, 1)[0]?.split(";").length ?? 0) > (csv.split(/\r?\n/, 1)[0]?.split(",").length ?? 0) ? ";" : ",";
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (!quoted && character === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += character;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

/**
 * The tenant-scoped natural key of an import row. The same key is used to
 * reject a duplicate inside a single file (preview) and to detect a row that
 * already exists in the workspace (confirmation), so a file can never be
 * accepted by one check and silently duplicated by the other.
 */
export function duplicateKey(kind: ImportKind, row: Record<string, string>) {
  const value =
    kind === "EMPLOYEES"
      ? (row.email ?? "").toLowerCase()
      : kind === "WORKSITES"
        ? `${row.name}|${row.city}`
        : kind === "SERVICES"
          ? `${row.customer}|${row.title}`
          : `${row.worksite}|${row.title}|${row.scheduledStart}`;
  return value.replace(/\|+$/, "") ? value.toLowerCase() : "";
}

export function previewCsvImport(kind: ImportKind, csv: string) {
  const rows = parseRows(csv.replace(/^\uFEFF/, ""));
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  const missingHeaders = requiredHeaders[kind].filter((header) => !headers.includes(header));
  const issues: Array<{ row: number; field: string; message: string }> = missingHeaders.map((field) => ({ row: 1, field, message: "Required header is missing." }));
  if (missingHeaders.length) return { headers, rowCount: rows.length, validRows: 0, invalidRows: rows.length, issues };
  const unique = new Set<string>();
  rows.forEach((cells, index) => {
    const row = Object.fromEntries(headers.map((header, position) => [header, cells[position]?.trim() ?? ""]));
    const add = (field: string, message: string) => issues.push({ row: index + 2, field, message });
    requiredHeaders[kind].forEach((header) => { if (!row[header]) add(header, "This value is required."); });
    if (kind === "EMPLOYEES" && row.email && !z.string().email().safeParse(row.email).success) add("email", "Use a valid email address.");
    if (kind === "SHIFTS" && row.scheduledStart && row.scheduledEnd) {
      const start = new Date(row.scheduledStart); const end = new Date(row.scheduledEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) add("scheduledEnd", "Use valid ISO times and an end after the start.");
    }
    const key = duplicateKey(kind, row);
    if (key && unique.has(key)) add("row", "Duplicate row in this file."); else unique.add(key);
  });
  const invalidRowNumbers = new Set(issues.map((issue) => issue.row));
  return { headers, rowCount: rows.length, validRows: rows.length - [...invalidRowNumbers].filter((row) => row > 1).length, invalidRows: [...invalidRowNumbers].filter((row) => row > 1).length, issues: issues.slice(0, 100) };
}

export function csvRecords(csv: string) {
  const rows = parseRows(csv.replace(/^\uFEFF/, ""));
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])));
}

/**
 * Downloadable starting point for each import. A pilot administrator gets the
 * exact headers the validator expects plus one example row, which removes the
 * most common import failure: a file whose columns were guessed.
 */
const templateExamples: Record<ImportKind, string[]> = {
  EMPLOYEES: ["Ana", "Lopez", "ana.lopez@example.com", "Cleaning operative", "floors;windows", "Madrid Centro"],
  WORKSITES: ["Main office", "1 Gran Via", "Madrid", "Europe/Madrid"],
  SERVICES: ["Acme Facilities", "Daily office cleaning", "cleaning", "WEEKLY"],
  SHIFTS: ["Main office", "Opening shift", "2026-09-01T06:00:00Z", "2026-09-01T10:00:00Z"],
};

const templateHeaders: Record<ImportKind, string[]> = {
  EMPLOYEES: [...requiredHeaders.EMPLOYEES, "position", "skills", "zones"],
  WORKSITES: [...requiredHeaders.WORKSITES, "timezone"],
  SERVICES: [...requiredHeaders.SERVICES, "recurrence"],
  SHIFTS: [...requiredHeaders.SHIFTS],
};

export function importTemplateCsv(kind: ImportKind) {
  const escape = (cell: string) => (/[",;\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return `${templateHeaders[kind].join(",")}\n${templateExamples[kind].map(escape).join(",")}\n`;
}

export function importTemplateFields(kind: ImportKind) {
  return templateHeaders[kind].map((field) => ({ field, required: requiredHeaders[kind].includes(field) }));
}
