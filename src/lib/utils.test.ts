import { describe, expect, it } from "vitest";
import { getZonedDateString, getZonedDayRange, toIsoWithTimezone } from "@/lib/utils";

describe("zoned calendar helpers", () => {
  it("uses the company's local day rather than UTC midnight", () => {
    const range = getZonedDayRange("2026-08-20", "Asia/Dubai");

    expect(range.start.toISOString()).toBe("2026-08-19T20:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-20T20:00:00.000Z");
    expect(getZonedDateString(new Date("2026-08-19T22:30:00.000Z"), "Asia/Dubai")).toBe(
      "2026-08-20"
    );
  });

  it("keeps DST calendar days accurate", () => {
    const range = getZonedDayRange("2026-03-29", "Europe/Madrid");

    expect(range.start.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(range.end.getTime() - range.start.getTime()).toBe(23 * 60 * 60 * 1_000);
  });

  it("uses the actual offset at the entered time on a DST transition day", () => {
    expect(toIsoWithTimezone("2026-03-29", "01:30", "Europe/Madrid")).toBe(
      "2026-03-29T00:30:00.000Z"
    );
    expect(toIsoWithTimezone("2026-03-29", "03:30", "Europe/Madrid")).toBe(
      "2026-03-29T01:30:00.000Z"
    );
  });
});
