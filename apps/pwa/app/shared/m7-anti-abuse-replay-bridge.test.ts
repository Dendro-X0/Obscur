import { beforeEach, describe, expect, it, vi } from "vitest";
import { installM7AntiAbuseCapture } from "./m7-anti-abuse-capture";
import { installM7AntiAbuseReplayBridge } from "./m7-anti-abuse-replay-bridge";
import { resetIncomingRequestAntiAbuseState } from "@/app/features/messaging/services/incoming-request-anti-abuse";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m7-anti-abuse-replay-bridge", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM7AntiAbuseReplay;
    delete root.obscurM7AntiAbuseCapture;
    delete root.obscurAppEvents;
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    resetIncomingRequestAntiAbuseState();
    vi.restoreAllMocks();
  });

  it("replays peer rate-limit then cooldown-active evidence and marks CP3 readiness", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    installM7AntiAbuseCapture();
    installM7AntiAbuseReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM7AntiAbuseReplay as {
      runPeerCooldownReplay: (params?: {
        peerPublicKeyHex?: string;
        baseUnixMs?: number;
        stepMs?: number;
        attemptCount?: number;
      }) => {
        quarantineEventCount: number;
        attempts: ReadonlyArray<{ quarantineReasonCode: string | null; allowed: boolean }>;
        replayReadiness: { readyForCp3Evidence: boolean } | null;
      };
    };

    const result = replayApi.runPeerCooldownReplay({
      peerPublicKeyHex: "a".repeat(64),
      baseUnixMs: 50_000,
      stepMs: 100,
      attemptCount: 5,
    });

    expect(result.quarantineEventCount).toBe(2);
    expect(
      result.attempts
        .filter((attempt) => attempt.allowed === false)
        .map((attempt) => attempt.quarantineReasonCode),
    ).toEqual([
      "incoming_connection_request_peer_rate_limited",
      "incoming_connection_request_peer_cooldown_active",
    ]);
    expect(result.replayReadiness?.readyForCp3Evidence).toBe(true);

    const diagnosticsApi = root.obscurAppEvents as {
      findByName: (name: string, count?: number) => ReadonlyArray<{
        context?: Record<string, unknown>;
      }>;
    };
    const quarantineEvents = diagnosticsApi.findByName("messaging.request.incoming_quarantined", 10);
    expect(quarantineEvents).toHaveLength(2);
    expect(quarantineEvents.map((event) => event.context?.reasonCode)).toEqual([
      "incoming_connection_request_peer_rate_limited",
      "incoming_connection_request_peer_cooldown_active",
    ]);
  });

  it("exports combined replay and capture JSON bundle", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    installM7AntiAbuseCapture();
    installM7AntiAbuseReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM7AntiAbuseReplay as {
      runPeerCooldownReplayCaptureJson: (params?: {
        peerPublicKeyHex?: string;
        attemptCount?: number;
        stepMs?: number;
        baseUnixMs?: number;
      }) => string;
    };

    const payload = JSON.parse(
      replayApi.runPeerCooldownReplayCaptureJson({
        peerPublicKeyHex: "b".repeat(64),
        attemptCount: 5,
        stepMs: 100,
        baseUnixMs: 80_000,
      }),
    ) as {
      replay?: { replayReadiness?: { readyForCp3Evidence?: boolean } };
      capture?: { antiAbuse?: { replayReadiness?: { readyForCp3Evidence?: boolean } } };
    };

    expect(payload.replay?.replayReadiness?.readyForCp3Evidence).toBe(true);
    expect(payload.capture?.antiAbuse?.replayReadiness?.readyForCp3Evidence).toBe(true);
  });
});
