"use client";

import { useEffect, useState } from "react";
import { getOfflineManager, type OfflineState } from "./offline-manager";

/**
 * Hook to access offline state
 */
export function useOfflineState() {
  const [state, setState] = useState<OfflineState>(() => getOfflineManager().getState());

  useEffect(() => {
    const manager = getOfflineManager();
    const unsubscribe = manager.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}
