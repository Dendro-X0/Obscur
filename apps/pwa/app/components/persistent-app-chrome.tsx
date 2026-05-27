"use client";

import type React from "react";
import AppShell from "./app-shell";
import { useAppChromeMergedSlot } from "./app-chrome-registry";
import { SidebarPortalProvider } from "./app-shell-sidebar-portal";
import { GlobalNavigationLoadingProvider } from "./global-navigation-loading";

/**
 * Single AppShell instance for the unlocked app. Route bodies register chrome
 * overrides via {@link useRegisterAppChrome} instead of mounting their own shell.
 */
export function PersistentAppChrome(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const slot = useAppChromeMergedSlot();

  return (
    <GlobalNavigationLoadingProvider>
      <SidebarPortalProvider>
        <AppShell
          navBadgeCounts={slot.navBadgeCounts}
          hideSidebar={slot.hideSidebar}
          hideHeader={slot.hideHeader}
          mobileDmMode={slot.mobileDmMode}
        >
          {props.children}
        </AppShell>
      </SidebarPortalProvider>
    </GlobalNavigationLoadingProvider>
  );
}
