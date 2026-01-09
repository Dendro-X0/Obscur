"use client";

import { useEffect, useState } from "react";
import type { BootstrapConfig } from "@dweb/core/bootstrap-config";
import { fetchBootstrapConfig } from "../lib/fetch-bootstrap-config";
import { Card } from "./ui/card";

type BootstrapStatusState = Readonly<{
  status: "idle" | "loading" | "success" | "error";
  data?: BootstrapConfig;
  error?: string;
}>;

const createInitialState = (): BootstrapStatusState => ({ status: "idle" });

export const BootstrapStatus = () => {
  const [state, setState] = useState<BootstrapStatusState>(createInitialState());
  useEffect(() => {
    const run = async (): Promise<void> => {
      setState({ status: "loading" });
      const result: Awaited<ReturnType<typeof fetchBootstrapConfig>> = await fetchBootstrapConfig();
      if (result.error) {
        setState({ status: "error", error: result.error });
        return;
      }
      if (!result.data) {
        setState({ status: "error", error: "Missing response body" });
        return;
      }
      setState({ status: "success", data: result.data });
    };
    void run();
  }, []);
  if (state.status === "idle" || state.status === "loading") {
    return (
      <Card title="API bootstrap" description="Edge bootstrap config and relay list.">
        <div>Loading…</div>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card tone="danger" title="API bootstrap" description="Edge bootstrap config and relay list.">
        <div className="wrap-break-word">{state.error}</div>
      </Card>
    );
  }
  return (
    <Card tone="success" title="API bootstrap" description="Edge bootstrap config and relay list.">
      <div>Version: {state.data?.version}</div>
      <div className="mt-4 text-xs font-semibold text-emerald-900 dark:text-emerald-100">Relays</div>
      <ul className="mt-2 space-y-1">
        {(state.data?.relays ?? []).map((relay: string) => (
          <li key={relay} className="font-mono text-xs wrap-break-word">
            {relay}
          </li>
        ))}
      </ul>
    </Card>
  );
};
