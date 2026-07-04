/**
 * M3 — Progressive cache tier policy (single owner).
 *
 * Tiers:
 * 1. warm_display — in-memory LRU (`dm-thread-display-cache.ts`)
 * 2. sync_seed — profile-scoped chat-state seed (`dm-thread-sync-seed-loader.ts`)
 * 3. cold_hydrate — IndexedDB / SQLite full hydrate (`dm-conversation-hydrate-pipeline-port.ts`)
 *
 * Initial paint uses warm → sync seed; cold hydrate always follows when a thread opens.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";
import {
  resolveInitialConversationPaint,
  type ResolveInitialConversationPaintResult,
} from "./dm-thread-read-model";

export type ProfileScopedConversationCacheKey = `${string}::${string}`;

export type ProgressiveCacheTier =
  | "warm_display"
  | "sync_seed"
  | "merged_warm"
  | "none";

export type ProgressiveCacheTierPlan = Readonly<{
  initialPaint: ResolveInitialConversationPaintResult;
  activeTier: ProgressiveCacheTier;
  shouldScheduleColdHydrate: boolean;
  coldHydrateDebounceMs: number;
}>;

/** Default coalesce window before cold hydrate (matches hydrate coordinator). */
export const PROGRESSIVE_CACHE_COLD_HYDRATE_DEBOUNCE_MS = 220;

/** Extra defer on compact mobile so warm paint can commit before heavy I/O. */
export const PROGRESSIVE_CACHE_COMPACT_COLD_HYDRATE_DEFER_MS = 80;

const paintSourceToTier = (
  source: ResolveInitialConversationPaintResult["source"],
): ProgressiveCacheTier => {
  if (source === "display_cache") {
    return "warm_display";
  }
  if (source === "sync_seed") {
    return "sync_seed";
  }
  if (source === "merged_seed") {
    return "merged_warm";
  }
  return "none";
};

export const buildProfileScopedConversationCacheKey = (
  profileId: string | undefined,
  conversationId: string | undefined,
): ProfileScopedConversationCacheKey | null => {
  const profile = profileId?.trim();
  const conversation = conversationId?.trim();
  if (!profile || !conversation) {
    return null;
  }
  return `${profile}::${conversation}`;
};

export type ProfileScopedStorageAuditResult = Readonly<{
  ok: boolean;
  violations: ReadonlyArray<string>;
}>;

export const auditProfileScopedStorageAccess = (params: Readonly<{
  profileId: string | undefined;
  conversationId: string | undefined;
  operation: "read" | "write" | "hydrate";
}>): ProfileScopedStorageAuditResult => {
  const violations: string[] = [];
  const profile = params.profileId?.trim();
  const conversation = params.conversationId?.trim();

  if (!conversation) {
    violations.push(`missing conversationId for ${params.operation}`);
  }
  if (params.operation === "write" && !profile) {
    violations.push("missing profileId for write");
    violations.push("write requires profile-scoped conversation key");
  }
  if (params.operation === "hydrate" && !profile) {
    violations.push("missing profileId for hydrate");
  }

  return { ok: violations.length === 0, violations };
};

export const resolveProgressiveCacheTierPlan = (params: Readonly<{
  displayCache: ReadonlyArray<Message>;
  syncSeed: ReadonlyArray<Message>;
  myPublicKeyHex: PublicKeyHex | null;
  compactLayout?: boolean;
}>): ProgressiveCacheTierPlan => {
  const initialPaint = resolveInitialConversationPaint({
    displayCache: params.displayCache,
    syncSeed: params.syncSeed,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  const activeTier = paintSourceToTier(initialPaint.source);
  const coldHydrateDebounceMs = (params.compactLayout ?? false)
    ? PROGRESSIVE_CACHE_COLD_HYDRATE_DEBOUNCE_MS + PROGRESSIVE_CACHE_COMPACT_COLD_HYDRATE_DEFER_MS
    : PROGRESSIVE_CACHE_COLD_HYDRATE_DEBOUNCE_MS;

  return {
    initialPaint,
    activeTier,
    shouldScheduleColdHydrate: true,
    coldHydrateDebounceMs,
  };
};
