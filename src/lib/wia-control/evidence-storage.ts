import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { WiaDomainError } from "@/lib/wia-control/domain-core";

/**
 * The storage boundary for evidence files.
 *
 * The rest of the application never touches a bucket directly: it asks for a
 * short-lived signed URL, hands back a key, and lets the retention job delete
 * by key. Keeping this an interface also means the upload, download, screening,
 * and purge rules can be tested without a storage provider.
 */
export type EvidenceStorage = {
  createUploadUrl(
    key: string,
    options: { contentType: string; expiresInSeconds: number }
  ): Promise<{ url: string; token?: string }>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  read(key: string): Promise<Uint8Array>;
  remove(keys: string[]): Promise<void>;
};

let verifiedPrivateBucket: string | undefined;

function evidenceBucket() {
  const bucket = process.env.SUPABASE_EVIDENCE_BUCKET;
  if (!bucket) {
    throw new WiaDomainError(
      "EVIDENCE_STORAGE_NOT_CONFIGURED",
      "Evidence storage is not configured. Set SUPABASE_EVIDENCE_BUCKET to a private bucket."
    );
  }
  return bucket;
}

/**
 * Refuses to use a public bucket, once per process. A misconfigured bucket is
 * the one mistake that would quietly turn every attachment into an
 * unauthenticated URL, so it fails the upload instead of the audit.
 */
async function assertPrivateBucket(bucket: string) {
  if (verifiedPrivateBucket === bucket) return;
  const { data, error } = await createSupabaseAdminClient().storage.getBucket(bucket);
  if (error || !data) {
    throw new WiaDomainError(
      "EVIDENCE_STORAGE_UNAVAILABLE",
      `The evidence bucket "${bucket}" could not be read: ${error?.message ?? "unknown error"}.`
    );
  }
  if (data.public) {
    throw new WiaDomainError(
      "EVIDENCE_STORAGE_PUBLIC",
      `The evidence bucket "${bucket}" is public. Evidence must be stored in a private bucket.`
    );
  }
  verifiedPrivateBucket = bucket;
}

export function getEvidenceStorage(): EvidenceStorage {
  const bucket = evidenceBucket();
  const client = () => createSupabaseAdminClient().storage.from(bucket);

  return {
    async createUploadUrl(key) {
      await assertPrivateBucket(bucket);
      const { data, error } = await client().createSignedUploadUrl(key);
      if (error || !data) {
        throw new WiaDomainError(
          "EVIDENCE_UPLOAD_URL_FAILED",
          error?.message ?? "The upload link could not be created."
        );
      }
      return { url: data.signedUrl, token: data.token };
    },
    async createDownloadUrl(key, expiresInSeconds) {
      const { data, error } = await client().createSignedUrl(key, expiresInSeconds);
      if (error || !data) {
        throw new WiaDomainError(
          "EVIDENCE_DOWNLOAD_URL_FAILED",
          error?.message ?? "The download link could not be created."
        );
      }
      return data.signedUrl;
    },
    async read(key) {
      const { data, error } = await client().download(key);
      if (error || !data) {
        throw new WiaDomainError(
          "EVIDENCE_NOT_STORED",
          error?.message ?? "The evidence file was not found in storage."
        );
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(keys) {
      if (!keys.length) return;
      const { error } = await client().remove(keys);
      if (error) {
        throw new WiaDomainError("EVIDENCE_DELETE_FAILED", error.message);
      }
    },
  };
}
