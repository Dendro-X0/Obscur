"use client";

import type { MultiRelayPublishResult, PublishResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";
import { mapLegacyPublishResultToRelayPublishResult } from "@/app/features/relays/lib/publish-outcome-mapper";

export const STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE = (
  "Standalone legacy publish is blocked. Enable host transport publish authority or shim."
);

const normalizeRelayUrl = (url: string): string | null => {
  const normalized = url.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map(normalizeRelayUrl).filter((value): value is string => !!value)))
);

export const publishStandaloneLegacyBlockedToRelay = async (
  url: string,
  _payload: string,
): Promise<PublishResult> => {
  const normalized = normalizeRelayUrl(url);
  if (!normalized) {
    return { success: false, relayUrl: url, error: "Empty relay URL." };
  }

  return {
    success: false,
    relayUrl: normalized,
    error: STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE,
  };
};

export const publishStandaloneLegacyBlockedToRelayUrls = async (
  urls: ReadonlyArray<string>,
  _payload: string,
): Promise<MultiRelayPublishResult> => {
  const normalized = normalizeRelayUrls(urls);
  const results = normalized.map((relayUrl) => ({
    success: false,
    relayUrl,
    error: STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE,
  }));

  const mapped = mapLegacyPublishResultToRelayPublishResult({
    success: false,
    successCount: 0,
    totalRelays: results.length,
    results,
  });

  return {
    success: mapped.success,
    successCount: mapped.successCount,
    totalRelays: mapped.totalRelays,
    quorumRequired: mapped.quorumRequired,
    metQuorum: mapped.metQuorum,
    results: mapped.results,
    failures: mapped.failures,
    overallError: mapped.overallError ?? STANDALONE_LEGACY_PUBLISH_BLOCKED_MESSAGE,
  };
};
