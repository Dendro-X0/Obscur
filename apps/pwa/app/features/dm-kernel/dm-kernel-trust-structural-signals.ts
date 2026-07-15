/**
 * Language-agnostic structural content signals (TRUST-INT-1b).
 * No NLU — digit runs, script mixing, and other locale-independent shapes.
 */

const LATIN_LETTER = /[a-z]/;
const CYRILLIC_LETTER = /[\u0400-\u04FF]/;

const IMPERATIVE_OTP_CONTEXT = /\b(?:send|text|reply(?:\s+with)?|forward|share|paste|enter|type|give(?:\s+me)?)\b/i;
const CODE_WORD_CONTEXT = /\b(?:code|pin|otp|2fa|verification|authenticator)\b/i;
const COMPACT_OTP_RUN = /\b\d{6,8}\b/;
const SPACED_OTP_RUN = /\b(?:\d[\s-]){5,7}\d\b/;

const COMMON_ASCII_TLD = new Set([
  "com", "net", "org", "io", "app", "co", "uk", "de", "fr", "ru", "xyz", "info",
]);

/** Hostname mixes Latin and Cyrillic — common IDN homoglyph attack shape. */
export const hasMixedScriptHostname = (hostname: string): boolean => {
  const labels = hostname.toLowerCase().split(".").filter((label) => label.length > 0);
  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index] ?? "";
    const isFinalTld = index === labels.length - 1 && COMMON_ASCII_TLD.has(label);
    if (isFinalTld) {
      continue;
    }
    const hasLatin = LATIN_LETTER.test(label);
    const hasCyrillic = CYRILLIC_LETTER.test(label);
    if (hasLatin && hasCyrillic) {
      return true;
    }
  }
  return false;
};

/** OTP exfil without English phrase-pack keywords — requires digit run + imperative or "code". */
export const detectOtpExfilStructuralShape = (content: string): boolean => {
  const hasDigitRun = COMPACT_OTP_RUN.test(content) || SPACED_OTP_RUN.test(content);
  if (!hasDigitRun) {
    return false;
  }
  return IMPERATIVE_OTP_CONTEXT.test(content) || CODE_WORD_CONTEXT.test(content);
};
