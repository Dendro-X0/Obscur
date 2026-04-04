import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { MessageMenu } from "./message-menu";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

const createMessage = (overrides: Partial<Message> = {}): Message => ({
    id: "msg-1",
    kind: "user",
    content: "hello",
    timestamp: new Date(1_000),
    isOutgoing: true,
    status: "delivered",
    conversationId: "conv-1",
    ...overrides,
});

const createProps = (activeMessage: Message) => ({
    x: 10,
    y: 20,
    activeMessage,
    onCopyText: vi.fn(),
    onCopyAttachmentUrl: vi.fn(),
    onReply: vi.fn(),
    onStartMultiSelect: vi.fn(),
    onDeleteForMe: vi.fn(),
    onDeleteForEveryone: vi.fn(),
    menuRef: { current: document.createElement("div") },
});

describe("MessageMenu deletion permissions", () => {
    it("allows delete for me on incoming messages but disables delete for everyone", async () => {
        const props = createProps(createMessage({ isOutgoing: false }));

        render(<MessageMenu {...props} />);

        const deleteForMeButton = await screen.findByRole("button", { name: /Delete for me/i });
        const deleteForEveryoneButton = await screen.findByRole("button", { name: /Delete for everyone/i });

        expect(deleteForMeButton).toBeEnabled();
        expect(deleteForEveryoneButton).toBeDisabled();

        fireEvent.click(deleteForMeButton);

        expect(props.onDeleteForMe).toHaveBeenCalledTimes(1);
        expect(props.onDeleteForEveryone).not.toHaveBeenCalled();
    });

    it("allows delete for everyone on self-authored messages", async () => {
        const props = createProps(createMessage({ isOutgoing: true }));

        render(<MessageMenu {...props} />);

        const deleteForEveryoneButton = await screen.findByRole("button", { name: /Delete for everyone/i });

        expect(deleteForEveryoneButton).toBeEnabled();

        fireEvent.click(deleteForEveryoneButton);

        expect(props.onDeleteForEveryone).toHaveBeenCalledTimes(1);
    });
});
