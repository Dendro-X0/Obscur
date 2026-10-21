import { describe, expect, it } from "vitest";
import {
  findDmConnectionByPubkey,
  formatInviteConnectionPubkeyPreview,
  isInviteConnectionHumanDisplayName,
  isPubkeyPlaceholderName,
  resolveInviteConnectionDisplayName,
  toInviteConnectionSearchText,
} from "./invite-connection-display";

const pubkey = "192bbdbf00112233445566778899aabbccddeeff00112233445566778899aabb";

describe("invite-connection-display", () => {
  it("finds DM connections case-insensitively", () => {
    const found = findDmConnectionByPubkey(
      [
        {
          kind: "dm" as const,
          pubkey: pubkey.toUpperCase(),
          displayName: "Tester2",
        },
      ],
      pubkey.toLowerCase(),
    );
    expect(found?.displayName).toBe("Tester2");
  });

  it("prefers metadata display name over pubkey-like connection labels", () => {
    const displayName = resolveInviteConnectionDisplayName({
      pubkey,
      connectionDisplayName: pubkey.slice(0, 8),
      metadataDisplayName: "Alice",
    });

    expect(displayName).toBe("Alice");
    expect(isInviteConnectionHumanDisplayName(displayName, pubkey)).toBe(true);
  });

  it("uses a meaningful connection display name when metadata is absent", () => {
    const displayName = resolveInviteConnectionDisplayName({
      pubkey,
      connectionDisplayName: "MusicLab",
    });

    expect(displayName).toBe("MusicLab");
  });

  it("falls back to compact pubkey preview instead of Unknown contact", () => {
    const displayName = resolveInviteConnectionDisplayName({
      pubkey,
      connectionDisplayName: pubkey.slice(0, 8),
      metadataDisplayName: `npub1${"q".repeat(20)}`,
    });

    expect(displayName).toBe(formatInviteConnectionPubkeyPreview(pubkey));
    expect(displayName).not.toMatch(/unknown contact/i);
    expect(isInviteConnectionHumanDisplayName(displayName, pubkey)).toBe(false);
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
