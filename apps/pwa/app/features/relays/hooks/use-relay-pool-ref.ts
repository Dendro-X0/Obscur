"use client";

import { useRef } from "react";

/**
 * Keeps the latest relay pool instance without subscribing effects/callbacks to pool identity churn.
 * See docs/program/ui-effect-stability-policy.md.
 */
export const useRelayPoolRef = <T,>(pool: T): Readonly<{ current: T }> => {
  const poolRef = useRef(pool);
  poolRef.current = pool;
  return poolRef;
};

/** Stable dependency token for relay connection snapshot changes (open/closed per URL). */
export const buildRelayConnectionsKey = (
  connections: ReadonlyArray<Readonly<{ url: string; status: string }>>,
): string => connections.map((connection) => `${connection.url}:${connection.status}`).join("|");
