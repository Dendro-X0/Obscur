import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DmConversation } from "@/app/features/messaging/types";
import { CHAT_HISTORY_SEARCH_OPEN_EVENT } from "@/app/features/messaging/components/messaging-shell-bottom-chrome";
import { MobileDmThreadHeader } from "./mobile-dm-thread-header";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
      return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(options?.[token] ?? ""));
    },
  }),
}));

vi.mock("@/app/features/profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => ({ displayName: null }),
}));

vi.mock("@/app/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
  }) => (
    <button type="button" role="menuitem" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}));

const dmConversation: DmConversation = {
  kind: "dm",
  id: "dm:a:b",
  pubkey: "a".repeat(64),
  displayName: "Unknown contact",
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
};

describe("MobileDmThreadHeader", () => {
  it("uses displayNameHint when conversation title is a placeholder", () => {
    render(
      <MobileDmThreadHeader
        conversation={dmConversation}
        onBack={vi.fn()}
        displayNameHint="Tester1"
        isPeerOnline
      />,
    );

    expect(screen.getByText("Tester1")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.queryByText("Unknown contact")).not.toBeInTheDocument();
  });

  it("renders the conversation title and calls onBack", () => {
    const onBack = vi.fn();
    render(
      <MobileDmThreadHeader
        conversation={{
          ...dmConversation,
          displayName: "Alice",
        }}
        onBack={onBack}
        onOpenMedia={vi.fn()}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("shows overflow menu when thread actions are available", () => {
    render(
      <MobileDmThreadHeader
        conversation={{
          ...dmConversation,
          displayName: "Alice",
        }}
        onBack={vi.fn()}
        onOpenMedia={vi.fn()}
        onSendVoiceCallInvite={vi.fn()}
        canSendVoiceCallInvite
      />,
    );

    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Voice call" })).toBeInTheDocument();
  });

  it("starts a video call from an icon button", () => {
    const onSendVideoCallInvite = vi.fn();
    render(
      <MobileDmThreadHeader
        conversation={{
          ...dmConversation,
          displayName: "Alice",
        }}
        onBack={vi.fn()}
        onSendVideoCallInvite={onSendVideoCallInvite}
        canSendVideoCallInvite
      />,
    );

    fireEvent.click(screen.getByTestId("mobile-thread-video-call"));
    expect(onSendVideoCallInvite).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("opens in-chat search from the overflow menu", () => {
    const openSearch = vi.fn();
    window.addEventListener(CHAT_HISTORY_SEARCH_OPEN_EVENT, openSearch);
    render(
      <MobileDmThreadHeader
        conversation={{
          ...dmConversation,
          displayName: "Alice",
        }}
        onBack={vi.fn()}
      />,
    );

    const searchLabel =
      (en.translation as Record<string, string | undefined>)["messaging.searchMessagesInChat"]
      ?? "Search Messages";
    fireEvent.click(screen.getByRole("menuitem", { name: searchLabel }));
    expect(openSearch).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHAT_HISTORY_SEARCH_OPEN_EVENT, openSearch);
  });
});
