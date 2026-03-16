"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { GlobalDialogManager } from "@/app/features/messaging/components/global-dialog-manager";
import { GroupProvider } from "@/app/features/groups/providers/group-provider";
import { MessagingProvider } from "@/app/features/messaging/providers/messaging-provider";
import { RuntimeMessagingTransportOwnerProvider } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { NetworkProvider } from "@/app/features/network/providers/network-provider";
import { RelayProvider } from "@/app/features/relays/providers/relay-provider";
import { RuntimeActivationManager } from "./runtime-activation-manager";
import { useWindowRuntimeSnapshot } from "../services/window-runtime-supervisor";

const ACTIVATION_OVERLAY_TIMEOUT_MS = 9_000;

export function UnlockedAppRuntimeShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const runtime = useWindowRuntimeSnapshot();
  const [activationOverlayTimedOut, setActivationOverlayTimedOut] = useState(false);
  const activationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (activationTimerRef.current !== null) {
      window.clearTimeout(activationTimerRef.current);
      activationTimerRef.current = null;
    }
    if (runtime.phase !== "activating_runtime") {
      setActivationOverlayTimedOut(false);
      return;
    }
    setActivationOverlayTimedOut(false);
    activationTimerRef.current = window.setTimeout(() => {
      setActivationOverlayTimedOut(true);
    }, ACTIVATION_OVERLAY_TIMEOUT_MS);
    return () => {
      if (activationTimerRef.current !== null) {
        window.clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
    };
  }, [runtime.phase]);

  return (
    <RelayProvider>
      <GroupProvider>
        <NetworkProvider>
          <RuntimeActivationManager />
          <MessagingProvider>
            <RuntimeMessagingTransportOwnerProvider>
              <GlobalDialogManager />
              {runtime.phase === "activating_runtime" && !activationOverlayTimedOut ? (
                <div className="absolute inset-0 z-[90] flex items-center justify-center bg-zinc-50/90 px-6 text-zinc-900 backdrop-blur-sm dark:bg-black/80 dark:text-zinc-100">
                  <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Profile Runtime</div>
                    <div className="mt-3 text-2xl font-semibold">Activating runtime</div>
                    <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      Finalizing relay, sync, and account services for this profile window.
                    </div>
                  </div>
                </div>
              ) : null}
              {runtime.phase === "activating_runtime" && activationOverlayTimedOut ? (
                <div className="pointer-events-none absolute left-3 right-3 top-3 z-[80] rounded-xl border border-amber-400/30 bg-amber-100/90 px-3 py-2 text-xs font-medium text-amber-900 shadow dark:border-amber-500/30 dark:bg-amber-950/70 dark:text-amber-100">
                  Runtime startup is taking longer than expected. The app remains usable while recovery continues.
                </div>
              ) : null}
              {props.children}
            </RuntimeMessagingTransportOwnerProvider>
          </MessagingProvider>
        </NetworkProvider>
      </GroupProvider>
    </RelayProvider>
  );
}
