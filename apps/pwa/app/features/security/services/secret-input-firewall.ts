/**
 * Secret-input firewall (KEY-MOAT-1 / ASE-1 M1)
 *
 * Single owner for detecting private key material in user-facing text inputs.
 * Import/unlock flows intentionally bypass this module — they are the canonical
 * path for entering secrets.
 */

export type SecretMaterialKind = "nsec" | "ncryptsec";

export type SecretMaterialMatch = Readonly<{
  kind: SecretMaterialKind;
  match: string;
  index: number;
}>;

export type SecretInputContext = "message" | "public_profile" | "discovery_token";

export type SecretInputBlockResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; kind: SecretMaterialKind; match: string }>;

const BECH32_CHARSET: string = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const NSEC_TOKEN_PATTERN: RegExp = /\bnsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}\b/gi;
const NCRYPTSEC_TOKEN_PATTERN: RegExp = /\bncryptsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{20,}\b/gi;

const bech32Polymod = (values: ReadonlyArray<number>): number => {
  const generators: ReadonlyArray<number> = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk: number = 1;
  values.forEach((value: number): void => {
    const top: number = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    generators.forEach((gen: number, index: number): void => {
      if (((top >>> index) & 1) === 1) {
        chk ^= gen;
      }
    });
  });
  return chk;
};

const bech32HrpExpand = (hrp: string): ReadonlyArray<number> => {
  const upper: number[] = Array.from(hrp).map((char: string): number => char.charCodeAt(0) >>> 5);
  const lower: number[] = Array.from(hrp).map((char: string): number => char.charCodeAt(0) & 31);
  return [...upper, 0, ...lower];
};

const bech32VerifyChecksum = (hrp: string, data: ReadonlyArray<number>): boolean => {
  return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === 1;
};

const bech32Decode = (value: string): Readonly<{ hrp: string; data: ReadonlyArray<number> }> | null => {
  const trimmed: string = value.trim();
  const lower: string = trimmed.toLowerCase();
  if (lower.length < 8) {
    return null;
  }
  if (lower !== trimmed && trimmed.toUpperCase() !== trimmed) {
    return null;
  }
  const pos: number = lower.lastIndexOf("1");
  if (pos < 1 || pos + 7 > lower.length) {
    return null;
  }
  const hrp: string = lower.slice(0, pos);
  const dataPart: string = lower.slice(pos + 1);
  const data: number[] = [];
  for (const char of dataPart) {
    const idx: number = BECH32_CHARSET.indexOf(char);
    if (idx < 0) {
      return null;
    }
    data.push(idx);
  }
  if (!bech32VerifyChecksum(hrp, data)) {
    return null;
  }
  return { hrp, data };
};

/** True when the full trimmed input is forbidden secret bech32 (nsec / ncryptsec). */
export const isForbiddenSecretInput = (input: string): boolean => {
  const lower = input.trim().toLowerCase();
  if (/^nsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(lower)) {
    return true;
  }
  if (/^ncryptsec1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/.test(lower)) {
    return true;
  }
  const decoded = bech32Decode(lower);
  if (!decoded) {
    return false;
  }
  return decoded.hrp === "nsec" || decoded.hrp === "ncryptsec";
};

const collectPatternMatches = (
  text: string,
  pattern: RegExp,
  kind: SecretMaterialKind,
): ReadonlyArray<SecretMaterialMatch> => {
  const matches: SecretMaterialMatch[] = [];
  const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null = globalPattern.exec(text);
  while (match) {
    const token = match[0];
    if (isForbiddenSecretInput(token)) {
      matches.push({
        kind,
        match: token,
        index: match.index,
      });
    }
    match = globalPattern.exec(text);
  }
  return matches;
};

/** Scan free-form text for embedded nsec / ncryptsec tokens. */
export const findSecretMaterialInText = (text: string): ReadonlyArray<SecretMaterialMatch> => {
  if (!text.trim()) {
    return [];
  }
  return [
    ...collectPatternMatches(text, NSEC_TOKEN_PATTERN, "nsec"),
    ...collectPatternMatches(text, NCRYPTSEC_TOKEN_PATTERN, "ncryptsec"),
  ].sort((left, right) => left.index - right.index);
};

export const textContainsBlockedSecretMaterial = (text: string): boolean => {
  return findSecretMaterialInText(text).length > 0;
};

export const assertNoBlockedSecretMaterial = (
  text: string,
  _context?: SecretInputContext,
): SecretInputBlockResult => {
  const matches = findSecretMaterialInText(text);
  if (matches.length === 0) {
    return { ok: true };
  }
  const first = matches[0]!;
  return { ok: false, kind: first.kind, match: first.match };
};

export const SECRET_INPUT_FIREWALL_MESSAGE = {
  messageBlocked:
    "This message looks like it contains a private key. Remove it before sending — never share secrets in chat.",
  publicProfileBlocked:
    "Do not publish private keys or encrypted secrets in your public profile.",
} as const;

export const secretInputFirewallInternals = {
  bech32Decode,
  NSEC_TOKEN_PATTERN,
  NCRYPTSEC_TOKEN_PATTERN,
};
