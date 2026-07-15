import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "@/app/features/messaging/types";
import { VaultWriteEncryptionRequiredError } from "@/app/features/storage/services/vault-at-rest";

const mocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(() => true),
  isVaultEncryptionSessionReady: vi.fn(() => true),
  classifyAttachmentFetchUrlForVaultSave: vi.fn(() => "ok" as "ok" | "blocked_host" | "unsupported"),
  isLocalVaultOnlyUrl: vi.fn(() => false),
  fetchRemoteAttachmentBytesForVaultSave: vi.fn(async (): Promise<Uint8Array | null> => new Uint8Array([1, 2, 3])),
  saveFileToLocalVault: vi.fn(async () => ({
    vaultUrl: "obscur://vault/local/abc123",
    localUrl: "blob:local",
    attachment: {} as Attachment,
  })),
  persistAttachmentToLocalVault: vi.fn(async () => "blob:persisted"),
  awaitVaultIndexRowForKey: vi.fn(async () => true),
  hydrateVaultDiskInventoryForActiveProfile: vi.fn(async () => 0),
  restoreNativeVaultEncryptionSessionIfNeeded: vi.fn(async () => false),
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

vi.mock("./local-media-store", async () => {
  const actual = await vi.importActual<typeof import("./local-media-store")>("./local-media-store");
  return {
    ...actual,
    classifyAttachmentFetchUrlForVaultSave: mocks.classifyAttachmentFetchUrlForVaultSave,
    isLocalVaultOnlyUrl: mocks.isLocalVaultOnlyUrl,
    fetchRemoteAttachmentBytesForVaultSave: mocks.fetchRemoteAttachmentBytesForVaultSave,
    saveFileToLocalVault: mocks.saveFileToLocalVault,
    persistAttachmentToLocalVault: mocks.persistAttachmentToLocalVault,
    awaitVaultIndexRowForKey: mocks.awaitVaultIndexRowForKey,
    isVaultEncryptionSessionReady: mocks.isVaultEncryptionSessionReady,
    hydrateVaultDiskInventoryForActiveProfile: mocks.hydrateVaultDiskInventoryForActiveProfile,
  };
});

vi.mock("@/app/features/storage/services/native-storage-at-rest-service", () => ({
  restoreNativeVaultEncryptionSessionIfNeeded: mocks.restoreNativeVaultEncryptionSessionIfNeeded,
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

describe("save-chat-attachment-to-vault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    mocks.hasNativeRuntime.mockReturnValue(true);
    mocks.isVaultEncryptionSessionReady.mockReturnValue(true);
    mocks.classifyAttachmentFetchUrlForVaultSave.mockReturnValue("ok");
    mocks.isLocalVaultOnlyUrl.mockReturnValue(false);
    mocks.fetchRemoteAttachmentBytesForVaultSave.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.saveFileToLocalVault.mockResolvedValue({
      vaultUrl: "obscur://vault/local/abc123",
      localUrl: "blob:local",
      attachment: attachment(),
    });
    mocks.awaitVaultIndexRowForKey.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps maintainer flag false while desktop shell enables intake", () => {
    expect(VAULT_SAVE_FROM_CHAT_ENABLED).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    expect(isVaultSaveFromChatFeatureEnabled()).toBe(true);
    expect(canSaveChatAttachmentsToLocalVault()).toBe(true);
  });

  it("blocks intake when feature gate is off", () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "0");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_VAULT_SAVE_FROM_CHAT", "0");
    expect(isVaultSaveFromChatFeatureEnabled()).toBe(false);
    expect(canSaveChatAttachmentsToLocalVault()).toBe(false);
  });

  it("shows success only when the vault index row is visible", async () => {
    const result = await saveChatAttachmentAndAwaitVaultRow(attachment(), t);

    expect(result).toBe(true);
    expect(mocks.awaitVaultIndexRowForKey).toHaveBeenCalledWith({
      indexKey: "obscur://vault/local/abc123",
    });
    expect(mocks.toast.success).toHaveBeenCalledWith("vault.saveFromChatSuccess");
  });

  it("does not toast success when the index row never appears", async () => {
    mocks.awaitVaultIndexRowForKey.mockResolvedValue(false);

    const result = await saveChatAttachmentAndAwaitVaultRow(attachment(), t);

    expect(result).toBe(false);
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith("vault.saveFromChatFailed");
  });

  it("surfaces encryption-required failures without success toast", async () => {
    mocks.saveFileToLocalVault.mockRejectedValue(new VaultWriteEncryptionRequiredError());

    const result = await saveChatAttachmentAndAwaitVaultRow(attachment(), t);

    expect(result).toBe(false);
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(mocks.toast.error).toHaveBeenCalledWith("vault.localSaveUnlockRequired");
  });

  it("reports unlock_required when vault encryption session is missing", async () => {
    mocks.isVaultEncryptionSessionReady.mockReturnValue(false);
    mocks.restoreNativeVaultEncryptionSessionIfNeeded.mockResolvedValue(false);

    const outcome = await saveChatAttachmentWithOutcome(attachment(), t, { suppressUnlockToast: true });

    expect(outcome).toEqual({ status: "unlock_required" });
    expect(mocks.saveFileToLocalVault).not.toHaveBeenCalled();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("saves from blob preview URLs when remote fetch is unavailable", async () => {
    mocks.classifyAttachmentFetchUrlForVaultSave.mockReturnValue("unsupported");
    mocks.fetchRemoteAttachmentBytesForVaultSave.mockResolvedValue(null);
    const blobAttachment: Attachment = {
      ...attachment(),
      url: "blob:https://obscur.local/preview",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
    } as Response);

    const outcome = await saveChatAttachmentWithOutcome(blobAttachment, t);

    expect(outcome).toEqual({ status: "saved" });
    expect(mocks.saveFileToLocalVault).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("suppresses per-item success toasts when toastPolicy is errors-only", async () => {
    const result = await saveChatAttachmentAndAwaitVaultRow(attachment(), t, { toastPolicy: "errors-only" });

    expect(result).toBe(true);
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });
});
