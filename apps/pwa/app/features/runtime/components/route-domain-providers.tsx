"use client";

import type React from "react";
import { LazyGlobalDialogManager } from "@/app/features/messaging/components/lazy-global-dialog-manager";
import { GroupProvider } from "@/app/features/groups/providers/group-provider";
import { MessagingProvider } from "@/app/features/messaging/providers/messaging-provider";
import { RuntimeMessagingTransportOwnerProvider } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { NetworkProvider } from "@/app/features/network/providers/network-provider";
import { resolveRuntimeDomain } from "../services/resolve-runtime-domain";
import { usePathname } from "next/navigation";

function NetworkDomainStack(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <GroupProvider>
      <NetworkProvider>
        {props.children}
      </NetworkProvider>
    </GroupProvider>
  );
}

function MessagingDomainStack(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <NetworkDomainStack>
      <MessagingProvider>
        <RuntimeMessagingTransportOwnerProvider>
          <LazyGlobalDialogManager />
          {props.children}
        </RuntimeMessagingTransportOwnerProvider>
      </MessagingProvider>
    </NetworkDomainStack>
  );
}

function SearchDomainStack(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <NetworkProvider>
      {props.children}
    </NetworkProvider>
  );
}

/**
 * Mounts Group / Network / Messaging only for the active route domain.
 * Route-scoped provider unmount was reverted (2026-05-23) — caused cross-route hook crashes.
 * See `unlocked-app-runtime-shell.tsx`. Future domain splits need safe hooks on all globals first.
 */
export function RouteDomainProviders(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const pathname = usePathname();
  const domain = resolveRuntimeDomain(pathname);

  if (domain === "messaging") {
    return <MessagingDomainStack>{props.children}</MessagingDomainStack>;
  }
  if (domain === "network") {
    return <NetworkDomainStack>{props.children}</NetworkDomainStack>;
  }
  if (domain === "search") {
    return <SearchDomainStack>{props.children}</SearchDomainStack>;
  }
  return <>{props.children}</>;
}
