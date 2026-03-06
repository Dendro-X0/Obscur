"use client";

import { useEffect } from "react";
import { checkStorageHealth } from "@/app/features/messaging/services/storage-health-service";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

export function StorageHealthBootstrap(): null {
  useEffect(() => {
    void (async () => {
      const state = await checkStorageHealth();
      if (!state.messageStoreOk || !state.queueStoreOk || !state.mediaIndexOk) {
        logRuntimeEvent(
          "storage.health.degraded",
          "degraded",
          [
            "[StorageHealth] Startup check detected degraded local storage state.",
            state,
          ],
          { maxPerWindow: 1, windowMs: 60_000 }
        );
      }
    })();
  }, []);

  return null;
}
