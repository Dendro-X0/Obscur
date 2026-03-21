import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import {
  MAX_OUTGOING_QUEUE_RETRY_ATTEMPTS,
  type IMessageQueue,
  type Message,
  type OutgoingMessage
} from "../lib/message-queue";
import { retryManager } from "../lib/retry-manager";
import { buildDmEvent, type DmEventBuildResult } from "./dm-event-builder";
import { countRelayFailures } from "./relay-utils";
import { logAppEvent } from "@/app/shared/log-app-event";
import { transitionMessageStatus } from "../state-machines/message-delivery-machine";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { publishViaRelayCore } from "@/app/features/relays/lib/nostr-core-relay";
import type { DeliveryReasonCode, RelayCircuitState } from "@dweb/core/security-foundation-contracts";
import {
  mapCoreResultToRelayPublishResult,
  mapLegacyPublishResultToRelayPublishResult,
  mapProtocolPublishReportToRelayPublishResult,
  type RelayPublishResult,
} from "@/app/features/relays/lib/publish-outcome-mapper";
import type { QueueSendAttemptResult } from "../lib/offline-queue-manager";

type MultiRelayPublishResult = Readonly<{
  success: boolean;
  status?: "ok" | "partial" | "queued" | "failed";
  reasonCode?: DeliveryReasonCode;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  failures?: Array<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>;
  overallError?: string;
}>;

type RelayPoolLike = Readonly<{
  sendToOpen: (payload: string) => void;
  connections?: ReadonlyArray<Readonly<{ url: string; status: string }>>;
  waitForConnection?: (timeoutMs: number) => Promise<boolean>;
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  getRelayCircuitState?: (url: string) => RelayCircuitState;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResult>;
}>;

type RelayLike = Readonly<{ url: string }>;
export const MIN_QUEUE_RETRY_DELAY_MS = 2_500;

const dedupeRelayUrls = (relayUrls: ReadonlyArray<string>): Array<string> => (
  Array.from(new Set(
    relayUrls
      .map((relayUrl) => relayUrl.trim())
      .filter((relayUrl) => relayUrl.length > 0)
  ))
);

const collectSuccessfulRelayUrls = (results: ReadonlyArray<Readonly<{
  relayUrl: string;
  success: boolean;
}>>): Array<string> => (
  dedupeRelayUrls(results.filter((entry) => entry.success).map((entry) => entry.relayUrl))
);

const normalizeQueuedRetryAt = (candidate: Date, nowUnixMs: number = Date.now()): Date => {
  const minRetryAt = nowUnixMs + MIN_QUEUE_RETRY_DELAY_MS;
  if (candidate.getTime() < minRetryAt) {
    return new Date(minRetryAt);
  }
  return candidate;
};

const canUseRelayCorePublisher = (pool: RelayPoolLike): pool is RelayPoolLike & Readonly<{
  connections: ReadonlyArray<Readonly<{ url: string; status: string }>>;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
}> => {
  return Array.isArray(pool.connections) && typeof pool.waitForConnection === "function";
};

const toRelayOutcome = (result: RelayPublishResult): QueueSendAttemptResult["relayOutcome"] => ({
  successCount: result.successCount,
  totalRelays: result.totalRelays,
  metQuorum: result.metQuorum,
});

const createUnsupportedRelayPublishResult = (
  relayUrls: ReadonlyArray<string>,
  message = "Relay pool does not support evidence-backed publish APIs."
): MultiRelayPublishResult => ({
  success: false,
  status: "failed",
  reasonCode: "unsupported_runtime",
  successCount: 0,
  totalRelays: relayUrls.length,
  metQuorum: false,
  quorumRequired: Math.max(1, Math.ceil(Math.max(1, relayUrls.length) / 2)),
  results: relayUrls.map((relayUrl) => ({
    relayUrl,
    success: false,
    error: message,
  })),
  failures: relayUrls.map((relayUrl) => ({
    relayUrl,
    success: false,
    error: message,
  })),
  overallError: message,
});

const publishToScopedRelayUrls = async (
  pool: RelayPoolLike,
  relayScopeUrls: ReadonlyArray<string>,
  eventPayload: string
): Promise<MultiRelayPublishResult | null> => {
  if (relayScopeUrls.length === 0) {
    return null;
  }
  if (typeof pool.publishToUrls === "function") {
    return pool.publishToUrls(relayScopeUrls, eventPayload);
  }
  return null;
};

const classifyProtocolFailureReasonCode = (
  reason: "unsupported" | "failed",
  message?: string
): DeliveryReasonCode => {
  if (reason === "unsupported") {
    return "unsupported_runtime";
  }
  const normalizedMessage = (message || "").toLowerCase();
  if (normalizedMessage.includes("no writable relay")) {
    return "no_writable_relays";
  }
  if (normalizedMessage.includes("timeout")) {
    return "relay_degraded";
  }
  if (normalizedMessage.includes("disconnected")) {
    return "relay_degraded";
  }
  if (normalizedMessage.includes("malformed event payload")) {
    return "provider_unavailable";
  }
  return "quorum_not_met";
};

const mapProtocolAdapterFailureToMultiRelayResult = (
  relayScopeUrls: ReadonlyArray<string>,
  failure: Readonly<{ reason: "unsupported" | "failed"; message?: string }>
): MultiRelayPublishResult => {
  const reasonCode = classifyProtocolFailureReasonCode(failure.reason, failure.message);
  const message = failure.message || "Protocol publish failed";
  const totalRelays = relayScopeUrls.length;
  const quorumRequired = Math.max(1, Math.ceil(Math.max(1, totalRelays) / 2));
  const failures = relayScopeUrls.map((relayUrl) => ({
    relayUrl,
    success: false,
    error: message,
  }));
  return {
    success: false,
    status: "failed",
    reasonCode,
    successCount: 0,
    totalRelays,
    metQuorum: false,
    quorumRequired,
    results: failures,
    failures,
    overallError: message,
  };
};

const mapProtocolAdapterFailureToRelayResult = (
  relayScopeUrls: ReadonlyArray<string>,
  failure: Readonly<{ reason: "unsupported" | "failed"; message?: string }>
): RelayPublishResult => {
  const reasonCode = classifyProtocolFailureReasonCode(failure.reason, failure.message);
  const message = failure.message || "Protocol publish failed";
  const totalRelays = relayScopeUrls.length;
  const quorumRequired = Math.max(1, Math.ceil(Math.max(1, totalRelays) / 2));
  const failures = relayScopeUrls.map((relayUrl) => ({
    relayUrl,
    success: false,
    error: message,
  }));
  return {
    status: "failed",
    reasonCode,
    success: false,
    successCount: 0,
    totalRelays,
    metQuorum: false,
    quorumRequired,
    results: failures,
    failures,
    overallError: message,
  };
};

const isRetryablePublishFailure = (reasonCode?: DeliveryReasonCode): boolean => (
  reasonCode === "no_writable_relays"
  || reasonCode === "quorum_not_met"
  || reasonCode === "relay_degraded"
);

const getDurableRelaySuccessMinimum = (targetRelayCount: number): number => (
  targetRelayCount >= 3 ? 2 : 1
);

const applyDurableRelayEvidenceGate = (
  result: MultiRelayPublishResult,
  targetRelayCount: number
): MultiRelayPublishResult => {
  const durableMinimum = getDurableRelaySuccessMinimum(targetRelayCount);
  const quorumRequired = Math.max(result.quorumRequired ?? 1, durableMinimum);
  const metQuorum = (result.metQuorum ?? result.success) && result.successCount >= quorumRequired;
  const failures = result.results.filter((entry) => !entry.success);
  const status = metQuorum
    ? (failures.length > 0 ? "partial" : "ok")
    : (result.successCount > 0 ? "partial" : "failed");
  const reasonCode = metQuorum
    ? (failures.length > 0 ? "relay_degraded" : undefined)
    : (
        result.reasonCode && result.reasonCode !== "relay_degraded" && result.reasonCode !== "quorum_not_met"
          ? result.reasonCode
          : (result.successCount > 0 ? "relay_degraded" : "quorum_not_met")
      );

  return {
    ...result,
    success: metQuorum,
    metQuorum,
    quorumRequired,
    status,
    reasonCode,
    failures,
    overallError: metQuorum
      ? undefined
      : (result.overallError || `Durable relay evidence not met (${result.successCount}/${quorumRequired}).`),
  };
};

const applyDurableRelayEvidenceGateToMappedResult = (
  result: RelayPublishResult,
  targetRelayCount: number
): RelayPublishResult => {
  const durableMinimum = getDurableRelaySuccessMinimum(targetRelayCount);
  const quorumRequired = Math.max(result.quorumRequired, durableMinimum);
  const metQuorum = result.metQuorum && result.successCount >= quorumRequired;
  const failures = result.results.filter((entry) => !entry.success);
  const status = metQuorum
    ? (failures.length > 0 ? "partial" : "ok")
    : (result.successCount > 0 ? "partial" : "failed");
  const reasonCode = metQuorum
    ? (failures.length > 0 ? "relay_degraded" : undefined)
    : (
        result.reasonCode && result.reasonCode !== "relay_degraded" && result.reasonCode !== "quorum_not_met"
          ? result.reasonCode
          : (result.successCount > 0 ? "relay_degraded" : "quorum_not_met")
      );

  return {
    ...result,
    success: metQuorum,
    metQuorum,
    quorumRequired,
    status,
    reasonCode,
    failures,
    overallError: metQuorum
      ? undefined
      : (result.overallError || `Durable relay evidence not met (${result.successCount}/${quorumRequired}).`),
  };
};

const mergePublishResults = (params: Readonly<{
  base: MultiRelayPublishResult;
  retry: MultiRelayPublishResult;
  relayScopeUrls: ReadonlyArray<string>;
}>): MultiRelayPublishResult => {
  const byRelay = new Map<string, {
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>();

  params.relayScopeUrls.forEach((relayUrl) => {
    byRelay.set(relayUrl, {
      relayUrl,
      success: false,
      error: "No publish evidence",
    });
  });

  const apply = (entries: ReadonlyArray<Readonly<{
    relayUrl: string;
    success: boolean;
    error?: string;
    latency?: number;
  }>>): void => {
    entries.forEach((entry) => {
      const existing = byRelay.get(entry.relayUrl);
      if (!existing) {
        byRelay.set(entry.relayUrl, { ...entry });
        return;
      }
      if (entry.success) {
        byRelay.set(entry.relayUrl, { ...entry, success: true, error: undefined });
        return;
      }
      if (!existing.success) {
        byRelay.set(entry.relayUrl, { ...entry });
      }
    });
  };

  apply(params.base.results);
  apply(params.retry.results);

  const mergedResults = params.relayScopeUrls.map((relayUrl) => byRelay.get(relayUrl) ?? ({
    relayUrl,
    success: false,
    error: "No publish evidence",
  }));
  const mergedSuccessCount = mergedResults.filter((entry) => entry.success).length;
  const mergedFailures = mergedResults.filter((entry) => !entry.success);
  const quorumRequired = params.base.quorumRequired ?? Math.max(1, Math.ceil(Math.max(1, params.relayScopeUrls.length) / 2));
  const metQuorum = mergedSuccessCount >= quorumRequired;

  return {
    ...params.base,
    success: metQuorum,
    successCount: mergedSuccessCount,
    totalRelays: params.base.totalRelays || params.relayScopeUrls.length,
    metQuorum,
    quorumRequired,
    status: metQuorum ? (mergedFailures.length > 0 ? "partial" : "ok") : (mergedSuccessCount > 0 ? "partial" : "failed"),
    reasonCode: metQuorum ? (mergedFailures.length > 0 ? "relay_degraded" : undefined) : (mergedSuccessCount > 0 ? "relay_degraded" : "quorum_not_met"),
    results: mergedResults,
    failures: mergedFailures,
    overallError: metQuorum
      ? undefined
      : (params.retry.overallError || params.base.overallError || "Relay publish quorum not met"),
  };
};

const scheduleRetryForPublishFailure = async (params: Readonly<{
  messageQueue: IMessageQueue | null;
  message: Message;
  plaintext: string;
  recipientPubkey: PublicKeyHex;
  signedEvent: NostrEvent;
  targetRelayUrls?: ReadonlyArray<string>;
  successfulRelayUrls?: ReadonlyArray<string>;
  reasonCode?: DeliveryReasonCode;
}>): Promise<Message> => {
  if (!params.messageQueue) {
    return params.message;
  }

  const nextRetryAt = normalizeQueuedRetryAt(retryManager.calculateNextRetry(0));
  const outgoingMessage: OutgoingMessage = {
    id: params.message.id,
    conversationId: params.message.conversationId,
    content: params.plaintext,
    recipientPubkey: params.recipientPubkey,
    createdAt: new Date(),
    retryCount: 0,
    nextRetryAt,
    lastReasonCode: params.reasonCode,
    signedEvent: params.signedEvent,
    targetRelayUrls: params.targetRelayUrls ? dedupeRelayUrls(params.targetRelayUrls) : undefined,
    achievedRelayUrls: params.successfulRelayUrls ? dedupeRelayUrls(params.successfulRelayUrls) : undefined,
  };
  await params.messageQueue.queueOutgoingMessage(outgoingMessage);

  const queuedStatus = transitionMessageStatus("rejected", {
    type: "RETRY_QUEUED",
    retryCount: outgoingMessage.retryCount,
    nextRetryAt: outgoingMessage.nextRetryAt
  });
  await params.messageQueue.updateMessageStatus(params.message.id, queuedStatus);
  return {
    ...params.message,
    status: queuedStatus,
    retryCount: outgoingMessage.retryCount
  };
};

export const publishOutgoingDm = async (params: Readonly<{
  pool: RelayPoolLike;
  openRelays: ReadonlyArray<RelayLike>;
  targetRelayUrls?: ReadonlyArray<string>;
  messageQueue: IMessageQueue | null;

  initialMessage: Message;
  build: DmEventBuildResult;

  plaintext: string;
  recipientPubkey: PublicKeyHex;
  senderPubkey: PublicKeyHex;
  senderPrivateKeyHex: PrivateKeyHex;
  createdAtUnixSeconds: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>): Promise<Readonly<{
  finalMessage: Message;
  publishResult: MultiRelayPublishResult;
  updatedSignedEvent?: NostrEvent;
}>> => {
  const relayScopeUrls = dedupeRelayUrls(
    (params.targetRelayUrls && params.targetRelayUrls.length > 0)
      ? params.targetRelayUrls
      : params.openRelays.map((relay) => relay.url)
  );

  const publishOnce = async (signedEvent: NostrEvent): Promise<MultiRelayPublishResult> => {
    const eventPayload = JSON.stringify(["EVENT", signedEvent]);
    const policy = getV090RolloutPolicy(PrivacySettingsService.getSettings());
    const protocolOwnerActive = policy.protocolCoreEnabled && hasNativeRuntime();
    logAppEvent({
      name: "messaging.transport.publish_owner",
      level: "info",
      scope: { feature: "messaging", action: "send_dm" },
      context: {
        owner: protocolOwnerActive ? "rust_protocol" : "legacy_transport",
        peerPubkey: params.recipientPubkey.slice(0, 16),
        eventId: signedEvent.id.slice(0, 16),
      },
    });

    logAppEvent({
      name: "messaging.transport.publish_attempt",
      level: "info",
      scope: { feature: "messaging", action: "send_dm" },
      context: {
        peerPubkey: params.recipientPubkey.slice(0, 16),
        eventId: signedEvent.id.slice(0, 16),
        targetRelayCount: relayScopeUrls.length,
        openRelayCount: params.openRelays.length,
      },
    });

    if (protocolOwnerActive) {
      if (relayScopeUrls.length === 0) {
        return createUnsupportedRelayPublishResult(relayScopeUrls, "No scoped relay URLs available for protocol publish.");
      }
      const protocolPublish = await protocolCoreAdapter.publishWithQuorum(eventPayload, relayScopeUrls);
      if (protocolPublish.ok) {
        return mapProtocolPublishReportToRelayPublishResult(protocolPublish.value, relayScopeUrls);
      }
      return mapProtocolAdapterFailureToMultiRelayResult(relayScopeUrls, protocolPublish);
    }

    if (canUseRelayCorePublisher(params.pool)) {
      const coreResult = await publishViaRelayCore({
        pool: params.pool,
        payload: eventPayload,
        scopedRelayUrls: relayScopeUrls.length > 0 ? relayScopeUrls : undefined,
        waitForConnectionMs: 1_250,
      });
      const mappedCoreResult = mapCoreResultToRelayPublishResult(coreResult, relayScopeUrls);
      if (mappedCoreResult) {
        return mappedCoreResult;
      }
    }

    const scopedPublishResult = await publishToScopedRelayUrls(params.pool, relayScopeUrls, eventPayload);
    if (scopedPublishResult) {
      return mapLegacyPublishResultToRelayPublishResult(scopedPublishResult);
    }

    if (!params.pool.publishToAll) {
      return createUnsupportedRelayPublishResult(relayScopeUrls);
    }
    return mapLegacyPublishResultToRelayPublishResult(await params.pool.publishToAll(eventPayload));
  };

  let publishResult: MultiRelayPublishResult = applyDurableRelayEvidenceGate(
    await publishOnce(params.build.signedEvent),
    relayScopeUrls.length
  );
  let finalMessage: Message = params.initialMessage;
  const hasDurableRelayEvidence = (): boolean => publishResult.success;

  if (publishResult.successCount > 0 && !hasDurableRelayEvidence() && relayScopeUrls.length > 1) {
    const failedRelayUrls = publishResult.results
      .filter((entry) => !entry.success)
      .map((entry) => entry.relayUrl);
    const scopedRetry = await publishToScopedRelayUrls(
      params.pool,
      failedRelayUrls,
      JSON.stringify(["EVENT", params.build.signedEvent])
    );
    if (scopedRetry) {
      const mappedRetry = mapLegacyPublishResultToRelayPublishResult(scopedRetry);
      publishResult = applyDurableRelayEvidenceGate(mergePublishResults({
        base: publishResult,
        retry: mappedRetry,
        relayScopeUrls,
      }), relayScopeUrls.length);
    }
  }

  logAppEvent({
    name: "messaging.transport.publish_result",
    level: publishResult.success ? "info" : "warn",
    scope: { feature: "messaging", action: "send_dm" },
    context: {
      peerPubkey: params.recipientPubkey.slice(0, 16),
      eventId: params.build.signedEvent.id.slice(0, 16),
      success: publishResult.success,
      successCount: publishResult.successCount,
      totalRelays: publishResult.totalRelays,
      resultCount: publishResult.results.length,
      status: publishResult.status ?? null,
      reasonCode: publishResult.reasonCode ?? null,
      metQuorum: publishResult.metQuorum ?? null,
      quorumRequired: publishResult.quorumRequired ?? null,
      targetRelayCount: relayScopeUrls.length,
      hasOverallError: typeof publishResult.overallError === "string" && publishResult.overallError.length > 0,
    },
  });

  if (params.build.format === "nip17" && publishResult.successCount === 0) {
    logAppEvent({
      name: "messaging.dm.send.fallback_start",
      level: "warn",
      scope: { feature: "messaging", action: "send_dm" },
      context: { from: "nip17", to: "nip04", failures: countRelayFailures(publishResult.results) }
    });

    const fallbackBuild: DmEventBuildResult = await buildDmEvent({
      format: "nip04",
      plaintext: params.plaintext,
      recipientPubkey: params.recipientPubkey,
      senderPubkey: params.senderPubkey,
      senderPrivateKeyHex: params.senderPrivateKeyHex,
      createdAtUnixSeconds: params.createdAtUnixSeconds,
      tags: params.tags
    });

    publishResult = applyDurableRelayEvidenceGate(
      await publishOnce(fallbackBuild.signedEvent),
      relayScopeUrls.length
    );

    finalMessage = {
      ...finalMessage,
      id: fallbackBuild.signedEvent.id,
      eventId: fallbackBuild.signedEvent.id,
      encryptedContent: fallbackBuild.encryptedContent,
      dmFormat: fallbackBuild.format,
      relayResults: []
    };

    if (params.messageQueue) {
      await params.messageQueue.persistMessage(finalMessage);
    }
    if (hasDurableRelayEvidence()) {
      const nextStatus = transitionMessageStatus(finalMessage.status, {
        type: "RELAY_ACCEPTED",
        successCount: publishResult.successCount,
        totalRelays: publishResult.totalRelays
      });
      finalMessage.status = nextStatus;
      if (params.messageQueue) {
        await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
      }
    } else {
      const retryableFailure = isRetryablePublishFailure(publishResult.reasonCode);
      const nextStatus = retryableFailure
        ? transitionMessageStatus(finalMessage.status, {
            type: "RELAY_REJECTED",
            error: publishResult.overallError
          })
        : transitionMessageStatus(finalMessage.status, {
            type: "PERMANENT_FAIL",
            error: publishResult.overallError || "Delivery failed without evidence-backed retry support",
          });
      finalMessage.status = nextStatus;
      if (params.messageQueue) {
        await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
        if (retryableFailure) {
          finalMessage = await scheduleRetryForPublishFailure({
            messageQueue: params.messageQueue,
            message: finalMessage,
            plaintext: params.plaintext,
            recipientPubkey: params.recipientPubkey,
            signedEvent: fallbackBuild.signedEvent,
            targetRelayUrls: relayScopeUrls,
            successfulRelayUrls: collectSuccessfulRelayUrls(publishResult.results),
            reasonCode: publishResult.reasonCode,
          });
        }
      }
    }

    return { finalMessage, publishResult, updatedSignedEvent: fallbackBuild.signedEvent };
  }

  finalMessage = { ...finalMessage, relayResults: publishResult.results };

  if (hasDurableRelayEvidence()) {
    const nextStatus = transitionMessageStatus(finalMessage.status, {
      type: "RELAY_ACCEPTED",
      successCount: publishResult.successCount,
      totalRelays: publishResult.totalRelays
    });
    finalMessage.status = nextStatus;
    if (params.messageQueue) {
      await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
    }
    } else {
      const retryableFailure = isRetryablePublishFailure(publishResult.reasonCode);
      const nextStatus = retryableFailure
        ? transitionMessageStatus(finalMessage.status, {
            type: "RELAY_REJECTED",
            error: publishResult.overallError
          })
        : transitionMessageStatus(finalMessage.status, {
            type: "PERMANENT_FAIL",
            error: publishResult.overallError || "Delivery failed without evidence-backed retry support",
          });
      finalMessage.status = nextStatus;
      if (params.messageQueue) {
        await params.messageQueue.updateMessageStatus(finalMessage.id, nextStatus);
        if (retryableFailure) {
          finalMessage = await scheduleRetryForPublishFailure({
            messageQueue: params.messageQueue,
            message: finalMessage,
            plaintext: params.plaintext,
            recipientPubkey: params.recipientPubkey,
            signedEvent: finalMessage.eventId === params.build.signedEvent.id ? params.build.signedEvent : params.build.signedEvent,
            targetRelayUrls: relayScopeUrls,
            successfulRelayUrls: collectSuccessfulRelayUrls(publishResult.results),
            reasonCode: publishResult.reasonCode,
          });
        }
      }
    }

  return { finalMessage, publishResult };
};

export const publishQueuedOutgoingMessage = async (params: Readonly<{
  pool: RelayPoolLike;
  messageQueue: IMessageQueue;
  message: OutgoingMessage;
  openRelays?: ReadonlyArray<RelayLike>;
}>): Promise<QueueSendAttemptResult> => {
  const acceptRelayDelivery = async (
    result: RelayPublishResult
  ): Promise<QueueSendAttemptResult> => {
    const nextStatus = transitionMessageStatus("sending", {
      type: "RELAY_ACCEPTED",
      successCount: result.successCount,
      totalRelays: result.totalRelays,
    });
    await params.messageQueue.updateMessageStatus(params.message.id, nextStatus);
    return {
      status: "accepted",
      reasonCode: result.reasonCode,
      relayOutcome: toRelayOutcome(result),
    };
  };

  const scheduleRetry = async (
    reasonCode: QueueSendAttemptResult["reasonCode"],
    error: string | undefined,
    relayOutcome?: QueueSendAttemptResult["relayOutcome"],
    achievedRelayUrls?: ReadonlyArray<string>
  ): Promise<QueueSendAttemptResult> => {
    const nextRetryCount = params.message.retryCount + 1;
    const retriesExhausted = nextRetryCount >= MAX_OUTGOING_QUEUE_RETRY_ATTEMPTS;

    if (retriesExhausted) {
      const terminalStatus = transitionMessageStatus("rejected", {
        type: "PERMANENT_FAIL",
        error: error || "Queue retry budget exhausted",
      });
      await params.messageQueue.updateMessageStatus(params.message.id, terminalStatus);
      return {
        status: "terminal_failed",
        reasonCode: "max_retries_exceeded",
        error: error || "Queue retry budget exhausted",
        relayOutcome,
      };
    }

    const nextRetryAt = normalizeQueuedRetryAt(retryManager.calculateNextRetry(nextRetryCount));
    await params.messageQueue.queueOutgoingMessage({
      ...params.message,
      retryCount: nextRetryCount,
      nextRetryAt,
      lastReasonCode: reasonCode,
      achievedRelayUrls: achievedRelayUrls ? dedupeRelayUrls(achievedRelayUrls) : params.message.achievedRelayUrls,
    });
    const nextStatus = transitionMessageStatus("rejected", {
      type: "RETRY_QUEUED",
      retryCount: nextRetryCount,
      nextRetryAt,
    });
    await params.messageQueue.updateMessageStatus(params.message.id, nextStatus);
    return {
      status: "retry_scheduled",
      reasonCode,
      error,
      nextRetryAtUnixMs: nextRetryAt.getTime(),
      relayOutcome,
    };
  };

  if (!params.message.signedEvent) {
    console.error("Queued message missing signed event");
    return {
      status: "terminal_failed",
      reasonCode: "missing_signed_event",
      error: "Queued message missing signed event",
    };
  }

  try {
    const eventPayload = JSON.stringify(["EVENT", params.message.signedEvent]);
    const openRelayUrls = dedupeRelayUrls((params.openRelays || []).map((relay) => relay.url));
    const scopedRelayUrls = dedupeRelayUrls(
      params.message.targetRelayUrls && params.message.targetRelayUrls.length > 0
        ? params.message.targetRelayUrls
        : openRelayUrls
    );
    const priorAchievedRelayUrls = dedupeRelayUrls(params.message.achievedRelayUrls ?? []);
    const durableRelaySuccessMinimum = getDurableRelaySuccessMinimum(
      scopedRelayUrls.length > 0 ? scopedRelayUrls.length : Math.max(openRelayUrls.length, 1)
    );
    const evaluateAttempt = async (result: RelayPublishResult): Promise<QueueSendAttemptResult> => {
      const cumulativeRelayUrls = dedupeRelayUrls([
        ...priorAchievedRelayUrls,
        ...collectSuccessfulRelayUrls(result.results),
      ]);
      const totalRelays = Math.max(result.totalRelays, scopedRelayUrls.length || result.totalRelays);
      const cumulativeSuccessCount = cumulativeRelayUrls.length;
      const cumulativeMetDurable = cumulativeSuccessCount >= durableRelaySuccessMinimum;
      const relayOutcome: QueueSendAttemptResult["relayOutcome"] = {
        successCount: cumulativeSuccessCount,
        totalRelays,
        metQuorum: cumulativeMetDurable,
      };

      if (cumulativeMetDurable) {
        const acceptedResult: RelayPublishResult = {
          ...result,
          success: true,
          metQuorum: true,
          successCount: cumulativeSuccessCount,
          totalRelays,
          quorumRequired: Math.max(result.quorumRequired, durableRelaySuccessMinimum),
          status: cumulativeSuccessCount >= totalRelays ? "ok" : "partial",
          reasonCode: cumulativeSuccessCount >= totalRelays ? undefined : "relay_degraded",
          overallError: undefined,
        };
        return acceptRelayDelivery(acceptedResult);
      }

      return scheduleRetry(
        result.reasonCode || "quorum_not_met",
        result.overallError,
        relayOutcome,
        cumulativeRelayUrls
      );
    };

    const policy = getV090RolloutPolicy(PrivacySettingsService.getSettings());
    const protocolOwnerActive = policy.protocolCoreEnabled && hasNativeRuntime();
    if (protocolOwnerActive) {
      if (scopedRelayUrls.length === 0) {
        return evaluateAttempt(mapProtocolAdapterFailureToRelayResult(scopedRelayUrls, {
          reason: "failed",
          message: "No scoped relay URLs available for protocol publish.",
        }));
      }
      const protocolPublish = await protocolCoreAdapter.publishWithQuorum(eventPayload, scopedRelayUrls);
      if (protocolPublish.ok) {
        const result = applyDurableRelayEvidenceGateToMappedResult(
          mapProtocolPublishReportToRelayPublishResult(protocolPublish.value, scopedRelayUrls),
          scopedRelayUrls.length
        );
        return evaluateAttempt(result);
      }
      return evaluateAttempt(mapProtocolAdapterFailureToRelayResult(scopedRelayUrls, protocolPublish));
    }

    if (canUseRelayCorePublisher(params.pool)) {
      const coreResult = await publishViaRelayCore({
        pool: params.pool,
        payload: eventPayload,
        scopedRelayUrls: scopedRelayUrls.length > 0 ? scopedRelayUrls : undefined,
        waitForConnectionMs: 1_250,
      });
      const mappedCoreResult = mapCoreResultToRelayPublishResult(coreResult, scopedRelayUrls);
      if (mappedCoreResult) {
        const gatedCoreResult = applyDurableRelayEvidenceGateToMappedResult(
          mappedCoreResult,
          scopedRelayUrls.length || mappedCoreResult.totalRelays
        );
        return evaluateAttempt(gatedCoreResult);
      }
    }

    const scopedPublishResult = await publishToScopedRelayUrls(params.pool, scopedRelayUrls, eventPayload);
    if (scopedPublishResult) {
      const result = applyDurableRelayEvidenceGateToMappedResult(
        mapLegacyPublishResultToRelayPublishResult(scopedPublishResult),
        scopedRelayUrls.length
      );
      return evaluateAttempt(result);
    }

    if (params.pool.publishToAll) {
      const result = applyDurableRelayEvidenceGateToMappedResult(
        mapLegacyPublishResultToRelayPublishResult(await params.pool.publishToAll(eventPayload)),
        scopedRelayUrls.length || openRelayUrls.length
      );
      return evaluateAttempt(result);
    }
    await params.messageQueue.updateMessageStatus(params.message.id, "failed");
    return {
      status: "terminal_failed",
      reasonCode: "unsupported_runtime",
      error: "Relay pool does not support evidence-backed queue publish APIs.",
    };
  } catch (error) {
    console.error("Failed to send queued message:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to send queued message";
    return scheduleRetry("unknown", errorMessage);
  }
};

export const queueOutgoingDmForRetry = async (params: Readonly<{
  messageQueue: IMessageQueue;
  messageId: string;
  conversationId: string;
  plaintext: string;
  recipientPubkey: PublicKeyHex;
  signedEvent: NostrEvent;
  targetRelayUrls?: ReadonlyArray<string>;
}>): Promise<Date | undefined> => {
  const outgoingMessage: OutgoingMessage = {
    id: params.messageId,
    conversationId: params.conversationId,
    content: params.plaintext,
    recipientPubkey: params.recipientPubkey,
    createdAt: new Date(),
    retryCount: 0,
    nextRetryAt: normalizeQueuedRetryAt(retryManager.calculateNextRetry(0)),
    signedEvent: params.signedEvent,
    targetRelayUrls: params.targetRelayUrls ? dedupeRelayUrls(params.targetRelayUrls) : undefined,
  };

  try {
    await params.messageQueue.queueOutgoingMessage(outgoingMessage);
    const nextStatus = transitionMessageStatus("rejected", { type: "RETRY_QUEUED", retryCount: 0, nextRetryAt: outgoingMessage.nextRetryAt });
    await params.messageQueue.updateMessageStatus(params.messageId, nextStatus);
    return outgoingMessage.nextRetryAt;
  } catch (queueError) {
    console.error("Failed to queue message:", queueError);
    return undefined;
  }
};

export const outgoingDmPublisherInternals = {
  mapProtocolPublishReportToRelayPublishResult,
  normalizeQueuedRetryAt,
  createUnsupportedRelayPublishResult,
  isRetryablePublishFailure,
};
