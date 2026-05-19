import type { DeliveryReasonCode } from "@dweb/core/security-foundation-contracts";
import { getRelayPublishFailureUserMessage } from "@/app/features/relays/services/relay-publish-user-copy";
import { UploadError, UploadErrorCode } from "../types";

export const inferUploadDeliveryReasonCode = (error: UploadError): DeliveryReasonCode => {
  switch (error.code) {
    case UploadErrorCode.NETWORK_ERROR:
      return /timeout|timed out/i.test(error.message) ? "upload_timeout" : "provider_unavailable";
    case UploadErrorCode.PROVIDER_ERROR:
      return "upload_provider_failed";
    case UploadErrorCode.NO_SESSION:
    case UploadErrorCode.AUTH_MISSING_KEY:
    case UploadErrorCode.AUTH_ERROR:
      return "unsupported_runtime";
    default:
      return "failed";
  }
};

/** User-facing upload failure copy (never raw provider HTTP text alone). */
export const getUploadFailureUserMessage = (
  error: UploadError,
  options?: Readonly<{ storageNote?: string }>,
): string => {
  let message: string;
  switch (error.code) {
    case UploadErrorCode.NO_SESSION:
      message = "Session expired. Lock and unlock Obscur, then try again.";
      break;
    case UploadErrorCode.AUTH_MISSING_KEY:
    case UploadErrorCode.AUTH_ERROR:
      message = "Unlock your identity to upload attachments.";
      break;
    case UploadErrorCode.FILE_TOO_LARGE:
      message = error.message.trim() || "This file is too large to upload.";
      break;
    case UploadErrorCode.MIME_ERROR:
      message = error.message.trim() || "This file type is not supported for upload.";
      break;
    case UploadErrorCode.IO_ERROR:
      message = error.message.trim() || "Could not read the file for upload.";
      break;
    default:
      message = getRelayPublishFailureUserMessage({
        reasonCode: inferUploadDeliveryReasonCode(error),
        error: error.message,
      });
  }
  const note = options?.storageNote?.trim();
  if (note && note.length > 0 && !message.includes(note)) {
    return `${message} ${note}`;
  }
  return message;
};

export const getUploadFailureUserMessageFromUnknown = (
  error: unknown,
  fallback: string,
  options?: Readonly<{ storageNote?: string }>,
): string => {
  if (error instanceof UploadError) {
    return getUploadFailureUserMessage(error, options);
  }
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  const note = options?.storageNote?.trim();
  if (note && note.length > 0 && !fallback.includes(note)) {
    return `${fallback} ${note}`;
  }
  return fallback;
};
