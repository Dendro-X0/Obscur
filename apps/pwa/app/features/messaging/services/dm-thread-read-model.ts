/**
 * Phase 1 — DM thread read model (single owner for display semantics).
 *
 * Owns direction coverage, initial paint policy, post-hydrate reconciliation,
 * and projection-merge gating. Storage authority selection stays in
 * `dm-read-authority-port.ts`; I/O orchestration stays in
 * `dm-thread-history-legacy-port.ts`. This module is pure: given layer outputs,
 * it decides what the thread should show and whether to reconcile.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isNativeDmSqliteReadOwner } from "./native-dm-read-policy";
import type { Message } from "../types";
import { mergeHydratedBaseWithLiveOverlayMessages } from "./conversation-message-materialization";
import { dedupeMessagesByIdentity } from "./dm-conversation-message-retention-dedupe";

export const getMessageDirectionCounts = (
  entries: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
): Readonly<{ outgoing: number; incoming: number }> => {
  let outgoing = 0;
  let incoming = 0;
  entries.forEach((entry) => {
    const senderPubkey = normalizePublicKeyHex(entry.senderPubkey);
    const isOutgoing = entry.isOutgoing === true || (!!myPublicKeyHex && senderPubkey === myPublicKeyHex);
    if (isOutgoing) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  });
  return { outgoing, incoming };
};

export const DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS = 4;
export const DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS = 150;
/** Native desktop boot can hydrate before profile bind + auth restore finish. */
export const NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS = 8;
export const NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS = 400;
export const DM_THREAD_DIRECTION_COVERAGE_HYDRATE_MAX_ATTEMPTS = 3;
export const DM_THREAD_PARTIAL_DIRECTION_HYDRATE_MAX_ATTEMPTS = 5;
export const DM_THREAD_PARTIAL_DIRECTION_HYDRATE_BASE_DELAY_MS = 200;
/** Default visible window for initial DM thread paint (matches MESSAGE_PAGE_SIZE). */
export const DM_THREAD_LIVE_WINDOW_SOFT_LIMIT = 200;

export type DmThreadDirectionCoverage = Readonly<{
  outgoing: number;
  incoming: number;
  isComplete: boolean;
  isPartial: boolean;
}>;

export type DmThreadHydrateReconcilePolicy = Readonly<{
  shouldRetryHydrate: boolean;
  forceIndexedAuthority: boolean;
  attempt: number;
  maxAttempts: number;
}>;

export type DmThreadProjectionMergePolicy = Readonly<{
  shouldMerge: boolean;
  wouldDropDirectionCoverage: boolean;
}>;

export const evaluateDirectionCoverage = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
): DmThreadDirectionCoverage => {
  const { outgoing, incoming } = getMessageDirectionCounts(messages, myPublicKeyHex);
  const hasOutgoing = outgoing > 0;
  const hasIncoming = incoming > 0;
  const isPartial = messages.length > 0 && hasOutgoing !== hasIncoming;
  return {
    outgoing,
    incoming,
    isComplete: messages.length === 0 || (hasOutgoing && hasIncoming),
    isPartial,
  };
};

export const hasPartialDirectionCoverage = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
): boolean => evaluateDirectionCoverage(messages, myPublicKeyHex).isPartial;

const mergeHydratedWithOverlay = (
  baseMessages: ReadonlyArray<Message>,
  overlayMessages: ReadonlyArray<Message>,
  conversationIds: ReadonlyArray<string>,
): ReadonlyArray<Message> => {
  if (overlayMessages.length === 0) {
    return baseMessages;
  }
  const scope = new Set(
    conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  return [...mergeHydratedBaseWithLiveOverlayMessages(
    baseMessages,
    overlayMessages,
    scope,
  )].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};

/** Retry hydrate only when another layer proves the missing direction should exist. */
export const shouldReconcilePartialDirectionCoverage = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
  hints: Readonly<{
    previousMessages: ReadonlyArray<Message>;
    supplementalMessages: ReadonlyArray<Message>;
  }>,
): boolean => {
  if (!hasPartialDirectionCoverage(messages, myPublicKeyHex)) {
    return false;
  }
  const current = evaluateDirectionCoverage(messages, myPublicKeyHex);
  const previous = evaluateDirectionCoverage(hints.previousMessages, myPublicKeyHex);
  const supplemental = evaluateDirectionCoverage(hints.supplementalMessages, myPublicKeyHex);
  if (current.incoming > 0 && current.outgoing === 0) {
    if (previous.outgoing > 0 || supplemental.outgoing > 0) {
      return true;
    }
    return requiresSqlitePersistence();
  }
  if (current.outgoing > 0 && current.incoming === 0) {
    return previous.incoming > 0 || supplemental.incoming > 0;
  }
  return false;
};

const mergeMissingDirectionFromSupplemental = (params: Readonly<{
  baseMessages: ReadonlyArray<Message>;
  supplementalMessages: ReadonlyArray<Message>;
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex | null;
}>): ReadonlyArray<Message> => {
  const baseCoverage = evaluateDirectionCoverage(params.baseMessages, params.myPublicKeyHex);
  if (!baseCoverage.isPartial || params.supplementalMessages.length === 0) {
    return params.baseMessages;
  }
  const scope = new Set(
    params.conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  return [...mergeHydratedBaseWithLiveOverlayMessages(
    params.baseMessages,
    params.supplementalMessages,
    scope,
  )].sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
};

/** Re-apply rows from prior paint / supplemental layers when hydrate would drop a direction. */
export const reconcileDirectionCoverage = (params: Readonly<{
  hydratedMessages: ReadonlyArray<Message>;
  previousMessages: ReadonlyArray<Message>;
  supplementalMessages?: ReadonlyArray<Message>;
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex | null;
}>): Readonly<{ messages: ReadonlyArray<Message>; preserved: boolean }> => {
  const { hydratedMessages, previousMessages, conversationIds, myPublicKeyHex } = params;
  const supplementalMessages = params.supplementalMessages ?? [];

  if (!myPublicKeyHex) {
    return { messages: hydratedMessages, preserved: false };
  }

  const mergeSources = (base: ReadonlyArray<Message>, overlay: ReadonlyArray<Message>): ReadonlyArray<Message> => (
    mergeHydratedWithOverlay(base, overlay, conversationIds)
  );

  let messages = hydratedMessages;
  let preserved = false;

  if (previousMessages.length > 0) {
    const nextCoverage = evaluateDirectionCoverage(messages, myPublicKeyHex);
    const previousCoverage = evaluateDirectionCoverage(previousMessages, myPublicKeyHex);
    const dropsOutgoing = previousCoverage.outgoing > 0 && nextCoverage.outgoing === 0;
    const dropsIncoming = previousCoverage.incoming > 0 && nextCoverage.incoming === 0;
    if (dropsOutgoing || dropsIncoming) {
      messages = mergeSources(messages, previousMessages);
      preserved = true;
    }
  }

  const afterPrevious = evaluateDirectionCoverage(messages, myPublicKeyHex);
  if (afterPrevious.isPartial && supplementalMessages.length > 0) {
    const withSupplemental = mergeMissingDirectionFromSupplemental({
      baseMessages: messages,
      supplementalMessages,
      conversationIds,
      myPublicKeyHex,
    });
    if (withSupplemental.length !== messages.length
      || !messages.every((entry, index) => withSupplemental[index]?.id === entry.id)) {
      messages = withSupplemental;
      preserved = true;
    } else {
      const supplementalCoverage = evaluateDirectionCoverage(withSupplemental, myPublicKeyHex);
      if (!supplementalCoverage.isPartial && afterPrevious.isPartial) {
        messages = withSupplemental;
        preserved = true;
      }
    }
  }

  return { messages, preserved };
};

/**
 * Re-hydrate must not shrink the loaded scroll depth — union older in-memory rows
 * when SQLite hydrate returns a smaller capped window.
 */
export const reconcileMonotonicLoadedDepth = (params: Readonly<{
  hydratedMessages: ReadonlyArray<Message>;
  previousMessages: ReadonlyArray<Message>;
  conversationIds: ReadonlyArray<string>;
}>): Readonly<{ messages: ReadonlyArray<Message>; preserved: boolean }> => {
  if (params.previousMessages.length <= params.hydratedMessages.length) {
    return { messages: params.hydratedMessages, preserved: false };
  }
  const scope = new Set(
    params.conversationIds.map((id) => id.trim()).filter((id) => id.length > 0),
  );
  const merged = mergeHydratedWithOverlay(
    params.hydratedMessages,
    params.previousMessages,
    Array.from(scope),
  );
  const preserved = merged.length > params.hydratedMessages.length;
  return { messages: merged, preserved };
};

export const resolveExpandedHistoryAfterHydrate = (params: Readonly<{
  previousExpandedHistory: boolean;
  previousMessageCount: number;
  hydratedMessageCount: number;
  liveWindowSoftLimit?: number;
}>): boolean => {
  const limit = params.liveWindowSoftLimit ?? DM_THREAD_LIVE_WINDOW_SOFT_LIMIT;
  return (
    params.previousExpandedHistory
    || params.previousMessageCount > limit
    || params.hydratedMessageCount > limit
  );
};

/** Union chat-state / repair rows when hydrate authority dropped a message direction. */
export const mergeDirectionGapFromSupplemental = (params: Readonly<{
  baseMessages: ReadonlyArray<Message>;
  supplementalMessages: ReadonlyArray<Message>;
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex | null;
}>): ReadonlyArray<Message> => (
  reconcileDirectionCoverage({
    hydratedMessages: params.baseMessages,
    previousMessages: [],
    supplementalMessages: params.supplementalMessages,
    conversationIds: params.conversationIds,
    myPublicKeyHex: params.myPublicKeyHex,
  }).messages
);

export type ResolveInitialConversationPaintParams = Readonly<{
  displayCache: ReadonlyArray<Message>;
  syncSeed: ReadonlyArray<Message>;
  myPublicKeyHex: PublicKeyHex | null;
}>;

export type ResolveInitialConversationPaintResult = Readonly<{
  messages: ReadonlyArray<Message>;
  shouldPaint: boolean;
  source: "none" | "display_cache" | "sync_seed" | "merged_seed";
}>;

/**
 * Native: refuse one-sided display cache as first paint (root cause of "only peer messages until refresh").
 * Web: chat-state sync seed may still paint immediately when cache is empty.
 */
export const resolveInitialConversationPaint = (
  params: ResolveInitialConversationPaintParams,
): ResolveInitialConversationPaintResult => {
  const { displayCache, syncSeed, myPublicKeyHex } = params;
  if (isNativeDmSqliteReadOwner()) {
    return { messages: [], shouldPaint: false, source: "none" };
  }
  const nativePersistence = requiresSqlitePersistence();

  const cacheUsable = displayCache.length > 0
    && (!nativePersistence || !hasPartialDirectionCoverage(displayCache, myPublicKeyHex));
  if (cacheUsable) {
    return { messages: displayCache, shouldPaint: true, source: "display_cache" };
  }

  if (syncSeed.length > 0) {
    const seedUsable = !nativePersistence || !hasPartialDirectionCoverage(syncSeed, myPublicKeyHex);
    if (seedUsable) {
      return { messages: syncSeed, shouldPaint: true, source: "sync_seed" };
    }
    if (displayCache.length > 0) {
      const merged = mergeHydratedWithOverlay(
        displayCache,
        syncSeed,
        Array.from(new Set([
          ...displayCache.map((m) => m.conversationId?.trim()).filter(Boolean) as string[],
          ...syncSeed.map((m) => m.conversationId?.trim()).filter(Boolean) as string[],
        ])),
      );
      if (!hasPartialDirectionCoverage(merged, myPublicKeyHex)) {
        return { messages: merged, shouldPaint: true, source: "merged_seed" };
      }
    }
  }

  return { messages: [], shouldPaint: false, source: "none" };
};

export type FinalizeDmThreadHydrateReadParams = Readonly<{
  assembledMessages: ReadonlyArray<Message>;
  previousMessages: ReadonlyArray<Message>;
  supplementalMessages?: ReadonlyArray<Message>;
  conversationIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex | null;
  directionCoverageAttempt: number;
  maxDirectionCoverageAttempts: number;
}>;

export type FinalizeDmThreadHydrateReadResult = Readonly<{
  messages: ReadonlyArray<Message>;
  directionCoverage: DmThreadDirectionCoverage;
  directionCoveragePreserved: boolean;
  loadedDepthPreserved: boolean;
  reconcilePolicy: DmThreadHydrateReconcilePolicy;
}>;

export const finalizeDmThreadHydrateRead = (
  params: FinalizeDmThreadHydrateReadParams,
): FinalizeDmThreadHydrateReadResult => {
  if (isNativeDmSqliteReadOwner()) {
    const depthReconciled = reconcileMonotonicLoadedDepth({
      hydratedMessages: params.assembledMessages,
      previousMessages: params.previousMessages,
      conversationIds: params.conversationIds,
    });
    const directionCoverage = evaluateDirectionCoverage(
      depthReconciled.messages,
      params.myPublicKeyHex,
    );
    return {
      messages: depthReconciled.messages,
      directionCoverage,
      directionCoveragePreserved: false,
      loadedDepthPreserved: depthReconciled.preserved,
      reconcilePolicy: {
        shouldRetryHydrate: false,
        forceIndexedAuthority: false,
        attempt: params.directionCoverageAttempt,
        maxAttempts: params.maxDirectionCoverageAttempts,
      },
    };
  }

  const reconciled = reconcileDirectionCoverage({
    hydratedMessages: params.assembledMessages,
    previousMessages: params.previousMessages,
    supplementalMessages: params.supplementalMessages,
    conversationIds: params.conversationIds,
    myPublicKeyHex: params.myPublicKeyHex,
  });
  const supplementalMessages = params.supplementalMessages ?? [];
  const depthReconciled = reconcileMonotonicLoadedDepth({
    hydratedMessages: reconciled.messages,
    previousMessages: params.previousMessages,
    conversationIds: params.conversationIds,
  });
  let finalMessages = depthReconciled.messages;
  let directionShrinkGuardPreserved = false;
  if (requiresSqlitePersistence() && params.myPublicKeyHex) {
    const previousCoverage = evaluateDirectionCoverage(params.previousMessages, params.myPublicKeyHex);
    const nextCoverage = evaluateDirectionCoverage(finalMessages, params.myPublicKeyHex);
    if (
      params.previousMessages.length > 0
      && previousCoverage.incoming > 0
      && previousCoverage.outgoing > 0
      && nextCoverage.isPartial
    ) {
      finalMessages = params.previousMessages;
      directionShrinkGuardPreserved = true;
    }
  }
  const shouldRetryHydrate = shouldReconcilePartialDirectionCoverage(
    finalMessages,
    params.myPublicKeyHex,
    {
      previousMessages: params.previousMessages,
      supplementalMessages,
    },
  ) && params.directionCoverageAttempt < params.maxDirectionCoverageAttempts;
  return {
    messages: finalMessages,
    directionCoverage: evaluateDirectionCoverage(finalMessages, params.myPublicKeyHex),
    directionCoveragePreserved: reconciled.preserved || directionShrinkGuardPreserved,
    loadedDepthPreserved: depthReconciled.preserved,
    reconcilePolicy: {
      shouldRetryHydrate,
      forceIndexedAuthority: shouldRetryHydrate && requiresSqlitePersistence(),
      attempt: params.directionCoverageAttempt,
      maxAttempts: params.maxDirectionCoverageAttempts,
    },
  };
};

export const evaluateProjectionMergePolicy = (params: Readonly<{
  projectionMessages: ReadonlyArray<Message>;
  previousMessages: ReadonlyArray<Message>;
  myPublicKeyHex: PublicKeyHex | null;
  suppressUntilHydrate: boolean;
}>): DmThreadProjectionMergePolicy => {
  if (isNativeDmSqliteReadOwner()) {
    return { shouldMerge: false, wouldDropDirectionCoverage: false };
  }
  if (params.suppressUntilHydrate) {
    return { shouldMerge: false, wouldDropDirectionCoverage: false };
  }
  if (params.projectionMessages.length === 0) {
    return { shouldMerge: false, wouldDropDirectionCoverage: false };
  }
  if (
    requiresSqlitePersistence()
    && params.myPublicKeyHex
    && hasPartialDirectionCoverage(params.previousMessages, params.myPublicKeyHex)
  ) {
    return { shouldMerge: false, wouldDropDirectionCoverage: false };
  }
  if (params.previousMessages.length > 0 && params.myPublicKeyHex) {
    const projectionCoverage = evaluateDirectionCoverage(params.projectionMessages, params.myPublicKeyHex);
    const previousCoverage = evaluateDirectionCoverage(params.previousMessages, params.myPublicKeyHex);
    const wouldDropDirectionCoverage = (
      (projectionCoverage.outgoing === 0 && previousCoverage.outgoing > 0)
      || (projectionCoverage.incoming === 0 && previousCoverage.incoming > 0)
    );
    if (wouldDropDirectionCoverage) {
      return { shouldMerge: false, wouldDropDirectionCoverage: true };
    }
  }
  return { shouldMerge: true, wouldDropDirectionCoverage: false };
};

export const shouldPersistDmThreadDisplayCache = (
  messages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
): boolean => {
  if (isNativeDmSqliteReadOwner()) {
    return false;
  }
  if (messages.length === 0) {
    return false;
  }
  if (!requiresSqlitePersistence()) {
    return true;
  }
  return !hasPartialDirectionCoverage(messages, myPublicKeyHex);
};

export const resolveDisplayMessagesWithCacheFallback = (params: Readonly<{
  messages: ReadonlyArray<Message>;
  displayCache: ReadonlyArray<Message> | null;
  myPublicKeyHex: PublicKeyHex | null;
}>): ReadonlyArray<Message> => {
  if (isNativeDmSqliteReadOwner()) {
    return params.messages;
  }
  const cache = params.displayCache ?? [];
  if (params.messages.length > 0 && params.myPublicKeyHex) {
    const partialCurrent = hasPartialDirectionCoverage(params.messages, params.myPublicKeyHex);
    if (
      partialCurrent
      && cache.length > params.messages.length
    ) {
      const paint = resolveInitialConversationPaint({
        displayCache: cache,
        syncSeed: [],
        myPublicKeyHex: params.myPublicKeyHex,
      });
      if (
        paint.shouldPaint
        && !hasPartialDirectionCoverage(paint.messages, params.myPublicKeyHex)
      ) {
        return paint.messages;
      }
    }
    return params.messages;
  }
  if (cache.length === 0) {
    return params.messages;
  }
  const paint = resolveInitialConversationPaint({
    displayCache: cache,
    syncSeed: [],
    myPublicKeyHex: params.myPublicKeyHex,
  });
  return paint.shouldPaint ? paint.messages : params.messages;
};

export const buildHydrateSupplementalMessages = (
  assembledMessages: ReadonlyArray<Message>,
  myPublicKeyHex: PublicKeyHex | null,
  projectionEvidenceMessages: ReadonlyArray<Message>,
  projectionMessages: ReadonlyArray<Message> = [],
  persistedFallbackMessages: ReadonlyArray<Message> = [],
): ReadonlyArray<Message> => {
  if (isNativeDmSqliteReadOwner()) {
    return [];
  }
  if (!hasPartialDirectionCoverage(assembledMessages, myPublicKeyHex)) {
    return [];
  }
  return dedupeMessagesByIdentity([
    ...projectionEvidenceMessages,
    ...projectionMessages,
    ...persistedFallbackMessages,
  ]);
};

export const evaluateStaleEmptyHydrateRetryPolicy = (params: Readonly<{
  messageCount: number;
  isLoading: boolean;
  projectionHasMessages: boolean;
  useProjectionReads: boolean;
  attempt: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}>): Readonly<{ shouldSchedule: boolean; delayMs: number }> => {
  const maxAttempts = params.maxAttempts ?? DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS;
  const baseDelayMs = params.baseDelayMs ?? DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS;
  if (params.isLoading || params.messageCount > 0) {
    return { shouldSchedule: false, delayMs: 0 };
  }
  if (params.useProjectionReads && params.projectionHasMessages) {
    return { shouldSchedule: false, delayMs: 0 };
  }
  if (params.attempt >= maxAttempts) {
    return { shouldSchedule: false, delayMs: 0 };
  }
  return {
    shouldSchedule: true,
    delayMs: baseDelayMs * (params.attempt + 1),
  };
};

export const evaluatePartialThreadRetryPolicy = (params: Readonly<{
  messages: ReadonlyArray<Message>;
  myPublicKeyHex: PublicKeyHex | null;
  isLoading: boolean;
  attempt: number;
  maxAttempts?: number;
}>): Readonly<{ shouldRetry: boolean; forceIndexedAuthority: boolean }> => {
  const maxAttempts = params.maxAttempts ?? DM_THREAD_PARTIAL_DIRECTION_HYDRATE_MAX_ATTEMPTS;
  if (params.isLoading || params.attempt >= maxAttempts) {
    return { shouldRetry: false, forceIndexedAuthority: false };
  }
  if (params.messages.length === 0) {
    return { shouldRetry: false, forceIndexedAuthority: false };
  }
  if (!hasPartialDirectionCoverage(params.messages, params.myPublicKeyHex)) {
    return { shouldRetry: false, forceIndexedAuthority: false };
  }
  return {
    shouldRetry: true,
    forceIndexedAuthority: requiresSqlitePersistence(),
  };
};

/** Schedules backoff re-hydrate when a thread paints one direction before sqlite catches up. */
export const evaluatePartialDirectionHydrateRetryPolicy = (params: Readonly<{
  messages: ReadonlyArray<Message>;
  myPublicKeyHex: PublicKeyHex | null;
  isLoading: boolean;
  attempt: number;
  maxAttempts?: number;
  baseDelayMs?: number;
}>): Readonly<{ shouldSchedule: boolean; delayMs: number; forceIndexedAuthority: boolean }> => {
  const maxAttempts = params.maxAttempts ?? DM_THREAD_PARTIAL_DIRECTION_HYDRATE_MAX_ATTEMPTS;
  const baseDelayMs = params.baseDelayMs ?? DM_THREAD_PARTIAL_DIRECTION_HYDRATE_BASE_DELAY_MS;
  if (isNativeDmSqliteReadOwner()) {
    return { shouldSchedule: false, delayMs: 0, forceIndexedAuthority: false };
  }
  if (params.isLoading || !params.myPublicKeyHex) {
    return { shouldSchedule: false, delayMs: 0, forceIndexedAuthority: false };
  }
  if (!hasPartialDirectionCoverage(params.messages, params.myPublicKeyHex)) {
    return { shouldSchedule: false, delayMs: 0, forceIndexedAuthority: false };
  }
  if (params.attempt >= maxAttempts) {
    return { shouldSchedule: false, delayMs: 0, forceIndexedAuthority: false };
  }
  return {
    shouldSchedule: true,
    delayMs: baseDelayMs * (params.attempt + 1),
    forceIndexedAuthority: requiresSqlitePersistence(),
  };
};
