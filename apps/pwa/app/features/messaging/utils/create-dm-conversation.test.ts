import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createDmConversation } from "./create-dm-conversation";

const MY_PUBLIC_KEY = "a".repeat(64);
const PEER_PUBLIC_KEY = "b".repeat(64) as PublicKeyHex;

describe("create-dm-conversation", () => {
  it("uses privacy-safe fallback display name when none is provided", () => {
    const conversation = createDmConversation({
      myPublicKeyHex: MY_PUBLIC_KEY,
      peerPublicKeyHex: PEER_PUBLIC_KEY,
    });

    expect(conversation).not.toBeNull();
    expect(conversation?.displayName).toBe("Unknown contact");
  });

  it("keeps explicit display name when provided", () => {
    const conversation = createDmConversation({
      myPublicKeyHex: MY_PUBLIC_KEY,
      peerPublicKeyHex: PEER_PUBLIC_KEY,
      displayName: "Alice",
    });

    expect(conversation).not.toBeNull();
    expect(conversation?.displayName).toBe("Alice");
  });
});
