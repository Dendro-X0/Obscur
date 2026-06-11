"use client";

import { useEffect, useRef } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { scheduleDmKernelColdStartRepair } from "../dm-kernel-cold-start-repair";
import { isDmKernelAuthority } from "../dm-kernel-policy";

/**
 * Runs once per profile unlock — background relay backfill for one-sided SQLite DM threads.
 */
export function DmKernelColdStartRepairOwner(): null {
  const { profileId } = useProfileRuntime();
  const publicKeyHex = useIdentity().state.publicKeyHex;
  const scheduledForProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDmKernelAuthority() || !profileId.trim() || !publicKeyHex) {
      return;
    }
    if (scheduledForProfileRef.current === profileId) {
      return;
    }
    scheduledForProfileRef.current = profileId;

    const myPublicKeyHex = normalizePublicKeyHex(publicKeyHex) ?? (publicKeyHex as PublicKeyHex);
    void scheduleDmKernelColdStartRepair({ profileId, myPublicKeyHex });
  }, [profileId, publicKeyHex]);

  return null;
}
