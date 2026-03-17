import { describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import { applyRecipientRelayHints } from "./recipient-relay-hints";

describe("recipient-relay-hints", () => {
  it("only adds trusted wss relay hints", () => {
    const addTransientRelay = vi.fn();
    const recipientPubkey = "b".repeat(64);
    const peerPublicKeyInput = nip19.nprofileEncode({
      pubkey: recipientPubkey,
      relays: [
        "wss://hint-a.example/",
        "ws://127.0.0.1:7001",
        "javascript:alert(1)",
      ],
    });

    applyRecipientRelayHints({
      peerPublicKeyInput,
      recipientPubkey: recipientPubkey as any,
      addTransientRelay,
      getWriteRelays: () => [
        "wss://hint-b.example",
        "http://bad.example",
      ],
    });

    expect(addTransientRelay).toHaveBeenCalledTimes(2);
    expect(addTransientRelay).toHaveBeenNthCalledWith(1, "wss://hint-a.example");
    expect(addTransientRelay).toHaveBeenNthCalledWith(2, "wss://hint-b.example");
  });
});
