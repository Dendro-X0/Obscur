"use client";

import { useEffect, useState } from "react";
import { fetchBootstrapConfig } from "../lib/fetch-bootstrap-config";
import { useRelayPool } from "../lib/use-relay-pool";
import { Card } from "./ui/card";

type RelayConnectivityViewState = Readonly<{
  relayUrls: ReadonlyArray<string>;
  status: "loading" | "ready" | "error";
  error?: string;
}>;

const createInitialState = (): RelayConnectivityViewState => ({
  relayUrls: [],
  status: "loading"
});

export const RelayConnectivity = () => {
  const [state, setState] = useState<RelayConnectivityViewState>(createInitialState());
  useEffect(() => {
    const run = async (): Promise<void> => {
      const result: Awaited<ReturnType<typeof fetchBootstrapConfig>> = await fetchBootstrapConfig();
      if (result.error) {
        setState({ relayUrls: [], status: "error", error: result.error });
        return;
      }
      const relayUrls: ReadonlyArray<string> = result.data?.relays ?? [];
      setState({ relayUrls, status: "ready" });
    };
    void run();
  }, []);
  const pool = useRelayPool(state.relayUrls);
  if (state.status === "loading") {
    return (
      <Card title="Relay connectivity" description="WebSocket health across configured relays.">
        <div>Loading…</div>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card tone="danger" title="Relay connectivity" description="WebSocket health across configured relays.">
        <div className="wrap-break-word">{state.error}</div>
      </Card>
    );
  }
  return (
    <Card title="Relay connectivity" description="WebSocket health across configured relays.">
      <ul className="space-y-2">
        {pool.connections.map((item) => (
          <li key={item.url} className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60">
            <div className="font-mono text-xs wrap-break-word">{item.url}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">
              Status: <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.status}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};
