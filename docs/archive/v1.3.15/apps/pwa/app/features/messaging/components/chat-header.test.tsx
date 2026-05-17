import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ChatHeaderProps } from "./chat-header";
import { ChatHeader } from "./chat-header";

const notificationPreferenceMocks = vi.hoisted(() => ({
  getNotificationTargetEnabled: vi.fn(() => true),
  setNotificationTargetEnabled: vi.fn(),
  subscribeNotificationTargetPreferenceChanges: vi.fn(() => () => {}),
}));

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

vi.mock("../../notifications/utils/notification-target-preference", () => ({
  getNotificationTargetEnabled: notificationPreferenceMocks.getNotificationTargetEnabled,
  setNotificationTargetEnabled: notificationPreferenceMocks.setNotificationTargetEnabled,
  subscribeNotificationTargetPreferenceChanges: notificationPreferenceMocks.subscribeNotificationTargetPreferenceChanges,
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
  beforeEach(() => {
    notificationPreferenceMocks.getNotificationTargetEnabled.mockClear();
    notificationPreferenceMocks.setNotificationTargetEnabled.mockClear();
    notificationPreferenceMocks.subscribeNotificationTargetPreferenceChanges.mockClear();
    notificationPreferenceMocks.getNotificationTargetEnabled.mockReturnValue(true);
  });

  it("toggles per-chat notification preference from the header bell button", () => {
    const props = createProps();
    const onToggleConversationNotifications = vi.fn();
    render(<ChatHeader {...props} onToggleConversationNotifications={onToggleConversationNotifications} />);

    const toggleButton = screen.getByTestId("chat-header-notification-toggle");
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");
    expect(toggleButton.className).toContain("border-emerald-500/35");

    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    expect(toggleButton.className).toContain("border-rose-500/35");

    expect(notificationPreferenceMocks.setNotificationTargetEnabled).toHaveBeenCalledWith({
      target: { kind: "dm", peerPublicKeyHex: "a".repeat(64) },
      enabled: false,
    });
    expect(onToggleConversationNotifications).toHaveBeenCalledWith({
      conversation: props.conversation,
      enabled: false,
    });
  });

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
