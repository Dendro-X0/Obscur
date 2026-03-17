import { beforeEach, describe, expect, it } from "vitest";
import { discoverySessionDiagnosticsStore } from "./discovery-session-diagnostics";
import { PrivacySettingsService, defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import type { DiscoveryQueryState, DiscoveryResult } from "@/app/features/search/types/discovery";

describe("discovery-session-diagnostics", () => {
  beforeEach(() => {
    localStorage.clear();
    PrivacySettingsService.saveSettings(defaultPrivacySettings);
    discoverySessionDiagnosticsStore.clear();
  });

  it("captures lookup completion latency and match source", () => {
    const runId = discoverySessionDiagnosticsStore.startLookup({
      intent: "add_friend",
      query: "OBSCUR-ABCD12",
    });
    const state: DiscoveryQueryState = {
      intent: "add_friend",
      query: "OBSCUR-ABCD12",
      phase: "complete",
      elapsedMs: 10,
      sourceStatusMap: {
        local: { state: "success" },
        relay: { state: "idle" },
        index: { state: "idle" },
      },
    };
    const results: ReadonlyArray<DiscoveryResult> = [{
      canonicalId: "pk-a",
      kind: "person",
      display: { title: "Alice", pubkey: "f".repeat(64) },
      confidence: "direct",
      sources: ["local"],
      score: 100,
      freshnessUnixMs: Date.now(),
    }];

    discoverySessionDiagnosticsStore.completeLookup({
      runId,
      state,
      results,
    });

    const snapshot = discoverySessionDiagnosticsStore.getSnapshot();
    expect(snapshot.lookupCount).toBe(1);
    expect(snapshot.lastLookup?.resultCount).toBe(1);
    expect(snapshot.lastLookup?.primaryMatchSource).toBe("local");
    expect(typeof snapshot.lastLookup?.latencyMs).toBe("number");
  });

  it("records add-contact conversion events", () => {
    discoverySessionDiagnosticsStore.recordAddContactConversion({
      result: {
        canonicalId: "pk-b",
        kind: "invite",
        display: { title: "Bob", pubkey: "e".repeat(64), inviteCode: "OBSCUR-BOB123" },
        confidence: "relay_confirmed",
        sources: ["relay"],
        score: 88,
        freshnessUnixMs: Date.now(),
      },
    });

    const snapshot = discoverySessionDiagnosticsStore.getSnapshot();
    expect(snapshot.addConversionCount).toBe(1);
    expect(snapshot.lastConversion).toEqual(expect.objectContaining({
      canonicalId: "pk-b",
      primarySource: "relay",
    }));
  });

  it("tracks discovery feature flags in snapshot", () => {
    PrivacySettingsService.saveSettings({
      ...defaultPrivacySettings,
      discoveryInviteCodeV1: true,
      discoveryDeepLinkV1: true,
      discoverySuggestionsV1: false,
    });
    discoverySessionDiagnosticsStore.clear();
    discoverySessionDiagnosticsStore.startLookup({
      intent: "add_friend",
      query: "alice",
    });

    const snapshot = discoverySessionDiagnosticsStore.getSnapshot();
    expect(snapshot.flags).toEqual({
      inviteCodeV1: true,
      deepLinkV1: true,
      suggestionsV1: false,
    });
  });
});
