/**
 * Brand lookalike / typosquat hostname checks — structural, language-agnostic.
 * Does not use message-body keywords; inspects URL host shape only.
 */

export type BrandDomainRule = Readonly<{
  officialSuffixes: ReadonlyArray<string>;
  typoPatterns: ReadonlyArray<RegExp>;
  deceptiveHostnamePatterns: ReadonlyArray<RegExp>;
}>;

const BRAND_DOMAIN_RULES: Readonly<Record<string, BrandDomainRule>> = {
  obscur: {
    officialSuffixes: ["obscur.app", "obscur.com", "app.obscur.com"],
    typoPatterns: [/0bscur/, /obscur[r]+/, /obs+[c]+ur/],
    deceptiveHostnamePatterns: [
      /obscur[-.](?:login|secure|wallet|support|verify|auth)/,
      /(?:login|secure|wallet|support|verify|auth)[.-]obscur/,
    ],
  },
  coinbase: {
    officialSuffixes: ["coinbase.com"],
    typoPatterns: [/c0inbase/, /coinbasse/, /coin[-_]base[-_]?(?:login|wallet|secure)/],
    deceptiveHostnamePatterns: [/coinbase[-.](?:login|wallet|secure|verify|support)/],
  },
  binance: {
    officialSuffixes: ["binance.com"],
    typoPatterns: [/binanc[e]?[^.]*login/, /b[i1]nance[-.]secure/],
    deceptiveHostnamePatterns: [/binance[-.](?:login|wallet|secure|verify)/],
  },
  paypal: {
    officialSuffixes: ["paypal.com"],
    typoPatterns: [/paypa[1l](?:\.|$|[-_])/, /pay[-_]pal[-.]?(?:login|secure|verify)/],
    deceptiveHostnamePatterns: [/paypal[-.](?:login|secure|verify|support)/],
  },
  google: {
    officialSuffixes: ["google.com", "googleapis.com", "gstatic.com", "youtube.com"],
    typoPatterns: [/goo+gle[-.]?(?:login|accounts|secure)/, /accounts[-.]google(?!apis)/],
    deceptiveHostnamePatterns: [/google[-.](?:login|accounts|secure|verify|auth)/],
  },
  microsoft: {
    officialSuffixes: ["microsoft.com", "microsoftonline.com", "live.com", "office.com"],
    typoPatterns: [/micros[0o]ft[-.]?(?:login|secure|verify)/],
    deceptiveHostnamePatterns: [/microsoft[-.](?:login|secure|verify|auth|365)/],
  },
  apple: {
    officialSuffixes: ["apple.com", "icloud.com"],
    typoPatterns: [/app[l1]e[-.]?(?:id|login|secure|verify)/],
    deceptiveHostnamePatterns: [/apple[-.](?:id|login|secure|verify|support)/],
  },
  metamask: {
    officialSuffixes: ["metamask.io"],
    typoPatterns: [/met[a@]mask[-.]?(?:login|wallet|secure)/],
    deceptiveHostnamePatterns: [/metamask[-.](?:login|wallet|secure|verify|support)/],
  },
  ledger: {
    officialSuffixes: ["ledger.com"],
    typoPatterns: [/ledg[e]?r[-.]?(?:live|wallet|secure)/],
    deceptiveHostnamePatterns: [/ledger[-.](?:live|wallet|secure|verify|support)/],
  },
};

export const normalizeHostname = (hostname: string): string => {
  const lower = hostname.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
};

export const isOfficialBrandHostname = (
  hostname: string,
  officialSuffixes: ReadonlyArray<string>,
): boolean => {
  const normalized = normalizeHostname(hostname);
  return officialSuffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
};

export const isLookalikeBrandHostname = (hostname: string): boolean => {
  const normalized = normalizeHostname(hostname);
  if (!normalized || normalized.includes("localhost")) {
    return false;
  }

  for (const rule of Object.values(BRAND_DOMAIN_RULES)) {
    if (isOfficialBrandHostname(normalized, rule.officialSuffixes)) {
      continue;
    }
    if (rule.typoPatterns.some((pattern) => pattern.test(normalized))) {
      return true;
    }
    if (rule.deceptiveHostnamePatterns.some((pattern) => pattern.test(normalized))) {
      return true;
    }
  }

  return false;
};
