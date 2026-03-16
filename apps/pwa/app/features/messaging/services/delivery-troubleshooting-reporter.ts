"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { MessageActionFailureReason } from "@/app/features/messaging/types";
import { logAppEvent } from "@/app/shared/log-app-event";
import { reportDevRuntimeIssue } from "@/app/shared/dev-runtime-issue-reporter";

type DeliveryIssueStatus = "queued_retrying" | "failed";

export type SenderDeliveryIssueReport = Readonly<{
  atUnixMs: number;
  attemptPhase: "initial_send" | "queue_retry";
  senderPublicKeyHex: PublicKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  messageId?: string;
  deliveryStatus: DeliveryIssueStatus;
  failureReason?: MessageActionFailureReason | "unknown";
  reasonCode?: string;
  error?: string;
  relayScopeSource?: string;
  targetRelayUrls: ReadonlyArray<string>;
  relayResultCount: number;
  relayFailureCount: number;
  relayFailureSummary: ReadonlyArray<string>;
  queueRetryCount?: number;
  nextRetryAtUnixMs?: number;
}>;

type DeliveryTroubleshootingTools = Readonly<{
  getRecentSenderDeliveryIssues: () => ReadonlyArray<SenderDeliveryIssueReport>;
  clearSenderDeliveryIssues: () => void;
}>;

declare global {
  interface Window {
    obscurDeliveryTroubleshooting?: DeliveryTroubleshootingTools;
  }
}

const MAX_ISSUES = 25;
let recentSenderDeliveryIssues: ReadonlyArray<SenderDeliveryIssueReport> = [];

const shouldInstallDevTools = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return process.env.NODE_ENV !== "production";
};

const installDevTools = (): void => {
  if (!shouldInstallDevTools()) {
    return;
  }
  window.obscurDeliveryTroubleshooting = {
    getRecentSenderDeliveryIssues: () => recentSenderDeliveryIssues,
    clearSenderDeliveryIssues: () => {
      recentSenderDeliveryIssues = [];
      installDevTools();
    },
  };
};

const trimRelayFailureSummary = (relayResults: ReadonlyArray<Readonly<{
  relayUrl: string;
  success: boolean;
  error?: string;
}>>
): ReadonlyArray<string> => {
  return relayResults
    .filter((entry) => !entry.success)
    .slice(0, 6)
    .map((entry) => `${entry.relayUrl}: ${entry.error || "publish_failed"}`);
};

const truncateHex = (value: string): string => value.slice(0, 16);

export const reportSenderDeliveryIssue = (params: Readonly<{
  attemptPhase?: "initial_send" | "queue_retry";
  senderPublicKeyHex: PublicKeyHex;
  recipientPublicKeyHex: PublicKeyHex;
  messageId?: string;
  deliveryStatus: DeliveryIssueStatus;
  failureReason?: MessageActionFailureReason | "unknown";
  reasonCode?: string;
  error?: string;
  relayScopeSource?: string;
  targetRelayUrls?: ReadonlyArray<string>;
  relayResults?: ReadonlyArray<Readonly<{
    relayUrl: string;
    success: boolean;
    error?: string;
  }>>;
  queueRetryCount?: number;
  nextRetryAtUnixMs?: number;
}>): SenderDeliveryIssueReport => {
  const relayResults = params.relayResults ?? [];
  const report: SenderDeliveryIssueReport = {
    atUnixMs: Date.now(),
    attemptPhase: params.attemptPhase ?? "initial_send",
    senderPublicKeyHex: params.senderPublicKeyHex,
    recipientPublicKeyHex: params.recipientPublicKeyHex,
    messageId: params.messageId,
    deliveryStatus: params.deliveryStatus,
    failureReason: params.failureReason,
    reasonCode: params.reasonCode,
    error: params.error,
    relayScopeSource: params.relayScopeSource,
    targetRelayUrls: [...(params.targetRelayUrls ?? [])],
    relayResultCount: relayResults.length,
    relayFailureCount: relayResults.filter((entry) => !entry.success).length,
    relayFailureSummary: trimRelayFailureSummary(relayResults),
    queueRetryCount: params.queueRetryCount,
    nextRetryAtUnixMs: params.nextRetryAtUnixMs,
  };

  recentSenderDeliveryIssues = [...recentSenderDeliveryIssues, report].slice(-MAX_ISSUES);
  installDevTools();

  const eventName = params.deliveryStatus === "failed"
    ? "messaging.delivery.sender_delivery_failed"
    : "messaging.delivery.sender_delivery_queued";
  logAppEvent({
    name: eventName,
    level: params.deliveryStatus === "failed" ? "error" : "warn",
    scope: {
      feature: "messaging",
      action: report.attemptPhase === "queue_retry" ? "queue_processing" : "send_dm"
    },
    context: {
      senderPubkey: truncateHex(params.senderPublicKeyHex),
      recipientPubkey: truncateHex(params.recipientPublicKeyHex),
      messageId: params.messageId ? params.messageId.slice(0, 16) : null,
      deliveryStatus: params.deliveryStatus,
      attemptPhase: report.attemptPhase,
      failureReason: params.failureReason ?? null,
      reasonCode: params.reasonCode ?? null,
      targetRelayCount: params.targetRelayUrls?.length ?? 0,
      relayFailureCount: report.relayFailureCount,
      queueRetryCount: params.queueRetryCount ?? null,
      nextRetryAtUnixMs: params.nextRetryAtUnixMs ?? null,
    },
  });

  reportDevRuntimeIssue({
    domain: "messaging",
    operation: report.attemptPhase === "queue_retry" ? "queue_delivery" : "send_delivery",
    severity: report.deliveryStatus === "failed" ? "error" : "warn",
    reasonCode: report.reasonCode ?? report.failureReason ?? undefined,
    message: report.error
      || (report.deliveryStatus === "failed"
        ? "Sender delivery failed without recipient evidence."
        : "Sender delivery queued for retry without recipient evidence."),
    retryable: report.deliveryStatus === "queued_retrying",
    source: "delivery-troubleshooting-reporter",
    context: {
      senderPubkey: truncateHex(report.senderPublicKeyHex),
      recipientPubkey: truncateHex(report.recipientPublicKeyHex),
      targetRelayCount: report.targetRelayUrls.length,
      relayFailureCount: report.relayFailureCount,
      relayResultCount: report.relayResultCount,
      queueRetryCount: report.queueRetryCount ?? null,
    },
    fingerprint: [
      "messaging",
      report.attemptPhase,
      report.reasonCode ?? report.failureReason ?? "unknown",
      truncateHex(report.senderPublicKeyHex),
      truncateHex(report.recipientPublicKeyHex),
    ].join("|"),
  });

  if (process.env.NODE_ENV !== "production") {
    console.warn("[DeliveryTroubleshooting] Sender delivery issue", report);
  }

  return report;
};

export const deliveryTroubleshootingReporterInternals = {
  getRecentSenderDeliveryIssues: (): ReadonlyArray<SenderDeliveryIssueReport> => recentSenderDeliveryIssues,
  clearSenderDeliveryIssues: (): void => {
    recentSenderDeliveryIssues = [];
  },
  trimRelayFailureSummary,
};
