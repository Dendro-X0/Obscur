"use client";

import type React from "react";
import { AppChromeProvider } from "@/app/components/app-chrome-registry";
import { PersistentAppChrome } from "@/app/components/persistent-app-chrome";
import { LazyGlobalDialogManager } from "@/app/features/messaging/components/lazy-global-dialog-manager";
import { LegacyGroupProvider } from "@/app/features/groups/providers/group-provider-port";
import { WorkspaceKernelGroupRelayIngestOwner } from "@/app/features/workspace-kernel/workspace-kernel-group-relay-ingest-owner";
import { WorkspaceKernelProvider } from "@/app/features/workspace-kernel/workspace-kernel-provider";
import { ProfileRuntimeProvider } from "@/app/features/profiles/providers/profile-runtime-provider";
import { MessagingProvider } from "@/app/features/messaging/providers/messaging-provider";
import { RuntimeMessagingTransportOwnerProvider } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { NetworkProvider } from "@/app/features/network/providers/network-provider";
import { TanstackQueryRuntimeProvider } from "@/app/features/query/providers/tanstack-query-runtime-provider";
import { RelayProvider } from "@/app/features/relays/providers/relay-provider";
import { DmKernelColdStartRepairOwner } from "@/app/features/dm-kernel/components/dm-kernel-cold-start-repair-owner";
import { DesktopWarmupOwner } from "./desktop-warmup-owner";
import { RuntimeActivationManager } from "./runtime-activation-manager";
import { ActiveSessionLeaseOwner } from "./active-session-lease-owner";
import { SecondaryProfilePostLoginRefresh } from "./secondary-profile-post-login-refresh";
import { ChatRouteMainShell, ChatRouteVoiceCallOverlay } from "./chat-route-main-shell";
import { AccountScopeBoundaryOwner } from "@/app/features/runtime/components/account-scope-boundary-owner";
import { DevLabMessagingBridge } from "@/app/features/dev-lab/dev-lab-messaging-bridge";
import { DesktopNotificationHandler } from "@/app/components/desktop-notification-handler";
import { AppMediaPreviewLayer } from "@/app/features/messaging/components/app-media-preview-layer";

/**
 * Unlocked session tree. Providers stay mounted across sidebar navigation so global
 * handlers (desktop notifications, dialogs) and cross-route state do not crash on nav.
 * Route-scoped provider unmount was reverted — it caused useMessaging errors on every
 * page switch without measurable lag wins in dev.
 */
export function UnlockedAppRuntimeShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <TanstackQueryRuntimeProvider>
      <ProfileRuntimeProvider>
        <AccountScopeBoundaryOwner />
        <RelayProvider>
          <LegacyGroupProvider>
            <WorkspaceKernelGroupRelayIngestOwner />
            <WorkspaceKernelProvider>
            <NetworkProvider>
              <DesktopWarmupOwner />
              <DmKernelColdStartRepairOwner />
              <RuntimeActivationManager />
              <ActiveSessionLeaseOwner />
              <SecondaryProfilePostLoginRefresh />
              <MessagingProvider>
                <RuntimeMessagingTransportOwnerProvider>
                  <DesktopNotificationHandler />
                  <AppMediaPreviewLayer />
                  <DevLabMessagingBridge />
                  <AppChromeProvider>
                    <LazyGlobalDialogManager />
                    <PersistentAppChrome>
                      <ChatRouteMainShell />
                      <ChatRouteVoiceCallOverlay />
                      {props.children}
                    </PersistentAppChrome>
                  </AppChromeProvider>
                </RuntimeMessagingTransportOwnerProvider>
              </MessagingProvider>
            </NetworkProvider>
            </WorkspaceKernelProvider>
          </LegacyGroupProvider>
        </RelayProvider>
      </ProfileRuntimeProvider>
    </TanstackQueryRuntimeProvider>
  );
}
