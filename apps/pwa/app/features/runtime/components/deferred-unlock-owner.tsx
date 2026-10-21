"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { scheduleUnlockPathHeavyWork } from "@/app/features/runtime/unlock-hydrate-policy";
import { logAppEvent } from "@/app/shared/log-app-event";

/**
 * Mounts a null-rendering unlock owner after min delay + idle.
 * Used for Slice 2c+ remounts that must not run on the unlock frame.
 */
export function DeferredUnlockOwner(props: Readonly<{
  delayMs: number;
  eventName: string;
  children: React.ReactNode;
}>): React.JSX.Element | null {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleCancel: (() => void) | undefined;
    const minDelay = window.setTimeout(() => {
      idleCancel = scheduleUnlockPathHeavyWork(() => {
        if (cancelled) {
          return;
        }
        setReady(true);
        logAppEvent({
          name: props.eventName,
          level: "info",
          scope: { feature: "runtime", action: "deferred_owner" },
          context: { delayMs: props.delayMs },
        });
      });
    }, props.delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(minDelay);
      idleCancel?.();
    };
  }, [props.delayMs, props.eventName]);

  if (!ready) {
    return null;
  }
  return <>{props.children}</>;
}
