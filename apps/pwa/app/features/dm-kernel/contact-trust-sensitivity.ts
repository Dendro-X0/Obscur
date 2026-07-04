import type {
  DmTrustAssessment,
  TrustSignalId,
  TrustWarningTier,
} from "./dm-kernel-trust-assessment-port";
import {
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
} from "./dm-kernel-trust-spam-signals";

const FINANCIAL_PIVOT_WINDOW_MS = 48 * 60 * 60 * 1000;
const BUNDLE_FIN_COLD = "BUNDLE_FIN_COLD";

/** Recipient-local defense posture for a contact — independent of connection accept/remove. */
export type ContactTrustSensitivity = "relaxed" | "standard" | "cautious" | "vigilant";

export const CONTACT_TRUST_SENSITIVITY_LEVELS: ReadonlyArray<ContactTrustSensitivity> = [
  "relaxed",
  "standard",
  "cautious",
  "vigilant",
];

export const DEFAULT_CONTACT_TRUST_SENSITIVITY: ContactTrustSensitivity = "standard";

export type ContactTrustSensitivityPolicy = Readonly<{
  forceColdContact: boolean;
  suppressColdContact: boolean;
  financialPivotWindowMs: number;
  msgRateThreshold: number;
  inviteFanoutThreshold: number;
  elevateInfoToElevated: boolean;
}>;

export const resolveContactTrustSensitivityPolicy = (
  sensitivity: ContactTrustSensitivity,
): ContactTrustSensitivityPolicy => {
  switch (sensitivity) {
    case "relaxed":
      return {
        forceColdContact: false,
        suppressColdContact: true,
        financialPivotWindowMs: FINANCIAL_PIVOT_WINDOW_MS * 2,
        msgRateThreshold: Math.ceil(MSG_RATE_THRESHOLD * 1.5),
        inviteFanoutThreshold: Math.ceil(INVITE_FANOUT_THRESHOLD * 1.5),
        elevateInfoToElevated: false,
      };
    case "cautious":
      return {
        forceColdContact: false,
        suppressColdContact: false,
        financialPivotWindowMs: Math.floor(FINANCIAL_PIVOT_WINDOW_MS / 2),
        msgRateThreshold: Math.max(3, Math.floor(MSG_RATE_THRESHOLD * 0.7)),
        inviteFanoutThreshold: Math.max(5, Math.floor(INVITE_FANOUT_THRESHOLD * 0.7)),
        elevateInfoToElevated: false,
      };
    case "vigilant":
      return {
        forceColdContact: true,
        suppressColdContact: false,
        financialPivotWindowMs: Math.floor(FINANCIAL_PIVOT_WINDOW_MS / 4),
        msgRateThreshold: Math.max(3, Math.floor(MSG_RATE_THRESHOLD * 0.5)),
        inviteFanoutThreshold: Math.max(3, Math.floor(INVITE_FANOUT_THRESHOLD * 0.5)),
        elevateInfoToElevated: true,
      };
    case "standard":
    default:
      return {
        forceColdContact: false,
        suppressColdContact: false,
        financialPivotWindowMs: FINANCIAL_PIVOT_WINDOW_MS,
        msgRateThreshold: MSG_RATE_THRESHOLD,
        inviteFanoutThreshold: INVITE_FANOUT_THRESHOLD,
        elevateInfoToElevated: false,
      };
  }
};

export const resolveEffectiveColdContact = (params: Readonly<{
  isPeerAccepted: boolean;
  threadFirstPeerMessageAtUnixMs: number | null;
  policy: ContactTrustSensitivityPolicy;
}>): boolean => {
  if (params.policy.forceColdContact) {
    return true;
  }
  if (params.policy.suppressColdContact && params.isPeerAccepted) {
    return false;
  }
  return !params.isPeerAccepted || params.threadFirstPeerMessageAtUnixMs === null;
};

/** Apply recipient sensitivity after base rule-pack assessment. */
export const applyContactTrustSensitivityToAssessment = (
  assessment: DmTrustAssessment,
  policy: ContactTrustSensitivityPolicy,
): DmTrustAssessment => {
  if (policy.elevateInfoToElevated && assessment.tier === "info") {
    const hasWarningShape = assessment.activeSignals.some((signal) => (
      signal === "thread.pivot_financial"
      || signal === "thread.financial_pressure"
      || signal === "link.suspicious_url"
      || signal === "link.lookalike_brand"
      || signal === "attachment.risky_filename"
      || signal === "contact.cold"
      || signal === "thread.credential_harvest"
      || signal === "thread.authority_impersonation"
      || signal === "thread.gift_card_scam"
      || signal === "thread.off_platform_redirect"
      || signal === "thread.advance_fee_scam"
      || signal === "thread.remote_access_tool"
      || signal === "thread.overpayment_refund"
      || signal === "thread.fake_escrow"
      || signal === "thread.hiring_trap"
      || signal === "thread.irreversible_payment_demand"
    ));
    if (hasWarningShape) {
      return {
        ...assessment,
        tier: "elevated",
      };
    }
  }

  if (
    policy.suppressColdContact
    && assessment.bundleId === BUNDLE_FIN_COLD
    && !assessment.activeSignals.includes("commerce.urgency_pressure")
  ) {
    return {
      ...assessment,
      tier: "info",
      bundleId: null,
    };
  }

  return assessment;
};

export const sensitivityLabelKey = (sensitivity: ContactTrustSensitivity): string => (
  `network.trust.sensitivity.${sensitivity}`
);

export const sensitivityHintKey = (sensitivity: ContactTrustSensitivity): string => (
  `network.trust.sensitivityHint.${sensitivity}`
);

export type { TrustSignalId };
