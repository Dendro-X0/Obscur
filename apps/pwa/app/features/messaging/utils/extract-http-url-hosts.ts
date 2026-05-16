/**
 * Read-only disclosure: which HTTP(S) hostnames appear in draft composer text.
 * No network I/O; best-effort URL parse for user visibility only.
 */

const HTTPS_URL_TOKEN_RE = /\bhttps?:\/\/[^\s<>"']+/gi;

const trimTrailingUrlPunctuation = (raw: string): string =>
  raw.replace(/[)\].,;:!?]+$/u, "");

/**
 * Returns unique hostname list in first-seen order (lowercased). Invalid URL tokens are skipped.
 */
export function extractHttpUrlHostsFromText(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const hosts: string[] = [];

  let match: RegExpExecArray | null;
  const re = new RegExp(HTTPS_URL_TOKEN_RE.source, HTTPS_URL_TOKEN_RE.flags);
  while ((match = re.exec(text)) !== null) {
    const cleaned = trimTrailingUrlPunctuation(match[0]);
    try {
      const u = new URL(cleaned);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        continue;
      }
      const host = u.hostname.trim().toLowerCase();
      if (host.length === 0 || seen.has(host)) {
        continue;
      }
      seen.add(host);
      hosts.push(host);
    } catch {
      // Malformed URL fragment in casual text — skip
    }
  }

  return hosts;
}
