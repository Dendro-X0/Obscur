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
      findByName: () => ([
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
      ]),
    };

    installM10TrustControlsBridge();
    const capture = window.obscurM10TrustControls?.capture(200);
    expect(capture?.recentAttackModeQuarantineEvents).toHaveLength(1);
    expect(capture?.recentAttackModeQuarantineEvents[0]?.context?.reasonCode).toBe(
      "incoming_connection_request_attack_mode_strict_relay_high_risk",
    );
  });
});
