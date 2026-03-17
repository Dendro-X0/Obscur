import { describe, expect, it, vi } from "vitest";
import {
  consumeFriendCodeV3,
  decodeFriendCodeV3,
  encodeFriendCodeV3,
  friendCodeV3Internals,
} from "./friend-code-v3";

describe("friend-code-v3", () => {
  it("encodes/decodes with TTL", () => {
    const now = 1_700_000_000_000;
    const code = encodeFriendCodeV3({
      pubkey: "a".repeat(64),
      relays: ["wss://relay.damus.io"],
      ttlMs: 600_000,
      nowUnixMs: now,
    });
    expect(code).toBeTruthy();
    const decoded = decodeFriendCodeV3(code ?? "", now + 1_000);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.payload.pubkey).toBe("a".repeat(64));
      expect(decoded.payload.expiresAt).toBe(now + 600_000);
    }
  });

  it("returns expired_code when TTL elapsed", () => {
    const now = 1_700_000_000_000;
    const code = encodeFriendCodeV3({
      pubkey: "b".repeat(64),
      ttlMs: 60_000,
      nowUnixMs: now,
    });
    const decoded = decodeFriendCodeV3(code ?? "", now + 120_000);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.reason).toBe("expired_code");
    }
  });

  it("returns code_used for consumed single-use code", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
      },
    });

    const now = 1_700_000_000_000;
    const code = encodeFriendCodeV3({
      pubkey: "c".repeat(64),
      ttlMs: 600_000,
      singleUse: true,
      nowUnixMs: now,
    });
    const first = decodeFriendCodeV3(code ?? "", now + 1_000);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    consumeFriendCodeV3(first.codeId);
    const second = decodeFriendCodeV3(code ?? "", now + 2_000);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("code_used");
    }
  });

  it("detects checksum mismatch", () => {
    const code = encodeFriendCodeV3({ pubkey: "d".repeat(64) }) ?? "";
    const tampered = `${code}X`;
    const decoded = decodeFriendCodeV3(tampered);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.reason).toBe("checksum_mismatch");
    }
  });

  it("provides deterministic code id helper", () => {
    const id = friendCodeV3Internals.makeCodeId("abc-body");
    expect(id.length).toBe(4);
  });
});

