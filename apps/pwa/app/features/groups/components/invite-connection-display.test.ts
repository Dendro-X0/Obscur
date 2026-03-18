import { describe, expect, it } from "vitest";
import {
  isPubkeyPlaceholderName,
  resolveInviteConnectionDisplayName,
  toInviteConnectionSearchText,
} from "./invite-connection-display";

const pubkey = "192bbdbf00112233445566778899aabbccddeeff00112233445566778899aabb";

describe("invite-connection-display", () => {
  it("prefers metadata display name over pubkey-like connection labels", () => {
    const displayName = resolveInviteConnectionDisplayName({
      pubkey,
      connectionDisplayName: pubkey.slice(0, 8),
      metadataDisplayName: "Alice",
    });

    expect(displayName).toBe("Alice");
  });

  it("uses a meaningful connection display name when metadata is absent", () => {
    const displayName = resolveInviteConnectionDisplayName({
      pubkey,
      connectionDisplayName: "MusicLab",
    });

    expect(displayName).toBe("MusicLab");
  });

  it("falls back to stable key preview when both names are placeholders", () => {
    const displayName = resolveInviteConnectionDisplayName({
      pubkey,
      connectionDisplayName: pubkey.slice(0, 8),
      metadataDisplayName: `npub1${"q".repeat(20)}`,
    });

    expect(displayName).toBe(`${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`);
  });

  it("detects common pubkey preview placeholders", () => {
    expect(isPubkeyPlaceholderName(pubkey.slice(0, 8), pubkey)).toBe(true);
    expect(isPubkeyPlaceholderName(`${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`, pubkey)).toBe(true);
    expect(isPubkeyPlaceholderName("Real Name", pubkey)).toBe(false);
  });

  it("builds searchable text that includes resolved name and pubkey", () => {
    const searchText = toInviteConnectionSearchText({
      pubkey,
      resolvedDisplayName: "Alice",
      connectionDisplayName: pubkey.slice(0, 8),
    });

    expect(searchText).toContain("alice");
    expect(searchText).toContain(pubkey);
  });
});
