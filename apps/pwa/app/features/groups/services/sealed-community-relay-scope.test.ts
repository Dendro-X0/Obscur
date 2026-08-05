import { describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import {
  getCommunityScopedRelayCopy,
  hasCommunityBindingTag,
  isScopedRelayEvent,
  normalizeSealedCommunityRelayUrl,
  publishSealedEventToCommunityScope,
  resolveCommunityScopedPublishRelayUrls,
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

  it("S4: resolve publish targets is primary + explicit broadcasts only", () => {
    expect(resolveCommunityScopedPublishRelayUrls({
      relayUrl: "wss://community.example/",
      communityRelayBroadcastUrls: ["wss://backup.example/", "wss://community.example/"],
    })).toEqual(["wss://community.example", "wss://backup.example"]);
  });

  it("S4: community copy documents bound store vs DM pool", () => {
    expect(getCommunityScopedRelayCopy({
      relayUrl: "wss://community.example",
    })).toContain("CM store: wss://community.example");
    expect(getCommunityScopedRelayCopy({
      relayUrl: "wss://community.example",
      communityRelayBroadcastUrls: ["wss://backup.example"],
    })).toContain("broadcast backups");
    expect(getCommunityScopedRelayCopy({})).toContain("no scoped relay bound");
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
    expect(pool.publishToAll).not.toHaveBeenCalled();
  });

  it("S4: fail-closed when scoped publish APIs are missing (never publishToAll)", async () => {
    const publishToAll = vi.fn(async () => ({
      success: true,
      successCount: 3,
      totalRelays: 3,
      results: [],
    }));
    const pool = {
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => () => {}),
      subscribe: vi.fn(() => "sub"),
      unsubscribe: vi.fn(),
      publishToAll,
    };
    const event = { id: "e".repeat(64), kind: 1, pubkey: "p".repeat(64), created_at: 1, tags: [], content: "", sig: "s".repeat(128) } as unknown as NostrEvent;

    const result = await publishSealedEventToCommunityScope({
      pool,
      relayUrl: "wss://relay.example/",
      communityRelayBroadcastUrls: ["wss://backup.example/"],
      event,
    });

    expect(publishToAll).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.overallError).toBe("scoped_publish_api_unavailable");
    expect(result.totalRelays).toBe(2);
  });
});
