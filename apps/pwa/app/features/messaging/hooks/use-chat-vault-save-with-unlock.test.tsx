import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const saveChatAttachmentWithOutcome = vi.fn();
const loadLesSavedAttachmentUrlSet = vi.fn(async () => new Set<string>());
const emitLesCatalogChanged = vi.fn();
const toast = {
  info: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Readonly<{ count?: number; defaultValue?: string }>) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@dweb/ui-kit/toast", () => ({
  toast,
}));

vi.mock("@/app/features/les/sdk/les-chat-save", () => ({
  loadLesSavedAttachmentUrlSet,
  emitLesCatalogChanged,
}));

vi.mock("@/app/features/storage/services/vault-at-rest", () => ({
  resolveVaultProfileId: () => "profile-test",
}));

vi.mock("@/app/features/vault/services/save-chat-attachment-to-vault", () => ({
  saveChatAttachmentWithOutcome,
}));

vi.mock("@/app/features/security/components/vault-write-unlock-dialog", () => ({
  VaultWriteUnlockDialog: (props: Readonly<{ isOpen: boolean }>) => (
    props.isOpen ? <div data-testid="vault-write-unlock-dialog" /> : null
  ),
}));

describe("useChatVaultSaveWithUnlock", () => {
  beforeEach(() => {
    saveChatAttachmentWithOutcome.mockReset();
    loadLesSavedAttachmentUrlSet.mockClear();
    emitLesCatalogChanged.mockClear();
    toast.info.mockClear();
    toast.success.mockClear();
    toast.warning.mockClear();
    toast.error.mockClear();
  });

  it("opens unlock flow instead of treating unlock_required as a bare failure", async () => {
    saveChatAttachmentWithOutcome.mockResolvedValueOnce({ status: "unlock_required" });
    const { useChatVaultSaveWithUnlock } = await import("./use-chat-vault-save-with-unlock");
    const { result } = renderHook(() => useChatVaultSaveWithUnlock());

    await act(async () => {
      const outcome = await result.current.saveOne({
        kind: "image",
        url: "https://cdn.example.com/a.jpg",
        contentType: "image/jpeg",
        fileName: "a.jpg",
      });
      expect(outcome.status).toBe("unlock_required");
    });

    expect(saveChatAttachmentWithOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://cdn.example.com/a.jpg" }),
      expect.any(Function),
      { suppressUnlockToast: true },
    );
    await waitFor(() => {
      expect(result.current.unlockDialog).toBeTruthy();
    });
  });

  it("shows progress and a summary toast when saving multiple attachments", async () => {
    saveChatAttachmentWithOutcome
      .mockResolvedValueOnce({ status: "saved" })
      .mockResolvedValueOnce({ status: "saved" });
    const { useChatVaultSaveWithUnlock } = await import("./use-chat-vault-save-with-unlock");
    const { result } = renderHook(() => useChatVaultSaveWithUnlock());

    await act(async () => {
      await result.current.saveMany([
        {
          kind: "audio",
          url: "https://cdn.example.com/a.mp3",
          contentType: "audio/mpeg",
          fileName: "a.mp3",
        },
        {
          kind: "audio",
          url: "https://cdn.example.com/b.mp3",
          contentType: "audio/mpeg",
          fileName: "b.mp3",
        },
      ]);
    });

    expect(toast.info).toHaveBeenCalled();
    expect(loadLesSavedAttachmentUrlSet).toHaveBeenCalled();
    expect(emitLesCatalogChanged).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("vault.saveFromChatSuccess");
    expect(saveChatAttachmentWithOutcome).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({
        toastPolicy: "errors-only",
        suppressCatalogEmit: true,
        suppressUnlockToast: true,
      }),
    );
  });
});
