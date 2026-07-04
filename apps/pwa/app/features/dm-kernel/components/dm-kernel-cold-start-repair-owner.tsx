"use client";

import { useEffect, useRef } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { scheduleDmKernelColdStartRepair } from "../dm-kernel-cold-start-repair";
import { isDmKernelAuthority } from "../dm-kernel-policy";

/**
 * Runs once per profile unlock — background relay backfill for one-sided SQLite DM threads.
 * Waits until at least one relay socket is open so backfill has transport evidence.
 */
export function DmKernelColdStartRepairOwner(): null {
  const { profileId } = useProfileRuntime();
  const publicKeyHex = useIdentity().state.publicKeyHex;
  const { relayPool, relayRuntime } = useRelay();
  const scheduledForProfileRef = useRef<string | null>(null);

  const relayReady = relayRuntime.writableRelayCount > 0
    || relayPool.connections.some((connection) => connection.status === "open");

  useEffect(() => {
    if (!isDmKernelAuthority() || !profileId.trim() || !publicKeyHex || !relayReady) {
      return;
    }
    if (scheduledForProfileRef.current === profileId) {
      return;
    }
    scheduledForProfileRef.current = profileId;

    const myPublicKeyHex = normalizePublicKeyHex(publicKeyHex) ?? (publicKeyHex as PublicKeyHex);
    void scheduleDmKernelColdStartRepair({ profileId, myPublicKeyHex });
  }, [profileId, publicKeyHex, relayReady]);

  return null;
}
