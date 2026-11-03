/**
 * P2-S S4 — explicit export / open-externally for inbound media.
 * Preview may be denied (S3) while export is allowed only after userConsentConfirmed.
 * Never auto-opens with the OS shell.
 *
 * @see specs/backend/sandboxed-storage-security-design-2026-11.md
 */

import type { Attachment } from "@/app/features/messaging/types";
import { shouldAllowInboundMediaPreview } from "./inbound-media-preview";

export type InboundMediaExportConsentInput = Readonly<{
  contentAvailabilityState?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  byteLength?: number | null;
}>;

/**
 * Quarantined or preview-denied attachments always require an explicit confirm dialog
 * before bytes leave the sandbox (download / save-as).
 */
export const requiresInboundMediaExportConfirm = (
  input: InboundMediaExportConsentInput,
): boolean => {
  const availability = (input.contentAvailabilityState ?? "").trim().toLowerCase();
  if (availability === "quarantined") {
    return true;
  }
  return !shouldAllowInboundMediaPreview(input);
};

export type ExportInboundMediaToUserPathParams = Readonly<{
  attachment: Attachment;
  /** Must be true after AttachmentExportConfirmDialog (or equivalent) onConfirm. */
  userConsentConfirmed: boolean;
  sourceUrl?: string;
  contentAvailabilityState?: string | null;
}>;

export type ExportInboundMediaToUserPathResult =
  | Readonly<{ status: "saved" }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "consent_required" }>
  | Readonly<{ status: "failed"; reason: string }>;

/**
 * Copy inbound attachment bytes to a user-chosen path after consent.
 * Does not invoke OS “open with default app”.
 */
export const exportInboundMediaToUserPath = async (
  params: ExportInboundMediaToUserPathParams,
): Promise<ExportInboundMediaToUserPathResult> => {
  if (!params.userConsentConfirmed) {
    return { status: "consent_required" };
  }

  const { downloadAttachmentToUserPath } = await import(
    "@/app/features/vault/services/local-media-store"
  );
  const result = await downloadAttachmentToUserPath({
    attachment: params.attachment,
    sourceUrl: params.sourceUrl,
  });
  if (result === "saved") {
    return { status: "saved" };
  }
  if (result === "cancelled") {
    return { status: "cancelled" };
  }
  return { status: "failed", reason: "download_failed" };
};
