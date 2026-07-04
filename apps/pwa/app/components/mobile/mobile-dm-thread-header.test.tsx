import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DmConversation } from "@/app/features/messaging/types";
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
  });
});
