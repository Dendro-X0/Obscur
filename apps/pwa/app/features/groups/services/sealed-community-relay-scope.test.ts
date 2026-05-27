import { describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import {
  hasCommunityBindingTag,
  isScopedRelayEvent,
  normalizeSealedCommunityRelayUrl,
  publishSealedEventToCommunityScope,
} from "./sealed-community-relay-scope";

describe("sealed-community-relay-scope", () => {
  it("normalizes relay URLs", () => {
    expect(normalizeSealedCommunityRelayUrl("WSS://Relay.Example/")).toBe("wss://relay.example");
  });

  it("matches scoped relay events", () => {
    expect(isScopedRelayEvent({
      scopedRelayUrl: "wss://relay.example",
      eventRelayUrl: "WSS://Relay.Example/",
    })).toBe(true);
    expect(isScopedRelayEvent({
      scopedRelayUrl: "wss://relay.a",
      eventRelayUrl: "wss://relay.b",
    })).toBe(false);
  });

  it("detects community binding tags", () => {
    const event = { tags: [["h", "group-1"]] } as unknown as NostrEvent;
    expect(hasCommunityBindingTag({ event, groupId: "group-1" })).toBe(true);
    expect(hasCommunityBindingTag({ event, groupId: "group-2" })).toBe(false);
  });

  it("publishes via publishToUrls when configured", async () => {
    const publishToUrls = vi.fn(async () => ({
      success: true,
      successCount: 1,
      totalRelays: 1,
      results: [{ success: true, relayUrl: "wss://relay.example" }],
    }));
    const pool = {
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => () => {}),
      subscribe: vi.fn(() => "sub"),
      unsubscribe: vi.fn(),
      publishToUrls,
      publishToAll: vi.fn(),
    };
    const event = { id: "e".repeat(64), kind: 1, pubkey: "p".repeat(64), created_at: 1, tags: [], content: "", sig: "s".repeat(128) } as unknown as NostrEvent;

    await publishSealedEventToCommunityScope({
      pool,
      relayUrl: "wss://relay.example/",
      event,
    });

    expect(publishToUrls).toHaveBeenCalledWith(
      ["wss://relay.example"],
      JSON.stringify(["EVENT", event]),
    );
  });
});
