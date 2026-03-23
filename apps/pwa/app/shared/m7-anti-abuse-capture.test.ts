import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installM7AntiAbuseCapture,
  m7AntiAbuseCaptureInternals,
} from "./m7-anti-abuse-capture";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m7-anti-abuse-capture", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM7AntiAbuseCapture;
    delete root.obscurAppEvents;
    delete root.obscurM0Triage;
    vi.restoreAllMocks();
  });

  it("installs helper and captures anti-abuse diagnostics bundle", () => {
    const root = getMutableWindow();
    root.obscurAppEvents = {
      getCrossDeviceSyncDigest: () => ({
        summary: {
          incomingRequestAntiAbuse: {
            riskLevel: "watch",
            quarantinedCount: 2,
            peerRateLimitedCount: 1,
            peerCooldownActiveCount: 1,
            globalRateLimitedCount: 0,
            uniquePeerPrefixCount: 1,
            latestReasonCode: "incoming_connection_request_peer_cooldown_active",
            latestPeerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
            latestCooldownRemainingMs: 60000,
          },
        },
        events: {
          "messaging.request.incoming_quarantined": [{
            atUnixMs: 42,
            level: "warn",
            context: {
              reasonCode: "incoming_connection_request_peer_cooldown_active",
              peerPubkeyPrefix: "aaaaaaaaaaaaaaaa",
              cooldownRemainingMs: 60000,
            },
          }],
        },
        recentWarnOrError: [{
          name: "messaging.request.incoming_quarantined",
          level: "warn",
          atUnixMs: 42,
          reasonCode: "incoming_connection_request_peer_cooldown_active",
        }],
      }),
      findByName: (name: string) => [{ name, atUnixMs: 43, level: "warn" }],
    };
    (root as Record<string, unknown>).obscurM0Triage = {
      capture: () => ({ tag: "m0" }),
    };

    installM7AntiAbuseCapture();

    const api = root.obscurM7AntiAbuseCapture as {
      capture: (eventWindowSize?: number) => unknown;
      captureJson: (eventWindowSize?: number) => string;
    };
    expect(api).toBeTruthy();

    const bundle = api.capture(320) as {
      checks: { requiredApis: Record<string, boolean> };
      antiAbuse: {
        summary: Record<string, unknown> | null;
        compactQuarantineEvents: Array<{ context: Record<string, unknown> }>;
        recentQuarantinedEvents: Array<{ name: string }>;
        recentWarnOrError: Array<{ reasonCode: string | null }>;
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(true);
    expect(bundle.checks.requiredApis.m0Triage).toBe(true);
    expect(bundle.antiAbuse.summary).toEqual(expect.objectContaining({
      riskLevel: "watch",
      quarantinedCount: 2,
      peerCooldownActiveCount: 1,
      latestReasonCode: "incoming_connection_request_peer_cooldown_active",
    }));
    expect(bundle.antiAbuse.compactQuarantineEvents[0]?.context).toEqual(expect.objectContaining({
      reasonCode: "incoming_connection_request_peer_cooldown_active",
      cooldownRemainingMs: 60000,
    }));
    expect(bundle.antiAbuse.recentQuarantinedEvents[0]?.name).toBe("messaging.request.incoming_quarantined");
    expect(bundle.antiAbuse.recentWarnOrError[0]?.reasonCode).toBe("incoming_connection_request_peer_cooldown_active");
    expect(bundle.m0Triage).toEqual({ tag: "m0" });
    expect(() => JSON.parse(api.captureJson(320))).not.toThrow();
  });

  it("fails open when APIs are unavailable", () => {
    const root = getMutableWindow();
    installM7AntiAbuseCapture();

    const api = root.obscurM7AntiAbuseCapture as { capture: (eventWindowSize?: number) => unknown };
    const bundle = api.capture() as {
      checks: { requiredApis: Record<string, boolean> };
      antiAbuse: {
        summary: unknown;
        compactQuarantineEvents: unknown[];
        recentQuarantinedEvents: unknown[];
        recentWarnOrError: unknown[];
      };
      m0Triage: unknown;
    };

    expect(bundle.checks.requiredApis.appEvents).toBe(false);
    expect(bundle.checks.requiredApis.m0Triage).toBe(false);
    expect(bundle.antiAbuse.summary).toBeNull();
    expect(bundle.antiAbuse.compactQuarantineEvents).toEqual([]);
    expect(bundle.antiAbuse.recentQuarantinedEvents).toEqual([]);
    expect(bundle.antiAbuse.recentWarnOrError).toEqual([]);
    expect(bundle.m0Triage).toBeNull();
  });

  it("normalizes malformed summary payloads and invalid window values", () => {
    expect(m7AntiAbuseCaptureInternals.parseIncomingRequestAntiAbuseSummary(null)).toBeNull();
    expect(m7AntiAbuseCaptureInternals.parseIncomingRequestAntiAbuseSummary({ riskLevel: "broken" })).toBeNull();
    expect(m7AntiAbuseCaptureInternals.parseIncomingRequestAntiAbuseSummary({
      riskLevel: "high",
      quarantinedCount: 7,
      peerRateLimitedCount: 2,
      peerCooldownActiveCount: 3,
      globalRateLimitedCount: 1,
      uniquePeerPrefixCount: 2,
      latestReasonCode: "incoming_connection_request_global_rate_limited",
      latestPeerPubkeyPrefix: "bbbbbbbbbbbbbbbb",
      latestCooldownRemainingMs: 0,
    })).toEqual(expect.objectContaining({
      riskLevel: "high",
      quarantinedCount: 7,
      globalRateLimitedCount: 1,
      latestReasonCode: "incoming_connection_request_global_rate_limited",
    }));
    expect(m7AntiAbuseCaptureInternals.toNumericWindowSize(410.7)).toBe(410);
    expect(m7AntiAbuseCaptureInternals.toNumericWindowSize(0)).toBe(1);
    expect(m7AntiAbuseCaptureInternals.toNumericWindowSize(Number.NaN)).toBe(400);
  });
});
