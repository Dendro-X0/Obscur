/**
 * M1 — kind-0 profile metadata hydrate retry policy (pure).
 * Owner: useProfileMetadata — do not invent a second cache.
 */

export const PROFILE_METADATA_HYDRATE_RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000] as const;

export const PROFILE_METADATA_HYDRATE_MAX_ATTEMPTS = 5;

export const nextProfileMetadataHydrateDelayMs = (attemptIndex: number): number | null => {
  if (attemptIndex < 0 || attemptIndex >= PROFILE_METADATA_HYDRATE_RETRY_DELAYS_MS.length) {
    return null;
  }
  return PROFILE_METADATA_HYDRATE_RETRY_DELAYS_MS[attemptIndex]!;
};

export const shouldScheduleProfileMetadataHydrateRetry = (params: Readonly<{
  needsHydration: boolean;
  live: boolean;
  hasRelayUrls: boolean;
  attemptCount: number;
  appliedEvent: boolean;
}>): boolean => {
  if (!params.live || !params.needsHydration || !params.hasRelayUrls) {
    return false;
  }
  if (params.appliedEvent) {
    return false;
  }
  return params.attemptCount < PROFILE_METADATA_HYDRATE_MAX_ATTEMPTS;
};

export const shouldRetryProfileMetadataOnPoolRecovery = (params: Readonly<{
  needsHydration: boolean;
  previousOpenCount: number;
  nextOpenCount: number;
}>): boolean => (
  params.needsHydration
  && params.nextOpenCount > params.previousOpenCount
);

export const countOpenRelayConnections = (
  connections: ReadonlyArray<Readonly<{ status: string }>>,
): number => (
  connections.filter((connection) => connection.status === "open").length
);
