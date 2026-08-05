"use client";

import { useEffect } from "react";
import { messagePersistenceService } from "@/app/features/messaging/services/message-persistence-service";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Sole hide/unload flush adapter for DM SQLite durability.
 * Row writes stay on MessagePersistenceService — do not add a second insert path here.
 * @see specs/backend/dm-persist-dual-owner-design-2026-07.md
 */
export function MessagePersistenceDurabilityOwner(): null {
  useEffect(() => {
    if (!requiresSqlitePersistence() || typeof window === "undefined") {
      return;
    }
    const flushPendingSqliteWrites = (): void => {
      void messagePersistenceService.flushPendingNow();
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        flushPendingSqliteWrites();
      }
    };
    window.addEventListener("pagehide", flushPendingSqliteWrites);
    window.addEventListener("beforeunload", flushPendingSqliteWrites);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushPendingSqliteWrites);
      window.removeEventListener("beforeunload", flushPendingSqliteWrites);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
