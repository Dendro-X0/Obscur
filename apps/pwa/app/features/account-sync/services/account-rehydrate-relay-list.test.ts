import { describe, expect, it } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { accountRehydrateServiceInternals } from "./account-rehydrate-service";

const baseEvent = (overrides: Partial<NostrEvent>): NostrEvent => ({
  id: "event-id",
  pubkey: "aa".repeat(32),
  created_at: 1_700_000_000,
  kind: 10002,
  tags: [],
  content: "",
  sig: "sig",
  ...overrides,
});

describe("accountRehydrateServiceInternals.parseRelayListFromEvent", () => {
  it("parses NIP-65 kind 10002 relay tags", () => {
    const relays = accountRehydrateServiceInternals.parseRelayListFromEvent(baseEvent({
      kind: 10002,
      tags: [
        ["r", "wss://nos.lol"],
        ["r", "wss://relay.damus.io", "read"],
      ],
    }));
    expect(relays).toEqual([
      { url: "wss://nos.lol", enabled: true },
      { url: "wss://relay.damus.io", enabled: false },
    ]);
  });

  it("ignores kind 3 contact lists so they cannot clobber relays", () => {
    const relays = accountRehydrateServiceInternals.parseRelayListFromEvent(baseEvent({
      kind: 3,
      content: JSON.stringify({
        "wss://evil.example": { read: true, write: true },
      }),
      tags: [["p", "cc".repeat(32)]],
    }));
    expect(relays).toEqual([]);
  });
});
