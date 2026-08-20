import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBucket: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: {
      getBucket: mocks.getBucket,
      from: () => ({
        createSignedUploadUrl: mocks.createSignedUploadUrl,
        createSignedUrl: mocks.createSignedUrl,
        download: mocks.download,
        remove: mocks.remove,
      }),
    },
  }),
}));

import { deliverEmail, deliverInApp } from "@/lib/wia-control/communication-providers";
import { getEvidenceStorage } from "@/lib/wia-control/evidence-storage";

const content = { subject: "You have been assigned to a shift", body: "Start: 09:00" };
const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.restoreAllMocks();
});

describe("email delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails honestly when no provider is configured, rather than reporting success", async () => {
    delete process.env.RESEND_API_KEY;
    expect(await deliverEmail("outbox-1", content, "ana@example.com")).toEqual({
      success: false,
      error: "No email provider is configured (RESEND_API_KEY is not set).",
    });
  });

  it("uses the outbox id as the provider idempotency key, so a retry cannot send twice", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.RESEND_FROM_EMAIL = "ops@wia.example";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "resend-42" }), { status: 200 }));

    const result = await deliverEmail("outbox-1", content, "ana@example.com");

    expect(result).toEqual({ success: true, providerReference: "resend-42" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("outbox-1");
    expect(JSON.parse(init.body as string)).toEqual(
      expect.objectContaining({ to: "ana@example.com", subject: content.subject, text: content.body })
    );
  });

  it("reports a provider rejection and a transport failure as failures, never as sent", async () => {
    process.env.RESEND_API_KEY = "test-key";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("quota exceeded", { status: 429 }));
    expect(await deliverEmail("outbox-1", content, "ana@example.com")).toEqual({
      success: false,
      error: expect.stringContaining("429"),
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("socket hang up"));
    expect(await deliverEmail("outbox-1", content, "ana@example.com")).toEqual({
      success: false,
      error: "socket hang up",
    });
  });

  it("treats an in-app message as delivered the moment it is queryable", async () => {
    expect(await deliverInApp()).toEqual({ success: true, providerReference: "in-app" });
  });
});

describe("evidence storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_EVIDENCE_BUCKET = "evidence-private";
    mocks.getBucket.mockResolvedValue({ data: { public: false }, error: null });
  });

  it("refuses to work at all when no bucket is configured", () => {
    delete process.env.SUPABASE_EVIDENCE_BUCKET;
    expect(() => getEvidenceStorage()).toThrow(/not configured/);
  });

  it("refuses to issue an upload link for a public bucket", async () => {
    mocks.getBucket.mockResolvedValue({ data: { public: true }, error: null });
    await expect(
      getEvidenceStorage().createUploadUrl("companies/company-1/a.jpg", {
        contentType: "image/jpeg",
        expiresInSeconds: 300,
      })
    ).rejects.toThrow(/is public/);
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses when the bucket cannot even be read", async () => {
    mocks.getBucket.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(
      getEvidenceStorage().createUploadUrl("companies/company-1/a.jpg", {
        contentType: "image/jpeg",
        expiresInSeconds: 300,
      })
    ).rejects.toThrow(/could not be read/);
  });

  it("issues signed links and reads bytes back through the private bucket", async () => {
    mocks.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://storage/upload", token: "tok" },
      error: null,
    });
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage/download" },
      error: null,
    });
    mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null });
    mocks.remove.mockResolvedValue({ error: null });
    const storage = getEvidenceStorage();

    expect(
      await storage.createUploadUrl("companies/company-1/a.jpg", {
        contentType: "image/jpeg",
        expiresInSeconds: 300,
      })
    ).toEqual({ url: "https://storage/upload", token: "tok" });
    expect(await storage.createDownloadUrl("companies/company-1/a.jpg", 120)).toBe(
      "https://storage/download"
    );
    expect(Array.from(await storage.read("companies/company-1/a.jpg"))).toEqual([1, 2, 3]);
    await expect(storage.remove(["companies/company-1/a.jpg"])).resolves.toBeUndefined();
  });

  it("surfaces a storage error instead of pretending a file was written or removed", async () => {
    mocks.createSignedUploadUrl.mockResolvedValue({ data: null, error: { message: "quota" } });
    mocks.download.mockResolvedValue({ data: null, error: { message: "missing" } });
    mocks.remove.mockResolvedValue({ error: { message: "denied" } });
    const storage = getEvidenceStorage();

    await expect(
      storage.createUploadUrl("companies/company-1/a.jpg", {
        contentType: "image/jpeg",
        expiresInSeconds: 300,
      })
    ).rejects.toThrow(/quota/);
    await expect(storage.read("companies/company-1/a.jpg")).rejects.toThrow(/missing/);
    await expect(storage.remove(["companies/company-1/a.jpg"])).rejects.toThrow(/denied/);
  });

  it("does not call the provider at all when there is nothing to remove", async () => {
    await getEvidenceStorage().remove([]);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
