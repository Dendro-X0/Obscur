import { describe, expect, it } from "vitest";
import { decodeFriendCodeV2, encodeFriendCodeV2, friendCodeV2Internals } from "./friend-code-v2";

describe("friend-code-v2", () => {
  it("encodes and decodes a valid payload", () => {
    const code = encodeFriendCodeV2({
      pubkey: "a".repeat(64),
      relays: ["wss://relay.damus.io"],
    });
    expect(code).toBeTruthy();
    const decoded = decodeFriendCodeV2(code!);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.payload.pubkey).toBe("a".repeat(64));
      expect(decoded.payload.relays?.[0]).toBe("wss://relay.damus.io");
    }
  });

  it("rejects checksum mismatch", () => {
    const code = encodeFriendCodeV2({ pubkey: "b".repeat(64) });
    const tampered = `${code}FFFF`;
    const decoded = decodeFriendCodeV2(tampered);
    expect(decoded.ok).toBe(false);
  });

  it("returns stable checksum width", () => {
    expect(friendCodeV2Internals.checksum4("abc").length).toBe(4);
  });
});
