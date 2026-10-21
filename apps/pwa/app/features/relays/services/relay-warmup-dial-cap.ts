/**
 * Slice 2 lag: during unlock warm-up, dial at most N public-default relays at once.
 * Private / intranet / custom hosts are never capped here.
 *
 * Host set is local (not imported from community-mode-contract) so turbopack chunk
 * splits cannot mis-bind `isPublicDefaultRelayHost` and treat Quiet URLs as private
 * — that path dialed nos+primal+damus with no process claim.
 */

/** How long after first dial attempt we treat the shell as warming up. */
export const RELAY_WARMUP_DIAL_WINDOW_MS = 60_000;

/**
 * Max concurrent public Quiet dials during warm-up.
 * v2.0.0-beta: **2** — thin shell + serial NativeRelay dial + EVENT coalesce reopen
 * a small clearnet pool (was 0 after pre-thin heap soaks). Private/local never capped.
 */
export const RELAY_WARMUP_PUBLIC_DIAL_CAP = 2;

/** Stagger deferred public Quiet dials (ms between each). */
export const RELAY_WARMUP_PUBLIC_DIAL_STAGGER_MS = 20_000;

/** Quiet public-default hosts — keep in sync with community-mode-contract. */
const PUBLIC_DEFAULT_RELAY_HOSTS = new Set<string>([
  "relay.damus.io",
  "nos.lol",
  "relay.primal.net",
  "relay.snort.social",
  "relay.nostr.band",
  "groups.fiatjaf.com",
]);

const hostnameOfRelayUrl = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  const candidate = /^wss?:\/\//i.test(trimmed) ? trimmed : `wss://${trimmed}`;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^wss?:\/\//i, "")
      .replace(/\/.*$/, "")
      .toLowerCase() || null;
  }
};

export const isPublicDefaultRelayUrl = (url: string): boolean => {
  const host = hostnameOfRelayUrl(url);
  return host ? PUBLIC_DEFAULT_RELAY_HOSTS.has(host) : false;
};

export const countPublicDefaultDialInFlight = (
  urls: ReadonlyArray<string>,
): number => urls.filter((url) => isPublicDefaultRelayUrl(url)).length;

/**
 * Process-wide Quiet dial claims. Multi-mount `useConduitMeshRelayPool` each owns a
 * client; without a shared claim, N mounts × publicDialCap stampede NativeRelay.
 */
const processPublicWarmupDialedUrls = new Set<string>();

export const clearProcessPublicWarmupDials = (): void => {
  processPublicWarmupDialedUrls.clear();
};

/** Test helper — current claimed Quiet URLs. */
export const listProcessPublicWarmupDialsForTests = (): ReadonlyArray<string> => (
  Array.from(processPublicWarmupDialedUrls)
);

/**
 * Claim a Quiet dial slot process-wide.
 * - Non-public URLs always succeed (not tracked here).
 * - Same Quiet URL already claimed → false (no second NativeRelay).
 * - Cap already full with a different Quiet → false.
 */
export const tryClaimProcessPublicWarmupDial = (
  url: string,
  publicDialCap: number = RELAY_WARMUP_PUBLIC_DIAL_CAP,
): boolean => {
  if (!isPublicDefaultRelayUrl(url)) {
    return true;
  }
  const key = url.trim();
  if (processPublicWarmupDialedUrls.has(key)) {
    return false;
  }
  if (processPublicWarmupDialedUrls.size >= publicDialCap) {
    return false;
  }
  processPublicWarmupDialedUrls.add(key);
  return true;
};

export const releaseProcessPublicWarmupDial = (url: string): void => {
  if (!isPublicDefaultRelayUrl(url)) {
    return;
  }
  processPublicWarmupDialedUrls.delete(url.trim());
};

/**
 * Split configured URLs into immediate dials vs deferred public Quiet dials.
 * Non-public URLs always go immediate; at most `publicDialCap` public Quiet URLs dial now.
 *
 * Private/local first, then ≤cap public alongside — beta showcase needs clearnet Quiet
 * even when localhost is also configured. Extra public hosts stay undialed (no stagger).
 */
export const partitionWarmupDialUrls = (
  urls: ReadonlyArray<string>,
  publicDialCap: number = RELAY_WARMUP_PUBLIC_DIAL_CAP,
): Readonly<{
  immediate: ReadonlyArray<string>;
  deferredPublic: ReadonlyArray<string>;
}> => {
  const trimmed = urls.map((url) => url.trim()).filter((url) => url.length > 0);
  const privateUrls = trimmed.filter((url) => !isPublicDefaultRelayUrl(url));
  const publicUrls = trimmed.filter((url) => isPublicDefaultRelayUrl(url));
  return {
    immediate: [...privateUrls, ...publicUrls.slice(0, Math.max(0, publicDialCap))],
    deferredPublic: [],
  };
};

/**
 * Returns false when warm-up should defer this public-default dial.
 * Private and non-default hosts always return true.
 */
export const shouldAllowRelayDialDuringWarmup = (params: Readonly<{
  url: string;
  inFlightPublicDefaultUrls: ReadonlyArray<string>;
  warmupStartedAtUnixMs: number | null;
  nowUnixMs?: number;
  publicDialCap?: number;
  warmupWindowMs?: number;
}>): boolean => {
  if (!isPublicDefaultRelayUrl(params.url)) {
    return true;
  }
  const started = params.warmupStartedAtUnixMs;
  if (started === null) {
    return true;
  }
  const now = params.nowUnixMs ?? Date.now();
  const windowMs = params.warmupWindowMs ?? RELAY_WARMUP_DIAL_WINDOW_MS;
  if (now - started >= windowMs) {
    return true;
  }
  const cap = params.publicDialCap ?? RELAY_WARMUP_PUBLIC_DIAL_CAP;
  const inFlight = countPublicDefaultDialInFlight(params.inFlightPublicDefaultUrls);
  if (inFlight < cap) {
    return true;
  }
  // Already counting this URL as in-flight — allow reuse / reconnect of same host.
  return params.inFlightPublicDefaultUrls.some(
    (candidate) => candidate.trim() === params.url.trim(),
  );
};
