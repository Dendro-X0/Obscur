import { describe, expect, it } from "vitest";
import { formatPeerPubkeyPreview } from "@/app/features/profile/utils/resolve-peer-display-name";
import { resolveInviteConnectionPresentation } from "./resolve-invite-connection-presentation";

const pubkey = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";

describe("resolveInviteConnectionPresentation", () => {
  it("prefers metadata display name", () => {
    const result = resolveInviteConnectionPresentation({
      pubkey,
      metadataDisplayName: "Tester2",
      connectionDisplayName: "Unknown contact",
      localHintByPubkey: new Map(),
    });
    expect(result.displayName).toBe("Tester2");
  });

  it("uses local profile-slot hint when relays/cache have no name", () => {
    const result = resolveInviteConnectionPresentation({
      pubkey,
      connectionDisplayName: "Unknown contact",
      localHintByPubkey: new Map([
        [pubkey, { username: "Tester2", avatarUrl: "https://example.com/t2.png" }],
      ]),
    });
    expect(result.displayName).toBe("Tester2");
    expect(result.avatarUrl).toBe("https://example.com/t2.png");
    expect(result.usedLocalAccountHint).toBe(true);
  });

  it("uses resolved-identity label when connection and metadata are empty", () => {
    const result = resolveInviteConnectionPresentation({
      pubkey,
      connectionDisplayName: "Unknown contact",
      resolvedDisplayName: "Tester2",
      localHintByPubkey: new Map(),
    });
    expect(result.displayName).toBe("Tester2");
    expect(result.usedLocalAccountHint).toBe(false);
  });

  it("falls back to pubkey preview only when no human label exists", () => {
    const result = resolveInviteConnectionPresentation({
      pubkey,
      connectionDisplayName: "Unknown contact",
      localHintByPubkey: new Map(),
    });
    expect(result.displayName).toBe(formatPeerPubkeyPreview(pubkey));
    expect(result.displayName).not.toMatch(/unknown contact/i);
  });
});
