"use client";

import type React from "react";
import { AppProviders } from "@/app/components/providers";
import { DesktopNotificationHandler } from "@/app/components/desktop-notification-handler";
import { IncomingCallPopupSurface } from "@/app/components/desktop/incoming-call-popup-surface";
import { isIncomingCallPopupWindow } from "@/app/features/desktop/utils/window-labels";

export function DesktopWindowRootSurface(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  if (isIncomingCallPopupWindow()) {
    return <IncomingCallPopupSurface />;
  }

  return (
    <AppProviders>
      <DesktopNotificationHandler />
      {props.children}
    </AppProviders>
  );
}
