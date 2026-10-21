"use client";

import { toast } from "@dweb/ui-kit/toast";
import type { Attachment } from "@/app/features/messaging/types";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";
import { normalizeAttachmentUrl } from "@/app/shared/public-url";
import {
  classifyAttachmentFetchUrlForLesSave,
  fetchRemoteAttachmentBytesForLesSave,
} from "./les-attachment-fetch";
import { lesKindFromFile } from "./les-kind-from-file";
import {
  commitLesObjectWithProof,
  isLesNativeAvailable,
  listLesObjects,
  type LesCommitReceipt,
} from "./les-native-sdk";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export const LES_CATALOG_CHANGED_EVENT = "obscur:les-catalog-changed";

export const emitLesCatalogChanged = (profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(LES_CATALOG_CHANGED_EVENT, {
      detail: { profileId: profileId ?? resolveVaultProfileId() },
    }),
  );
};

export type LesChatSaveOutcome =
  | Readonly<{ status: "saved"; receipt: LesCommitReceipt }>
  | Readonly<{ status: "unlock_required" }>
  | Readonly<{ status: "failed"; reason: string }>;

/** Chat → LES is available on native whenever the Rust LES surface exists. */
export const canSaveChatAttachmentsToLes = (): boolean =>
  isLesNativeAvailable() && hasNativeRuntime();

const isReadableLocalPreviewUrl = (url: string): boolean => {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("blob:")
    || trimmed.startsWith("asset:")
    || trimmed.startsWith("file:")
    || trimmed.includes("asset.localhost")
    || trimmed.includes("ipc.localhost")
  );
};

const fetchPreviewBytes = async (url: string): Promise<Uint8Array | null> => {
  if (!isReadableLocalPreviewUrl(url)) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
};

const resolveAttachmentBytes = async (attachment: Attachment): Promise<Uint8Array | null> => {
  const url = attachment.url.trim();
  if (!url) {
    return null;
  }
  const previewBytes = await fetchPreviewBytes(url);
  if (previewBytes) {
    return previewBytes;
  }
  return fetchRemoteAttachmentBytesForLesSave(url, attachment.contentType);
};

const ensureLesEncryptionReady = async (): Promise<"ready" | "unlock_required"> => {
  const { ensureNativeVaultEncryptionSessionForWrites } = await import(
    "@/app/features/storage/services/native-storage-at-rest-service"
  );
  const ready = await ensureNativeVaultEncryptionSessionForWrites({
    profileId: resolveVaultProfileId(),
  });
  return ready ? "ready" : "unlock_required";
};

export const isChatAttachmentSavedToLes = async (remoteUrl: string): Promise<boolean> => {
  if (!canSaveChatAttachmentsToLes()) {
    return false;
  }
  const normalized = normalizeAttachmentUrl(remoteUrl) || remoteUrl.trim();
  if (!normalized) {
    return false;
  }
  const profileId = resolveVaultProfileId().trim() || undefined;
  const rows = await listLesObjects(profileId);
  return rows.some((row) => {
    const source = (row.sourceAttachmentUrl ?? "").trim();
    return source === normalized || source === remoteUrl.trim();
  });
};

/** One catalog scan for batch Save-to-Vault already-checks. */
export const loadLesSavedAttachmentUrlSet = async (): Promise<Set<string>> => {
  if (!canSaveChatAttachmentsToLes()) {
    return new Set();
  }
  const profileId = resolveVaultProfileId().trim() || undefined;
  const rows = await listLesObjects(profileId);
  return new Set(
    rows
      .map((row) => (row.sourceAttachmentUrl ?? "").trim())
      .filter((url) => url.length > 0),
  );
};

export type LesChatSaveOptions = Readonly<{
  toastPolicy?: "all" | "errors-only";
  suppressUnlockToast?: boolean;
  /** When true, caller owns `emitLesCatalogChanged` (batch saves). */
  suppressCatalogEmit?: boolean;
  /** Preloaded source URLs already in LES — skips per-item `listLesObjects`. */
  knownSavedUrls?: ReadonlySet<string>;
}>;

/**
 * Chat Save → same Rust `commit_object` as Secure Upload.
 * Toast only after catalog proof (`commitLesObjectWithProof`).
 */
export const saveChatAttachmentToLesWithOutcome = async (
  attachment: Attachment,
  t: TranslateFn,
  options?: LesChatSaveOptions,
): Promise<LesChatSaveOutcome> => {
  const showSuccessToast = options?.toastPolicy !== "errors-only";

  if (!canSaveChatAttachmentsToLes()) {
    toast.error(t("vault.saveFromChatUnavailable"));
    return { status: "failed", reason: "unavailable" };
  }

  const encryption = await ensureLesEncryptionReady();
  if (encryption === "unlock_required") {
    if (!options?.suppressUnlockToast) {
      toast.error(t("vault.localSaveUnlockRequired"));
    }
    return { status: "unlock_required" };
  }

  const urlClass = classifyAttachmentFetchUrlForLesSave(attachment.url);
  if (urlClass === "blocked_host") {
    toast.error(t("vault.saveFromChatBlockedHost"));
    return { status: "failed", reason: "blocked_host" };
  }

  const normalizedUrl = normalizeAttachmentUrl(attachment.url) || attachment.url.trim();
  const already = options?.knownSavedUrls
    ? options.knownSavedUrls.has(normalizedUrl) || options.knownSavedUrls.has(attachment.url.trim())
    : await isChatAttachmentSavedToLes(attachment.url);
  if (already) {
    if (showSuccessToast) {
      toast.info(t("vault.alreadyInVault"));
    }
    return { status: "failed", reason: "already_saved" };
  }

  const bytes = await resolveAttachmentBytes(attachment);
  if (!bytes || bytes.byteLength === 0) {
    if (urlClass === "unsupported") {
      toast.error(t("vault.saveFromChatUnsupportedUrl"));
      return { status: "failed", reason: "unsupported_url" };
    }
    toast.error(t("vault.saveFromChatFailed"));
    return { status: "failed", reason: "no_bytes" };
  }

  try {
    const profileId = resolveVaultProfileId().trim() || undefined;
    const displayName = attachment.fileName?.trim() || "attachment";
    const contentType = attachment.contentType?.trim() || "application/octet-stream";
    const receipt = await commitLesObjectWithProof({
      profileId,
      bytes,
      kind: lesKindFromFile({ name: displayName, type: contentType }),
      displayName,
      contentType,
      source: "chat_save",
      sourceAttachmentUrl: normalizedUrl,
    });
    if (!options?.suppressCatalogEmit) {
      emitLesCatalogChanged(receipt.profileId);
    }
    if (showSuccessToast) {
      toast.success(t("vault.saveFromChatSuccess"));
    }
    return { status: "saved", receipt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Unlock this profile/i.test(message)) {
      if (!options?.suppressUnlockToast) {
        toast.error(t("vault.localSaveUnlockRequired"));
      }
      return { status: "unlock_required" };
    }
    toast.error(t("vault.saveFromChatFailed"));
    return { status: "failed", reason: "exception" };
  }
};

export const saveChatAttachmentToLes = async (
  attachment: Attachment,
  t: TranslateFn,
): Promise<boolean> => {
  const outcome = await saveChatAttachmentToLesWithOutcome(attachment, t);
  return outcome.status === "saved";
};

export const saveChatAttachmentsToLes = async (
  attachments: ReadonlyArray<Attachment>,
  t: TranslateFn,
): Promise<number> => {
  if (!canSaveChatAttachmentsToLes() || attachments.length === 0) {
    return 0;
  }
  const profileId = resolveVaultProfileId().trim() || undefined;
  const catalog = await listLesObjects(profileId);
  const knownSavedUrls = new Set(
    catalog
      .map((row) => (row.sourceAttachmentUrl ?? "").trim())
      .filter((url) => url.length > 0),
  );
  let savedCount = 0;
  let alreadyCount = 0;
  for (const attachment of attachments) {
    const outcome = await saveChatAttachmentToLesWithOutcome(attachment, t, {
      toastPolicy: "errors-only",
      suppressCatalogEmit: true,
      knownSavedUrls,
    });
    if (outcome.status === "saved") {
      savedCount += 1;
      const normalized = normalizeAttachmentUrl(attachment.url) || attachment.url.trim();
      if (normalized) {
        knownSavedUrls.add(normalized);
      }
      continue;
    }
    if (outcome.status === "failed" && outcome.reason === "already_saved") {
      alreadyCount += 1;
    }
  }
  if (savedCount > 0) {
    emitLesCatalogChanged(profileId);
  }
  if (savedCount === 0) {
    if (alreadyCount === attachments.length) {
      toast.info(t("vault.alreadyInVault"));
    } else {
      toast.error(t("vault.saveFromChatFailed"));
    }
  } else if (savedCount < attachments.length) {
    toast.warning(t("vault.partialLocalSave", { saved: savedCount, total: attachments.length }));
  } else {
    toast.success(t("vault.saveFromChatSuccess"));
  }
  return savedCount;
};
