"use client";

import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { Card } from "./ui/card";

/**
 * Relay connectivity
 * WebSocket health across configured relays.
 */
export const RelayConnectivity = () => {
  const { relayPool: pool } = useRelay();

  return (
    <Card title="Relay connectivity" description="WebSocket health across configured relays.">
      <ul className="space-y-2">
        {pool.connections.length === 0 ? (
          <div className="py-4 text-center text-xs text-zinc-500 italic">No relays configured</div>
        ) : (
          pool.connections.map((item) => (
            <li key={item.url} className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60">
              <div className="font-mono text-xs wrap-break-word">{item.url}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Status: <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.status}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
};
