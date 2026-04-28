"use client";

import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

export interface DmVisibilityDiagnosticEntry {
  eventId: string;
  authorPubkey: string;
  recipientPubkey?: string;
  kind: number;
  receivedAt: number;
  relayUrl: string;
  processingStage:
    | "received"
    | "decrypting"
    | "decrypted"
    | "routed"
    | "rendered"
    | "filtered_out"
    | "error";
  error?: string;
  conversationId?: string;
  messageId?: string;
}

const visibilityLog: DmVisibilityDiagnosticEntry[] = [];
const MAX_LOG_SIZE = 1000;

export const logDmVisibilityEvent = (
  entry: Omit<DmVisibilityDiagnosticEntry, "receivedAt">
): void => {
  const fullEntry: DmVisibilityDiagnosticEntry = {
    ...entry,
    receivedAt: Date.now(),
  };

  visibilityLog.push(fullEntry);
  if (visibilityLog.length > MAX_LOG_SIZE) {
    visibilityLog.shift();
  }

  logRuntimeEvent(
    "dm_visibility",
    entry.processingStage === "error" || entry.processingStage === "filtered_out"
      ? "actionable"
      : "expected",
    [`[DmVisibility] ${entry.processingStage} - event:${entry.eventId?.slice(0, 16)} from:${entry.authorPubkey?.slice(0, 16)}`]
  );

  // Only log errors and filtered messages to console
  if (entry.processingStage === "error" || entry.processingStage === "filtered_out") {
    console.warn(`[DmVisibility] ${entry.processingStage}:`, {
      eventId: entry.eventId?.slice(0, 16),
      author: entry.authorPubkey?.slice(0, 16),
      recipient: entry.recipientPubkey?.slice(0, 16),
      error: entry.error,
      stage: entry.processingStage,
    });
  }
};

export const getDmVisibilityDiagnostics = (): {
  recent: DmVisibilityDiagnosticEntry[];
  stats: {
    total: number;
    byStage: Record<DmVisibilityDiagnosticEntry["processingStage"], number>;
    byAuthor: Record<string, number>;
  };
} => {
  const stats = {
    total: visibilityLog.length,
    byStage: {
      received: 0,
      decrypting: 0,
      decrypted: 0,
      routed: 0,
      rendered: 0,
      filtered_out: 0,
      error: 0,
    },
    byAuthor: {} as Record<string, number>,
  };

  for (const entry of visibilityLog) {
    stats.byStage[entry.processingStage]++;
    stats.byAuthor[entry.authorPubkey] = (stats.byAuthor[entry.authorPubkey] || 0) + 1;
  }

  return {
    recent: visibilityLog.slice(-50),
    stats,
  };
};

export const analyzeVisibilityGap = (authorPubkey: string): {
  eventsFromAuthor: number;
  reachedStage: DmVisibilityDiagnosticEntry["processingStage"][];
  stuckAt: DmVisibilityDiagnosticEntry["processingStage"] | null;
  lastEventAt: number | null;
} => {
  const authorEvents = visibilityLog.filter((e) => e.authorPubkey === authorPubkey);

  if (authorEvents.length === 0) {
    return {
      eventsFromAuthor: 0,
      reachedStage: [],
      stuckAt: null,
      lastEventAt: null,
    };
  }

  const stages = authorEvents.map((e) => e.processingStage);
  const uniqueStages = [...new Set(stages)];
  const lastEvent = authorEvents[authorEvents.length - 1];

  // Find where most events get stuck
  const stageCounts: Record<string, number> = {};
  for (const stage of stages) {
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }
  const maxStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0];
  const stuckAt = maxStage && maxStage[1] > 1 ? (maxStage[0] as DmVisibilityDiagnosticEntry["processingStage"]) : null;

  return {
    eventsFromAuthor: authorEvents.length,
    reachedStage: uniqueStages,
    stuckAt,
    lastEventAt: lastEvent.receivedAt,
  };
};

// Global diagnostics export for console debugging
if (typeof window !== "undefined") {
  (window as Window & { dmVisibilityDiagnostics?: typeof getDmVisibilityDiagnostics }).dmVisibilityDiagnostics = getDmVisibilityDiagnostics;
}
