import { beforeEach, describe, expect, it } from "vitest";
import { installM10TrustControlsBridge } from "./m10-trust-controls-bridge";
import { resetM10SharedIntelPolicyState } from "@/app/features/messaging/services/m10-shared-intel-policy";
import { logAppEvent } from "@/app/shared/log-app-event";

describe("m10-trust-controls-bridge", () => {
  beforeEach(() => {
    resetM10SharedIntelPolicyState();
    window.localStorage.clear();
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
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

  it("emits a canonical cp2 stability gate event when probe runs", () => {
    logAppEvent({
      name: "navigation.route_stall_hard_fallback",
      level: "warn",
      context: {
        targetRouteSurface: "chats",
        elapsedMs: 1200,
      },
    });
    logAppEvent({
      name: "navigation.page_transition_effects_disabled",
      level: "warn",
      context: {
        routeSurface: "chats",
        timeoutCount: 2,
      },
    });

    installM10TrustControlsBridge();
    const probe = window.obscurM10TrustControls?.runCp2StabilityGateProbe({
      expectedStable: true,
      eventWindowSize: 200,
    });
    expect(probe?.cp2TriageGate.pass).toBe(false);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const cp2GateEvents = diagnosticsApi?.findByName?.("messaging.m10.cp2_stability_gate", 10) ?? [];
    expect(cp2GateEvents).toHaveLength(1);
    expect(cp2GateEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp2Pass: false,
      failedCheckCount: expect.any(Number),
      failedCheckSample: expect.any(String),
      uiResponsivenessRiskLevel: "high",
      uiRouteStallHardFallbackCount: 1,
      uiPageTransitionEffectsDisabledCount: 1,
    }));
  });

  it("emits cp3 readiness gate event and surfaces unexpected cp2 fail posture", () => {
    logAppEvent({
      name: "messaging.m10.cp2_stability_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp2Pass: false,
        failedCheckCount: 1,
        failedCheckSample: "uiResponsivenessRiskNotHigh",
      },
    });

    installM10TrustControlsBridge();
    const capture = window.obscurM10TrustControls?.runCp3ReadinessCapture({
      expectedStable: true,
      eventWindowSize: 200,
    });
    expect(capture?.cp3ReadinessGate.pass).toBe(false);
    expect(capture?.cp3ReadinessGate.failedChecks).toContain("cp2UnexpectedFailCountZero");

    const relaxedGate = window.obscurM10TrustControls?.runCp3ReadinessGateProbe({
      expectedStable: false,
      eventWindowSize: 200,
    });
    expect(relaxedGate?.pass).toBe(true);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const cp3GateEvents = diagnosticsApi?.findByName?.("messaging.m10.cp3_readiness_gate", 10) ?? [];
    expect(cp3GateEvents.length).toBeGreaterThanOrEqual(2);
    expect(cp3GateEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp3Pass: false,
      cp2TriagePass: true,
      cp2StabilityGateUnexpectedFailCount: 1,
    }));
  });

  it("emits cp3 suite gate event and exposes suite gate verdict", () => {
    logAppEvent({
      name: "messaging.m10.cp3_readiness_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp3Pass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp2UnexpectedFailCountZero",
        cp2TriagePass: true,
        cp2StabilityGateUnexpectedFailCount: 1,
      },
    });

    installM10TrustControlsBridge();
    const suiteCapture = window.obscurM10TrustControls?.runCp3SuiteCapture({
      expectedStable: true,
      eventWindowSize: 200,
    });
    expect(suiteCapture?.cp3SuiteGate.pass).toBe(false);
    expect(suiteCapture?.cp3SuiteGate.failedChecks).toContain("cp3ReadinessUnexpectedFailCountZero");

    const relaxedSuiteGate = window.obscurM10TrustControls?.runCp3SuiteGateProbe({
      expectedStable: false,
      eventWindowSize: 200,
    });
    expect(relaxedSuiteGate?.pass).toBe(true);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const cp3SuiteGateEvents = diagnosticsApi?.findByName?.("messaging.m10.cp3_suite_gate", 10) ?? [];
    expect(cp3SuiteGateEvents.length).toBeGreaterThanOrEqual(2);
    expect(cp3SuiteGateEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp3SuitePass: false,
      cp3ReadinessPass: false,
      cp3ReadinessUnexpectedFailCount: expect.any(Number),
    }));
  });

  it("emits cp4 closeout gate event and exposes closeout gate verdict", () => {
    logAppEvent({
      name: "messaging.m10.cp3_suite_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp3SuitePass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp3ReadinessUnexpectedFailCountZero",
        cp3ReadinessPass: true,
        cp3ReadinessUnexpectedFailCount: 1,
      },
    });

    installM10TrustControlsBridge();
    const closeoutCapture = window.obscurM10TrustControls?.runCp4CloseoutCapture({
      expectedStable: true,
      eventWindowSize: 200,
    });
    expect(closeoutCapture?.cp4CloseoutGate.pass).toBe(false);
    expect(closeoutCapture?.cp4CloseoutGate.failedChecks).toContain("cp3SuiteUnexpectedFailCountZero");

    const relaxedCloseoutGate = window.obscurM10TrustControls?.runCp4CloseoutGateProbe({
      expectedStable: false,
      eventWindowSize: 200,
    });
    expect(relaxedCloseoutGate?.pass).toBe(true);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const cp4CloseoutEvents = diagnosticsApi?.findByName?.("messaging.m10.cp4_closeout_gate", 10) ?? [];
    expect(cp4CloseoutEvents.length).toBeGreaterThanOrEqual(2);
    expect(cp4CloseoutEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      cp4CloseoutPass: false,
      cp3SuitePass: false,
      cp3SuiteUnexpectedFailCount: expect.any(Number),
    }));
  });

  it("emits v130 closeout gate event and exposes aggregate closeout verdict", () => {
    logAppEvent({
      name: "messaging.m10.cp4_closeout_gate",
      level: "warn",
      context: {
        expectedStable: true,
        cp4CloseoutPass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp3SuiteUnexpectedFailCountZero",
        cp3SuitePass: false,
        cp3SuiteUnexpectedFailCount: 1,
      },
    });

    installM10TrustControlsBridge();
    const v130Capture = window.obscurM10TrustControls?.runV130CloseoutCapture({
      expectedStable: true,
      eventWindowSize: 200,
    });
    expect(v130Capture?.v130CloseoutGate.pass).toBe(false);
    expect(v130Capture?.v130CloseoutGate.failedChecks).toContain("cp4CloseoutUnexpectedFailCountZero");

    const relaxedV130Gate = window.obscurM10TrustControls?.runV130CloseoutGateProbe({
      expectedStable: false,
      eventWindowSize: 200,
    });
    expect(relaxedV130Gate?.pass).toBe(true);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const v130CloseoutEvents = diagnosticsApi?.findByName?.("messaging.m10.v130_closeout_gate", 10) ?? [];
    expect(v130CloseoutEvents.length).toBeGreaterThanOrEqual(2);
    expect(v130CloseoutEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      v130CloseoutPass: false,
      cp4CloseoutPass: false,
      cp4CloseoutUnexpectedFailCount: expect.any(Number),
    }));
  });

  it("emits v130 evidence gate event and exposes final closeout evidence verdict", () => {
    logAppEvent({
      name: "messaging.m10.v130_closeout_gate",
      level: "warn",
      context: {
        expectedStable: true,
        v130CloseoutPass: false,
        failedCheckCount: 1,
        failedCheckSample: "cp4CloseoutUnexpectedFailCountZero",
        cp4CloseoutPass: false,
        cp4CloseoutGateCount: 1,
        cp4CloseoutUnexpectedFailCount: 1,
      },
    });

    installM10TrustControlsBridge();
    const evidenceCapture = window.obscurM10TrustControls?.runV130EvidenceCapture({
      expectedStable: true,
      eventWindowSize: 200,
    });
    expect(evidenceCapture?.v130EvidenceGate.pass).toBe(false);
    expect(evidenceCapture?.v130EvidenceGate.failedChecks).toContain("v130CloseoutUnexpectedFailCountZero");

    const relaxedEvidenceGate = window.obscurM10TrustControls?.runV130EvidenceGateProbe({
      expectedStable: false,
      eventWindowSize: 200,
    });
    expect(relaxedEvidenceGate?.pass).toBe(true);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const v130EvidenceEvents = diagnosticsApi?.findByName?.("messaging.m10.v130_evidence_gate", 10) ?? [];
    expect(v130EvidenceEvents.length).toBeGreaterThanOrEqual(2);
    expect(v130EvidenceEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: true,
      v130EvidencePass: false,
      v130CloseoutPass: false,
      v130CloseoutUnexpectedFailCount: expect.any(Number),
      latestV130EventMatchesGate: true,
    }));
  });

  it("exports a one-copy v1.2.4 demo asset bundle with canonical event slices", () => {
    installM10TrustControlsBridge();
    const bundle = window.obscurM10TrustControls?.runV124DemoAssetBundleCapture({
      eventWindowSize: 200,
      expectedStable: false,
    });

    expect(bundle).toBeDefined();
    expect(bundle?.demoAssets.cp3ReadinessPass.cp3ReadinessGate).toBeDefined();
    expect(bundle?.demoAssets.cp3SuitePass.cp3SuiteGate).toBeDefined();
    expect(bundle?.demoAssets.cp4CloseoutPass.cp4CloseoutGate).toBeDefined();
    expect(bundle?.demoAssets.v130CloseoutPass.v130CloseoutGate).toBeDefined();
    expect(bundle?.demoAssets.v130EvidencePass.v130EvidenceGate).toBeDefined();

    expect(bundle?.demoAssets.eventSlices.events.cp2.length).toBeGreaterThan(0);
    expect(bundle?.demoAssets.eventSlices.events.cp3Readiness.length).toBeGreaterThan(0);
    expect(bundle?.demoAssets.eventSlices.events.cp3Suite.length).toBeGreaterThan(0);
    expect(bundle?.demoAssets.eventSlices.events.cp4Closeout.length).toBeGreaterThan(0);
    expect(bundle?.demoAssets.eventSlices.events.v130Closeout.length).toBeGreaterThan(0);
    expect(bundle?.demoAssets.eventSlices.events.v130Evidence.length).toBeGreaterThan(0);

    const bundleJson = window.obscurM10TrustControls?.runV124DemoAssetBundleCaptureJson({
      eventWindowSize: 200,
      expectedStable: false,
    });
    expect(bundleJson).toContain("\"demoAssets\"");
    expect(bundleJson).toContain("\"strictGatePreview\"");
  });

  it("exports a one-copy v1.3 release-candidate capture and emits canonical gate diagnostics", () => {
    installM10TrustControlsBridge();
    const capture = window.obscurM10TrustControls?.runV130ReleaseCandidateCapture({
      eventWindowSize: 200,
      expectedStable: false,
    });

    expect(capture).toBeDefined();
    expect(capture?.releaseCandidateGate.pass).toBe(true);
    expect(capture?.cp2TriageCapture.cp2TriageGate).toBeDefined();
    expect(capture?.v130EvidenceCapture.v130EvidenceGate).toBeDefined();
    expect(capture?.eventSlices.events.cp2.length).toBeGreaterThan(0);
    expect(capture?.eventSlices.events.cp3Readiness.length).toBeGreaterThan(0);
    expect(capture?.eventSlices.events.cp3Suite.length).toBeGreaterThan(0);
    expect(capture?.eventSlices.events.cp4Closeout.length).toBeGreaterThan(0);
    expect(capture?.eventSlices.events.v130Closeout.length).toBeGreaterThan(0);
    expect(capture?.eventSlices.events.v130Evidence.length).toBeGreaterThan(0);
    expect(capture?.eventSlices.events.v130ReleaseCandidate.length).toBeGreaterThan(0);

    const probe = window.obscurM10TrustControls?.runV130ReleaseCandidateGateProbe({
      eventWindowSize: 200,
      expectedStable: false,
    });
    expect(probe?.pass).toBe(true);

    const diagnosticsApi = (window as Window & {
      obscurAppEvents?: Readonly<{
        findByName?: (name: string, count?: number) => ReadonlyArray<Readonly<{
          context?: Readonly<Record<string, string | number | boolean | null>>;
        }>>;
      }>;
    }).obscurAppEvents;
    const releaseCandidateEvents = (
      diagnosticsApi?.findByName?.("messaging.m10.v130_release_candidate_gate", 10)
      ?? []
    );
    expect(releaseCandidateEvents.length).toBeGreaterThanOrEqual(2);
    expect(releaseCandidateEvents[0]?.context).toEqual(expect.objectContaining({
      expectedStable: false,
      v130ReleaseCandidatePass: true,
      v130EvidencePass: true,
      latestV130EvidenceEventMatchesGate: true,
    }));

    const captureJson = window.obscurM10TrustControls?.runV130ReleaseCandidateCaptureJson({
      eventWindowSize: 200,
      expectedStable: false,
    });
    expect(captureJson).toContain("\"releaseCandidateGate\"");
    expect(captureJson).toContain("\"eventSlices\"");
  });
});
