import type { TrustSignalId, TrustWarningTier } from "./dm-kernel-trust-assessment-port";
import {
  BUNDLE_CONN_BURST,
  BUNDLE_FIN_COLD,
  BUNDLE_PHISH_COLD,
  BUNDLE_SE_COLD,
  BUNDLE_SPAM_COLD,
} from "./dm-kernel-trust-assessment-port";

const includesSignal = (
  activeSignals: ReadonlyArray<TrustSignalId>,
  signal: TrustSignalId,
): boolean => activeSignals.includes(signal);

const resolvePhishColdCopyKey = (activeSignals: ReadonlyArray<TrustSignalId>): string => {
  if (includesSignal(activeSignals, "attachment.risky_filename")) {
    return "messaging.trust.phishAttachmentCold";
  }
  if (includesSignal(activeSignals, "attachment.repeat_hash")) {
    return "messaging.trust.repeatHashCold";
  }
  if (includesSignal(activeSignals, "link.lookalike_brand")) {
    return "messaging.trust.phishLookalikeCold";
  }
  if (includesSignal(activeSignals, "link.suspicious_url")) {
    return "messaging.trust.phishCold";
  }
  return "messaging.trust.phishCold";
};

const resolveSeColdCopyKey = (activeSignals: ReadonlyArray<TrustSignalId>): string => {
  if (includesSignal(activeSignals, "thread.credential_harvest")) {
    return "messaging.trust.seCredentialCold";
  }
  if (includesSignal(activeSignals, "thread.remote_access_tool")) {
    return "messaging.trust.seRemoteAccessCold";
  }
  if (includesSignal(activeSignals, "thread.hiring_trap")) {
    return "messaging.trust.seHiringTrapCold";
  }
  if (includesSignal(activeSignals, "thread.gift_card_scam")) {
    return "messaging.trust.seGiftCardCold";
  }
  if (includesSignal(activeSignals, "thread.overpayment_refund")) {
    return "messaging.trust.seOverpaymentCold";
  }
  if (includesSignal(activeSignals, "thread.fake_escrow")) {
    return "messaging.trust.seFakeEscrowCold";
  }
  if (includesSignal(activeSignals, "thread.off_platform_redirect")) {
    return "messaging.trust.seOffPlatformCold";
  }
  if (includesSignal(activeSignals, "thread.advance_fee_scam")) {
    return "messaging.trust.seAdvanceFeeCold";
  }
  if (includesSignal(activeSignals, "thread.irreversible_payment_demand")) {
    return "messaging.trust.seIrreversiblePaymentCold";
  }
  if (includesSignal(activeSignals, "thread.authority_impersonation")) {
    return "messaging.trust.seAuthorityCold";
  }
  return "messaging.trust.seCold";
};

const resolveStandaloneSignalCopyKey = (
  activeSignals: ReadonlyArray<TrustSignalId>,
): string | null => {
  if (includesSignal(activeSignals, "thread.credential_harvest")) {
    return "messaging.trust.seCredentialCold";
  }
  if (includesSignal(activeSignals, "thread.remote_access_tool")) {
    return "messaging.trust.seRemoteAccessCold";
  }
  if (includesSignal(activeSignals, "thread.hiring_trap")) {
    return "messaging.trust.seHiringTrapCold";
  }
  if (includesSignal(activeSignals, "link.lookalike_brand")) {
    return "messaging.trust.phishLookalikeCold";
  }
  if (includesSignal(activeSignals, "attachment.risky_filename")) {
    return "messaging.trust.phishAttachmentCold";
  }
  if (includesSignal(activeSignals, "attachment.repeat_hash")) {
    return "messaging.trust.repeatHashCold";
  }
  if (includesSignal(activeSignals, "thread.off_platform_redirect")) {
    return "messaging.trust.seOffPlatformCold";
  }
  if (includesSignal(activeSignals, "thread.overpayment_refund")) {
    return "messaging.trust.seOverpaymentCold";
  }
  if (includesSignal(activeSignals, "thread.fake_escrow")) {
    return "messaging.trust.seFakeEscrowCold";
  }
  if (includesSignal(activeSignals, "thread.advance_fee_scam")) {
    return "messaging.trust.seAdvanceFeeCold";
  }
  if (includesSignal(activeSignals, "thread.irreversible_payment_demand")) {
    return "messaging.trust.seIrreversiblePaymentCold";
  }
  if (includesSignal(activeSignals, "thread.authority_impersonation")) {
    return "messaging.trust.seAuthorityCold";
  }
  return null;
};

/** Recipient-local banner copy — bundle-first, then dominant structural signal. */
export const resolveTrustCopyKey = (
  activeSignals: ReadonlyArray<TrustSignalId>,
  bundleId: string | null,
  tier: TrustWarningTier,
): string => {
  if (bundleId === BUNDLE_FIN_COLD) {
    return includesSignal(activeSignals, "thread.financial_pressure")
      ? "messaging.trust.finStaleCold"
      : "messaging.trust.finCold";
  }
  if (bundleId === BUNDLE_PHISH_COLD) {
    return resolvePhishColdCopyKey(activeSignals);
  }
  if (bundleId === BUNDLE_SE_COLD) {
    return resolveSeColdCopyKey(activeSignals);
  }
  if (bundleId === BUNDLE_CONN_BURST) {
    return "messaging.trust.connBurst";
  }
  if (bundleId === BUNDLE_SPAM_COLD) {
    return "messaging.trust.spamCold";
  }
  if (activeSignals.includes("msg.rate")) {
    return "messaging.trust.msgRate";
  }
  if (activeSignals.includes("invite.fanout")) {
    return "messaging.trust.inviteFanout";
  }
  if (activeSignals.includes("connection.request_burst")) {
    return "messaging.trust.connBurst";
  }

  const standaloneCopyKey = resolveStandaloneSignalCopyKey(activeSignals);
  if (standaloneCopyKey) {
    return standaloneCopyKey;
  }

  if (tier === "info") {
    return "messaging.trust.info";
  }
  return "messaging.trust.none";
};
