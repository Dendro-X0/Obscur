import { isOnionMeshEndpoint } from "@obscur/conduit-mesh/resolve-conduit-http-transport";
import {
  isPublicDefaultRelayHost,
  normalizeRelayHost,
} from "@/app/features/groups/services/community-mode-contract";
import {
  isLocalDevWorkspaceRelayUrl,
  type RelayListEntry,
} from "./relay-transport-scope";

/** T5-2: max NativeRelay dial targets while Tor preference is ON. */
export const TOR_VIABLE_MAX_DIAL_TARGETS = 2;

export type TorRelayEndpointClass =
  | "onion_ws"
  | "onion_http"
  | "tor_allowlist"
  | "lab_loopback"
  | "public_cf"
  | "other_clear";

const parseAllowlistHosts = (raw: string | undefined): ReadonlySet<string> => {
  if (!raw || raw.trim().length === 0) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0),
  );
};

/** Curated non-CF hosts (empty by default). Lab: NEXT_PUBLIC_OBSCUR_TOR_VIABLE_HOSTS. */
export const resolveTorViableAllowlistHosts = (
  envValue: string | undefined = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_OBSCUR_TOR_VIABLE_HOSTS
    : undefined,
): ReadonlySet<string> => parseAllowlistHosts(envValue);

const isWsScheme = (url: string): boolean => {
  const lower = url.trim().toLowerCase();
  return lower.startsWith("ws://") || lower.startsWith("wss://");
};

const isHttpScheme = (url: string): boolean => {
  const lower = url.trim().toLowerCase();
  return lower.startsWith("http://") || lower.startsWith("https://");
};

export const classifyTorRelayEndpoint = (
  relayUrl: string,
  allowlistHosts: ReadonlySet<string> = resolveTorViableAllowlistHosts(),
): TorRelayEndpointClass => {
  const trimmed = relayUrl.trim();
  if (!trimmed) {
    return "other_clear";
  }

  if (isOnionMeshEndpoint(trimmed)) {
    if (isHttpScheme(trimmed)) {
      return "onion_http";
    }
    if (isWsScheme(trimmed)) {
      return "onion_ws";
    }
    // Bare onion host without scheme — treat as WS-capable for dial classification.
    return "onion_ws";
  }

  if (isLocalDevWorkspaceRelayUrl(trimmed)) {
    return "lab_loopback";
  }

  const host = normalizeRelayHost(trimmed);
  if (host && allowlistHosts.has(host)) {
    return "tor_allowlist";
  }
  if (host && isPublicDefaultRelayHost(host)) {
    return "public_cf";
  }
  return "other_clear";
};

const isTorViableNativeDialClass = (klass: TorRelayEndpointClass): boolean => (
  klass === "onion_ws" || klass === "tor_allowlist"
);

/**
 * When Tor preference is ON: onion_ws / allowlist from **all** enabled rows
 * (onions are often community-partitioned and missing from clearnet DM resolve).
 * Lab loopback only if that set is empty. Cap at {@link TOR_VIABLE_MAX_DIAL_TARGETS}.
 * Never includes public_cf / other_clear / onion_http.
 */
export const resolveTorViableDmRelayUrls = (
  relays: ReadonlyArray<RelayListEntry>,
  options?: Readonly<{
    allowlistHosts?: ReadonlySet<string>;
    maxDialTargets?: number;
  }>,
): ReadonlyArray<string> => {
  const allowlist = options?.allowlistHosts ?? resolveTorViableAllowlistHosts();
  const maxTargets = options?.maxDialTargets ?? TOR_VIABLE_MAX_DIAL_TARGETS;
  const enabledUrls = relays
    .filter((relay) => relay.enabled)
    .map((relay) => relay.url);

  const onionOrAllowlist = enabledUrls.filter((url) => (
    isTorViableNativeDialClass(classifyTorRelayEndpoint(url, allowlist))
  ));

  if (onionOrAllowlist.length > 0) {
    return onionOrAllowlist.slice(0, maxTargets);
  }

  const lab = enabledUrls.filter((url) => (
    classifyTorRelayEndpoint(url, allowlist) === "lab_loopback"
  ));
  return lab.slice(0, maxTargets);
};

/** Filter an already-resolved DM URL list (same rules as {@link resolveTorViableDmRelayUrls}). */
export const filterTorViableDmRelayUrls = (
  dmUrls: ReadonlyArray<string>,
  options?: Readonly<{
    allowlistHosts?: ReadonlySet<string>;
    maxDialTargets?: number;
  }>,
): ReadonlyArray<string> => {
  const allowlist = options?.allowlistHosts ?? resolveTorViableAllowlistHosts();
  const maxTargets = options?.maxDialTargets ?? TOR_VIABLE_MAX_DIAL_TARGETS;
  const onionOrAllowlist = dmUrls.filter((url) => (
    isTorViableNativeDialClass(classifyTorRelayEndpoint(url, allowlist))
  ));
  if (onionOrAllowlist.length > 0) {
    return onionOrAllowlist.slice(0, maxTargets);
  }
  const lab = dmUrls.filter((url) => (
    classifyTorRelayEndpoint(url, allowlist) === "lab_loopback"
  ));
  return lab.slice(0, maxTargets);
};
