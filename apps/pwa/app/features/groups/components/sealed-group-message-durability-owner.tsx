"use client";

import { useEffect } from "react";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import {
  backfillSealedGroupMessagesToSqliteFromAllAccountChatStates,
  flushPendingSealedGroupSqliteWrites,
} from "@/app/features/groups/services/sealed-group-message-persistence";
import { getLastBoundAccountPublicKeyHex } from "@/app/features/profiles/services/profile-window-account-binding";
import { readActiveDesktopProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";
import { isTauri } from "@dweb/db";

/**
 * Ensures in-flight native SQLite group-message writes complete before the desktop
 * shell exits — page refresh keeps the process alive; cold restart does not.
 */
export function SealedGroupMessageDurabilityOwner(): null {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flushPending = (): void => {
      chatStateStoreService.flushAllPending();
      void (async () => {
        if (isTauri()) {
          const profileId = readActiveDesktopProfileId().trim();
          const publicKeyHex = profileId.length > 0
            ? getLastBoundAccountPublicKeyHex(profileId)
            : null;
          if (publicKeyHex && profileId.length > 0) {
            await backfillSealedGroupMessagesToSqliteFromAllAccountChatStates({
              publicKeyHex,
              profileId,
            });
          }
        }
        await flushPendingSealedGroupSqliteWrites();
      })();
    };
    window.addEventListener("pagehide", flushPending);
    window.addEventListener("beforeunload", flushPending);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushPending();
      }
    });
    return () => {
      window.removeEventListener("pagehide", flushPending);
      window.removeEventListener("beforeunload", flushPending);
    };
  }, []);

  return null;
}
