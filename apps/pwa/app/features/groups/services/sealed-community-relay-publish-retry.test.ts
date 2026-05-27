import { describe, expect, it, vi } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { publishSealedEventToCommunityScopeWithRetry } from "./sealed-community-relay-publish-retry";

const stubEvent = {
  id: "e".repeat(64),
  kind: 1,
  pubkey: "p".repeat(64),
  created_at: 1,
  tags: [],
  content: "",
  sig: "s".repeat(128),
} as unknown as NostrEvent;

describe("publishSealedEventToCommunityScopeWithRetry", () => {
  it("retries until scoped publish succeeds", async () => {
    const publishToScope = vi.fn()
      .mockResolvedValueOnce({ success: false, successCount: 0, totalRelays: 1, results: [] })
      .mockResolvedValueOnce({ success: true, successCount: 1, totalRelays: 1, results: [] });
    const onRecoveredAfterRetry = vi.fn();

    const result = await publishSealedEventToCommunityScopeWithRetry({
      publishToScope,
      pool: { publishToAll: vi.fn() } as never,
      relayUrl: "wss://relay.example",
      event: stubEvent,
      operation: "test",
      maxAttempts: 2,
      baseBackoffMs: 1,
      onRecoveredAfterRetry,
    });

    expect(result.success).toBe(true);
    expect(publishToScope).toHaveBeenCalledTimes(2);
    expect(onRecoveredAfterRetry).toHaveBeenCalledOnce();
  });
});
