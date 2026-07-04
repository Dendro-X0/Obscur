"use client";

import { useEffect, useMemo, useReducer } from "react";
import type { WorkspaceRelayPoolTransport } from "../services/workspace-relay-calibrator";
import {
  hasWritableCommunityRelayTransport,
  isCommunityRelayPoolWritable,
} from "../services/community-relay-transport";

/**
 * Pool-backed relay readiness for community health gates (R4 T-3).
 * Polls briefly while URL is writable but pool is not yet connected.
 */
export const useCommunityRelayPoolWritable = (
  relayUrl: string,
  pool: WorkspaceRelayPoolTransport | undefined,
  enabled = true,
): Readonly<{
  urlWritable: boolean;
  poolWritable: boolean;
  relayActivationSynced: boolean;
}> => {
  const [revision, bumpRevision] = useReducer((value: number) => value + 1, 0);
  const urlWritable = hasWritableCommunityRelayTransport(relayUrl);
  const poolWritable = useMemo(() => (
    enabled && urlWritable && isCommunityRelayPoolWritable(relayUrl, pool)
  ), [enabled, pool, relayUrl, revision, urlWritable]);

  useEffect(() => {
    if (!enabled || !urlWritable || poolWritable) {
      return;
    }
    const timerId = window.setInterval(() => bumpRevision(), 1500);
    return () => window.clearInterval(timerId);
  }, [enabled, poolWritable, urlWritable]);

  return {
    urlWritable,
    poolWritable,
    relayActivationSynced: urlWritable && poolWritable,
  };
};
