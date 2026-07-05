import type { TransportPublishRelayEventResult } from "@obscur/engine-contracts";
import type { MultiRelayPublishResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";
import { mapLegacyPublishResultToRelayPublishResult, type RelayPublishResult } from "@/app/features/relays/lib/publish-outcome-mapper";

export type RelayAttemptFixture = Readonly<{
  relayUrl: string;
  success: boolean;
  error?: string;
}>;

/** Mirrors libobscur `transport_publish_quorum_required` / shared mapper quorum rule. */
export const transportPublishQuorumRequired = (totalRelays: number): number => (
  Math.max(1, Math.ceil(Math.max(1, totalRelays) / 2))
);

/** Builds host network-shaped publish results from per-relay attempt fixtures. */
export const buildHostNetworkPublishResultFromAttempts = (
  attempts: ReadonlyArray<RelayAttemptFixture>,
): TransportPublishRelayEventResult => {
  const totalRelays = attempts.length;
  const quorumRequired = transportPublishQuorumRequired(totalRelays);
  const successCount = attempts.filter((attempt) => attempt.success).length;
  const metQuorum = successCount >= quorumRequired;
  const results = attempts.map((attempt) => ({
    relayUrl: attempt.relayUrl,
    success: attempt.success,
    error: attempt.error,
  }));
  const failures = results.filter((entry) => !entry.success);

  return {
    success: metQuorum,
    successCount,
    totalRelays,
    quorumRequired,
    metQuorum,
    results,
    failures,
    overallError: metQuorum
      ? undefined
      : `Quorum not met (${successCount}/${totalRelays}).`,
  };
};

export const mapStandaloneAttemptsToMultiRelay = (
  attempts: ReadonlyArray<RelayAttemptFixture>,
): MultiRelayPublishResult => {
  const results = attempts.map((attempt) => ({
    relayUrl: attempt.relayUrl,
    success: attempt.success,
    error: attempt.error,
  }));
  const mapped = mapLegacyPublishResultToRelayPublishResult({
    success: results.some((entry) => entry.success),
    successCount: results.filter((entry) => entry.success).length,
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

export const mapHostNetworkResultToMultiRelay = (
  hostResult: TransportPublishRelayEventResult,
): MultiRelayPublishResult => {
  const mapped = mapLegacyPublishResultToRelayPublishResult({
    success: hostResult.success,
    successCount: hostResult.successCount,
    totalRelays: hostResult.totalRelays,
    metQuorum: hostResult.metQuorum,
    quorumRequired: hostResult.quorumRequired,
    results: hostResult.results,
    failures: hostResult.failures,
    overallError: hostResult.overallError,
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

export const mapMultiRelayToRelayPublishResult = (
  result: MultiRelayPublishResult,
): RelayPublishResult => mapLegacyPublishResultToRelayPublishResult({
  success: result.success,
  successCount: result.successCount,
  totalRelays: result.totalRelays,
  metQuorum: result.metQuorum,
  quorumRequired: result.quorumRequired,
  results: result.results,
  failures: result.failures,
  overallError: result.overallError,
});

export const assertNetworkPublishParity = (
  standalone: MultiRelayPublishResult,
  host: MultiRelayPublishResult,
): void => {
  const standaloneMapped = mapMultiRelayToRelayPublishResult(standalone);
  const hostMapped = mapMultiRelayToRelayPublishResult(host);

  const assertEq = (label: string, left: unknown, right: unknown): void => {
    if (left !== right) {
      throw new Error(`network publish parity mismatch (${label}): ${String(left)} !== ${String(right)}`);
    }
  };

  const normalizeRelayResult = (
    entry: Readonly<{ relayUrl: string; success: boolean; error?: string; latency?: number }>,
  ): { relayUrl: string; success: boolean; error?: string; latency?: number } => ({
    relayUrl: entry.relayUrl,
    success: entry.success,
    ...(entry.error !== undefined ? { error: entry.error } : {}),
    ...(entry.latency !== undefined ? { latency: entry.latency } : {}),
  });

  const normalizeResults = (
    results: ReadonlyArray<{ relayUrl: string; success: boolean; error?: string; latency?: number }>,
  ): Array<{ relayUrl: string; success: boolean; error?: string; latency?: number }> => (
    results.map(normalizeRelayResult)
  );

  assertEq("quorumRequired", standalone.quorumRequired, host.quorumRequired);
  assertEq("metQuorum", standalone.metQuorum, host.metQuorum);
  assertEq("success", standalone.success, host.success);
  assertEq("successCount", standalone.successCount, host.successCount);
  assertEq("totalRelays", standalone.totalRelays, host.totalRelays);
  if (JSON.stringify(normalizeResults(standalone.results)) !== JSON.stringify(normalizeResults(host.results))) {
    throw new Error("network publish parity mismatch (results)");
  }
  if (JSON.stringify(normalizeResults(standalone.failures)) !== JSON.stringify(normalizeResults(host.failures))) {
    throw new Error("network publish parity mismatch (failures)");
  }
  assertEq("mapped.status", standaloneMapped.status, hostMapped.status);
  assertEq("mapped.reasonCode", standaloneMapped.reasonCode, hostMapped.reasonCode);
};
