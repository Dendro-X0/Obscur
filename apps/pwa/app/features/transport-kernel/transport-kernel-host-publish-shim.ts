"use client";

import type { MultiRelayPublishResult, PublishResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";
import { mapLegacyPublishResultToRelayPublishResult } from "@/app/features/relays/lib/publish-outcome-mapper";
import { publishRelayEventViaTransportEngineHost } from "./transport-engine-host-port";

const HOST_SHIM_PROFILE_ID = "default";

const mapHostFailureToMultiRelayResult = (
  relayUrls: ReadonlyArray<string>,
  errorMessage: string,
): MultiRelayPublishResult => {
  const results = relayUrls.map((relayUrl) => ({
    relayUrl,
    success: false,
    error: errorMessage,
  }));
  const mapped = mapLegacyPublishResultToRelayPublishResult({
    success: false,
    successCount: 0,
    totalRelays: relayUrls.length,
    results,
    failures: results,
    overallError: errorMessage,
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

export const publishHostTransportShimToRelay = async (
  url: string,
  payload: string,
): Promise<PublishResult> => {
  const multi = await publishHostTransportShimToRelayUrls([url], payload);
  const result = multi.results.find((entry) => entry.relayUrl === url.trim())
    ?? multi.results[0]
    ?? { success: false, relayUrl: url, error: multi.overallError ?? "Host publish shim failed." };
  return result;
};

export const publishHostTransportShimToRelayUrls = async (
  urls: ReadonlyArray<string>,
  payload: string,
): Promise<MultiRelayPublishResult> => {
  const hostResult = await publishRelayEventViaTransportEngineHost({
    profileId: HOST_SHIM_PROFILE_ID,
    payload: { relayUrls: urls, payload },
  });

  if (!hostResult.ok) {
    return mapHostFailureToMultiRelayResult(urls, hostResult.errorMessage);
  }

  const mapped = mapLegacyPublishResultToRelayPublishResult({
    success: hostResult.data.success,
    successCount: hostResult.data.successCount,
    totalRelays: hostResult.data.totalRelays,
    metQuorum: hostResult.data.metQuorum,
    quorumRequired: hostResult.data.quorumRequired,
    results: hostResult.data.results,
    failures: hostResult.data.failures,
    overallError: hostResult.data.overallError,
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
