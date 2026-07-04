/**
 * Structural URL / link-class signals for phishing-shaped DMs (rule-pack v2.0a+).
 * Language-agnostic: inspects URL shape, not message-body keywords.
 */

import { isLookalikeBrandHostname, normalizeHostname } from "./dm-kernel-trust-link-domain-signals";

const URL_EXTRACT_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

/** Known URL shortener domains — structural redirect risk, not content keywords. */
const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly",
  "short.link",
  "cutt.ly",
  "rb.gy",
]);

/** Credential-harvest path segments — URL structure, not prose. */
const CREDENTIAL_PATH_PATTERN = /\/(?:login|signin|sign-in|verify|wallet|reset|account|secure|auth|oauth)(?:\/|[?#]|$)/i;

const IPV4_HOST_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export const extractHttpUrls = (content: string): ReadonlyArray<string> => {
  const matches = content.match(URL_EXTRACT_PATTERN);
  if (!matches) {
    return [];
  }
  return matches.map((url) => url.replace(/[.,;:!?)]+$/, ""));
};

const hostWithoutPort = (hostname: string): string => {
  const lower = hostname.toLowerCase();
  const bracketEnd = lower.indexOf("]");
  if (lower.startsWith("[") && bracketEnd !== -1) {
    return lower.slice(0, bracketEnd + 1);
  }
  const colon = lower.lastIndexOf(":");
  if (colon !== -1 && /^\d+$/.test(lower.slice(colon + 1))) {
    return lower.slice(0, colon);
  }
  return lower;
};

export const isSuspiciousUrlShape = (rawUrl: string): boolean => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const host = hostWithoutPort(parsed.hostname);

  if (host.includes("xn--")) {
    return true;
  }

  if (IPV4_HOST_PATTERN.test(host)) {
    return true;
  }

  if (host.startsWith("[") && host.includes(":")) {
    return true;
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return true;
  }

  const registrableHost = host.startsWith("www.") ? host.slice(4) : host;
  if (SHORTENER_HOSTS.has(registrableHost)) {
    return true;
  }

  const pathAndQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (CREDENTIAL_PATH_PATTERN.test(pathAndQuery)) {
    return true;
  }

  return false;
};

export const hostnameFromHttpUrl = (rawUrl: string): string | null => {
  try {
    return normalizeHostname(new URL(rawUrl).hostname);
  } catch {
    return null;
  }
};

/** True when a URL hostname typosquats or impersonates a known brand domain. */
export const isLookalikeBrandUrl = (rawUrl: string): boolean => {
  const hostname = hostnameFromHttpUrl(rawUrl);
  return hostname !== null && isLookalikeBrandHostname(hostname);
};

/** True when any HTTP(S) URL in the message matches a phishing-shaped structural class. */
export const detectSuspiciousLink = (content: string): boolean => (
  extractHttpUrls(content).some((url) => isSuspiciousUrlShape(url))
);

/** True when any HTTP(S) URL hostname looks like a brand typosquat / deceptive host. */
export const detectLookalikeBrandLink = (content: string): boolean => (
  extractHttpUrls(content).some((url) => isLookalikeBrandUrl(url))
);
