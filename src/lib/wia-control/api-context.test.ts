import { describe, expect, it } from "vitest";
import { requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";

describe("requestedCompanyIdFromBody", () => {
  it("returns a non-empty company id from a request body", () => {
    expect(requestedCompanyIdFromBody({ companyId: "company-a" })).toBe("company-a");
  });

  it("ignores missing, blank, and non-string company ids", () => {
    expect(requestedCompanyIdFromBody({ companyId: "   " })).toBeUndefined();
    expect(requestedCompanyIdFromBody({ companyId: 123 })).toBeUndefined();
    expect(requestedCompanyIdFromBody({})).toBeUndefined();
  });

  it("ignores non-object request bodies", () => {
    expect(requestedCompanyIdFromBody(null)).toBeUndefined();
    expect(requestedCompanyIdFromBody("company-a")).toBeUndefined();
  });
});
