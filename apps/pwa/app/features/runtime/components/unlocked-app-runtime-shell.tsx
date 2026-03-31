"use client";

import type React from "react";
import { GlobalDialogManager } from "@/app/features/messaging/components/global-dialog-manager";
import { GroupProvider } from "@/app/features/groups/providers/group-provider";
import { MessagingProvider } from "@/app/features/messaging/providers/messaging-provider";
import { RuntimeMessagingTransportOwnerProvider } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { NetworkProvider } from "@/app/features/network/providers/network-provider";
import { TanstackQueryRuntimeProvider } from "@/app/features/query/providers/tanstack-query-runtime-provider";
import { RelayProvider } from "@/app/features/relays/providers/relay-provider";
import { RuntimeActivationManager } from "./runtime-activation-manager";
import { GlobalVoiceCallOverlay } from "@/app/features/messaging/components/global-voice-call-overlay";
import MainShell from "@/app/features/main-shell/main-shell";


export function UnlockedAppRuntimeShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <TanstackQueryRuntimeProvider>
      <RelayProvider>
        <GroupProvider>
          <NetworkProvider>
            <RuntimeActivationManager />
            <MessagingProvider>
              <RuntimeMessagingTransportOwnerProvider>
                <GlobalDialogManager />
                <MainShell />
                <GlobalVoiceCallOverlay />
                {props.children}
              </RuntimeMessagingTransportOwnerProvider>
            </MessagingProvider>
          </NetworkProvider>
        </GroupProvider>
      </RelayProvider>
    </TanstackQueryRuntimeProvider>
  );
}
