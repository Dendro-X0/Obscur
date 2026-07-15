/**
 * Recipient-local social-engineering phrase detectors (SEC-F refinement).
 * English base + es/zh locale packs — no server scoring; deterministic regex only.
 */

import { detectOtpExfilStructuralShape } from "./dm-kernel-trust-structural-signals";
import {
  mergeSeLocalePatterns,
  matchesSePatternGroup,
} from "./dm-kernel-trust-social-engineering-locale-packs";

const CREDENTIAL_HARVEST_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(seed phrase|recovery phrase|secret recovery|backup phrase|12[- ]word|24[- ]word)\b/i,
  /\b(private key|mnemonic|passphrase)\b.*\b(send|share|paste|verify|confirm)\b/i,
  /\b(send|share|paste|verify|confirm)\b.*\b(private key|mnemonic|passphrase|seed phrase)\b/i,
  /\b(2fa|two[- ]factor|authentication code|verification code|otp|one[- ]time code)\b/i,
  /\b(enter|provide|send)\b.*\b(password|login credentials|account password)\b/i,
  /\b(verify your account|confirm your login|sign in here|log in here|login here)\b/i,
  /\b(validate your credentials|confirm your identity|update your payment info)\b/i,
];

const AUTHORITY_IMPERSONATION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(obscur|wallet|exchange|bank|paypal|coinbase|binance)\b.*\b(support|security|compliance|help desk)\b/i,
  /\b(support team|security department|fraud department|account recovery)\b/i,
  /\b(official|verified)\b.*\b(representative|agent|moderator|admin)\b/i,
  /\b(your account (?:has been|is|will be) (?:suspended|locked|compromised|flagged))\b/i,
  /\b(we detected|unusual activity|verify your identity immediately)\b/i,
  /\b(i(?:'m| am) (?:the )?(?:ceo|cfo|founder|director|hr manager|payroll))\b/i,
  /\b(from (?:hr|human resources|payroll|finance department|executive office))\b/i,
  /\b(confidential (?:request|task|wire)|urgent wire from (?:the )?ceo)\b/i,
];

const GIFT_CARD_SCAM_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(gift card|google play card|itunes card|steam card|amazon card)\b/i,
  /\b(buy|purchase|load)\b.*\b(gift cards?|prepaid cards?)\b/i,
  /\b(scratch off|pin code|card codes?)\b.*\b(send|text|share)\b/i,
];

const OFF_PLATFORM_REDIRECT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(move|switch|continue|chat|talk|reach me|message me)\b.*\b(on|to|via|at)\b.*\b(telegram|whatsapp|signal|discord|wechat|skype|line app)\b/i,
  /\b(telegram|whatsapp|signal|discord)\b.*\b(dm|chat|message|group|channel)\b/i,
  /\b(add me on|contact me on|find me on)\b.*\b(telegram|whatsapp|signal|discord|linkedin)\b/i,
  /\b(off[- ]platform|outside (?:the )?(?:app|platform|marketplace))\b/i,
  /\b(email me directly|personal email|leave the platform|reach me on google chat)\b/i,
];

const ADVANCE_FEE_SCAM_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(pay|send|transfer)\b.*\b(upfront|in advance|first|before (?:we|you|starting))\b/i,
  /\b(upfront|advance|registration|processing|administrative)\b.*\b(fee|payment|deposit)\b/i,
  /\b(pay|purchase|buy)\b.*\b(equipment|training materials|starter kit|software license|work kit)\b/i,
  /\b(reimburs(?:e|ed|ement))\b.*\b(after|once|when)\b.*\b(pay|send|deposit)\b/i,
];

const REMOTE_ACCESS_TOOL_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(anydesk|teamviewer|team viewer|rustdesk|ultraviewer|logmein|log me in|supremo|ammyy admin|quick assist|screen connect)\b/i,
  /\b(remote desktop|remote access tool|screen sharing (?:software|app|session))\b/i,
  /\b(install|download|open|run)\b.*\b(anydesk|teamviewer|rustdesk|remote desktop)\b/i,
];

const OVERPAYMENT_SCAM_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(overpaid|over payment|accidental payment|paid too much|mistaken transfer)\b/i,
  /\b(refund|return|send back)\b.*\b(difference|excess|extra amount|overpayment)\b/i,
  /\b(excess amount|extra funds)\b.*\b(refund|return|send back|wire back)\b/i,
];

const FAKE_ESCROW_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(our escrow|custom escrow|secure payment portal|private payment page)\b/i,
  /\b(pay outside (?:the )?(?:platform|app|escrow|marketplace))\b/i,
  /\b(use our payment link|direct bank transfer before)\b/i,
  /\bescrow\b.*\blink\b/i,
  /\bpayment portal\b/i,
];

const HIRING_TRAP_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(install|download|run)\b.*\b(our (?:software|app|client|tool)|this repo|the (?:attached )?script|test project)\b/i,
  /\b(clone (?:this |the )?repo(?:sitory)?|run npm install|technical assessment tool|skills test application)\b/i,
  /\b(run our test project|run the attached script)\b/i,
];

const IRREVERSIBLE_PAYMENT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(bitcoin only|crypto only|usdt only|wire transfer only|bank wire only|pay in crypto|cryptocurrency only)\b/i,
  /\b(only (?:accept|accepts|via)|must pay (?:in|via|using))\b.*\b(usdt|btc|crypto|wire transfer|gift card)\b/i,
];

export const detectCredentialHarvestRequest = (content: string): boolean => (
  matchesSePatternGroup(mergeSeLocalePatterns(CREDENTIAL_HARVEST_PATTERNS, "credentialHarvest"), content)
  || detectOtpExfilStructuralShape(content)
);

export const detectAuthorityImpersonation = (content: string): boolean => (
  matchesSePatternGroup(mergeSeLocalePatterns(AUTHORITY_IMPERSONATION_PATTERNS, "authorityImpersonation"), content)
);

export const detectGiftCardScam = (content: string): boolean => (
  matchesSePatternGroup(mergeSeLocalePatterns(GIFT_CARD_SCAM_PATTERNS, "giftCardScam"), content)
);

export const detectOffPlatformRedirect = (content: string): boolean => (
  matchesSePatternGroup(mergeSeLocalePatterns(OFF_PLATFORM_REDIRECT_PATTERNS, "offPlatformRedirect"), content)
);

export const detectAdvanceFeeScam = (content: string): boolean => (
  matchesSePatternGroup(mergeSeLocalePatterns(ADVANCE_FEE_SCAM_PATTERNS, "advanceFeeScam"), content)
);

export const detectRemoteAccessTool = (content: string): boolean => (
  matchesSePatternGroup(mergeSeLocalePatterns(REMOTE_ACCESS_TOOL_PATTERNS, "remoteAccessTool"), content)
);

export const detectOverpaymentScam = (content: string): boolean => (
  OVERPAYMENT_SCAM_PATTERNS.some((pattern) => pattern.test(content))
);

export const detectFakeEscrow = (content: string): boolean => (
  FAKE_ESCROW_PATTERNS.some((pattern) => pattern.test(content))
);

export const detectHiringTrap = (content: string): boolean => (
  HIRING_TRAP_PATTERNS.some((pattern) => pattern.test(content))
);

export const detectIrreversiblePaymentDemand = (content: string): boolean => (
  IRREVERSIBLE_PAYMENT_PATTERNS.some((pattern) => pattern.test(content))
);

export const detectSocialEngineeringSignals = (content: string): Readonly<{
  credentialHarvest: boolean;
  authorityImpersonation: boolean;
  giftCardScam: boolean;
  offPlatformRedirect: boolean;
  advanceFeeScam: boolean;
  remoteAccessTool: boolean;
  overpaymentScam: boolean;
  fakeEscrow: boolean;
  hiringTrap: boolean;
  irreversiblePaymentDemand: boolean;
}> => ({
  credentialHarvest: detectCredentialHarvestRequest(content),
  authorityImpersonation: detectAuthorityImpersonation(content),
  giftCardScam: detectGiftCardScam(content),
  offPlatformRedirect: detectOffPlatformRedirect(content),
  advanceFeeScam: detectAdvanceFeeScam(content),
  remoteAccessTool: detectRemoteAccessTool(content),
  overpaymentScam: detectOverpaymentScam(content),
  fakeEscrow: detectFakeEscrow(content),
  hiringTrap: detectHiringTrap(content),
  irreversiblePaymentDemand: detectIrreversiblePaymentDemand(content),
});
