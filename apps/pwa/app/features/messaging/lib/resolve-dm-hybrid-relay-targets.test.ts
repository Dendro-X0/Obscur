import { describe, expect, it } from "vitest";
import { resolveDmHybridRelayTargeting } from "./resolve-dm-hybrid-relay-targets";

describe("resolveDmHybridRelayTargeting", () => {
  it("unions recipient NIP-65 / inbound evidence with sender open and write relays for ordinary DMs", () => {
    const result = resolveDmHybridRelayTargeting({
      customTags: [["p", "peer"]],
      discoveredRecipientRelayUrls: [],
      senderOpenRelayUrls: ["wss://nos.lol"],
      senderWriteRelayUrls: ["wss://relay.damus.io", "wss://nos.lol"],
      recipientWriteRelayUrls: ["wss://peer-nip65.example"],
      recipientInboundRelayUrls: ["wss://peer-seen.example"],
    });

    expect(result.usedRecipientScopeOnly).toBe(false);
    expect(result.targetRelayUrls).toEqual([
      "wss://peer-nip65.example",
      "wss://peer-seen.example",
      "wss://nos.lol",
      "wss://relay.damus.io",
    ]);
  });

  it("unions message-delete targets with sender open and write relays (same as ordinary DMs)", () => {
    const result = resolveDmHybridRelayTargeting({
      customTags: [["t", "message-delete"]],
      discoveredRecipientRelayUrls: [],
      senderOpenRelayUrls: ["wss://nos.lol"],
      senderWriteRelayUrls: ["wss://relay.damus.io"],
      recipientWriteRelayUrls: ["wss://r1.example"],
      recipientInboundRelayUrls: ["wss://r2.example"],
    });

    expect(result.usedRecipientScopeOnly).toBe(false);
    expect(result.targetRelayUrls).toEqual([
      "wss://r1.example",
      "wss://r2.example",
      "wss://nos.lol",
      "wss://relay.damus.io",
    ]);
  });
});
