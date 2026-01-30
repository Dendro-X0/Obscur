"use client";

import { useEnhancedRelayPool } from "./enhanced-relay-pool";

/**
 * Compatibility hook for useRelayPool
 * Requirement 4.2: Multiple relay support for redundancy
 */
export const useRelayPool = (urls: ReadonlyArray<string>) => {
    return useEnhancedRelayPool(urls);
};
