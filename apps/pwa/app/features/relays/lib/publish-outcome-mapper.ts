import type {
  CoreResult,
  DeliveryReasonCode,
  PublishOutcome,
  QuorumPublishReport,
} from "@dweb/core/security-foundation-contracts";

type RelayResultLike = Readonly<{
  relayUrl: string;
  success: boolean;
  error?: string;
  latency?: number;
}>;

type LegacyPublishResultLike = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: ReadonlyArray<RelayResultLike>;
  failures?: ReadonlyArray<RelayResultLike>;
  overallError?: string;
}>;

export type RelayPublishResult = Readonly<{
  status: "ok" | "partial" | "queued" | "failed";
  reasonCode?: DeliveryReasonCode;
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum: boolean;
  quorumRequired: number;
  results: Array<RelayResultLike>;
  failures: Array<RelayResultLike>;
  overallError?: string;
}>;

const dedupeRelayUrls = (relayUrls: ReadonlyArray<string>): Array<string> =>
  Array.from(new Set(relayUrls.map((url) => url.trim()).filter((url) => url.length > 0)));

export const mapProtocolPublishReportToRelayPublishResult = (
  report: QuorumPublishReport,
  relayUrls: ReadonlyArray<string>
): RelayPublishResult => {
  const uniqueRelayUrls = dedupeRelayUrls(relayUrls);
  const failureByRelay = new Map(
    report.failures.map((entry) => [entry.relayUrl, entry.error || "Publish failed"])
  );
  const results = uniqueRelayUrls.map((relayUrl) => {
    const failureError = failureByRelay.get(relayUrl);
    return {
      relayUrl,
      success: !failureError,
      error: failureError,
    };
  });
  const failures = results.filter((entry) => !entry.success);
  const quorumRequired = Math.max(1, Math.ceil(report.totalRelays / 2));
  const metQuorum = report.metQuorum;

  return {
    status: metQuorum ? (failures.length > 0 ? "partial" : "ok") : (report.successCount > 0 ? "partial" : "failed"),
    reasonCode: metQuorum ? (failures.length > 0 ? "relay_degraded" : undefined) : "quorum_not_met",
    success: metQuorum,
    successCount: report.successCount,
    totalRelays: report.totalRelays,
    metQuorum,
    quorumRequired,
    results,
    failures,
    overallError: metQuorum
      ? undefined
      : `Protocol quorum not met (${report.successCount}/${report.totalRelays})`,
  };
};

export const mapCoreResultToRelayPublishResult = (
  coreResult: CoreResult<PublishOutcome>,
  relayUrls: ReadonlyArray<string>
): RelayPublishResult | null => {
  if (coreResult.status === "unsupported") {
    return null;
  }

  const scopedRelayUrls = dedupeRelayUrls(relayUrls);

  if (!coreResult.value) {
    const fallbackTotal = scopedRelayUrls.length;
    const quorumRequired = Math.max(1, Math.ceil(Math.max(1, fallbackTotal) / 2));
    const results = scopedRelayUrls.map((relayUrl) => ({
      relayUrl,
      success: false,
      error: coreResult.message,
    }));
    return {
      status: coreResult.status,
      reasonCode: coreResult.reasonCode,
      success: false,
      successCount: 0,
      totalRelays: fallbackTotal,
      metQuorum: false,
      quorumRequired,
      results,
      failures: [...results],
      overallError: coreResult.message || "Relay publish did not produce an outcome.",
    };
  }

  const outcome = coreResult.value;
  const failureByRelay = new Map(
    outcome.failures.map((failure) => [failure.relayUrl, failure.error || "Publish failed"])
  );
  const knownRelayUrls = scopedRelayUrls.length > 0
    ? scopedRelayUrls
    : Array.from(new Set(outcome.failures.map((failure) => failure.relayUrl)));
  const results = knownRelayUrls.map((relayUrl) => {
    const failureError = failureByRelay.get(relayUrl);
    return {
      relayUrl,
      success: !failureError,
      error: failureError,
    };
  });
  const failures = results.filter((entry) => !entry.success);
  const totalRelays = outcome.totalRelays || knownRelayUrls.length;
  const quorumRequired = outcome.quorumRequired || Math.max(1, Math.ceil(Math.max(1, totalRelays) / 2));
  const metQuorum = outcome.metQuorum || outcome.successCount >= quorumRequired;
  const success = coreResult.status === "ok" || (coreResult.status === "partial" && metQuorum);
  const overallError = coreResult.status === "ok"
    ? undefined
    : (coreResult.message || (metQuorum ? undefined : `Quorum not met (${outcome.successCount}/${totalRelays}).`));

  return {
    status: coreResult.status,
    reasonCode: coreResult.reasonCode,
    success,
    successCount: outcome.successCount,
    totalRelays,
    metQuorum,
    quorumRequired,
    results,
    failures,
    overallError,
  };
};

export const mapLegacyPublishResultToRelayPublishResult = (
  result: LegacyPublishResultLike
): RelayPublishResult => {
  const failures = (result.failures ?? result.results.filter((entry) => !entry.success)).map((entry) => ({
    relayUrl: entry.relayUrl,
    success: false,
    error: entry.error,
    latency: entry.latency,
  }));
  const quorumRequired = result.quorumRequired ?? Math.max(1, Math.ceil(Math.max(1, result.totalRelays) / 2));
  const metQuorum = result.metQuorum ?? result.successCount >= quorumRequired;
  const status = metQuorum ? (failures.length > 0 ? "partial" : "ok") : (result.successCount > 0 ? "partial" : "failed");

  return {
    status,
    reasonCode: status === "failed" ? "quorum_not_met" : (status === "partial" ? "relay_degraded" : undefined),
    success: metQuorum,
    successCount: result.successCount,
    totalRelays: result.totalRelays,
    metQuorum,
    quorumRequired,
    results: result.results.map((entry) => ({ ...entry })),
    failures,
    overallError: result.overallError,
  };
};
