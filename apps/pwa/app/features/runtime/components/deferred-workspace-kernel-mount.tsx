"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { WorkspaceKernelProvider } from "@/app/features/workspace-kernel/workspace-kernel-provider";
import { scheduleUnlockPathHeavyWork } from "@/app/features/runtime/unlock-hydrate-policy";
import { logAppEvent } from "@/app/shared/log-app-event";

/** Min delay after unlock mount before WorkspaceKernel may activate (Slice 2b). */
const DEFERRED_KERNEL_MIN_DELAY_MS = 2_000;

/**
 * Thin-desktop remount: mount WorkspaceKernelProvider immediately with authority off,
 * then enable after idle + min delay. Tree shape stays stable (no child remount).
 * Warmup / cold-repair / leases / group-relay ingest stay subtracted elsewhere.
 */
export function DeferredWorkspaceKernelMount(
  props: Readonly<{ children: React.ReactNode }>,
): React.JSX.Element {
  const [kernelReady, setKernelReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleCancel: (() => void) | undefined;
    const minDelay = window.setTimeout(() => {
      idleCancel = scheduleUnlockPathHeavyWork(() => {
        if (cancelled) {
          return;
        }
        setKernelReady(true);
        logAppEvent({
          name: "runtime.deferred_workspace_kernel_mounted",
          level: "info",
          scope: { feature: "runtime", action: "deferred_kernel" },
          context: { delayMs: DEFERRED_KERNEL_MIN_DELAY_MS },
        });
      });
    }, DEFERRED_KERNEL_MIN_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(minDelay);
      idleCancel?.();
    };
  }, []);

  return (
    <WorkspaceKernelProvider authorityEnabled={kernelReady}>
      {props.children}
    </WorkspaceKernelProvider>
  );
}
