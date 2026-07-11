import { afterEach, describe, expect, it, vi } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
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

  it("rejects private key hex when relay confirms derived pubkey profile", async () => {
    const privateKeyHex = "095648f20fc8f90d4a0e8c0f7737fd6e18a5d57e1af2c8100caa6954484c367d" as PrivateKeyHex;
    const derivedPublicKeyHex = derivePublicKeyHex(privateKeyHex);

    let messageHandler: ((params: Readonly<{ url: string; message: string }>) => void) | null = null;
    const pool: RelayQueryPool = {
      broadcastEvent: async (payload: string) => {
        const parsed = JSON.parse(payload) as ReadonlyArray<unknown>;
        if (!Array.isArray(parsed) || parsed[0] !== "REQ" || typeof parsed[1] !== "string") {
          return { success: false };
        }
        const subId = parsed[1];
        const filters = parsed.slice(2) as ReadonlyArray<{ authors?: ReadonlyArray<string> }>;
        const author = filters[0]?.authors?.[0];
        if (author === derivedPublicKeyHex && messageHandler) {
          setTimeout(() => {
            messageHandler?.({
              url: "wss://relay.example",
              message: JSON.stringify([
                "EVENT",
                subId,
                {
                  kind: 0,
                  pubkey: derivedPublicKeyHex,
                  content: JSON.stringify({ name: "DemoUser", about: "Find me on Obscur" }),
                  tags: [],
                },
              ]),
            });
          }, 5);
        }
        return { success: true };
      },
      sendToOpen: () => {},
      subscribeToMessages: (handler) => {
        messageHandler = handler;
        return () => {
          messageHandler = null;
        };
      },
      waitForConnection: async () => true,
    };

    const result = await resolveIdentity({
      query: privateKeyHex,
      pool,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("private_key_forbidden");
    }
  });

  it("still resolves legacy invite code when callers pass a disabled flag", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        pubkey: "e".repeat(64),
        display: "Eve",
        inviteCode: "OBSCUR-ABCDE",
      }),
    })));
    const result = await resolveIdentity({
      query: "OBSCUR-ABCDE",
      pool: createMockPool(),
      indexBaseUrl: "https://index.example",
      allowLegacyInviteCode: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.pubkey).toBe("e".repeat(64));
      expect(["legacy_code", "friend_code_v3"]).toContain(result.identity.source);
    }
  });
});
