/**
 * Attachment byte fetch helpers for LES chat-save.
 *
 * R5: classify lives here (no vault index writes). Remote/local byte fetch still
 * reuses the message-cache I/O in `local-media-store` until that module is split —
 * callers must not use vault catalog write APIs (`saveFileToLocalVault`, etc.).
 */

export {
  classifyAttachmentFetchUrlForVaultSave as classifyAttachmentFetchUrlForLesSave,
  fetchRemoteAttachmentBytesForVaultSave as fetchRemoteAttachmentBytesForLesSave,
} from "@/app/features/vault/services/local-media-store";
