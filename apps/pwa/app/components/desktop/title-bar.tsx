"use client";

import type React from "react";
import { WindowControls } from "./window-controls";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";
import { isDesktopEnvironment } from "@/app/features/desktop/utils/tauri-api";

interface TitleBarProps {
  title?: string;
  showControls?: boolean;
}

/**
 * Custom title bar for desktop app
 * Provides a draggable area and window controls
 */
export function TitleBar({ title = "Obscur", showControls = true }: TitleBarProps): React.JSX.Element | null {
  const isDesktop = useIsDesktop();
  const forceDesktopShell = process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1" || process.env.NEXT_PUBLIC_DESKTOP_SHELL === "true";
  const shouldRender = forceDesktopShell || isDesktop || isDesktopEnvironment();

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className="flex h-12 items-center justify-between px-4 titlebar-glass border-b border-black/10 dark:border-white/10 relative z-[9999]"
      data-tauri-drag-region
    >
      {/* Background Gradient Layer */}
      <div className="absolute inset-0 titlebar-gradient pointer-events-none" />

      <div className="flex items-center gap-3 relative z-10 select-none" data-tauri-drag-region>
        <div className="flex items-center justify-center h-6 w-6" data-tauri-drag-region>
          <img src="/obscur-logo-light.svg" className="h-full w-full dark:hidden" alt="Obscur" data-tauri-drag-region />
          <img src="/obscur-logo-dark.svg" className="h-full w-full hidden dark:block" alt="Obscur" data-tauri-drag-region />
        </div>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-zinc-100 opacity-80" data-tauri-drag-region>
          {title}
        </span>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40" data-tauri-drag-region>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent" data-tauri-drag-region />
      </div>

      <div className="relative z-10 flex items-center">
        {showControls && <WindowControls />}
      </div>
    </div>
  );
}
