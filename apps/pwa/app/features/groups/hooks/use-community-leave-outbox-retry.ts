"use client";

import { useEffect, useRef } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { flushPendingCommunityLeaveOutbox } from "../services/community-leave-outbox-retry";
import { getPendingCommunityLeaveOutboxItems } from "../services/community-leave-outbox";

const FLUSH_DEBOUNCE_MS = 750;
const FLUSH_INTERVAL_MS = 60_000;

/**
 * Background publisher for durable community leave outbox items.
 * Runs when identity is unlocked and at least one relay connection is open.
 */
export const useCommunityLeaveOutboxRetry = (enabled: boolean = true): void => {
  const identity = useIdentity();
  const { relayPool } = useRelay();
  const publicKeyHex = identity.state.publicKeyHex ?? null;
  const privateKeyHex = identity.state.privateKeyHex ?? null;
  const relayPoolRef = useRef(relayPool);
  useEffect(() => {
    relayPoolRef.current = relayPool;
  }, [relayPool]);

  const openRelayCount = relayPool.connections.filter((connection) => connection.status === "open").length;
  const connectionsKey = relayPool.connections.map((connection) => `${connection.url}:${connection.status}`).join("|");

  useEffect(() => {
    if (!enabled || !publicKeyHex || !privateKeyHex || openRelayCount === 0) {
      return undefined;
    }
    const profileId = getResolvedProfileId();
    const pending = getPendingCommunityLeaveOutboxItems(publicKeyHex, Date.now(), profileId);
    if (pending.length === 0) {
      return undefined;
    }

    const runFlush = (): void => {
      void flushPendingCommunityLeaveOutbox({
        publicKeyHex,
        privateKeyHex: privateKeyHex as PrivateKeyHex,
        pool: relayPoolRef.current,
        profileId,
      });
    };

    const debounceTimer = setTimeout(runFlush, FLUSH_DEBOUNCE_MS);
    const interval = setInterval(runFlush, FLUSH_INTERVAL_MS);

    return () => {
      clearTimeout(debounceTimer);
      clearInterval(interval);
    };
  }, [enabled, publicKeyHex, privateKeyHex, openRelayCount, connectionsKey]);
};
