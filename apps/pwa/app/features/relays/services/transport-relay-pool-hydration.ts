/**
 * Pool hydration when user relay settings are empty but transport-engine persistence has evidence.
 */
export const resolveEnginePoolHydrationRelayUrls = (params: Readonly<{
  userEnabledRelayUrls: ReadonlyArray<string>;
  customNodeRelayUrls: ReadonlyArray<string>;
  engineConfiguredRelayUrls: ReadonlyArray<string>;
  engineCheckpointRelayUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  if (params.userEnabledRelayUrls.length > 0 || params.customNodeRelayUrls.length > 0) {
    return [];
  }
  if (params.engineCheckpointRelayUrls.length > 0) {
    return params.engineCheckpointRelayUrls;
  }
  return params.engineConfiguredRelayUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
};

/** DM transport list with engine hydration fallback when user settings are empty. */
export const resolveEffectiveDmTransportRelayUrls = (params: Readonly<{
  userDmTransportRelayUrls: ReadonlyArray<string>;
  enginePoolHydrationRelayUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => (
  params.userDmTransportRelayUrls.length > 0
    ? params.userDmTransportRelayUrls
    : params.enginePoolHydrationRelayUrls
);
