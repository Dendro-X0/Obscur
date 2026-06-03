import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { chatStateStoreService } from "./chat-state-store";
import { loadDmThreadSyncSeedCache } from "./dm-thread-sync-seed-loader";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: () => false,
}));

describe("dm-thread-sync-seed-loader", () => {
  const publicKeyHex = "aa".repeat(32) as PublicKeyHex;
  const conversationId = "dm:aa:bb";

  beforeEach(() => {
    vi.spyOn(chatStateStoreService, "load").mockReturnValue({
      messagesByConversationId: {
        [conversationId]: [{
          id: "seed-1",
          kind: "user",
          content: "seed",
          timestamp: new Date(1_000),
          isOutgoing: false,
          status: "delivered",
          conversationId,
        }],
      },
    } as ReturnType<typeof chatStateStoreService.load>);
  });

  it("loads profile-scoped chat-state seed on web builds", () => {
    const seed = loadDmThreadSyncSeedCache({
      conversationAliasIds: [conversationId],
      publicKeyHex,
      profileId: "profile-a",
      persistentSuppressedMessageIds: new Set(),
      localMessageRetentionDays: undefined,
    });
    expect(chatStateStoreService.load).toHaveBeenCalledWith(publicKeyHex, { profileId: "profile-a" });
    expect(seed.map((row) => row.id)).toEqual(["seed-1"]);
  });

  it("returns empty seed when conversation id is missing", () => {
    const seed = loadDmThreadSyncSeedCache({
      conversationAliasIds: [],
      publicKeyHex,
      profileId: "profile-a",
      persistentSuppressedMessageIds: new Set(),
      localMessageRetentionDays: undefined,
    });
    expect(seed).toEqual([]);
    expect(chatStateStoreService.load).not.toHaveBeenCalled();
  });
});
