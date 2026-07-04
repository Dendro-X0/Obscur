import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
import {
  expandWorkspaceRelayUrlCandidates,
  workspaceRelayUrlsMatch,
} from "./workspace-relay-url";
import type { WorkspaceRelayPoolTransport } from "./workspace-relay-calibrator";

const UNKNOWN_RELAY_SENTINELS = new Set(["unknown", "null", "undefined", "n/a", "none"]);

/** Host labels that are not real Nostr relays (coordination-only or UI placeholders). */
const PLACEHOLDER_RELAY_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "relay.internal",
  "0.0.0.0",
]);

const relayHostFromNormalizedUrl = (normalized: string): string | null => {
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    const stripped = normalized.replace(/^wss?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
    return stripped.length > 0 ? stripped : null;
  }
};

/** True when the community host can receive Nostr wire traffic (wss:// or ws://). */
export const hasWritableCommunityRelayTransport = (relayUrl: string): boolean => {
  const normalized = normalizeRelayUrl(relayUrl);
  if (normalized.length === 0) {
    return false;
  }
  if (UNKNOWN_RELAY_SENTINELS.has(normalized)) {
    return false;
  }
  if (!/^wss?:\/\/.+/.test(normalized)) {
    return false;
  }
  const host = relayHostFromNormalizedUrl(normalized);
  if (!host) {
    return false;
  }
  if (host === "relay.internal") {
    return false;
  }
  if (PLACEHOLDER_RELAY_HOSTS.has(host)) {
    try {
      const parsed = new URL(normalized);
      const port = parsed.port.trim();
      // Bare loopback or coordination HTTP port — not a Nostr relay endpoint.
      if (!port || port === "8787") {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
};

/** True when the relay pool reports a writable connection for the community URL (R4 pool evidence). */
export const isCommunityRelayPoolWritable = (
  relayUrl: string,
  pool?: WorkspaceRelayPoolTransport | null,
): boolean => {
  if (!hasWritableCommunityRelayTransport(relayUrl)) {
    return false;
  }
  const candidates = expandWorkspaceRelayUrlCandidates(relayUrl);
  const snapshot = pool?.getWritableRelaySnapshot?.(candidates);
  const writableRelayUrls = snapshot?.writableRelayUrls ?? [];
  return writableRelayUrls.some((writableUrl) => (
    candidates.some((candidate) => workspaceRelayUrlsMatch(candidate, writableUrl))
  ));
};
