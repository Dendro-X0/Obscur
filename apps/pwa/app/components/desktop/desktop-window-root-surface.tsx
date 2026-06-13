"use client";

import type React from "react";
import { AppProviders } from "@/app/components/providers";
import { IncomingCallPopupSurface } from "@/app/components/desktop/incoming-call-popup-surface";
import { isIncomingCallPopupWindow } from "@/app/features/desktop/utils/window-labels";

export function DesktopWindowRootSurface(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  if (isIncomingCallPopupWindow()) {
    return <IncomingCallPopupSurface />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppProviders>
        {props.children}
      </AppProviders>
    </div>
  );
}
