import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DmConversation } from "@/app/features/messaging/types";
import { MobileDmThreadHeader } from "./mobile-dm-thread-header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/app/features/profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => ({ displayName: "Alice" }),
}));

const dmConversation: DmConversation = {
  kind: "dm",
  id: "dm:a:b",
  pubkey: "a".repeat(64),
  displayName: "Alice",
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
};

describe("MobileDmThreadHeader", () => {
  it("renders the conversation title and calls onBack", () => {
    const onBack = vi.fn();
    render(
      <MobileDmThreadHeader
        conversation={dmConversation}
        onBack={onBack}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
