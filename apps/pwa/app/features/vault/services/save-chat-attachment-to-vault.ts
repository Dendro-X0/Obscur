"use client";

/**
 * Chat → Vault facade (R4): delegates to LES. Legacy local-media-store write path is not used.
 */
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import type { Attachment } from "@/app/features/messaging/types";
import {
  canSaveChatAttachmentsToLes,
  isChatAttachmentSavedToLes,
  saveChatAttachmentToLes,
  saveChatAttachmentToLesWithOutcome,
  saveChatAttachmentsToLes,
  type LesChatSaveOutcome,
} from "@/app/features/les/sdk/les-chat-save";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Maintainer release flag for *legacy* vault store path — remains false.
 * Desktop chat save is enabled via LES (`canSaveChatAttachmentsToLocalVault`).
 */
export const VAULT_SAVE_FROM_CHAT_ENABLED = false;

const parseEnvFlag = (value: string | undefined): boolean => (value ?? "").trim() === "1";

/** Legacy env gate — kept for tests; LES availability is the real enablement. */
export const isVaultSaveFromChatFeatureEnabled = (): boolean => {
  if (VAULT_SAVE_FROM_CHAT_ENABLED) {
    return true;
  }
  if (parseEnvFlag(process.env.NEXT_PUBLIC_OBSCUR_VAULT_SAVE_FROM_CHAT)) {
    return true;
  }
  return process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1";
};

export const canSaveChatAttachmentsToLocalVault = (): boolean =>
  canSaveChatAttachmentsToLes() && isVaultSaveFromChatFeatureEnabled();

export type SaveChatAttachmentOutcome =
  | Readonly<{ status: "saved" }>
  | Readonly<{ status: "unlock_required" }>
  | Readonly<{ status: "failed"; reason: string }>;

const mapOutcome = (outcome: LesChatSaveOutcome): SaveChatAttachmentOutcome => {
  if (outcome.status === "saved") {
    return { status: "saved" };
  }
  if (outcome.status === "unlock_required") {
    return { status: "unlock_required" };
  }
  return { status: "failed", reason: outcome.reason };
};

export const isChatAttachmentSavedToLocalVault = async (remoteUrl: string): Promise<boolean> =>
  isChatAttachmentSavedToLes(remoteUrl);

export const saveChatAttachmentWithOutcome = async (
  attachment: Attachment,
  t: TranslateFn,
  options?: Readonly<{ toastPolicy?: "all" | "errors-only"; suppressUnlockToast?: boolean }>,
): Promise<SaveChatAttachmentOutcome> => {
  if (!isVaultSaveFromChatFeatureEnabled() || !hasNativeRuntime()) {
    const { toast } = await import("@dweb/ui-kit");
    toast.error(t("vault.saveFromChatUnavailable"));
    return { status: "failed", reason: "unavailable" };
  }
  const outcome = await saveChatAttachmentToLesWithOutcome(attachment, t, options);
  return mapOutcome(outcome);
};

export const saveChatAttachmentAndAwaitVaultRow = async (
  attachment: Attachment,
  t: TranslateFn,
  options?: Readonly<{ toastPolicy?: "all" | "errors-only"; suppressUnlockToast?: boolean }>,
): Promise<boolean> => {
  const outcome = await saveChatAttachmentWithOutcome(attachment, t, options);
  return outcome.status === "saved";
};

export const saveChatAttachmentToLocalVault = async (
  attachment: Attachment,
  t: TranslateFn,
): Promise<boolean> => saveChatAttachmentToLes(attachment, t);

export const saveChatAttachmentsToLocalVault = async (
  attachments: ReadonlyArray<Attachment>,
  t: TranslateFn,
): Promise<number> => {
  if (!isVaultSaveFromChatFeatureEnabled() || !hasNativeRuntime()) {
    return 0;
  }
  return saveChatAttachmentsToLes(attachments, t);
};
