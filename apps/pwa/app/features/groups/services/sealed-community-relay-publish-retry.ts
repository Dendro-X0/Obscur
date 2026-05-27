import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { hasWritableCommunityRelayTransport } from "./community-relay-transport";
import {
  toScopedRelayUrl,
  type SealedCommunityMultiRelayPublishResult,
  type SealedCommunityNostrPool,
} from "./sealed-community-relay-scope";

export const sealedCommunityPublishBackoffMs = (ms: number): Promise<void> => (
  new Promise((resolve) => setTimeout(resolve, ms))
);

export const publishSealedEventToCommunityScopeWithRetry = async (params: Readonly<{
  publishToScope: (event: NostrEvent) => Promise<SealedCommunityMultiRelayPublishResult>;
  pool: SealedCommunityNostrPool;
  relayUrl: string;
  event: NostrEvent;
  operation: string;
  maxAttempts?: number;
  baseBackoffMs?: number;
  allowGlobalFallback?: boolean;
  onRecoveredAfterRetry?: () => void;
  onGlobalFallbackUsed?: () => void;
  onRetriesExhausted?: () => void;
}>): Promise<SealedCommunityMultiRelayPublishResult> => {
  const maxAttempts = Math.max(1, params.maxAttempts ?? 3);
  const baseBackoffMs = Math.max(50, params.baseBackoffMs ?? 200);
  const payload = JSON.stringify(["EVENT", params.event]);
  let lastResult: SealedCommunityMultiRelayPublishResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await params.publishToScope(params.event);
    if (result.success) {
      if (attempt > 1) {
        params.onRecoveredAfterRetry?.();
      }
      return result;
    }
    lastResult = result;
    if (attempt < maxAttempts) {
      await sealedCommunityPublishBackoffMs(baseBackoffMs * attempt);
    }
  }

  if (
    params.allowGlobalFallback
    && hasWritableCommunityRelayTransport(params.relayUrl)
    && toScopedRelayUrl(params.relayUrl)
  ) {
    const fallbackResult = await params.pool.publishToAll(payload);
    if (fallbackResult.success) {
      params.onGlobalFallbackUsed?.();
      return fallbackResult;
    }
    lastResult = fallbackResult;
  }

  params.onRetriesExhausted?.();

  return lastResult ?? {
    success: false,
    successCount: 0,
    totalRelays: 0,
    results: [],
    overallError: `${params.operation} failed`,
  };
};
