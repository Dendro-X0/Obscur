import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationRow } from "./conversation-row";
import type { Conversation } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("../../profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => null,
}));

let mockMobileCompactLayout = false;

vi.mock("@/app/features/runtime/use-mobile-compact-layout", () => ({
  useMobileCompactLayout: () => mockMobileCompactLayout,
}));

vi.mock("../../../components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    className?: string;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
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

  it("suppresses double-encoded voice-call control payload previews", () => {
    const controlPayload = JSON.stringify({
      type: "voice-call-signal",
      version: 1,
      roomId: "room-b",
      signalType: "leave",
      fromPubkey: "b".repeat(64),
      sentAtUnixMs: 2,
    });
    const doubleEncodedPayload = JSON.stringify(controlPayload);
    render(
      <ConversationRow
        conversation={{ ...baseConversation, id: "conv-b", lastMessage: doubleEncodedPayload }}
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

  it("suppresses escaped-object voice-call control payload previews", () => {
    const escapedControlPayload = JSON.stringify({
      type: "voice-call-signal",
      version: 1,
      roomId: "room-c",
      signalType: "ice-candidate",
      fromPubkey: "c".repeat(64),
      sentAtUnixMs: 3,
    }).replace(/\"/g, "\\\"");
    render(
      <ConversationRow
        conversation={{ ...baseConversation, id: "conv-c", lastMessage: escapedControlPayload }}
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

  it("offers a direct profile navigation action for dm conversations", () => {
    const onViewProfile = vi.fn();
    render(
      <ConversationRow
        conversation={baseConversation}
        isSelected={false}
        onSelect={vi.fn()}
        unreadCount={0}
        lastMessageLabel=""
        lastActiveLabel=""
        lastViewedLabel=""
        onViewProfile={onViewProfile}
      />,
    );

    fireEvent.click(screen.getByText("View Profile"));

    expect(onViewProfile).toHaveBeenCalledWith(baseConversation.pubkey);
  });

  it("navigates to profile when avatar is clicked", () => {
    const onViewProfile = vi.fn();
    render(
      <ConversationRow
        conversation={baseConversation}
        isSelected={false}
        onSelect={vi.fn()}
        unreadCount={0}
        lastMessageLabel=""
        lastActiveLabel=""
        lastViewedLabel=""
        onViewProfile={onViewProfile}
      />,
    );

    fireEvent.click(screen.getByTestId("conversation-row-avatar-button"));

    expect(onViewProfile).toHaveBeenCalledWith(baseConversation.pubkey);
  });

  it("offers a hide action for conversations", () => {
    const onHide = vi.fn();
    render(
      <ConversationRow
        conversation={baseConversation}
        isSelected={false}
        onSelect={vi.fn()}
        unreadCount={0}
        lastMessageLabel=""
        lastActiveLabel=""
        lastViewedLabel=""
        onHide={onHide}
      />,
    );

    fireEvent.click(screen.getByText("Hide"));

    expect(onHide).toHaveBeenCalledWith(baseConversation.id);
  });

  it("renders community invite response preview and message timestamp label", () => {
    const inviteResponse = JSON.stringify({
      type: "community-invite-response",
      status: "accepted",
      groupId: "g1",
    });
    render(
      <ConversationRow
        conversation={{
          ...baseConversation,
          displayName: "Tester2",
          lastMessage: inviteResponse,
          lastMessageIsOutgoing: false,
          lastMessageTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        }}
        isSelected={false}
        onSelect={vi.fn()}
        unreadCount={0}
        lastMessageLabel="4d ago"
        lastActiveLabel=""
        lastViewedLabel=""
      />,
    );

    expect(screen.getByText(/Tester2 accepted the invitation/i)).toBeInTheDocument();
    expect(screen.getByText("4d ago")).toBeInTheDocument();
  });

  it("shows an inline offline badge on compact rows", () => {
    mockMobileCompactLayout = true;
    render(
      <ConversationRow
        conversation={baseConversation}
        isSelected={false}
        onSelect={vi.fn()}
        unreadCount={0}
        isOnline={false}
        lastMessageLabel="7d ago"
        lastActiveLabel=""
        lastViewedLabel=""
      />,
    );
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByText(/Active/i)).not.toBeInTheDocument();
    mockMobileCompactLayout = false;
  });
});
