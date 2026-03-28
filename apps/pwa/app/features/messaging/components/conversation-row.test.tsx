import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationRow } from "./conversation-row";
import type { Conversation } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => null,
}));

const baseConversation: Conversation = {
  kind: "dm",
  id: "conv-a",
  pubkey: "a".repeat(64),
  displayName: "Alice",
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date("2026-01-01T00:00:00.000Z"),
};

describe("ConversationRow", () => {
  it("suppresses voice-call control payload previews", () => {
    const controlPayload = JSON.stringify({
      type: "voice-call-signal",
      version: 1,
      roomId: "room-a",
      signalType: "offer",
      fromPubkey: "a".repeat(64),
      sentAtUnixMs: 1,
    });
    render(
      <ConversationRow
        conversation={{ ...baseConversation, lastMessage: controlPayload }}
        isSelected={false}
        onSelect={vi.fn()}
        unreadCount={0}
        lastMessageLabel=""
        lastActiveLabel=""
        lastViewedLabel=""
      />,
    );
    expect(screen.getByText("messaging.noMessagesYet")).toBeInTheDocument();
    expect(screen.queryByText(/voice-call-signal/i)).not.toBeInTheDocument();
  });
});

