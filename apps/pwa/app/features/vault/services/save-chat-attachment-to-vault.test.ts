import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "@/app/features/messaging/types";

const mocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(() => true),
  canSaveChatAttachmentsToLes: vi.fn(() => true),
  saveChatAttachmentToLesWithOutcome: vi.fn(
    async (): Promise<
      | { status: "saved"; receipt: {
          lesObjectId: string;
          profileId: string;
          relativePath: string;
          catalogRevision: number;
        } }
      | { status: "unlock_required" }
      | { status: "failed"; reason: string }
    > => ({
      status: "saved",
      receipt: {
        lesObjectId: "abc",
        profileId: "default",
        relativePath: "profiles/default/les/images/abc.obscurvault",
        catalogRevision: 1,
      },
    }),
  ),
  saveChatAttachmentToLes: vi.fn(async () => true),
  saveChatAttachmentsToLes: vi.fn(async () => 1),
  isChatAttachmentSavedToLes: vi.fn(async () => false),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: mocks.hasNativeRuntime,
}));

vi.mock("@/app/features/les/sdk/les-chat-save", () => ({
  canSaveChatAttachmentsToLes: mocks.canSaveChatAttachmentsToLes,
  saveChatAttachmentToLesWithOutcome: mocks.saveChatAttachmentToLesWithOutcome,
  saveChatAttachmentToLes: mocks.saveChatAttachmentToLes,
  saveChatAttachmentsToLes: mocks.saveChatAttachmentsToLes,
  isChatAttachmentSavedToLes: mocks.isChatAttachmentSavedToLes,
}));

vi.mock("@dweb/ui-kit", () => ({
  toast: mocks.toast,
}));

import {
  VAULT_SAVE_FROM_CHAT_ENABLED,
  canSaveChatAttachmentsToLocalVault,
  isVaultSaveFromChatFeatureEnabled,
  saveChatAttachmentAndAwaitVaultRow,
  saveChatAttachmentWithOutcome,
} from "./save-chat-attachment-to-vault";

const t = (key: string) => key;

const attachment = (): Attachment => ({
  kind: "image",
  url: "https://cdn.example.com/photo.jpg",
  contentType: "image/jpeg",
  fileName: "photo.jpg",
});

describe("save-chat-attachment-to-vault (LES facade)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    mocks.hasNativeRuntime.mockReturnValue(true);
    mocks.canSaveChatAttachmentsToLes.mockReturnValue(true);
    mocks.saveChatAttachmentToLesWithOutcome.mockResolvedValue({
      status: "saved",
      receipt: {
        lesObjectId: "abc",
        profileId: "default",
        relativePath: "profiles/default/les/images/abc.obscurvault",
        catalogRevision: 1,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps legacy maintainer flag false while desktop shell enables LES intake", () => {
    expect(VAULT_SAVE_FROM_CHAT_ENABLED).toBe(false);
    expect(isVaultSaveFromChatFeatureEnabled()).toBe(true);
    expect(canSaveChatAttachmentsToLocalVault()).toBe(true);
  });

  it("blocks intake when feature gate is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "0");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_VAULT_SAVE_FROM_CHAT", "0");
    expect(isVaultSaveFromChatFeatureEnabled()).toBe(false);
    const outcome = await saveChatAttachmentWithOutcome(attachment(), t);
    expect(outcome.status).toBe("failed");
    expect(mocks.saveChatAttachmentToLesWithOutcome).not.toHaveBeenCalled();
  });

  it("delegates save + success to LES with catalog proof owner", async () => {
    const ok = await saveChatAttachmentAndAwaitVaultRow(attachment(), t);
    expect(ok).toBe(true);
    expect(mocks.saveChatAttachmentToLesWithOutcome).toHaveBeenCalled();
  });

  it("maps LES unlock_required", async () => {
    mocks.saveChatAttachmentToLesWithOutcome.mockResolvedValueOnce({ status: "unlock_required" });
    const outcome = await saveChatAttachmentWithOutcome(attachment(), t);
    expect(outcome).toEqual({ status: "unlock_required" });
  });

  it("maps LES failures", async () => {
    mocks.saveChatAttachmentToLesWithOutcome.mockResolvedValueOnce({
      status: "failed",
      reason: "no_bytes",
    });
    const outcome = await saveChatAttachmentWithOutcome(attachment(), t);
    expect(outcome).toEqual({ status: "failed", reason: "no_bytes" });
  });
});
