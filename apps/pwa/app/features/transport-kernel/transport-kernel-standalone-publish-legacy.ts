"use client";

import type { MultiRelayPublishResult, PublishResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";
import { relayNativeAdapter } from "@/app/features/relays/hooks/relay-native-adapter";
import { mapLegacyPublishResultToRelayPublishResult } from "@/app/features/relays/lib/publish-outcome-mapper";

const normalizeRelayUrl = (url: string): string | null => {
  const normalized = url.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeRelayUrls = (urls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(urls.map(normalizeRelayUrl).filter((value): value is string => !!value)))
);

export const publishTransportKernelToRelay = async (url: string, payload: string): Promise<PublishResult> => {
  const normalized = normalizeRelayUrl(url);
  if (!normalized) {
    return { success: false, relayUrl: url, error: "Empty relay URL." };
  }

  try {
    await relayNativeAdapter.sendRelayMessage(normalized, payload);
    return { success: true, relayUrl: normalized };
  } catch (error) {
    return {
      success: false,
      relayUrl: normalized,
      error: error instanceof Error ? error.message : "Native relay publish failed",
    };
  }
};

export const publishTransportKernelToRelayUrls = async (
  urls: ReadonlyArray<string>,
  payload: string,
): Promise<MultiRelayPublishResult> => {
  const normalized = normalizeRelayUrls(urls);
  const results = await Promise.all(normalized.map((relayUrl) => publishTransportKernelToRelay(relayUrl, payload)));
  const mapped = mapLegacyPublishResultToRelayPublishResult({
    success: results.some((result) => result.success),
    successCount: results.filter((result) => result.success).length,
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
    overallError: mapped.overallError,
  };
};
