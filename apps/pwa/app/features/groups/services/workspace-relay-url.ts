import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";

const LOCAL_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i;

const hostFromRelayInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (/^(wss?|https?):\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).host.toLowerCase();
    } catch {
      return trimmed.replace(/^(wss?|https?):\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    }
  }
  return trimmed.replace(/\/.*$/, "").toLowerCase();
};

/** True for localhost / loopback workspace relays that must use plain ws:// in dev. */
export const isLocalWorkspaceRelayHost = (hostOrUrl: string): boolean => {
  const host = hostFromRelayInput(hostOrUrl);
  return host.length > 0 && LOCAL_HOST_PATTERN.test(host);
};

/**
 * Canonical workspace / relay URL for list storage.
 * - localhost / 127.0.0.1 → ws:// (Docker dev Nostr relay)
 * - localhost http(s) → preserved (team_relay mesh HTTP gateway, C8+)
 * - public hosts → wss://
 * - fixes mistaken wss://localhost to ws://localhost
 */
export const normalizeWorkspaceRelayUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  // Mesh HTTP gateways — never coerce http(s) loopback into WebSocket schemes.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!isLocalWorkspaceRelayHost(parsed.host)) {
        return "";
      }
      const path = parsed.pathname === "/" ? "" : parsed.pathname;
      return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}`;
    } catch {
      return "";
    }
  }

  let withScheme = trimmed;
  if (!/^wss?:\/\//i.test(trimmed)) {
    withScheme = isLocalWorkspaceRelayHost(trimmed)
      ? `ws://${trimmed}`
      : `wss://${trimmed}`;
  }

  try {
    const parsed = new URL(withScheme);
    const scheme = isLocalWorkspaceRelayHost(parsed.host) ? "ws:" : "wss:";
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${scheme}//${parsed.host.toLowerCase()}${path}`;
  } catch {
    return normalizeRelayUrl(withScheme);
  }
};

export const workspaceRelayUrlsMatch = (left: string, right: string): boolean => {
  const leftCanonical = normalizeWorkspaceRelayUrl(left);
  const rightCanonical = normalizeWorkspaceRelayUrl(right);
  if (!leftCanonical || !rightCanonical) {
    return false;
  }
  if (leftCanonical === rightCanonical) {
    return true;
  }
  if (isLocalWorkspaceRelayHost(leftCanonical) && isLocalWorkspaceRelayHost(rightCanonical)) {
    try {
      const leftPort = new URL(leftCanonical).port || "7000";
      const rightPort = new URL(rightCanonical).port || "7000";
      return leftPort === rightPort;
    } catch {
      return false;
    }
  }
  return false;
};

/** Stable key for deduping localhost / loopback aliases that share the same relay port. */
export const workspaceRelayIdentityKey = (url: string): string => {
  const canonical = normalizeWorkspaceRelayUrl(url);
  if (!canonical) {
    return url.trim().toLowerCase();
  }
  try {
    const parsed = new URL(canonical);
    if (isLocalWorkspaceRelayHost(parsed.host)) {
      return `local:${parsed.port || "7000"}`;
    }
    return canonical;
  } catch {
    return canonical;
  }
};

/**
 * Expand user-entered workspace relay input into probe candidates.
 * Local dev relays often appear as host-only, ws://, or mistaken wss:// variants.
 */
export const resolveMatchingOpenRelayUrl = (
  requestedUrl: string,
  openRelayUrls: ReadonlyArray<string>,
): string | null => {
  const trimmed = requestedUrl.trim();
  if (!trimmed) {
    return null;
  }
  for (const openUrl of openRelayUrls) {
    if (workspaceRelayUrlsMatch(openUrl, trimmed)) {
      return openUrl;
    }
  }
  return null;
};

export const expandWorkspaceRelayUrlCandidates = (raw: string): ReadonlyArray<string> => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>();
  const primary = normalizeWorkspaceRelayUrl(trimmed);
  if (primary) {
    candidates.add(primary);
  }

  const localSeed = isLocalWorkspaceRelayHost(trimmed) || (primary && isLocalWorkspaceRelayHost(primary));
  if (localSeed) {
    try {
      const parsed = new URL(primary || normalizeWorkspaceRelayUrl(trimmed));
      const port = parsed.port || "7000";
      const host = parsed.hostname.toLowerCase();
      candidates.add(`ws://${host}:${port}`);
      candidates.add(`wss://${host}:${port}`);
      candidates.add(`${host}:${port}`);
      if (host === "localhost" || host === "127.0.0.1") {
        candidates.add(`ws://localhost:${port}`);
        candidates.add(`ws://127.0.0.1:${port}`);
        candidates.add(`wss://localhost:${port}`);
        candidates.add(`wss://127.0.0.1:${port}`);
        candidates.add(`localhost:${port}`);
        candidates.add(`127.0.0.1:${port}`);
      }
    } catch {
      // keep primary candidate only
    }
  }

  return Array.from(candidates)
    .map((candidate) => normalizeWorkspaceRelayUrl(candidate))
    .filter((candidate, index, list) => candidate.length > 0 && list.indexOf(candidate) === index);
};
