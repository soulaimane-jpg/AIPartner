import "server-only";

/**
 * Google Cloud Storage seam for brief attachments.
 *
 * Every object lives under `briefs/<companyId>/<briefId>/<uuid>-<filename>`.
 * The `companyId` prefix is deliberate: it makes tenant ownership visible in
 * the object name, so a mis-scoped read is obvious in logs and a per-tenant
 * lifecycle/deletion rule is a prefix operation rather than a table scan.
 *
 * The bucket is private. Downloads are served via short-lived V4 signed URLs
 * issued only after the caller passes the same RBAC check as the brief itself —
 * we never make objects public and never store a public URL.
 *
 * Auth comes from Application Default Credentials: the Cloud Run service
 * account in production, `gcloud auth application-default login` locally.
 */

import { Storage, type Bucket } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { env } from "@/env";

/** Thrown when object storage hasn't been configured for this environment. */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "File uploads are not configured: set GCS_BUCKET to a private Cloud Storage bucket.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

let _storage: Storage | null = null;

function getBucket(): Bucket {
  if (!env.GCS_BUCKET) throw new StorageNotConfiguredError();
  _storage ??= new Storage(
    env.GCS_PROJECT_ID ? { projectId: env.GCS_PROJECT_ID } : {},
  );
  return _storage.bucket(env.GCS_BUCKET);
}

/** True when uploads can be accepted. Lets callers fail fast with a nice UI. */
export function isStorageConfigured(): boolean {
  return Boolean(env.GCS_BUCKET);
}

/**
 * Strip anything that could escape the intended prefix or confuse tooling.
 * The original filename is still kept verbatim in the database for display;
 * this only sanitises the object name.
 */
function safeObjectName(filename: string): string {
  const cleaned = filename
    .replace(/[/\\]/g, "-")
    .replace(/[^\w.\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "upload";
}

export function buildStoragePath(opts: {
  companyId: string;
  briefId: string;
  filename: string;
}): string {
  return `briefs/${opts.companyId}/${opts.briefId}/${randomUUID()}-${safeObjectName(opts.filename)}`;
}

export async function uploadBuffer(opts: {
  storagePath: string;
  buffer: Buffer;
  mimeType: string;
  /** Echoed back on download so the browser names the file correctly. */
  filename: string;
}): Promise<void> {
  const file = getBucket().file(opts.storagePath);
  await file.save(opts.buffer, {
    resumable: false,
    contentType: opts.mimeType,
    metadata: {
      contentType: opts.mimeType,
      contentDisposition: `attachment; filename="${safeObjectName(opts.filename)}"`,
      cacheControl: "private, max-age=0, no-store",
    },
  });
}

/**
 * Read an object back as a stream.
 *
 * We stream through the app rather than handing out V4 signed URLs. Signing
 * needs a credential with a `client_email`: Application Default Credentials on
 * a developer machine are a *user* credential and have none, so signed URLs
 * fail outright in local development, and in production they depend on the
 * service account keeping `iam.serviceAccountTokenCreator` on itself.
 *
 * Proxying costs a little egress on a 15 MB ceiling, and in exchange the
 * download path is identical everywhere, needs no extra IAM, and re-checks
 * authorisation on every request instead of trusting a URL that stays valid
 * after access is revoked.
 */
export function openDownloadStream(
  storagePath: string,
): NodeJS.ReadableStream {
  return getBucket().file(storagePath).createReadStream();
}

/**
 * Delete an object. Missing objects are not an error: the DB row is the source
 * of truth and we never want a stale bucket entry to block a GDPR erasure.
 */
export async function deleteObject(storagePath: string): Promise<void> {
  try {
    await getBucket().file(storagePath).delete({ ignoreNotFound: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[gcs] delete failed", storagePath, err);
  }
}
