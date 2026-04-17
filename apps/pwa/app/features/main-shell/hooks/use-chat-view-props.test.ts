import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Attachment, Conversation, Message } from "../../messaging/types";
import { useChatViewProps } from "./use-chat-view-props";

const conversation: Conversation = {
  kind: "dm",
  id: "conv-1",
  displayName: "Peer",
  pubkey: "a".repeat(64) as any,
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(1_000),
};

const messagesFixture: ReadonlyArray<Message> = [
  {
    id: "m-previewable",
    kind: "user",
    content: "media",
    timestamp: new Date(2_000),
    isOutgoing: false,
    status: "delivered",
    attachments: [
      { kind: "image", url: "https://cdn.example.com/image.png", contentType: "image/png", fileName: "image.png" },
      { kind: "video", url: "https://cdn.example.com/video.mp4", contentType: "video/mp4", fileName: "video.mp4" },
      { kind: "audio", url: "https://cdn.example.com/audio.mp3", contentType: "audio/mpeg", fileName: "audio.mp3" },
      { kind: "voice_note", url: "https://cdn.example.com/voice.webm", contentType: "audio/webm", fileName: "voice-note-1774249000000-d12.webm" },
      { kind: "file", url: "https://cdn.example.com/doc.pdf", contentType: "application/pdf", fileName: "doc.pdf" },
      { kind: "file", url: "https://cdn.example.com/readme.txt", contentType: "text/plain", fileName: "readme.txt" },
    ] as ReadonlyArray<Attachment>,
  },
];

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("../../messaging/hooks/use-conversation-messages", () => ({
  useConversationMessages: () => ({
    messages: messagesFixture,
    isLoading: false,
    hasEarlier: false,
    loadEarlier: vi.fn(),
    pendingEventCount: 0,
  }),
}));

describe("useChatViewProps previewable media selection", () => {
  it("includes only previewable chat attachments in conversation preview order", () => {
    const { result } = renderHook(() => useChatViewProps({
      selectedConversation: conversation,
      myPublicKeyHex: "f".repeat(64),
    }));

    const urls = result.current.selectedConversationMediaItems.map((item) => item.attachment.url);
    expect(urls).toEqual([
      "https://cdn.example.com/image.png",
      "https://cdn.example.com/video.mp4",
      "https://cdn.example.com/audio.mp3",
      "https://cdn.example.com/voice.webm",
      "https://cdn.example.com/doc.pdf",
    ]);
    expect(urls).not.toContain("https://cdn.example.com/readme.txt");
  });
});
