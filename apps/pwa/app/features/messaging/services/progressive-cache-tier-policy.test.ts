import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";
import {
  auditProfileScopedStorageAccess,
  buildProfileScopedConversationCacheKey,
  PROGRESSIVE_CACHE_COLD_HYDRATE_DEBOUNCE_MS,
  PROGRESSIVE_CACHE_COMPACT_COLD_HYDRATE_DEFER_MS,
  resolveProgressiveCacheTierPlan,
} from "./progressive-cache-tier-policy";

const myPk = "aa".repeat(32) as PublicKeyHex;
const peerPk = "bb".repeat(32) as PublicKeyHex;
const conversationId = `dm:${myPk}:${peerPk}`;

const message = (id: string, isOutgoing: boolean): Message => ({
  id,
  kind: "user",
  content: "hello",
  timestamp: new Date(),
  isOutgoing,
  status: "delivered",
  conversationId,
});

describe("progressive-cache-tier-policy", () => {
  describe("buildProfileScopedConversationCacheKey", () => {
    it("builds profile::conversation keys", () => {
      expect(buildProfileScopedConversationCacheKey("profile-a", "conv-1")).toBe("profile-a::conv-1");
    });

    it("returns null when profile or conversation is missing", () => {
      expect(buildProfileScopedConversationCacheKey(undefined, "conv-1")).toBeNull();
      expect(buildProfileScopedConversationCacheKey("profile-a", "")).toBeNull();
    });
  });

  describe("auditProfileScopedStorageAccess", () => {
    it("passes when profile and conversation are present", () => {
      const result = auditProfileScopedStorageAccess({
        profileId: "profile-a",
        conversationId: "conv-1",
        operation: "write",
      });
      expect(result.ok).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it("flags missing profileId on write", () => {
      const result = auditProfileScopedStorageAccess({
        profileId: undefined,
        conversationId: "conv-1",
        operation: "write",
      });
      expect(result.ok).toBe(false);
      expect(result.violations).toContain("missing profileId for write");
      expect(result.violations).toContain("write requires profile-scoped conversation key");
    });

    it("allows read without profileId for ambient chat-state fallback", () => {
      const result = auditProfileScopedStorageAccess({
        profileId: undefined,
        conversationId: "conv-1",
        operation: "read",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("resolveProgressiveCacheTierPlan", () => {
    it("selects warm_display when bidirectional cache is usable", () => {
      const plan = resolveProgressiveCacheTierPlan({
        displayCache: [message("in", false), message("out", true)],
        syncSeed: [],
        myPublicKeyHex: myPk,
      });
      expect(plan.activeTier).toBe("warm_display");
      expect(plan.initialPaint.shouldPaint).toBe(true);
      expect(plan.shouldScheduleColdHydrate).toBe(true);
      expect(plan.coldHydrateDebounceMs).toBe(PROGRESSIVE_CACHE_COLD_HYDRATE_DEBOUNCE_MS);
    });

    it("selects sync_seed when cache is empty", () => {
      const plan = resolveProgressiveCacheTierPlan({
        displayCache: [],
        syncSeed: [message("seed", false)],
        myPublicKeyHex: myPk,
      });
      expect(plan.activeTier).toBe("sync_seed");
    });

    it("adds compact defer to cold hydrate debounce", () => {
      const plan = resolveProgressiveCacheTierPlan({
        displayCache: [],
        syncSeed: [],
        myPublicKeyHex: myPk,
        compactLayout: true,
      });
      expect(plan.activeTier).toBe("none");
      expect(plan.coldHydrateDebounceMs).toBe(
        PROGRESSIVE_CACHE_COLD_HYDRATE_DEBOUNCE_MS + PROGRESSIVE_CACHE_COMPACT_COLD_HYDRATE_DEFER_MS,
      );
    });
  });
});
