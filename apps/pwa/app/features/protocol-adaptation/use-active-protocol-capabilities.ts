"use client";

import { useEffect, useState } from "react";
import { ProtocolAdaptationLayer } from "./layer";
import { PROTOCOL_ADAPTATION_CHANGED_EVENT } from "./preferences";
import type { ProtocolCapabilities, ProtocolId, TransportId } from "./types";

export type ActiveProtocolSnapshot = Readonly<{
  protocolId: ProtocolId;
  transportId: TransportId;
  capabilities: ProtocolCapabilities;
}>;

const readSnapshot = (): ActiveProtocolSnapshot => ({
  protocolId: ProtocolAdaptationLayer.getActiveProtocolId(),
  transportId: ProtocolAdaptationLayer.getActiveTransportId(),
  capabilities: ProtocolAdaptationLayer.capabilities(),
});

/** React hook for shell affordances — capabilities(), not protocol id branching. */
export const useActiveProtocolCapabilities = (): ActiveProtocolSnapshot => {
  const [snapshot, setSnapshot] = useState<ActiveProtocolSnapshot>(readSnapshot);

  useEffect(() => {
    const refresh = (): void => {
      setSnapshot(readSnapshot());
    };
    refresh();
    if (typeof window === "undefined") {
      return;
    }
    window.addEventListener(PROTOCOL_ADAPTATION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(PROTOCOL_ADAPTATION_CHANGED_EVENT, refresh);
    };
  }, []);

  return snapshot;
};
