"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import type { DriftReport, AccountProjectionSnapshot } from "../account-event-contracts";

const STORAGE_KEY = "obscur.account_sync.drift_report.v1";

const saveReport = (report: DriftReport): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Drift report persistence is best-effort.
  }
};

const countProjectionAcceptedPeers = (projection: AccountProjectionSnapshot): number => (
  Object.values(projection.contactsByPeer).filter((contact) => contact.status === "accepted").length
);

const countProjectionPendingPeers = (projection: AccountProjectionSnapshot): number => (
  Object.values(projection.contactsByPeer).filter((contact) => contact.status === "pending").length
);

const countProjectionMessages = (projection: AccountProjectionSnapshot): number => (
  Object.values(projection.messagesByConversationId)
    .reduce((total, entries) => total + entries.length, 0)
);

const countLegacyMessages = (
  legacyChatState: ReturnType<typeof chatStateStoreService.load>
): number => (
  Object.values(legacyChatState?.messagesByConversationId ?? {})
    .reduce((total, entries) => total + entries.length, 0)
);

export const createDriftReport = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  projection: AccountProjectionSnapshot;
}>): DriftReport => {
  const legacyTrust = peerTrustInternals.loadFromStorage(params.publicKeyHex);
  const legacyChatState = chatStateStoreService.load(params.publicKeyHex);
  const legacyPendingCount = (legacyChatState?.connectionRequests ?? []).filter((entry) => entry.status === "pending").length;
  const legacyMessageCount = countLegacyMessages(legacyChatState);

  const acceptedDelta = Math.abs(legacyTrust.acceptedPeers.length - countProjectionAcceptedPeers(params.projection));
  const pendingDelta = Math.abs(legacyPendingCount - countProjectionPendingPeers(params.projection));
  const messageDelta = Math.abs(legacyMessageCount - countProjectionMessages(params.projection));
  const domains: Array<"contacts" | "messages" | "sync"> = [];
  if (acceptedDelta > 0 || pendingDelta > 0) {
    domains.push("contacts");
  }
  if (messageDelta > 0) {
    domains.push("messages");
  }
  const criticalDriftCount = acceptedDelta;
  const nonCriticalDriftCount = pendingDelta + messageDelta;
  const report: DriftReport = {
    criticalDriftCount,
    nonCriticalDriftCount,
    domains,
    checkedAtUnixMs: Date.now(),
  };
  saveReport(report);
  return report;
};

export const getLatestDriftReport = (): DriftReport | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as DriftReport;
    if (typeof parsed?.criticalDriftCount !== "number" || !Array.isArray(parsed?.domains)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const accountSyncDriftDetectorInternals = {
  STORAGE_KEY,
  saveReport,
  countProjectionMessages,
  countLegacyMessages,
};
