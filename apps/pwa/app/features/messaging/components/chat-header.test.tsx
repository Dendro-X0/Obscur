import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ChatHeaderProps } from "./chat-header";
import { ChatHeader } from "./chat-header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("../../profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => null,
}));

vi.mock("../../settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: () => ({ showPublicKeyControlsInChat: false }),
  },
}));

const createProps = (): ChatHeaderProps => ({
  conversation: {
    kind: "dm",
    id: "conv-a",
    displayName: "Alice",
    pubkey: "a".repeat(64) as PublicKeyHex,
    lastMessage: "hello",
    unreadCount: 0,
    lastMessageTime: new Date(1_000),
  },
  isOnline: false,
  interactionStatus: { lastActiveAtMs: Date.now() - 15_000 },
  nowMs: null,
  onCopyPubkey: vi.fn(),
  onOpenMedia: vi.fn(),
});

describe("ChatHeader", () => {
  it("does not synthesize relative last-active labels when nowMs is unavailable", () => {
    render(<ChatHeader {...createProps()} />);

    expect(screen.getByText("No recent activity")).toBeInTheDocument();
    expect(screen.queryByText(/Last active/i)).not.toBeInTheDocument();
  });

  it("navigates to profile when dm avatar is clicked", () => {
    const onOpenProfile = vi.fn();
    const props = createProps();
    render(<ChatHeader {...props} onOpenProfile={onOpenProfile} />);

    fireEvent.click(screen.getByTestId("chat-header-avatar-button"));

    expect(onOpenProfile).toHaveBeenCalledWith("a".repeat(64));
  });
});
