"use client";

import type { Message } from "../types";
import { resolveDmReadAuthority, type DmReadAuthorityStatus } from "./dm-read-authority-contract";
import { logAppEvent } from "@/app/shared/log-app-event";

export interface DriftDetectionParams {
  conversationId: string;
  identityPubkey: string | null;
  scopeVerified: boolean;
  projectionReady: boolean;
  projectionMessages: ReadonlyArray<Message>;
  indexedMessages: ReadonlyArray<Message>;
  persistedMessages: ReadonlyArray<Message>;
  timelineSource: "projection" | "indexed_recovery" | "legacy_persisted" | "none";
}

export interface DriftReport {
  hasDrift: boolean;
  driftType: "authority_mismatch" | "count_divergence" | "none";
  conversationListAuthority: DmReadAuthorityStatus["source"];
  timelineAuthority: DmReadAuthorityStatus["source"];
  projectionCount: number;
  indexedCount: number;
  persistedCount: number;
  timelineMessageCount: number;
}

export const detectDmAuthorityDrift = (params: DriftDetectionParams): DriftReport => {
  const authorityStatus = resolveDmReadAuthority({
    identityPubkey: params.identityPubkey,
    conversationId: params.conversationId,
    scopeVerified: params.scopeVerified,
    projectionReady: params.projectionReady,
    projectionMessages: params.projectionMessages,
    indexedMessages: params.indexedMessages,
    legacyPersistedMessages: params.persistedMessages,
    allowIndexedRecovery: true,
    allowLegacyRecovery: true,
  });

  const report: DriftReport = {
    hasDrift: false,
    driftType: "none",
    conversationListAuthority: authorityStatus.source,
    timelineAuthority: params.timelineSource,
    projectionCount: params.projectionMessages.length,
    indexedCount: params.indexedMessages.length,
    persistedCount: params.persistedMessages.length,
    timelineMessageCount: 0,
  };

  // Detect authority mismatch between conversation list and timeline
  if (authorityStatus.source !== params.timelineSource && params.timelineSource !== "none") {
    report.hasDrift = true;
    report.driftType = "authority_mismatch";
  }

  if (report.hasDrift) {
    logAppEvent({
      name: "dm_authority_drift_detected",
      level: "warn",
      scope: { feature: "messaging", action: "drift_detected" },
      context: {
        conversationId: params.conversationId,
        driftType: report.driftType,
        conversationListSource: report.conversationListAuthority,
        timelineSource: report.timelineAuthority,
        projectionCount: report.projectionCount,
        indexedCount: report.indexedCount,
        persistedCount: report.persistedCount,
        isCanonical: String(authorityStatus.isCanonical),
        reason: authorityStatus.reason,
      },
    });

    console.warn("[DmAuthorityDrift] Authority drift detected:", {
      conversationId: params.conversationId,
      driftType: report.driftType,
      conversationListSource: report.conversationListAuthority,
      timelineSource: report.timelineAuthority,
      projectionCount: report.projectionCount,
      indexedCount: report.indexedCount,
      persistedCount: report.persistedCount,
    });
  }

  return report;
};

export const formatDriftDiagnostics = (report: DriftReport): string => {
  if (!report.hasDrift) {
    return `[DriftDetector] No drift detected - authorities aligned (${report.conversationListAuthority})`;
  }
  return `[DriftDetector] DRIFT: type=${report.driftType}, list=${report.conversationListAuthority}, timeline=${report.timelineAuthority}, counts=[proj:${report.projectionCount}, idx:${report.indexedCount}, pst:${report.persistedCount}]`;
};
