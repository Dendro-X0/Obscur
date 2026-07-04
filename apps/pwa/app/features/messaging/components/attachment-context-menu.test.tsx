import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Attachment } from "../types";
import { AttachmentContextMenu } from "./attachment-context-menu";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@/app/features/vault/services/save-chat-attachment-to-vault", () => ({
    canSaveChatAttachmentsToLocalVault: () => true,
    isChatAttachmentSavedToLocalVault: vi.fn(async () => false),
    saveChatAttachmentToLocalVault: vi.fn(async () => true),
}));

const attachment: Attachment = {
    kind: "image",
    url: "https://cdn.example.com/photo.jpg",
    contentType: "image/jpeg",
    fileName: "photo.jpg",
};

describe("AttachmentContextMenu", () => {
    it("surfaces save-to-vault as the first action", async () => {
        render(<AttachmentContextMenu state={{ attachment, x: 120, y: 80 }} onClose={vi.fn()}/>);
        const saveButton = await screen.findByRole("button", { name: "vault.saveFromChat" });
        expect(saveButton).toBeEnabled();
        fireEvent.click(saveButton);
        const { saveChatAttachmentToLocalVault } = await import("@/app/features/vault/services/save-chat-attachment-to-vault");
        expect(saveChatAttachmentToLocalVault).toHaveBeenCalledWith(attachment, expect.any(Function));
    });
});
