"use client";

import { PrivacySettingsService, type DiscoveryFeatureFlags } from "@/app/features/settings/services/privacy-settings-service";
import { logAppEvent } from "@/app/shared/log-app-event";
import type {
  DiscoveryIntent,
  DiscoveryQueryState,
  DiscoveryResult,
} from "@/app/features/search/types/discovery";
import { resolvePrimaryDiscoverySource } from "./discovery-identity-contract";

type LookupRunId = string;

type DiscoveryLookupSnapshot = Readonly<{
  runId: LookupRunId;
  intent: DiscoveryIntent;
  queryLength: number;
  startedAtUnixMs: number;
  completedAtUnixMs?: number;
  latencyMs?: number;
  resultCount: number;
  phase: DiscoveryQueryState["phase"];
  reasonCode?: DiscoveryQueryState["reasonCode"];
  primaryMatchSource: ReturnType<typeof resolvePrimaryDiscoverySource>;
}>;

type DiscoveryAddConversionSnapshot = Readonly<{
  atUnixMs: number;
  canonicalId: string;
  kind: DiscoveryResult["kind"];
  confidence: DiscoveryResult["confidence"];
  primarySource: ReturnType<typeof resolvePrimaryDiscoverySource>;
}>;

export type DiscoverySessionDiagnosticsSnapshot = Readonly<{
  sessionStartedAtUnixMs: number;
  lookupCount: number;
  addConversionCount: number;
  flags: DiscoveryFeatureFlags;
  lastLookup?: DiscoveryLookupSnapshot;
  lastConversion?: DiscoveryAddConversionSnapshot;
}>;

type DiscoveryDiagnosticsTools = Readonly<{
  getSnapshot: () => DiscoverySessionDiagnosticsSnapshot;
  clear: () => void;
}>;

declare global {
  interface Window {
    obscurDiscoveryDiagnostics?: DiscoveryDiagnosticsTools;
  }
}

const createDefaultSnapshot = (): DiscoverySessionDiagnosticsSnapshot => ({
  sessionStartedAtUnixMs: Date.now(),
  lookupCount: 0,
  addConversionCount: 0,
  flags: PrivacySettingsService.getDiscoveryFeatureFlags(),
});

let snapshot: DiscoverySessionDiagnosticsSnapshot = createDefaultSnapshot();
const runStartTimes = new Map<LookupRunId, number>();

const installTools = (): void => {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return;
  }
  window.obscurDiscoveryDiagnostics = {
    getSnapshot: () => snapshot,
    clear: () => {
      snapshot = createDefaultSnapshot();
      runStartTimes.clear();
      installTools();
    },
  };
};

const updateSnapshot = (
  updater: (current: DiscoverySessionDiagnosticsSnapshot) => DiscoverySessionDiagnosticsSnapshot,
): void => {
  snapshot = updater(snapshot);
  installTools();
};

const toLookupRunId = (): LookupRunId => `lookup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const toQueryLength = (query: string): number => query.trim().length;

export const discoverySessionDiagnosticsStore = {
  getSnapshot(): DiscoverySessionDiagnosticsSnapshot {
    installTools();
    return snapshot;
  },
  clear(): void {
    snapshot = createDefaultSnapshot();
    runStartTimes.clear();
    installTools();
  },
  startLookup(params: Readonly<{ intent: DiscoveryIntent; query: string }>): LookupRunId {
    const runId = toLookupRunId();
    const startedAtUnixMs = Date.now();
    runStartTimes.set(runId, startedAtUnixMs);
    updateSnapshot((current) => ({
      ...current,
      flags: PrivacySettingsService.getDiscoveryFeatureFlags(),
      lastLookup: {
        runId,
        intent: params.intent,
        queryLength: toQueryLength(params.query),
        startedAtUnixMs,
        resultCount: 0,
        phase: "running",
        primaryMatchSource: "none",
      },
    }));
    return runId;
  },
  completeLookup(params: Readonly<{
    runId: LookupRunId;
    state: DiscoveryQueryState;
    results: ReadonlyArray<DiscoveryResult>;
  }>): void {
    const completedAtUnixMs = Date.now();
    const startedAtUnixMs = runStartTimes.get(params.runId) ?? completedAtUnixMs;
    runStartTimes.delete(params.runId);
    const latencyMs = Math.max(0, completedAtUnixMs - startedAtUnixMs);
    const primaryMatchSource = resolvePrimaryDiscoverySource(params.results[0]?.sources ?? []);
    updateSnapshot((current) => ({
      ...current,
      lookupCount: current.lookupCount + 1,
      flags: PrivacySettingsService.getDiscoveryFeatureFlags(),
      lastLookup: {
        runId: params.runId,
        intent: params.state.intent,
        queryLength: toQueryLength(params.state.query),
        startedAtUnixMs,
        completedAtUnixMs,
        latencyMs,
        resultCount: params.results.length,
        phase: params.state.phase,
        reasonCode: params.state.reasonCode,
        primaryMatchSource,
      },
    }));
    logAppEvent({
      name: "discovery.lookup_complete",
      level: "info",
      scope: { feature: "discovery", action: "lookup" },
      context: {
        latencyMs,
        resultCount: params.results.length,
        intent: params.state.intent,
        phase: params.state.phase,
        reasonCode: params.state.reasonCode ?? null,
        primaryMatchSource,
      },
    });
  },
  recordAddContactConversion(params: Readonly<{ result: DiscoveryResult }>): void {
    const conversion: DiscoveryAddConversionSnapshot = {
      atUnixMs: Date.now(),
      canonicalId: params.result.canonicalId,
      kind: params.result.kind,
      confidence: params.result.confidence,
      primarySource: resolvePrimaryDiscoverySource(params.result.sources),
    };
    updateSnapshot((current) => ({
      ...current,
      addConversionCount: current.addConversionCount + 1,
      flags: PrivacySettingsService.getDiscoveryFeatureFlags(),
      lastConversion: conversion,
    }));
    logAppEvent({
      name: "discovery.add_contact_conversion",
      level: "info",
      scope: { feature: "discovery", action: "add_contact" },
      context: {
        kind: conversion.kind,
        confidence: conversion.confidence,
        primarySource: conversion.primarySource,
      },
    });
  },
};
