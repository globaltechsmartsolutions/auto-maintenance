import { describe, expect, it } from "vitest";
import { previewCsvImport } from "@/lib/wia-control/csv-import";

describe("CSV import preview", () => {
  it("parses quoted cells and validates required employee fields without writing data", () => {
    const preview = previewCsvImport("EMPLOYEES", 'firstName,lastName,email\n"Ana, Maria",Lopez,ana@example.com\nJose,,invalid');
    expect(preview).toEqual(expect.objectContaining({ rowCount: 2, validRows: 1, invalidRows: 1 }));
    expect(preview.issues).toEqual(expect.arrayContaining([expect.objectContaining({ row: 3, field: "lastName" }), expect.objectContaining({ row: 3, field: "email" })]));
  });

  it("rejects invalid shift timing and duplicate rows", () => {
    const preview = previewCsvImport("SHIFTS", "worksite,title,scheduledStart,scheduledEnd\nSite A,Opening,2026-08-20T10:00:00Z,2026-08-20T09:00:00Z\nSite A,Opening,2026-08-20T10:00:00Z,2026-08-20T11:00:00Z");
    expect(preview.invalidRows).toBe(2);
    expect(preview.issues.some((issue) => issue.message === "Duplicate row in this file.")).toBe(true);
  });
});
