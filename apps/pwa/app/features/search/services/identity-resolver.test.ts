import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveIdentity } from "./identity-resolver";
import { createSignedContactCard, encodeContactCard } from "./contact-card";
import { encodeFriendCodeV3 } from "./friend-code-v3";
import type { RelayQueryPool } from "./relay-discovery-query";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const createMockPool = (): RelayQueryPool => ({
  broadcastEvent: async () => ({ success: false }),
  sendToOpen: () => {},
  subscribeToMessages: () => () => {},
  waitForConnection: async () => false,
});

describe("identity-resolver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves hex pubkey deterministically", async () => {
    const result = await resolveIdentity({
      query: "a".repeat(64),
      pool: createMockPool(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.pubkey).toBe("a".repeat(64));
      expect(result.identity.source).toBe("hex");
    }
  });

  it("resolves encoded contact card", async () => {
    const card = await createSignedContactCard({
      pubkey: "b".repeat(64) as PublicKeyHex,
      relays: ["wss://relay.damus.io"],
      label: "Bob",
    });
    const encoded = encodeContactCard(card);
    const result = await resolveIdentity({
      query: encoded,
      pool: createMockPool(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.pubkey).toBe("b".repeat(64));
      expect(result.identity.source).toBe("contact_card");
    }
  });

  it("returns unsupported token for free text", async () => {
    const result = await resolveIdentity({
      query: "alice from school",
      pool: createMockPool(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupported_token");
    }
  });

  it("resolves friend code v3", async () => {
    const now = Date.now();
    const code = encodeFriendCodeV3({
      pubkey: "c".repeat(64),
      ttlMs: 600_000,
      nowUnixMs: now,
    });
    const result = await resolveIdentity({
      query: code ?? "",
      pool: createMockPool(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.pubkey).toBe("c".repeat(64));
      expect(result.identity.source).toBe("friend_code_v3");
    }
  });

  it("uses index resolve for short code input", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        pubkey: "d".repeat(64),
        display: "Dana",
        relays: ["wss://relay.primal.net"],
      }),
    })));
    const result = await resolveIdentity({
      query: "OB-7K2P-9M4D",
      pool: createMockPool(),
      indexBaseUrl: "https://index.example",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.pubkey).toBe("d".repeat(64));
      expect(result.identity.source).toBe("friend_code_v3");
    }
  });

  it("rejects legacy invite code when invite-code lane is disabled", async () => {
    const result = await resolveIdentity({
      query: "OBSCUR-ABCDE",
      pool: createMockPool(),
      allowLegacyInviteCode: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupported_token");
      expect(result.message).toContain("Invite code lookup is currently disabled");
    }
  });
});
