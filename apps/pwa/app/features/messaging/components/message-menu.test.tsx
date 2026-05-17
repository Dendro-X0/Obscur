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
    it("does not surface recall for everyone in the product UI", async () => {
        const props = createProps(createMessage({ isOutgoing: true }));

        render(<MessageMenu {...props} />);

        expect(screen.queryByRole("button", { name: /Recall for everyone/i })).toBeNull();
    });

    it("allows hide on this device for incoming and outgoing messages", async () => {
        const incomingProps = createProps(createMessage({ isOutgoing: false }));
        const { unmount } = render(<MessageMenu {...incomingProps} />);

        const incomingHide = await screen.findByRole("button", { name: /Hide on this device/i });
        expect(incomingHide).toBeEnabled();
        fireEvent.click(incomingHide);
        expect(incomingProps.onDeleteForMe).toHaveBeenCalledTimes(1);
        unmount();

        const outgoingProps = createProps(createMessage({ isOutgoing: true }));
        render(<MessageMenu {...outgoingProps} />);
        const outgoingHide = await screen.findByRole("button", { name: /Hide on this device/i });
        expect(outgoingHide).toBeEnabled();
        fireEvent.click(outgoingHide);
        expect(outgoingProps.onDeleteForMe).toHaveBeenCalledTimes(1);
        expect(outgoingProps.onDeleteForEveryone).not.toHaveBeenCalled();
    });
});
