"use client";

import type React from "react";
import { DesktopSidebarListChrome } from "./sidebar-list-chrome-desktop";
import { MobileSidebarListChrome } from "./sidebar-list-chrome-mobile";
import type { SidebarListChromeProps } from "./sidebar-list-chrome-shared";

export type {
  SidebarListChromeChatMode,
  SidebarListChromeProps,
  SidebarListChromeTab,
} from "./sidebar-list-chrome-shared";

/**
 * Shell-gated dispatcher. Prefer editing desktop-* or mobile-* templates — not this file.
 * @see docs/frontend-spec-desktop-mobile-layout-separation-2026-10.md
 */
export function SidebarListChrome(props: SidebarListChromeProps): React.JSX.Element {
  const { variant, ...surfaceProps } = props;
  if (variant === "mobile") {
    return <MobileSidebarListChrome {...surfaceProps} />;
  }
  return <DesktopSidebarListChrome {...surfaceProps} />;
}
