"use client";

import { useCallback, useEffect, useState } from "react";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  readRelayTransportMode,
  writeRelayTransportMode,
  type RelayTransportMode,
} from "../services/relay-transport-mode";

export const useRelayTransportMode = (): Readonly<{
  mode: RelayTransportMode;
  setMode: (mode: RelayTransportMode) => void;
  isRedundancy: boolean;
}> => {
  const [mode, setModeState] = useState<RelayTransportMode>(() => readRelayTransportMode());

  useEffect(() => {
    setModeState(readRelayTransportMode(getResolvedProfileId()));
  }, []);

  const setMode = useCallback((next: RelayTransportMode) => {
    writeRelayTransportMode(next, getResolvedProfileId());
    setModeState(next);
  }, []);

  return {
    mode,
    setMode,
    isRedundancy: mode === "redundancy",
  };
};
