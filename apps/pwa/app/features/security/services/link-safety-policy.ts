/**
 * PB2-A — Opt-in link-safety policy (no network).
 * Outbound reputation fetch stays gated until maintainer accept + settings wire.
 */

export type LinkSafetyCancelBehavior = "block_open" | "open_unchecked";

export type LinkSafetyPolicyInput = Readonly<{
  /** Profile setting — default false. */
  outboundCheckEnabled: boolean;
  /** Reserved for ASE-2c; ignored until post-v2 open. */
  attackModeSafetyProfile?: "standard" | "strict";
  /** When user declines reputation check. Default: block_open. */
  cancelBehavior?: LinkSafetyCancelBehavior;
}>;

export type LinkSafetyOpenDecision =
  | Readonly<{ kind: "open_without_check" }>
  | Readonly<{ kind: "offer_reputation_check"; cancelBehavior: LinkSafetyCancelBehavior }>
  | Readonly<{ kind: "block_open" }>;

export type LinkSafetyConsentCopy = Readonly<{
  eyebrowKey: "security.linkSafety.reputation.eyebrow";
  titleKey: "security.linkSafety.reputation.title";
  descriptionKey: "security.linkSafety.reputation.description";
  confirmKey: "security.linkSafety.reputation.confirm";
  cancelKey: "security.linkSafety.reputation.cancel";
  /** Provider display name for labeled phone-home copy. */
  providerLabel: string;
}>;

/** Catalog label only — adapter not wired until slice C. */
export const LINK_SAFETY_DEFAULT_PROVIDER_LABEL = "URLHaus";

export const DEFAULT_LINK_SAFETY_CANCEL_BEHAVIOR: LinkSafetyCancelBehavior = "block_open";

/**
 * Default-off. Strict attack profile does not force-on here (ASE-2c paused).
 */
export const isLinkSafetyOutboundCheckEnabled = (
  input: Readonly<{ outboundCheckEnabled: boolean; attackModeSafetyProfile?: "standard" | "strict" }>,
): boolean => input.outboundCheckEnabled === true;

export const resolveLinkSafetyOpenDecision = (
  input: LinkSafetyPolicyInput,
): LinkSafetyOpenDecision => {
  if (!isLinkSafetyOutboundCheckEnabled(input)) {
    return { kind: "open_without_check" };
  }
  return {
    kind: "offer_reputation_check",
    cancelBehavior: input.cancelBehavior ?? DEFAULT_LINK_SAFETY_CANCEL_BEHAVIOR,
  };
};

export const resolveLinkSafetyAfterCancel = (
  cancelBehavior: LinkSafetyCancelBehavior,
): LinkSafetyOpenDecision => {
  if (cancelBehavior === "open_unchecked") {
    return { kind: "open_without_check" };
  }
  return { kind: "block_open" };
};

export const buildLinkSafetyConsentCopy = (
  providerLabel: string = LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
): LinkSafetyConsentCopy => ({
  eyebrowKey: "security.linkSafety.reputation.eyebrow",
  titleKey: "security.linkSafety.reputation.title",
  descriptionKey: "security.linkSafety.reputation.description",
  confirmKey: "security.linkSafety.reputation.confirm",
  cancelKey: "security.linkSafety.reputation.cancel",
  providerLabel: providerLabel.trim() || LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
});
