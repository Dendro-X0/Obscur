"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { selectHiddenProjectionConversationMessages } from "@/app/features/account-sync/services/account-projection-selectors";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { subscribeAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { Message } from "../types";

export const useDmThreadHiddenMessages = (params: Readonly<{
  conversationId: string | null | undefined;
  conversationKind: "dm" | "group";
  myPublicKeyHex: PublicKeyHex | null | undefined;
}>): Readonly<{
  hiddenMessages: ReadonlyArray<Message>;
  hiddenCount: number;
  refreshHiddenMessages: () => void;
}> => {
  const projectionSnapshot = useAccountProjectionSnapshot();
  const activeProfileId = getResolvedProfileId();
  const [revision, setRevision] = useState(0);

  const refreshHiddenMessages = useCallback((): void => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (params.conversationKind !== "dm" || !params.conversationId) {
      return;
    }
    return subscribeAccountSyncMutation((detail) => {
      if (
        detail.reason === "message_delete_tombstones_changed"
        || detail.reason === "dm_history_changed"
      ) {
        setRevision((value) => value + 1);
      }
    }, { profileId: activeProfileId, replayOnSubscribe: false });
  }, [activeProfileId, params.conversationId, params.conversationKind]);

  const hiddenMessages = useMemo(() => {
    void revision;
    if (
      params.conversationKind !== "dm"
      || !params.conversationId
      || !params.myPublicKeyHex
    ) {
      return [];
    }
    const projection = (
      projectionSnapshot.profileId
      && projectionSnapshot.projection?.accountPublicKeyHex === params.myPublicKeyHex
    )
      ? projectionSnapshot.projection
      : accountProjectionRuntime.getSnapshot().projection;
    return selectHiddenProjectionConversationMessages({
      projection,
      conversationId: params.conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
      limit: 200,
    });
  }, [
    params.conversationId,
    params.conversationKind,
    params.myPublicKeyHex,
    projectionSnapshot.profileId,
    projectionSnapshot.projection,
    revision,
  ]);

  return {
    hiddenMessages,
    hiddenCount: hiddenMessages.length,
    refreshHiddenMessages,
  };
};
