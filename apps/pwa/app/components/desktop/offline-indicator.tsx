"use client";

import { WifiOff, Wifi } from "lucide-react";
import { useOfflineState } from "@/app/features/desktop/hooks/use-offline-state";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";

/**
 * Indicator showing online/offline status in desktop mode
 */
export function OfflineIndicator() {
  const isDesktop = useIsDesktop();
  const offlineState = useOfflineState();

  // Only show in desktop mode
  if (!isDesktop) return null;

  // Don't show if online and no pending actions
  if (offlineState.isOnline && offlineState.pendingActions === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 shadow-lg dark:border-white/10 dark:bg-zinc-900">
        {offlineState.isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-200">
              Online
              {offlineState.pendingActions > 0 && (
                <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                  ({offlineState.pendingActions} pending)
                </span>
              )}
            </span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-zinc-700 dark:text-zinc-200">
              Offline
              {offlineState.pendingActions > 0 && (
                <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                  ({offlineState.pendingActions} queued)
                </span>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
