import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatViewProps } from "./chat-view";
import { ChatView } from "./chat-view";
import type { Conversation, Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const messageListPropsRef = vi.hoisted(() => ({
    current: null as Record<string, unknown> | null,
}));

const searchMessagesMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

vi.mock("next/image", () => ({
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("../../profile/hooks/use-resolved-profile-metadata", () => ({
    useResolvedProfileMetadata: () => null,
}));

vi.mock("../services/chat-state-store", () => ({
    chatStateStoreService: {
        searchMessages: searchMessagesMock,
    },
}));

vi.mock("./chat-header", () => ({
    ChatHeader: () => <div data-testid="chat-header" />,
}));

vi.mock("./stranger-warning-banner", () => ({
    StrangerWarningBanner: () => <div data-testid="stranger-banner" />,
}));

vi.mock("./composer", () => ({
    Composer: () => <div data-testid="composer" />,
}));

vi.mock("./media-gallery", () => ({
    MediaGallery: () => null,
}));

vi.mock("./lightbox", () => ({
    Lightbox: () => null,
}));

vi.mock("./message-menu", () => ({
    MessageMenu: () => null,
}));

vi.mock("./reaction-picker", () => ({
    ReactionPicker: () => null,
}));

vi.mock("./message-list", () => ({
    MessageList: (props: Record<string, unknown>) => {
        messageListPropsRef.current = props;
        return <div data-testid="message-list" />;
    },
}));

const createConversation = (): Conversation => ({
    kind: "dm",
    id: "conv-a",
    displayName: "Alice",
    pubkey: "a".repeat(64) as PublicKeyHex,
    lastMessage: "hey",
    unreadCount: 0,
    lastMessageTime: new Date(1_000),
});

const createMessage = (): Message => ({
    id: "m-visible",
    kind: "user",
    content: "visible message",
    timestamp: new Date(2_000),
    isOutgoing: false,
    status: "delivered",
    conversationId: "conv-a",
});

const createBaseProps = (): ChatViewProps => ({
    conversation: createConversation(),
    isPeerOnline: true,
    interactionStatus: {},
    messages: [createMessage()],
    rawMessagesCount: 1,
    hasHydrated: true,
    hasEarlierMessages: true,
    onLoadEarlier: vi.fn(),
    nowMs: Date.now(),
    flashMessageId: null,
    onCopyPubkey: vi.fn(),
    onOpenMedia: vi.fn(),
    onOpenInfo: vi.fn(),
    messageMenu: null,
    setMessageMenu: vi.fn(),
    messageMenuRef: React.createRef<HTMLDivElement>(),
    onCopyText: vi.fn(),
    onCopyAttachmentUrl: vi.fn(),
    onReferenceMessage: vi.fn(),
    onDeleteMessageForMe: vi.fn(),
    onDeleteMessageForEveryone: vi.fn(),
    reactionPicker: null,
    setReactionPicker: vi.fn(),
    reactionPickerRef: React.createRef<HTMLDivElement>(),
    onToggleReaction: vi.fn(),
    onRetryMessage: vi.fn(),
    messageInput: "",
    setMessageInput: vi.fn(),
    handleSendMessage: vi.fn(),
    onSendDirectMessage: vi.fn(),
    isUploadingAttachment: false,
    uploadStage: "idle",
    pendingAttachments: [],
    pendingAttachmentPreviewUrls: [],
    attachmentError: null,
    replyTo: null,
    setReplyTo: vi.fn(),
    onPickAttachments: vi.fn(),
    onSelectFiles: vi.fn(),
    removePendingAttachment: vi.fn(),
    clearPendingAttachment: vi.fn(),
    relayStatus: { total: 1, openCount: 1, errorCount: 0 },
    composerTextareaRef: React.createRef<HTMLTextAreaElement>(),
    onSendVoiceNote: vi.fn(),
    isProcessingMedia: false,
    mediaProcessingProgress: 0,
    isMediaGalleryOpen: false,
    setIsMediaGalleryOpen: vi.fn(),
    selectedConversationMediaItems: [],
    lightboxIndex: null,
    setLightboxIndex: vi.fn(),
    pendingEventCount: 0,
    recipientStatus: "idle",
    isPeerAccepted: true,
    isInitiator: false,
    onAcceptPeer: vi.fn(),
    onBlockPeer: vi.fn(),
    groupAdmins: [],
});

describe("ChatView history search", () => {
    it("searches only in current conversation and forwards jump target to message list", async () => {
        searchMessagesMock.mockResolvedValue([
            {
                conversationId: "conv-a",
                message: { id: "m-hit-a", content: "alpha keyword", timestampMs: 5_000 },
            },
            {
                conversationId: "conv-b",
                message: { id: "m-hit-b", content: "alpha keyword elsewhere", timestampMs: 6_000 },
            },
        ]);

        render(<ChatView {...createBaseProps()} />);

        fireEvent.click(screen.getByRole("button", { name: "Search Messages" }));
        fireEvent.change(screen.getByPlaceholderText("Search message history in this chat..."), {
            target: { value: "alpha" },
        });

        await waitFor(() => {
            expect(searchMessagesMock).toHaveBeenCalledWith("alpha", 120);
        });

        expect(screen.getByText(/keyword/)).toBeInTheDocument();
        expect(screen.queryByText(/elsewhere/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByText(/keyword/));

        await waitFor(() => {
            expect(messageListPropsRef.current?.jumpToMessageId).toBe("m-hit-a");
        });
    });

    it("closes the history search panel with Escape", async () => {
        render(<ChatView {...createBaseProps()} />);

        fireEvent.click(screen.getByRole("button", { name: "Search Messages" }));
        expect(screen.getByPlaceholderText("Search message history in this chat...")).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "Escape" });

        await waitFor(() => {
            expect(screen.queryByPlaceholderText("Search message history in this chat...")).not.toBeInTheDocument();
        });
    });

    it("renders voice-note metadata badge for attachment-only search hits", async () => {
        searchMessagesMock.mockResolvedValue([
            {
                conversationId: "conv-a",
                message: {
                    id: "m-voice-a",
                    content: "",
                    timestampMs: 7_000,
                    attachments: [{
                        kind: "audio",
                        fileName: "voice-note-1774249000000-d64.webm",
                        contentType: "audio/webm",
                    }],
                },
            },
        ]);

        render(<ChatView {...createBaseProps()} />);

        fireEvent.click(screen.getByRole("button", { name: "Search Messages" }));
        fireEvent.change(screen.getByPlaceholderText("Search message history in this chat..."), {
            target: { value: "1:04" },
        });

        await waitFor(() => {
            expect(searchMessagesMock).toHaveBeenCalledWith("1:04", 120);
        });

        expect(screen.getByText("Voice Note 1:04")).toBeInTheDocument();
        expect(screen.getByText("Voice note")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Voice Note 1:04/i }));
        await waitFor(() => {
            expect(messageListPropsRef.current?.jumpToMessageId).toBe("m-voice-a");
        });
    });

    it("filters search results to voice notes when voice filter is selected", async () => {
        searchMessagesMock.mockResolvedValue([
            {
                conversationId: "conv-a",
                message: { id: "m-text-a", content: "project update alpha", timestampMs: 8_000 },
            },
            {
                conversationId: "conv-a",
                message: {
                    id: "m-voice-b",
                    content: "",
                    timestampMs: 9_000,
                    attachments: [{
                        kind: "audio",
                        fileName: "voice-note-1774249000000-d12.webm",
                        contentType: "audio/webm",
                    }],
                },
            },
        ]);

        render(<ChatView {...createBaseProps()} />);

        fireEvent.click(screen.getByRole("button", { name: "Search Messages" }));
        fireEvent.change(screen.getByPlaceholderText("Search message history in this chat..."), {
            target: { value: "voice" },
        });

        await waitFor(() => {
            expect(searchMessagesMock).toHaveBeenCalledWith("voice", 120);
        });

        expect(screen.getByText(/project update alpha/i)).toBeInTheDocument();
        expect(screen.getByText("Voice Note 0:12")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Voice Notes/i }));

        await waitFor(() => {
            expect(screen.queryByText(/project update alpha/i)).not.toBeInTheDocument();
        });
        expect(screen.getByText("Voice Note 0:12")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /Voice Note 0:12/i }));
        await waitFor(() => {
            expect(messageListPropsRef.current?.jumpToMessageId).toBe("m-voice-b");
        });
    });
});
