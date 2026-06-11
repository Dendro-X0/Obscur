import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Recipient-local warning tier — delivery invariant: tier never blocks message arrival. */
export type TrustWarningTier = "none" | "info" | "elevated" | "critical";

export type TrustSignalId =
  | "contact.cold"
  | "thread.pivot_financial"
  | "commerce.urgency_pressure";

export const BUNDLE_FIN_COLD = "BUNDLE_FIN_COLD";

export const FINANCIAL_PIVOT_WINDOW_MS = 48 * 60 * 60 * 1000;

export const TRUST_BANNER_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type AssessDmTrustInput = Readonly<{
  peerPublicKeyHex: PublicKeyHex | string;
  isPeerAccepted: boolean;
  messageContent: string;
  messageTimestampUnixMs: number;
  threadFirstPeerMessageAtUnixMs: number | null;
  dismissedUntilUnixMs: number | null;
  nowUnixMs?: number;
}>;

export type DmTrustAssessment = Readonly<{
  tier: TrustWarningTier;
  bundleId: string | null;
  activeSignals: ReadonlyArray<TrustSignalId>;
  copyKey: string;
}>;

const FINANCIAL_PATTERNS: ReadonlyArray<RegExp> = [
  /\$\s?\d+/,
  /\b(usdt|btc|eth|wire transfer|bank transfer|paypal|venmo|cashapp|invoice|payment link)\b/i,
  /\b0x[a-fA-F0-9]{40}\b/,
  /\bbc1[a-z0-9]{20,}\b/i,
  /\b(send (?:the )?(?:money|funds|payment))\b/i,
];

const URGENCY_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(urgent|immediately|act now|limited time|within \d+ (?:hour|day)s?|asap)\b/i,
  /\b(last chance|deadline|expires? (?:today|soon))\b/i,
];

export const detectFinancialMention = (content: string): boolean => (
  FINANCIAL_PATTERNS.some((pattern) => pattern.test(content))
);

export const detectUrgencyPressure = (content: string): boolean => (
  URGENCY_PATTERNS.some((pattern) => pattern.test(content))
);

const isContactCold = (input: AssessDmTrustInput): boolean => (
  !input.isPeerAccepted
  || input.threadFirstPeerMessageAtUnixMs === null
);

const isFinancialPivotInWindow = (input: AssessDmTrustInput, nowUnixMs: number): boolean => {
  if (!detectFinancialMention(input.messageContent)) {
    return false;
  }
  const anchor = input.threadFirstPeerMessageAtUnixMs ?? input.messageTimestampUnixMs;
  return (nowUnixMs - anchor) <= FINANCIAL_PIVOT_WINDOW_MS;
};

const buildAssessment = (
  activeSignals: ReadonlyArray<TrustSignalId>,
  bundleId: string | null,
  tier: TrustWarningTier,
): DmTrustAssessment => ({
  tier,
  bundleId,
  activeSignals,
  copyKey: bundleId === BUNDLE_FIN_COLD
    ? "messaging.trust.finCold"
    : tier === "info"
      ? "messaging.trust.info"
      : "messaging.trust.none",
});

/**
 * Recipient-local DM trust assessment — deterministic from rule pack v1 (SEC-F2).
 * Never notifies sender; never blocks delivery.
 */
export const assessDmTrustWarning = (input: AssessDmTrustInput): DmTrustAssessment => {
  const nowUnixMs = input.nowUnixMs ?? Date.now();
  if (input.dismissedUntilUnixMs !== null && nowUnixMs < input.dismissedUntilUnixMs) {
    return buildAssessment([], null, "none");
  }

  const signals: TrustSignalId[] = [];
  if (isContactCold(input)) {
    signals.push("contact.cold");
  }
  if (isFinancialPivotInWindow(input, nowUnixMs)) {
    signals.push("thread.pivot_financial");
  }
  if (detectUrgencyPressure(input.messageContent)) {
    signals.push("commerce.urgency_pressure");
  }

  const hasFinColdBundle = signals.includes("contact.cold")
    && signals.includes("thread.pivot_financial");

  if (hasFinColdBundle) {
    const tier: TrustWarningTier = signals.includes("commerce.urgency_pressure")
      ? "critical"
      : "elevated";
    return buildAssessment(signals, BUNDLE_FIN_COLD, tier);
  }

  if (signals.includes("thread.pivot_financial")) {
    return buildAssessment(signals, null, "info");
  }

  if (signals.includes("contact.cold")) {
    return buildAssessment(["contact.cold"], null, "info");
  }

  return buildAssessment([], null, "none");
};
