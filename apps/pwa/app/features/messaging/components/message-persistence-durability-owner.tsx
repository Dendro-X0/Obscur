"use client";

import { useEffect } from "react";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Ensures batched native SQLite message writes complete before tab close / hide.
 */
export function MessagePersistenceDurabilityOwner(): null {
  useEffect(() => {
    if (!requiresSqlitePersistence() || typeof window === "undefined") {
      return;
    }
    const flushPendingSqliteWrites = (): void => {
      void messagePersistenceService.flushPendingNow();
    };
    window.addEventListener("pagehide", flushPendingSqliteWrites);
    window.addEventListener("beforeunload", flushPendingSqliteWrites);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushPendingSqliteWrites();
      }
    });
    return () => {
      window.removeEventListener("pagehide", flushPendingSqliteWrites);
      window.removeEventListener("beforeunload", flushPendingSqliteWrites);
    };
  }, []);

  return null;
}
