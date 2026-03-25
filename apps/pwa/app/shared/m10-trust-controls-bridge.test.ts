import { beforeEach, describe, expect, it } from "vitest";
import { installM10TrustControlsBridge } from "./m10-trust-controls-bridge";
import { resetM10SharedIntelPolicyState } from "@/app/features/messaging/services/m10-shared-intel-policy";

describe("m10-trust-controls-bridge", () => {
  beforeEach(() => {
    resetM10SharedIntelPolicyState();
    window.localStorage.clear();
    delete (window as Window & { obscurM10TrustControls?: unknown }).obscurM10TrustControls;
    delete (window as Window & { obscurAppEvents?: unknown }).obscurAppEvents;
  });

  it("installs bridge and manages attack-mode profile + signals", () => {
    installM10TrustControlsBridge();
    const api = window.obscurM10TrustControls;
    expect(api).toBeDefined();

    expect(api?.getSnapshot().attackModeSafetyProfile).toBe("standard");
    const effectiveProfile = api?.setAttackModeSafetyProfile("strict");
    expect(effectiveProfile).toBe("strict");
    expect(api?.getSnapshot().attackModeSafetyProfile).toBe("strict");

    const signalCount = api?.replaceSignedSharedIntelSignals([
      {
        version: "obscur.m10.shared_intel.v1",
        signalId: "bridge-signal-1",
        subjectType: "relay_host",
        subjectValue: "relay.bad.example",
        disposition: "block",
        confidenceScore: 88,
        reasonCode: "relay_known_spam_cluster",
        issuedAtUnixMs: Date.now() - 500,
        expiresAtUnixMs: Date.now() + 60_000,
        signerPublicKeyHex: "c".repeat(64) as any,
        signatureHex: "signed",
      },
    ]);
    expect(signalCount).toBe(1);
    expect(api?.getSnapshot().signalCount).toBe(1);

    const exported = api?.exportSignedSharedIntelSignalsJson() ?? "[]";
    expect(exported).toContain("bridge-signal-1");
  });

  it("captures only attack-mode quarantine events", () => {
    (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName: (name: string, count?: number) => ReadonlyArray<Readonly<{
          name: string;
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents = {
      findByName: (name: string) => {
        if (name === "messaging.request.incoming_quarantined") {
          return ([
            {
              name: "messaging.request.incoming_quarantined",
              context: {
                reasonCode: "incoming_connection_request_attack_mode_strict_relay_high_risk",
              },
            },
            {
              name: "messaging.request.incoming_quarantined",
              context: {
                reasonCode: "incoming_connection_request_peer_rate_limited",
              },
            },
          ]);
        }
        if (name === "messaging.m10.trust_controls_profile_changed") {
          return ([
            {
              name: "messaging.m10.trust_controls_profile_changed",
              atUnixMs: 10,
              context: {
                profile: "strict",
              },
            },
          ]);
        }
        if (name === "navigation.route_mount_probe_slow") {
          return ([
            {
              name: "navigation.route_mount_probe_slow",
              atUnixMs: 11,
              context: {
                routeSurface: "chats",
                elapsedMs: 1800,
              },
            },
          ]);
        }
        return [];
      },
    };

    installM10TrustControlsBridge();
    const capture = window.obscurM10TrustControls?.capture(200);
    expect(capture?.recentAttackModeQuarantineEvents).toHaveLength(1);
    expect(capture?.recentAttackModeQuarantineEvents[0]?.context?.reasonCode).toBe(
      "incoming_connection_request_attack_mode_strict_relay_high_risk",
    );
    expect(capture?.recentTrustControlEvents).toHaveLength(1);
    expect(capture?.recentTrustControlEvents[0]?.name).toBe("messaging.m10.trust_controls_profile_changed");
    expect(capture?.recentResponsivenessEvents).toHaveLength(1);
    expect(capture?.recentResponsivenessEvents[0]?.name).toBe("navigation.route_mount_probe_slow");
  });

  it("ingests signals from JSON and reports invalid JSON deterministically", () => {
    installM10TrustControlsBridge();
    const api = window.obscurM10TrustControls;
    const okResult = api?.ingestSignedSharedIntelSignalsJson({
      payloadJson: JSON.stringify({
        signals: [
          {
            version: "obscur.m10.shared_intel.v1",
            signalId: "ingest-json-1",
            subjectType: "relay_host",
            subjectValue: "relay.bad.example",
            disposition: "watch",
            confidenceScore: 60,
            reasonCode: "relay_watch",
            issuedAtUnixMs: Date.now() - 1000,
            expiresAtUnixMs: Date.now() + 60_000,
            signerPublicKeyHex: "d".repeat(64),
            signatureHex: "sig",
          },
        ],
      }),
      requireSignatureVerification: false,
      replaceExisting: true,
    });
    expect(okResult?.acceptedCount).toBe(1);
    expect(api?.getSnapshot().signalCount).toBe(1);

    const badJsonResult = api?.ingestSignedSharedIntelSignalsJson({
      payloadJson: "{not json}",
    });
    expect(badJsonResult?.rejectedByReason.invalid_shape).toBe(1);
    expect(badJsonResult?.rejectedSignalIdSamples).toContain("invalid_json");
  });

  it("produces cp2 triage gate verdict from anti-abuse + responsiveness digest signals", () => {
    (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName: (name: string, count?: number) => ReadonlyArray<Readonly<{
          name: string;
          atUnixMs?: number;
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
        getCrossDeviceSyncDigest: (count?: number) => Readonly<{
          summary: Readonly<{
            incomingRequestAntiAbuse: Readonly<{
              riskLevel: "watch" | "none" | "high";
              quarantinedCount: number;
              latestReasonCode: string | null;
            }>;
            uiResponsiveness: Readonly<{
              riskLevel: "watch" | "none" | "high";
              routeStallHardFallbackCount: number;
              routeMountProbeSlowCount: number;
              pageTransitionWatchdogTimeoutCount: number;
              pageTransitionEffectsDisabledCount: number;
              startupProfileBootStallTimeoutCount: number;
              latestRouteSurface: string | null;
            }>;
          }>;
        }>;
      }>;
    }).obscurAppEvents = {
      findByName: () => [],
      getCrossDeviceSyncDigest: () => ({
        summary: {
          incomingRequestAntiAbuse: {
            riskLevel: "watch",
            quarantinedCount: 1,
            latestReasonCode: "incoming_connection_request_peer_rate_limited",
          },
          uiResponsiveness: {
            riskLevel: "high",
            routeStallHardFallbackCount: 1,
            routeMountProbeSlowCount: 2,
            pageTransitionWatchdogTimeoutCount: 1,
            pageTransitionEffectsDisabledCount: 1,
            startupProfileBootStallTimeoutCount: 0,
            latestRouteSurface: "chats",
          },
        },
      }),
    };

    installM10TrustControlsBridge();
    const capture = window.obscurM10TrustControls?.runCp2TriageCapture({ expectedStable: true, eventWindowSize: 200 });
    expect(capture?.cp2TriageGate.pass).toBe(false);
    expect(capture?.cp2TriageGate.failedChecks).toContain("uiResponsivenessRiskNotHigh");
    expect(capture?.cp2TriageGate.failedChecks).toContain("routeStallHardFallbackCountZero");
    expect(capture?.cp2TriageGate.failedChecks).toContain("transitionEffectsDisabledCountZero");

    const relaxedCapture = window.obscurM10TrustControls?.runCp2TriageCapture({ expectedStable: false, eventWindowSize: 200 });
    expect(relaxedCapture?.cp2TriageGate.pass).toBe(true);
  });
});
