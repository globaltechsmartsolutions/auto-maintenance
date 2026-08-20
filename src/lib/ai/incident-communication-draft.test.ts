import { describe, expect, it } from "vitest";
import { __test__ } from "@/lib/ai/incident-communication-draft";

describe("incident communication AI boundary", () => {
  it("accepts only the two explicit human audiences", () => {
    expect(__test__.audienceSchema.safeParse("INTERNAL_COORDINATION").success).toBe(true);
    expect(__test__.audienceSchema.safeParse("CUSTOMER_UPDATE").success).toBe(true);
    expect(__test__.audienceSchema.safeParse("EMPLOYEE_DISCIPLINE").success).toBe(false);
  });
});
