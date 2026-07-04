"use client";

import { useTransportRelayPersistence } from "./use-transport-relay-persistence";

type UseTransportConfiguredRelayUrlsParams = Readonly<{
  profileId: string;
  windowLabel: string;
  enabled: boolean;
}>;

/** Loads transport-engine configured relay URLs when relay transport bootstrap is ready. */
export const useTransportConfiguredRelayUrls = (
  params: UseTransportConfiguredRelayUrlsParams,
): ReadonlyArray<string> => {
  const persistence = useTransportRelayPersistence(params);
  return persistence.engineConfiguredRelayUrls;
};
