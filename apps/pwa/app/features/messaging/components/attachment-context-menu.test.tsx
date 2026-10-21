import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Attachment } from "../types";
import { AttachmentContextMenu } from "./attachment-context-menu";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@dweb/ui-kit/toast", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warning: vi.fn(),
    },
}));

vi.mock("@/app/features/security/components/vault-write-unlock-dialog", () => ({
    VaultWriteUnlockDialog: () => null,
}));

vi.mock("@/app/features/security/components/attachment-export-confirm-dialog", () => ({
    AttachmentExportConfirmDialog: () => null,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
    getResolvedProfileId: () => "profile-test",
}));

vi.mock("@/app/features/dm-kernel/dm-kernel-trust-export-action-gate", () => ({
    requiresAttachmentExportConfirm: vi.fn(() => false),
}));

vi.mock("@/app/features/vault/services/save-chat-attachment-to-vault", () => ({
    canSaveChatAttachmentsToLocalVault: vi.fn(() => false),
    isChatAttachmentSavedToLocalVault: vi.fn(async () => false),
    saveChatAttachmentWithOutcome: vi.fn(async () => ({ status: "saved" as const })),
}));

vi.mock("@/app/features/vault/services/local-media-store", () => ({
    downloadAttachmentToUserPath: vi.fn(async () => true),
}));

const attachment: Attachment = {
    kind: "image",
    url: "https://cdn.example.com/photo.jpg",
    contentType: "image/jpeg",
    fileName: "photo.jpg",
};

describe("AttachmentContextMenu", () => {
    it("hides save-to-vault when the feature is disabled", async () => {
        const { canSaveChatAttachmentsToLocalVault } = await import("@/app/features/vault/services/save-chat-attachment-to-vault");
        vi.mocked(canSaveChatAttachmentsToLocalVault).mockReturnValue(false);

        render(<AttachmentContextMenu state={{ attachment, x: 120, y: 80 }} onClose={vi.fn()}/>);
        expect(screen.queryByRole("button", { name: "vault.saveFromChat" })).toBeNull();
        expect(screen.getByTestId("attachment-download-to-folder")).toBeInTheDocument();
    });

    it("surfaces save-to-vault as the first action when enabled", async () => {
        const { canSaveChatAttachmentsToLocalVault, saveChatAttachmentWithOutcome } = await import(
            "@/app/features/vault/services/save-chat-attachment-to-vault"
        );
        vi.mocked(canSaveChatAttachmentsToLocalVault).mockReturnValue(true);

        render(<AttachmentContextMenu state={{ attachment, x: 120, y: 80 }} onClose={vi.fn()}/>);
        const saveButton = await screen.findByRole("button", { name: "vault.saveFromChat" });
        expect(saveButton).toBeEnabled();
        fireEvent.click(saveButton);
        await waitFor(() => {
            expect(saveChatAttachmentWithOutcome).toHaveBeenCalledWith(
                attachment,
                expect.any(Function),
                { suppressUnlockToast: true },
            );
        });
    });

    it("downloads to a user-chosen folder from the context menu", async () => {
        const onClose = vi.fn();
        const { downloadAttachmentToUserPath } = await import("@/app/features/vault/services/local-media-store");
        const { toast } = await import("@dweb/ui-kit/toast");
        vi.mocked(downloadAttachmentToUserPath).mockResolvedValue("saved");

        render(<AttachmentContextMenu state={{ attachment, x: 120, y: 80 }} onClose={onClose}/>);
        fireEvent.click(screen.getByTestId("attachment-download-to-folder"));

        await waitFor(() => {
            expect(downloadAttachmentToUserPath).toHaveBeenCalledWith({ attachment });
            expect(toast.success).toHaveBeenCalledWith("vault.exportDecryptedCopySuccess");
            expect(onClose).toHaveBeenCalled();
        });
    });

    it("stays silent when the save dialog is cancelled", async () => {
        const onClose = vi.fn();
        const { downloadAttachmentToUserPath } = await import("@/app/features/vault/services/local-media-store");
        const { toast } = await import("@dweb/ui-kit/toast");
        vi.mocked(downloadAttachmentToUserPath).mockResolvedValue("cancelled");

        render(<AttachmentContextMenu state={{ attachment, x: 120, y: 80 }} onClose={onClose}/>);
        fireEvent.click(screen.getByTestId("attachment-download-to-folder"));

        await waitFor(() => {
            expect(downloadAttachmentToUserPath).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });
});
