"use client";

import { useEffect, useState } from "react";
import {
  loadTransportRelayPersistence,
  type TransportRelayPersistenceBundle,
} from "../services/transport-relay-supervisor-bootstrap";

type UseTransportRelayPersistenceParams = Readonly<{
  profileId: string;
  windowLabel: string;
  enabled: boolean;
}>;

const EMPTY_PERSISTENCE: TransportRelayPersistenceBundle = {
  engineConfiguredRelayUrls: [],
  relayCheckpoints: [],
  engineCheckpointRelayUrls: [],
};

/** Loads transport-engine relay URLs and checkpoints when relay transport bootstrap is ready. */
export const useTransportRelayPersistence = (
  params: UseTransportRelayPersistenceParams,
): TransportRelayPersistenceBundle => {
  const [persistence, setPersistence] = useState<TransportRelayPersistenceBundle>(
    () => EMPTY_PERSISTENCE,
  );

  useEffect(() => {
    if (!params.enabled) {
      setPersistence(EMPTY_PERSISTENCE);
      return;
    }
    const profileId = params.profileId.trim();
    if (!profileId) {
      setPersistence(EMPTY_PERSISTENCE);
      return;
    }

    let cancelled = false;
    void loadTransportRelayPersistence({
      profileId,
      windowLabel: params.windowLabel,
    }).then((loaded) => {
      if (!cancelled) {
        setPersistence(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params.enabled, params.profileId, params.windowLabel]);

  return persistence;
};
