import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Recipient-local warning tier — delivery invariant: tier never blocks message arrival. */
export type TrustWarningTier = "none" | "info" | "elevated" | "critical";

export type TrustSignalId =
  | "contact.cold"
  | "key.age"
  | "graph.wot_distance"
  | "attachment.repeat_hash"
  | "thread.pivot_financial"
  | "thread.financial_pressure"
  | "commerce.urgency_pressure"
  | "link.suspicious_url"
  | "link.lookalike_brand"
  | "attachment.risky_filename"
  | "connection.request_burst"
  | "msg.rate"
  | "invite.fanout"
  | "thread.credential_harvest"
  | "thread.authority_impersonation"
  | "thread.gift_card_scam"
  | "thread.off_platform_redirect"
  | "thread.advance_fee_scam"
  | "thread.remote_access_tool"
  | "thread.overpayment_refund"
  | "thread.fake_escrow"
  | "thread.hiring_trap"
  | "thread.irreversible_payment_demand";

export const BUNDLE_FIN_COLD = "BUNDLE_FIN_COLD";
export const BUNDLE_PHISH_COLD = "BUNDLE_PHISH_COLD";
export const BUNDLE_SE_COLD = "BUNDLE_SE_COLD";
export const BUNDLE_CONN_BURST = "BUNDLE_CONN_BURST";
export const BUNDLE_SPAM_COLD = "BUNDLE_SPAM_COLD";

export const FINANCIAL_PIVOT_WINDOW_MS = 48 * 60 * 60 * 1000;

export const KEY_AGE_YOUNG_MS = 24 * 60 * 60 * 1000;

export const TRUST_BANNER_DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

import { detectConnectionRequestBurstSignal } from "./dm-kernel-trust-connection-signals";
import type { IncomingRequestAntiAbusePeerSnapshot } from "@/app/features/messaging/services/incoming-request-anti-abuse";
import { shouldTriggerMsgRateSignal } from "./dm-kernel-trust-spam-signals";
import { detectSuspiciousLink, detectLookalikeBrandLink } from "./dm-kernel-trust-link-signals";
import { detectRiskyAttachmentFilenames } from "./dm-kernel-trust-attachment-signals";
import {
  detectAdvanceFeeScam,
  detectAuthorityImpersonation,
  detectCredentialHarvestRequest,
  detectFakeEscrow,
  detectGiftCardScam,
  detectHiringTrap,
  detectIrreversiblePaymentDemand,
  detectOffPlatformRedirect,
  detectOverpaymentScam,
  detectRemoteAccessTool,
} from "./dm-kernel-trust-social-engineering-signals";
import {
  applyContactTrustSensitivityToAssessment,
  DEFAULT_CONTACT_TRUST_SENSITIVITY,
  resolveContactTrustSensitivityPolicy,
  resolveEffectiveColdContact,
  type ContactTrustSensitivity,
} from "./contact-trust-sensitivity";
import { resolveTrustCopyKey } from "./dm-kernel-trust-copy-keys";
import {
  resolvePeerWotDistanceV1,
  shouldTriggerAttachmentRepeatHashSignal,
  shouldTriggerGraphWotDistanceSignal,
} from "./dm-kernel-trust-metadata-signals";

export type AssessDmTrustInput = Readonly<{
  peerPublicKeyHex: PublicKeyHex | string;
  isPeerAccepted: boolean;
  messageContent: string;
  messageTimestampUnixMs: number;
  threadFirstPeerMessageAtUnixMs: number | null;
  dismissedUntilUnixMs: number | null;
  /** Attachment filenames on the assessed inbound message (metadata only). */
  messageAttachmentFileNames?: ReadonlyArray<string>;
  peerFirstSeenAtUnixMs?: number | null;
  /** v1: 1 when peer is accepted; null when outside recipient WoT roots. */
  peerWotDistance?: number | null;
  /** Distinct peers that sent the same attachment digest within the fanout window. */
  attachmentRepeatHashDistinctPeerCount?: number;
  peerIncomingCountLastMinute?: number;
  peerConnectionRequestCountLastDay?: number;
  connectionRequestBurstSnapshot?: IncomingRequestAntiAbusePeerSnapshot | null;
  nowUnixMs?: number;
  /** Recipient-local defense posture — does not change connection accept/remove. */
  contactTrustSensitivity?: ContactTrustSensitivity;
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

const resolveFinancialSignals = (
  input: AssessDmTrustInput,
  nowUnixMs: number,
  pivotWindowMs: number,
  isContactCold: boolean,
): ReadonlyArray<TrustSignalId> => {
  if (!detectFinancialMention(input.messageContent)) {
    return [];
  }
  const anchor = input.threadFirstPeerMessageAtUnixMs ?? input.messageTimestampUnixMs;
  if ((nowUnixMs - anchor) <= pivotWindowMs) {
    return ["thread.pivot_financial"];
  }
  if (isContactCold) {
    return ["thread.financial_pressure"];
  }
  return [];
};

const SE_CRITICAL_SIGNALS: ReadonlyArray<TrustSignalId> = [
  "thread.credential_harvest",
  "thread.remote_access_tool",
  "thread.hiring_trap",
  "thread.gift_card_scam",
];

const SE_BUNDLE_SIGNALS: ReadonlyArray<TrustSignalId> = [
  "thread.credential_harvest",
  "thread.authority_impersonation",
  "thread.gift_card_scam",
  "thread.off_platform_redirect",
  "thread.advance_fee_scam",
  "thread.remote_access_tool",
  "thread.overpayment_refund",
  "thread.fake_escrow",
  "thread.hiring_trap",
  "thread.irreversible_payment_demand",
];

const SE_STANDALONE_SIGNALS: ReadonlyArray<TrustSignalId> = [
  "thread.credential_harvest",
  "thread.authority_impersonation",
  "thread.off_platform_redirect",
  "thread.advance_fee_scam",
  "thread.remote_access_tool",
  "thread.overpayment_refund",
  "thread.fake_escrow",
  "thread.hiring_trap",
  "thread.irreversible_payment_demand",
];

const includesAnySignal = (
  signals: ReadonlyArray<TrustSignalId>,
  candidates: ReadonlyArray<TrustSignalId>,
): boolean => candidates.some((signal) => signals.includes(signal));

const resolveSeCriticalTier = (signals: ReadonlyArray<TrustSignalId>): boolean => (
  signals.includes("commerce.urgency_pressure")
  || includesAnySignal(signals, SE_CRITICAL_SIGNALS)
);

const buildAssessment = (
  activeSignals: ReadonlyArray<TrustSignalId>,
  bundleId: string | null,
  tier: TrustWarningTier,
): DmTrustAssessment => ({
  tier,
  bundleId,
  activeSignals,
  copyKey: resolveTrustCopyKey(activeSignals, bundleId, tier),
});

/**
 * Recipient-local DM trust assessment — deterministic rule pack (SEC-F2 + v2.0a phish).
 * Never notifies sender; never blocks delivery.
 */
export const assessDmTrustWarning = (input: AssessDmTrustInput): DmTrustAssessment => {
  const nowUnixMs = input.nowUnixMs ?? Date.now();
  if (input.dismissedUntilUnixMs !== null && nowUnixMs < input.dismissedUntilUnixMs) {
    return buildAssessment([], null, "none");
  }

  const sensitivity = input.contactTrustSensitivity ?? DEFAULT_CONTACT_TRUST_SENSITIVITY;
  const sensitivityPolicy = resolveContactTrustSensitivityPolicy(sensitivity);
  const isContactCold = resolveEffectiveColdContact({
    isPeerAccepted: input.isPeerAccepted,
    threadFirstPeerMessageAtUnixMs: input.threadFirstPeerMessageAtUnixMs,
    policy: sensitivityPolicy,
  });

  const signals: TrustSignalId[] = [];
  if (isContactCold) {
    signals.push("contact.cold");
  }
  if (
    input.peerFirstSeenAtUnixMs != null
    && (nowUnixMs - input.peerFirstSeenAtUnixMs) < KEY_AGE_YOUNG_MS
  ) {
    signals.push("key.age");
  }
  const peerWotDistance = input.peerWotDistance ?? resolvePeerWotDistanceV1(
    String(input.peerPublicKeyHex),
    input.isPeerAccepted,
  );
  if (shouldTriggerGraphWotDistanceSignal(peerWotDistance)) {
    signals.push("graph.wot_distance");
  }
  if (
    shouldTriggerAttachmentRepeatHashSignal(input.attachmentRepeatHashDistinctPeerCount ?? 0)
  ) {
    signals.push("attachment.repeat_hash");
  }
  for (const financialSignal of resolveFinancialSignals(
    input,
    nowUnixMs,
    sensitivityPolicy.financialPivotWindowMs,
    isContactCold,
  )) {
    signals.push(financialSignal);
  }
  if (detectUrgencyPressure(input.messageContent)) {
    signals.push("commerce.urgency_pressure");
  }
  if (detectSuspiciousLink(input.messageContent)) {
    signals.push("link.suspicious_url");
  }
  if (detectLookalikeBrandLink(input.messageContent)) {
    signals.push("link.lookalike_brand");
  }
  if (detectRiskyAttachmentFilenames(input.messageAttachmentFileNames ?? [])) {
    signals.push("attachment.risky_filename");
  }
  if (detectCredentialHarvestRequest(input.messageContent)) {
    signals.push("thread.credential_harvest");
  }
  if (detectAuthorityImpersonation(input.messageContent)) {
    signals.push("thread.authority_impersonation");
  }
  if (detectGiftCardScam(input.messageContent)) {
    signals.push("thread.gift_card_scam");
  }
  if (detectOffPlatformRedirect(input.messageContent)) {
    signals.push("thread.off_platform_redirect");
  }
  if (detectAdvanceFeeScam(input.messageContent)) {
    signals.push("thread.advance_fee_scam");
  }
  if (detectRemoteAccessTool(input.messageContent)) {
    signals.push("thread.remote_access_tool");
  }
  if (detectOverpaymentScam(input.messageContent)) {
    signals.push("thread.overpayment_refund");
  }
  if (detectFakeEscrow(input.messageContent)) {
    signals.push("thread.fake_escrow");
  }
  if (detectHiringTrap(input.messageContent)) {
    signals.push("thread.hiring_trap");
  }
  if (detectIrreversiblePaymentDemand(input.messageContent)) {
    signals.push("thread.irreversible_payment_demand");
  }
  if (
    input.connectionRequestBurstSnapshot
    && detectConnectionRequestBurstSignal(input.connectionRequestBurstSnapshot)
  ) {
    signals.push("connection.request_burst");
  }
  if (
    shouldTriggerMsgRateSignal({
      peerIncomingCountLastMinute: input.peerIncomingCountLastMinute ?? 0,
      msgRateThreshold: sensitivityPolicy.msgRateThreshold,
      isContactCold,
      isPeerAccepted: input.isPeerAccepted,
    })
  ) {
    signals.push("msg.rate");
  }
  if ((input.peerConnectionRequestCountLastDay ?? 0) > sensitivityPolicy.inviteFanoutThreshold) {
    signals.push("invite.fanout");
  }

  const hasFinColdBundle = signals.includes("contact.cold")
    && (
      signals.includes("thread.pivot_financial")
      || signals.includes("thread.financial_pressure")
    );

  const finalize = (assessment: DmTrustAssessment): DmTrustAssessment => (
    applyContactTrustSensitivityToAssessment(assessment, sensitivityPolicy)
  );

  if (hasFinColdBundle) {
    const tier: TrustWarningTier = signals.includes("commerce.urgency_pressure")
      ? "critical"
      : "elevated";
    return finalize(buildAssessment(signals, BUNDLE_FIN_COLD, tier));
  }

  const hasPhishColdBundle = signals.includes("contact.cold")
    && (
      signals.includes("link.suspicious_url")
      || signals.includes("link.lookalike_brand")
      || signals.includes("attachment.risky_filename")
      || signals.includes("attachment.repeat_hash")
    );

  if (hasPhishColdBundle) {
    const tier: TrustWarningTier = signals.includes("commerce.urgency_pressure")
      ? "critical"
      : "elevated";
    return finalize(buildAssessment(signals, BUNDLE_PHISH_COLD, tier));
  }

  const hasSeColdBundle = signals.includes("contact.cold")
    && includesAnySignal(signals, SE_BUNDLE_SIGNALS);

  if (hasSeColdBundle) {
    const tier: TrustWarningTier = resolveSeCriticalTier(signals)
      ? "critical"
      : "elevated";
    return finalize(buildAssessment(signals, BUNDLE_SE_COLD, tier));
  }

  if (includesAnySignal(signals, SE_STANDALONE_SIGNALS)) {
    const tier: TrustWarningTier = includesAnySignal(signals, SE_CRITICAL_SIGNALS)
      ? "critical"
      : "elevated";
    return finalize(buildAssessment(signals, null, tier));
  }

  const hasConnBurstBundle = signals.includes("contact.cold")
    && signals.includes("connection.request_burst");

  if (hasConnBurstBundle) {
    return finalize(buildAssessment(signals, BUNDLE_CONN_BURST, "elevated"));
  }

  const hasSpamColdBundle = signals.includes("contact.cold")
    && signals.includes("msg.rate");

  if (hasSpamColdBundle) {
    return finalize(buildAssessment(signals, BUNDLE_SPAM_COLD, "elevated"));
  }

  if (signals.includes("msg.rate") || signals.includes("invite.fanout")) {
    const msgRateOnly = signals.length === 1 && signals[0] === "msg.rate";
    if (msgRateOnly && input.isPeerAccepted && !isContactCold) {
      return finalize(buildAssessment(signals, null, "info"));
    }
    return finalize(buildAssessment(signals, null, "elevated"));
  }

  if (signals.includes("connection.request_burst")) {
    return finalize(buildAssessment(signals, null, "elevated"));
  }

  if (
    signals.includes("link.lookalike_brand")
    || signals.includes("attachment.risky_filename")
  ) {
    return finalize(buildAssessment(signals, null, "elevated"));
  }

  if (signals.includes("attachment.repeat_hash") && signals.includes("contact.cold")) {
    return finalize(buildAssessment(signals, null, "elevated"));
  }

  if (signals.includes("attachment.repeat_hash")) {
    return finalize(buildAssessment(signals, null, "info"));
  }

  if (signals.includes("thread.pivot_financial")) {
    return finalize(buildAssessment(signals, null, "info"));
  }

  if (signals.includes("thread.financial_pressure")) {
    return finalize(buildAssessment(signals, null, "info"));
  }

  if (signals.includes("thread.gift_card_scam")) {
    return finalize(buildAssessment(signals, null, "info"));
  }

  if (signals.includes("link.suspicious_url")) {
    return finalize(buildAssessment(signals, null, "info"));
  }

  if (signals.includes("contact.cold")) {
    return finalize(buildAssessment(signals, null, "info"));
  }

  return finalize(buildAssessment([], null, "none"));
};

/** ASE friction ladder mapping — recipient-local tier → L0–L3 (L4 reserved for secret firewall). */
export type TrustActionFrictionLevel = "none" | "inform" | "warn" | "confirm";

export const resolveTrustActionFriction = (
  assessment: DmTrustAssessment,
): TrustActionFrictionLevel => {
  switch (assessment.tier) {
    case "critical":
      return "confirm";
    case "elevated":
      return "warn";
    case "info":
      return "inform";
    default:
      return "none";
  }
};
