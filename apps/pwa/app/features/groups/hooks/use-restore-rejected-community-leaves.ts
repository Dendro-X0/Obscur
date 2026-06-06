"use client";

import { useCallback, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { useGroups } from "../providers/group-provider";
import { restoreRejectedCommunityLeaveIntents } from "../services/community-leave-recovery";
import { useCommunityLeaveOutboxIndex } from "./use-community-leave-outbox-index";

export type RestoreRejectedCommunityLeavesOutcome = Readonly<{
  restoredCount: number;
  skippedNoPersistedEvidence: number;
}>;

export const useRestoreRejectedCommunityLeaves = (): Readonly<{
  rejectedCount: number;
  canRestore: boolean;
  isRestoring: boolean;
  restoreRejected: () => Promise<RestoreRejectedCommunityLeavesOutcome>;
}> => {
  const { state: identityState } = useIdentity();
  const publicKeyHex = (identityState.publicKeyHex?.trim() ?? "") as PublicKeyHex;
  const profileId = getResolvedProfileId();
  const { addGroup } = useGroups();
  const { items, refresh } = useCommunityLeaveOutboxIndex();
  const [isRestoring, setIsRestoring] = useState(false);

  const rejectedCount = useMemo(
    (): number => items.filter((item) => item.status === "rejected").length,
    [items],
  );

  const restoreRejected = useCallback(async (): Promise<RestoreRejectedCommunityLeavesOutcome> => {
    if (!publicKeyHex) {
      return { restoredCount: 0, skippedNoPersistedEvidence: 0 };
    }
    setIsRestoring(true);
    try {
      const { restored, skippedNoPersistedEvidence } = await restoreRejectedCommunityLeaveIntents({
        publicKeyHex,
        profileId,
      });
      for (const group of restored) {
        addGroup(group, { allowRevive: true });
      }
      refresh();
      return {
        restoredCount: restored.length,
        skippedNoPersistedEvidence,
      };
    } finally {
      setIsRestoring(false);
    }
  }, [addGroup, profileId, publicKeyHex, refresh]);

  return {
    rejectedCount,
    canRestore: rejectedCount > 0 && !isRestoring,
    isRestoring,
    restoreRejected,
  };
};
