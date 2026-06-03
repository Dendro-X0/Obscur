import { describe, expect, it } from "vitest";
import type { DmConversation } from "@/app/features/messaging/types";
import {
  isPlaceholderDmDisplayName,
  resolveMobileThreadTitle,
} from "./resolve-mobile-thread-title";

const dmConversation: DmConversation = {
  kind: "dm",
  id: "dm:a:b",
  pubkey: "a".repeat(64),
  displayName: "Unknown contact",
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(),
};

describe("resolveMobileThreadTitle", () => {
  it("treats Unknown contact as a placeholder", () => {
    expect(isPlaceholderDmDisplayName("Unknown contact")).toBe(true);
    expect(isPlaceholderDmDisplayName("Tester1")).toBe(false);
  });

  it("prefers resolved metadata over placeholder conversation name", () => {
    expect(resolveMobileThreadTitle({
      conversation: dmConversation,
      resolvedDisplayName: "Tester1",
    })).toBe("Tester1");
  });

  it("uses displayNameHint when conversation and metadata are placeholders", () => {
    expect(resolveMobileThreadTitle({
      conversation: dmConversation,
      displayNameHint: "Tester1",
    })).toBe("Tester1");
  });

  it("falls back to Direct message when no real name exists", () => {
    expect(resolveMobileThreadTitle({
      conversation: dmConversation,
    })).toBe("Direct message");
  });
});
