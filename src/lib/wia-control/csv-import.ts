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
    const key = kind === "EMPLOYEES" ? row.email.toLowerCase() : kind === "WORKSITES" ? `${row.name}|${row.city}` : kind === "SERVICES" ? `${row.customer}|${row.title}` : `${row.worksite}|${row.title}|${row.scheduledStart}`;
    if (key && unique.has(key)) add("row", "Duplicate row in this file."); else unique.add(key);
  });
  const invalidRowNumbers = new Set(issues.map((issue) => issue.row));
  return { headers, rowCount: rows.length, validRows: rows.length - [...invalidRowNumbers].filter((row) => row > 1).length, invalidRows: [...invalidRowNumbers].filter((row) => row > 1).length, issues: issues.slice(0, 100) };
}
