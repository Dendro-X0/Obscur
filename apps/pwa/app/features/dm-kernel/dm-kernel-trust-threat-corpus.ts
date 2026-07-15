import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  assessDmTrustWarning,
  BUNDLE_FIN_COLD,
  BUNDLE_PHISH_COLD,
  BUNDLE_SE_COLD,
  BUNDLE_SPAM_COLD,
  FINANCIAL_PIVOT_WINDOW_MS,
  TRUST_BANNER_DISMISS_COOLDOWN_MS,
  type AssessDmTrustInput,
  type DmTrustAssessment,
  type TrustSignalId,
  type TrustWarningTier,
} from "./dm-kernel-trust-assessment-port";
import {
  ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER,
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
} from "./dm-kernel-trust-spam-signals";

export type TrustThreatCategory =
  | "benign"
  | "financial"
  | "phishing"
  | "social_engineering"
  | "urgency"
  | "spam"
  | "coordination"
  | "edge"
  | "manual_matrix";

export type TrustThreatFixtureExpect = Readonly<{
  tier?: TrustWarningTier;
  bundleId?: string | null;
  notBundleId?: string;
  mustIncludeSignals?: ReadonlyArray<TrustSignalId>;
  mustExcludeSignals?: ReadonlyArray<TrustSignalId>;
  copyKey?: string;
}>;

export type TrustThreatFixtureDefinition = Readonly<{
  id: string;
  category: TrustThreatCategory;
  note?: string;
  input: AssessDmTrustInput;
  expect: TrustThreatFixtureExpect;
}>;

export type TrustThreatFixtureCaseResult = Readonly<{
  id: string;
  category: TrustThreatCategory;
  passed: boolean;
  issues: ReadonlyArray<string>;
  assessment: DmTrustAssessment;
}>;

export type TrustThreatCorpusResult = Readonly<{
  ok: boolean;
  peerPublicKeyHex: PublicKeyHex;
  cases: ReadonlyArray<TrustThreatFixtureCaseResult>;
  byCategory: Readonly<Record<TrustThreatCategory, number>>;
}>;

/** Stable clock for deterministic corpus — not wall time. */
export const THREAT_CORPUS_BASE_MS = 1_700_000_000_000;

const defaultPeer = (): PublicKeyHex => "c".repeat(64) as PublicKeyHex;

const coldThreadInput = (
  peerPublicKeyHex: PublicKeyHex,
  messageContent: string,
  offsetMs = 60_000,
  overrides: Partial<AssessDmTrustInput> = {},
): AssessDmTrustInput => ({
  peerPublicKeyHex,
  isPeerAccepted: false,
  messageContent,
  messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + offsetMs,
  threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
  dismissedUntilUnixMs: null,
  nowUnixMs: THREAT_CORPUS_BASE_MS + offsetMs,
  ...overrides,
});

export const buildTrustThreatFixtureDefinitions = (
  peerPublicKeyHex: PublicKeyHex = defaultPeer(),
): ReadonlyArray<TrustThreatFixtureDefinition> => [
  // —— Manual matrix TRUST-1..3 ——
  {
    id: "trust_1_fin_cold_elevated",
    category: "manual_matrix",
    note: "TRUST-1 cold DM + financial mention",
    input: coldThreadInput(peerPublicKeyHex, "Hi — can you send $200 via wire transfer today?"),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "trust_2_dismiss_suppresses_banner",
    category: "manual_matrix",
    note: "TRUST-2 dismiss/snooze suppresses repeat banner",
    input: coldThreadInput(peerPublicKeyHex, "Send $999 wire transfer now", 120_000, {
      dismissedUntilUnixMs: THREAT_CORPUS_BASE_MS + TRUST_BANNER_DISMISS_COOLDOWN_MS,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 180_000,
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
    }),
    expect: { tier: "none", bundleId: null },
  },
  {
    id: "trust_3_accepted_peer_no_fin_cold",
    category: "manual_matrix",
    note: "TRUST-3 established contact benign invoice outside pivot window",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Invoice for last month: $120 — thanks!",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
    },
    expect: { tier: "none", notBundleId: BUNDLE_FIN_COLD },
  },

  // —— Benign / low false-positive guards ——
  {
    id: "benign_cold_greeting_info_only",
    category: "benign",
    input: coldThreadInput(peerPublicKeyHex, "Hey — saw your post. Nice work on the relay guide."),
    expect: {
      tier: "info",
      bundleId: null,
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["thread.pivot_financial"],
    },
  },
  {
    id: "benign_accepted_peer_small_talk",
    category: "benign",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Can we sync tomorrow on the deployment checklist?",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 3600_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 3600_000,
    },
    expect: { tier: "none", bundleId: null },
  },
  {
    id: "benign_accepted_peer_financial_inside_window_info",
    category: "benign",
    note: "Financial mention on trusted thread stays below fin-cold bundle",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Splitting dinner — can you venmo me $42?",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
    },
    expect: {
      tier: "info",
      notBundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["thread.pivot_financial"],
      mustExcludeSignals: ["contact.cold"],
    },
  },
  {
    id: "benign_urgency_without_financial_cold_info",
    category: "benign",
    note: "Urgency alone does not surface fin-cold; info tier collapses to contact.cold in port v1",
    input: coldThreadInput(peerPublicKeyHex, "Need your review asap before the maintainer call."),
    expect: {
      tier: "info",
      notBundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["thread.pivot_financial"],
    },
  },

  // —— Financial scam templates ——
  {
    id: "financial_usdt_wallet_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Send 500 USDT to 0x" + "a".repeat(40) + " now"),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_btc_address_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Deposit BTC to bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_wire_transfer_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Please complete the bank transfer for $3,500 today."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_paypal_invoice_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "PayPal invoice pending — pay $899 via payment link."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_cashapp_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "CashApp $250 to unlock your account access."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_send_money_phrase_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Please send the funds before the window closes."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_eth_mention_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Transfer 2 ETH to settle the smart contract fee."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },

  // —— Phishing-shaped (rule-pack v2.0a: structural URL class) ——
  {
    id: "phishing_punycode_url_cold_elevated",
    category: "phishing",
    note: "TRUST-INT-1b — punycode IDN host",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Confirm login: https://xn--pple-43d.com/signin?id=1",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_PHISH_COLD,
      mustIncludeSignals: ["link.suspicious_url"],
    },
  },
  {
    id: "phishing_mixed_script_hostname_cold_elevated",
    category: "phishing",
    note: "TRUST-INT-1b — Latin/Cyrillic homoglyph host",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Verify payment at https://p\u0430ypal.com/secure/login",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_PHISH_COLD,
      mustIncludeSignals: ["link.suspicious_url"],
    },
  },
  {
    id: "phishing_wallet_verify_url_cold_elevated",
    category: "phishing",
    note: "TRUST-4 cold DM + credential-path URL",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Verify your wallet at https://obscur-wallet-security.example/login?session=abc",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_PHISH_COLD,
      mustIncludeSignals: ["contact.cold", "link.suspicious_url"],
      copyKey: "messaging.trust.phishLookalikeCold",
    },
  },
  {
    id: "phishing_bitly_support_cold_elevated",
    category: "phishing",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Support ticket — confirm identity: http://bit.ly/secure-account-reset",
    ),
    expect: { tier: "elevated", bundleId: BUNDLE_PHISH_COLD },
  },
  {
    id: "se_otp_imperative_structural_cold",
    category: "social_engineering",
    note: "TRUST-INT-1b — OTP digit run without English phrase-pack keyword alone",
    input: coldThreadInput(peerPublicKeyHex, "Reply with 847291 to continue"),
    expect: {
      tier: "critical",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.credential_harvest"],
    },
  },
  {
    id: "se_credential_harvest_es_cold",
    category: "social_engineering",
    note: "TRUST-INT-1c — Spanish seed phrase harvest",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Envíame tu frase semilla para verificar la cuenta",
    ),
    expect: {
      tier: "critical",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.credential_harvest"],
    },
  },
  {
    id: "se_authority_impersonation_zh_cold",
    category: "social_engineering",
    note: "TRUST-INT-1c — Chinese support impersonation",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Obscur官方支持：您的账户已被冻结，请立即验证",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.authority_impersonation"],
    },
  },
  {
    id: "se_off_platform_redirect_es_cold",
    category: "social_engineering",
    note: "TRUST-INT-1c — Spanish Telegram redirect",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Continuemos en Telegram — escríbeme allí",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.off_platform_redirect"],
    },
  },
  {
    id: "se_remote_access_zh_cold",
    category: "social_engineering",
    note: "TRUST-INT-1c — Chinese remote access pressure",
    input: coldThreadInput(
      peerPublicKeyHex,
      "请安装 AnyDesk 进行远程协助",
    ),
    expect: {
      tier: "critical",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.remote_access_tool"],
    },
  },
  {
    id: "phishing_impersonation_support_cold_se",
    category: "social_engineering",
    note: "Support impersonation + recovery phrase on cold contact",
    input: coldThreadInput(
      peerPublicKeyHex,
      "This is Obscur Security — your relay certificate expired. Reply with your recovery phrase.",
    ),
    expect: {
      tier: "critical",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.credential_harvest", "thread.authority_impersonation"],
    },
  },
  {
    id: "phishing_financial_plus_url_critical",
    category: "phishing",
    note: "Financial pivot takes precedence over phish bundle when both fire",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Urgent: wire $500 immediately — https://pay-secure-portal.example/invoice",
      45_000,
    ),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "phishing_benign_github_url_cold_info",
    category: "phishing",
    note: "Benign URL on cold contact — info only, no phish bundle",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Check out our repo: https://github.com/Dendro-X0/Obscur",
    ),
    expect: {
      tier: "info",
      notBundleId: BUNDLE_PHISH_COLD,
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["link.suspicious_url"],
    },
  },

  {
    id: "phishing_lookalike_brand_cold_elevated",
    category: "phishing",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Verify wallet access: https://obscur-wallet-verify.example/start",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_PHISH_COLD,
      mustIncludeSignals: ["link.lookalike_brand"],
    },
  },
  {
    id: "phishing_risky_attachment_cold_elevated",
    category: "phishing",
    input: coldThreadInput(peerPublicKeyHex, "Attached project brief for review.", 60_000, {
      messageAttachmentFileNames: ["Scope-Document.pdf.exe"],
    }),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_PHISH_COLD,
      mustIncludeSignals: ["attachment.risky_filename"],
    },
  },
  {
    id: "phishing_macro_attachment_accepted_elevated",
    category: "phishing",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Please open the contract attachment.",
      messageAttachmentFileNames: ["Agreement.docm"],
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
    },
    expect: {
      tier: "elevated",
      mustIncludeSignals: ["attachment.risky_filename"],
      mustExcludeSignals: ["contact.cold"],
    },
  },

  {
    id: "financial_stale_cold_thread_wire_transfer",
    category: "financial",
    note: "Cold contact wire ask after pivot window — still fin-cold",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: false,
      messageContent: "Hi — can you send $200 via wire transfer today?",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 3_600_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 3_600_000,
    },
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["thread.financial_pressure"],
    },
  },

  // —— Social engineering (SEC-F refinement) ——
  {
    id: "se_gift_card_cold_elevated",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Buy Google Play gift cards and text the pin codes immediately.",
    ),
    expect: { tier: "critical", bundleId: BUNDLE_SE_COLD },
  },
  {
    id: "se_credential_harvest_accepted_critical",
    category: "social_engineering",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Send your 2FA code so we can verify the account transfer.",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 90_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 90_000,
    },
    expect: {
      tier: "critical",
      mustIncludeSignals: ["thread.credential_harvest"],
      mustExcludeSignals: ["contact.cold"],
    },
  },

  {
    id: "se_off_platform_cold_elevated",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Let's continue this on Telegram — add me @recruiter_jobs",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.off_platform_redirect"],
    },
  },
  {
    id: "se_advance_fee_cold_elevated",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Pay the registration fee upfront before we ship your starter kit.",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.advance_fee_scam"],
    },
  },
  {
    id: "se_off_platform_accepted_elevated",
    category: "social_engineering",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Move to WhatsApp so we can discuss payment details privately.",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
    },
    expect: {
      tier: "elevated",
      mustIncludeSignals: ["thread.off_platform_redirect"],
      mustExcludeSignals: ["contact.cold"],
    },
  },
  {
    id: "se_remote_access_cold_critical",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Download TeamViewer now so we can verify your workstation for the contract.",
    ),
    expect: {
      tier: "critical",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.remote_access_tool"],
    },
  },
  {
    id: "se_overpayment_cold_elevated",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "We accidentally overpaid — refund the excess amount today.",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.overpayment_refund"],
    },
  },
  {
    id: "se_fake_escrow_cold_elevated",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Use our secure payment portal — pay outside the platform escrow link.",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.fake_escrow"],
    },
  },
  {
    id: "se_hiring_trap_accepted_critical",
    category: "social_engineering",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Run npm install on this repo for the technical assessment tool.",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 150_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 150_000,
    },
    expect: {
      tier: "critical",
      mustIncludeSignals: ["thread.hiring_trap"],
      mustExcludeSignals: ["contact.cold"],
    },
  },
  {
    id: "se_irreversible_payment_cold_elevated",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Contract requires payment in crypto only — no other method accepted.",
    ),
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.irreversible_payment_demand"],
    },
  },
  {
    id: "se_ceo_impersonation_cold_critical",
    category: "social_engineering",
    input: coldThreadInput(
      peerPublicKeyHex,
      "I'm the CEO — urgent wire from the executive office today.",
    ),
    expect: {
      tier: "critical",
      bundleId: BUNDLE_SE_COLD,
      mustIncludeSignals: ["thread.authority_impersonation", "commerce.urgency_pressure"],
    },
  },

  // —— Urgency pressure escalations ——
  {
    id: "urgency_limited_time_financial_critical",
    category: "urgency",
    input: coldThreadInput(peerPublicKeyHex, "Limited time: send $150 via wire transfer within 24 hours"),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "urgency_act_now_financial_critical",
    category: "urgency",
    input: coldThreadInput(peerPublicKeyHex, "Act now — PayPal $75 payment link expires today"),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "urgency_deadline_financial_critical",
    category: "urgency",
    input: coldThreadInput(peerPublicKeyHex, "Deadline today: send the payment of $600 ASAP"),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },

  // —— Spam / burst shapes ——
  {
    id: "spam_cold_burst_bundle_spam_cold",
    category: "spam",
    input: coldThreadInput(peerPublicKeyHex, "promo burst", 30_000, {
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 1,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_SPAM_COLD, copyKey: "messaging.trust.spamCold" },
  },
  {
    id: "spam_accepted_normal_burst_suppressed",
    category: "spam",
    note: "TRUST-INT-1a — everyday back-and-forth on accepted peer",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "quick reply in active chat",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 3,
      nowUnixMs: THREAT_CORPUS_BASE_MS,
    },
    expect: {
      tier: "none",
      bundleId: null,
      mustExcludeSignals: ["msg.rate"],
    },
  },
  {
    id: "spam_accepted_burst_msg_rate_only",
    category: "spam",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "flood segment",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute:
        Math.ceil(MSG_RATE_THRESHOLD * ACCEPTED_PEER_MSG_RATE_FLOOD_MULTIPLIER) + 1,
      nowUnixMs: THREAT_CORPUS_BASE_MS,
    },
    expect: {
      tier: "info",
      bundleId: null,
      mustIncludeSignals: ["msg.rate"],
      copyKey: "messaging.trust.msgRate",
    },
  },
  {
    id: "spam_identical_payload_burst",
    category: "spam",
    input: coldThreadInput(peerPublicKeyHex, "FREE AIRDROP CLICK NOW", 20_000, {
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 2,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_SPAM_COLD },
  },
  {
    id: "spam_below_rate_threshold_no_elevation",
    category: "spam",
    input: coldThreadInput(peerPublicKeyHex, "single ping", 10_000, {
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD,
    }),
    expect: { tier: "info", notBundleId: BUNDLE_SPAM_COLD },
  },

  // —— Coordination / fanout metadata ——
  {
    id: "coordination_invite_fanout_cold",
    category: "coordination",
    input: coldThreadInput(peerPublicKeyHex, "please accept my connection request", 5_000, {
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD + 1,
    }),
    expect: {
      tier: "elevated",
      mustIncludeSignals: ["invite.fanout"],
      copyKey: "messaging.trust.inviteFanout",
    },
  },
  {
    id: "coordination_fanout_plus_financial_fin_cold",
    category: "coordination",
    note: "Fanout spammer pivots to financial ask",
    input: coldThreadInput(peerPublicKeyHex, "Send $50 USDT — hurry", 15_000, {
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD + 3,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "coordination_fanout_below_threshold_info",
    category: "coordination",
    input: coldThreadInput(peerPublicKeyHex, "adding you to my network", 8_000, {
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD,
    }),
    expect: { tier: "info", mustExcludeSignals: ["invite.fanout"] },
  },

  // —— Edge / boundary ——
  {
    id: "metadata_young_key_cold_info",
    category: "edge",
    note: "TRUST-INT-1d — peer first seen within 24h",
    input: coldThreadInput(peerPublicKeyHex, "Hey — just checking in", 5_000, {
      peerFirstSeenAtUnixMs: THREAT_CORPUS_BASE_MS - 3 * 60 * 60 * 1000,
    }),
    expect: {
      tier: "info",
      mustIncludeSignals: ["key.age", "contact.cold"],
    },
  },
  {
    id: "metadata_wot_distance_outside_web",
    category: "edge",
    note: "TRUST-INT-1d — peer outside accepted WoT roots",
    input: coldThreadInput(peerPublicKeyHex, "Hello from outside your network", 6_000, {
      peerWotDistance: null,
    }),
    expect: {
      tier: "info",
      mustIncludeSignals: ["graph.wot_distance", "contact.cold"],
    },
  },
  {
    id: "metadata_wot_distance_accepted_inside_web",
    category: "edge",
    note: "TRUST-INT-1d — accepted peer stays inside WoT even when vigilant forces cold",
    input: coldThreadInput(peerPublicKeyHex, "Trusted contact checking in", 7_000, {
      isPeerAccepted: true,
      peerWotDistance: 1,
      contactTrustSensitivity: "vigilant",
    }),
    expect: {
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["graph.wot_distance"],
    },
  },
  {
    id: "metadata_attachment_repeat_hash_cold_elevated",
    category: "coordination",
    note: "TRUST-INT-1d — same attachment digest seen from multiple peers",
    input: coldThreadInput(peerPublicKeyHex, "Open this file", 8_000, {
      attachmentRepeatHashDistinctPeerCount: 3,
    }),
    expect: {
      tier: "elevated",
      mustIncludeSignals: ["attachment.repeat_hash", "contact.cold"],
      copyKey: "messaging.trust.repeatHashCold",
    },
  },
  {
    id: "metadata_attachment_repeat_hash_below_threshold",
    category: "edge",
    note: "TRUST-INT-1d — repeat-hash fanout below peer threshold",
    input: coldThreadInput(peerPublicKeyHex, "One-off attachment", 9_000, {
      attachmentRepeatHashDistinctPeerCount: 2,
    }),
    expect: {
      mustExcludeSignals: ["attachment.repeat_hash"],
    },
  },
  {
    id: "metadata_attachment_repeat_hash_phish_cold_bundle",
    category: "phishing",
    note: "TRUST-INT-1d — repeat-hash qualifies for cold phish bundle",
    input: coldThreadInput(peerPublicKeyHex, "Please review the attached file", 10_000, {
      attachmentRepeatHashDistinctPeerCount: 4,
    }),
    expect: {
      bundleId: BUNDLE_PHISH_COLD,
      copyKey: "messaging.trust.repeatHashCold",
    },
  },
  {
    id: "edge_financial_at_pivot_window_boundary_outside",
    category: "edge",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: false,
      messageContent: "Wire transfer $100 for the license",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
    },
    expect: {
      tier: "elevated",
      bundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["contact.cold", "thread.financial_pressure"],
      mustExcludeSignals: ["thread.pivot_financial"],
    },
  },
  {
    id: "edge_financial_at_pivot_window_boundary_inside",
    category: "edge",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: false,
      messageContent: "Wire transfer $100 for the license",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS,
    },
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "edge_dismiss_expired_warns_again",
    category: "edge",
    input: coldThreadInput(peerPublicKeyHex, "Send $300 wire transfer", 200_000, {
      dismissedUntilUnixMs: THREAT_CORPUS_BASE_MS + 50_000,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 200_000,
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 200_000,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "edge_accepted_null_thread_anchor_still_cold",
    category: "edge",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Pay $25 via venmo",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 30_000,
      threadFirstPeerMessageAtUnixMs: null,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 30_000,
    },
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
];

export const evaluateTrustThreatFixture = (
  definition: TrustThreatFixtureDefinition,
): TrustThreatFixtureCaseResult => {
  const assessment = assessDmTrustWarning(definition.input);
  const issues: string[] = [];
  const { expect } = definition;

  if (expect.tier !== undefined && assessment.tier !== expect.tier) {
    issues.push(`expected_tier_${expect.tier}_got_${assessment.tier}`);
  }
  if (expect.bundleId !== undefined && assessment.bundleId !== expect.bundleId) {
    issues.push(`expected_bundle_${expect.bundleId}_got_${assessment.bundleId ?? "null"}`);
  }
  if (expect.notBundleId !== undefined && assessment.bundleId === expect.notBundleId) {
    issues.push(`unexpected_bundle_${expect.notBundleId}`);
  }
  if (expect.copyKey !== undefined && assessment.copyKey !== expect.copyKey) {
    issues.push(`expected_copyKey_${expect.copyKey}_got_${assessment.copyKey}`);
  }
  for (const signal of expect.mustIncludeSignals ?? []) {
    if (!assessment.activeSignals.includes(signal)) {
      issues.push(`missing_signal_${signal}`);
    }
  }
  for (const signal of expect.mustExcludeSignals ?? []) {
    if (assessment.activeSignals.includes(signal)) {
      issues.push(`unexpected_signal_${signal}`);
    }
  }

  return {
    id: definition.id,
    category: definition.category,
    passed: issues.length === 0,
    issues,
    assessment,
  };
};

export const evaluateTrustThreatCorpus = (
  peerPublicKeyHex: PublicKeyHex = defaultPeer(),
): TrustThreatCorpusResult => {
  const definitions = buildTrustThreatFixtureDefinitions(peerPublicKeyHex);
  const cases = definitions.map((definition) => evaluateTrustThreatFixture(definition));

  const byCategory = {
    benign: 0,
    financial: 0,
    phishing: 0,
    social_engineering: 0,
    urgency: 0,
    spam: 0,
    coordination: 0,
    edge: 0,
    manual_matrix: 0,
  } satisfies Record<TrustThreatCategory, number>;

  for (const entry of cases) {
    byCategory[entry.category] += 1;
  }

  return {
    ok: cases.every((entry) => entry.passed),
    peerPublicKeyHex,
    cases,
    byCategory,
  };
};
