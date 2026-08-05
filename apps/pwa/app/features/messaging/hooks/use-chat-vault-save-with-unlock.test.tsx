import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const saveChatAttachmentWithOutcome = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/app/features/vault/services/save-chat-attachment-to-vault", () => ({
  saveChatAttachmentWithOutcome: (...args: unknown[]) => saveChatAttachmentWithOutcome(...args),
}));

vi.mock("@/app/features/security/components/vault-write-unlock-dialog", () => ({
  VaultWriteUnlockDialog: (props: Readonly<{ isOpen: boolean }>) => (
    props.isOpen ? <div data-testid="vault-write-unlock-dialog" /> : null
  ),
}));

describe("useChatVaultSaveWithUnlock", () => {
  beforeEach(() => {
    saveChatAttachmentWithOutcome.mockReset();
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
});
