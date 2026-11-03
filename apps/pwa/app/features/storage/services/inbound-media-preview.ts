/**
 * P2-S S3 — inbound media preview gate.
 * Quarantined / policy-denied attachments must not receive blob: object URLs for render.
 *
 * @see specs/backend/sandboxed-storage-security-design-2026-11.md
 */

import { evaluateInboundMediaPolicy } from "./inbound-media-policy";

export type InboundMediaPreviewInput = Readonly<{
  contentAvailabilityState?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  byteLength?: number | null;
}>;

/**
 * Whether UI may create a blob:/data: preview for inbound attachment bytes.
 * Explicit export / open-externally is S4 (not this gate).
 */
export const shouldAllowInboundMediaPreview = (
  input: InboundMediaPreviewInput,
): boolean => {
  const availability = (input.contentAvailabilityState ?? "").trim().toLowerCase();
  if (availability === "quarantined" || availability === "deleted") {
    return false;
  }
  const policy = evaluateInboundMediaPolicy({
    mimeType: input.mimeType,
    fileName: input.fileName,
    byteLength: input.byteLength,
  });
  return policy.ok === true;
};

/**
 * Create a blob: object URL only when preview is allowed.
 * Caller must revoke via vault blob lifecycle / URL.revokeObjectURL.
 */
export const createInboundMediaPreviewObjectUrl = (
  blob: Blob,
  input?: Omit<InboundMediaPreviewInput, "byteLength" | "mimeType"> & Readonly<{
    mimeType?: string | null;
    fileName?: string | null;
  }>,
): string | null => {
  const mimeType = input?.mimeType ?? blob.type;
  if (!shouldAllowInboundMediaPreview({
    contentAvailabilityState: input?.contentAvailabilityState,
    mimeType,
    fileName: input?.fileName,
    byteLength: blob.size,
  })) {
    return null;
  }
  return URL.createObjectURL(blob);
};
