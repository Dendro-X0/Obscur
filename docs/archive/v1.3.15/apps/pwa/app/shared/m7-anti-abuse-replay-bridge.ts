import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  evaluateIncomingRequestAntiAbuse,
  resetIncomingRequestAntiAbuseState,
  type IncomingRequestAntiAbuseDecision,
} from "@/app/features/messaging/services/incoming-request-anti-abuse";
import { logAppEvent } from "@/app/shared/log-app-event";
import type { M7AntiAbuseCaptureBundle } from "@/app/shared/m7-anti-abuse-capture";

type M7AntiAbuseReplayAttempt = Readonly<{
  attemptNumber: number;
  atUnixMs: number;
  allowed: boolean;
  decisionReasonCode: IncomingRequestAntiAbuseDecision["reasonCode"];
  quarantineReasonCode: string | null;
  peerWindowCount: number;
  globalWindowCount: number;
  cooldownRemainingMs: number | null;
}>;

export type M7AntiAbuseReplayResult = Readonly<{
  generatedAtUnixMs: number;
  peerPubkeyPrefix: string;
  attempts: ReadonlyArray<M7AntiAbuseReplayAttempt>;
  quarantineEventCount: number;
  latestDigestSummary: Readonly<{
    riskLevel: "none" | "watch" | "high";
    quarantinedCount: number;
    peerRateLimitedCount: number;
    peerCooldownActiveCount: number;
    globalRateLimitedCount: number;
    uniquePeerPrefixCount: number;
    latestReasonCode: string | null;
    latestPeerPubkeyPrefix: string | null;
    latestCooldownRemainingMs: number | null;
  }> | null;
  replayReadiness: Readonly<{
    hasPeerRateLimited: boolean;
    hasPeerCooldownActive: boolean;
    hasExpectedReasonTransition: boolean;
    digestHasPeerRateLimitedCount: boolean;
    digestHasPeerCooldownActiveCount: boolean;
    readyForCp3Evidence: boolean;
  }> | null;
}>;

type M7AntiAbuseReplayApi = Readonly<{
  reset: (params?: Readonly<{ clearAppEvents?: boolean }>) => void;
  getLastReplay: () => M7AntiAbuseReplayResult | null;
  runPeerCooldownReplay: (params?: Readonly<{
    peerPublicKeyHex?: PublicKeyHex;
    baseUnixMs?: number;
    stepMs?: number;
    attemptCount?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
  }>) => M7AntiAbuseReplayResult;
  runPeerCooldownReplayCaptureJson: (params?: Readonly<{
    peerPublicKeyHex?: PublicKeyHex;
    baseUnixMs?: number;
    stepMs?: number;
    attemptCount?: number;
    captureWindowSize?: number;
    clearAppEvents?: boolean;
  }>) => string;
}>;

type M7AntiAbuseReplayWindow = Window & {
  obscurM7AntiAbuseReplay?: M7AntiAbuseReplayApi;
  obscurM7AntiAbuseCapture?: Readonly<{
    capture?: (eventWindowSize?: number) => M7AntiAbuseCaptureBundle;
  }>;
  obscurAppEvents?: Readonly<{
    clear?: () => void;
    getCrossDeviceSyncDigest?: (count?: number) => Readonly<{
      summary?: Readonly<{
        incomingRequestAntiAbuse?: M7AntiAbuseReplayResult["latestDigestSummary"];
      }>;
    }>;
  }>;
};

declare global {
  interface Window {
    obscurM7AntiAbuseReplay?: M7AntiAbuseReplayApi;
  }
}

const toReasonCode = (decisionReasonCode: IncomingRequestAntiAbuseDecision["reasonCode"]): string => (
  `incoming_connection_request_${decisionReasonCode}`
);

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }
  return fallback;
};

const logQuarantineEvent = (params: Readonly<{
  peerPubkeyPrefix: string;
  decision: IncomingRequestAntiAbuseDecision;
}>): string | null => {
  if (params.decision.allowed) {
    return null;
  }
  const reasonCode = toReasonCode(params.decision.reasonCode);
  logAppEvent({
    name: "messaging.request.incoming_quarantined",
    level: "warn",
    scope: { feature: "messaging", action: "incoming_request" },
    context: {
      reasonCode,
      peerPubkeyPrefix: params.peerPubkeyPrefix,
      peerWindowCount: params.decision.peerWindowCount,
      globalWindowCount: params.decision.globalWindowCount,
      peerLimit: params.decision.peerLimit,
      globalLimit: params.decision.globalLimit,
      windowMs: params.decision.windowMs,
      peerCooldownMs: params.decision.peerCooldownMs,
      cooldownRemainingMs: params.decision.cooldownRemainingMs,
    },
  });
  return reasonCode;
};

export const installM7AntiAbuseReplayBridge = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  const root = window as M7AntiAbuseReplayWindow;
  if (root.obscurM7AntiAbuseReplay) {
    return;
  }

  let lastReplay: M7AntiAbuseReplayResult | null = null;

  root.obscurM7AntiAbuseReplay = {
    reset: (params) => {
      resetIncomingRequestAntiAbuseState();
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      lastReplay = null;
    },
    getLastReplay: () => lastReplay,
    runPeerCooldownReplay: (params) => {
      if (params?.clearAppEvents) {
        root.obscurAppEvents?.clear?.();
      }
      resetIncomingRequestAntiAbuseState();

      const peerPublicKeyHex = (params?.peerPublicKeyHex ?? "a".repeat(64)) as PublicKeyHex;
      const peerPubkeyPrefix = peerPublicKeyHex.slice(0, 16);
      const baseUnixMs = typeof params?.baseUnixMs === "number" && Number.isFinite(params.baseUnixMs)
        ? Math.floor(params.baseUnixMs)
        : Date.now();
      const stepMs = toPositiveInteger(params?.stepMs, 100);
      const attemptCount = toPositiveInteger(params?.attemptCount, 5);
      const captureWindowSize = toPositiveInteger(params?.captureWindowSize, 400);

      const attempts: M7AntiAbuseReplayAttempt[] = [];
      for (let index = 0; index < attemptCount; index += 1) {
        const atUnixMs = baseUnixMs + (index * stepMs);
        const decision = evaluateIncomingRequestAntiAbuse({
          peerPublicKeyHex,
          nowUnixMs: atUnixMs,
        });
        const quarantineReasonCode = logQuarantineEvent({
          peerPubkeyPrefix,
          decision,
        });
        attempts.push({
          attemptNumber: index + 1,
          atUnixMs,
          allowed: decision.allowed,
          decisionReasonCode: decision.reasonCode,
          quarantineReasonCode,
          peerWindowCount: decision.peerWindowCount,
          globalWindowCount: decision.globalWindowCount,
          cooldownRemainingMs: decision.cooldownRemainingMs,
        });
      }

      const digestSummary = root.obscurAppEvents?.getCrossDeviceSyncDigest?.(captureWindowSize)
        ?.summary?.incomingRequestAntiAbuse ?? null;
      const replayReadiness = root.obscurM7AntiAbuseCapture
        ?.capture?.(captureWindowSize)?.antiAbuse?.replayReadiness ?? null;
      lastReplay = {
        generatedAtUnixMs: Date.now(),
        peerPubkeyPrefix,
        attempts,
        quarantineEventCount: attempts.filter((attempt) => attempt.allowed === false).length,
        latestDigestSummary: digestSummary,
        replayReadiness: replayReadiness
          ? {
            hasPeerRateLimited: replayReadiness.hasPeerRateLimited,
            hasPeerCooldownActive: replayReadiness.hasPeerCooldownActive,
            hasExpectedReasonTransition: replayReadiness.hasExpectedReasonTransition,
            digestHasPeerRateLimitedCount: replayReadiness.digestHasPeerRateLimitedCount,
            digestHasPeerCooldownActiveCount: replayReadiness.digestHasPeerCooldownActiveCount,
            readyForCp3Evidence: replayReadiness.readyForCp3Evidence,
          }
          : null,
      };
      return lastReplay;
    },
    runPeerCooldownReplayCaptureJson: (params) => (
      JSON.stringify(
        {
          replay: root.obscurM7AntiAbuseReplay?.runPeerCooldownReplay(params) ?? null,
          capture: root.obscurM7AntiAbuseCapture?.capture?.(
            toPositiveInteger(params?.captureWindowSize, 400),
          ) ?? null,
        },
        null,
        2,
      )
    ),
  };
};
