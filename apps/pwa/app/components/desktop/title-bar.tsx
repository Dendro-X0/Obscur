"use client";

import type React from "react";
import { WindowControls } from "./window-controls";
import { useIsDesktop } from "@/app/features/desktop/hooks/use-tauri";

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

  // Don't render on web
  if (!isDesktop) {
    return null;
  }

  return (
    <div
      className="flex h-12 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100" data-tauri-drag-region>
          {title}
        </span>
      </div>
      {showControls && <WindowControls />}
    </div>
  );
}
