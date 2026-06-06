"use client";

import { useEffect } from "react";
import { flushPendingSealedGroupSqliteWrites } from "@/app/features/groups/services/sealed-group-message-persistence";

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
      void flushPendingSealedGroupSqliteWrites();
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
