"use client";

import type React from "react";
import { Minus, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "../ui/button";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useState, useEffect } from "react";

/**
 * Native window controls for desktop app
 * Shows minimize, maximize/restore, and close buttons
 */
export function WindowControls(): React.JSX.Element | null {
  const { isDesktop, api } = useTauri();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    // Check initial maximized state
    api.window.isMaximized().then(setIsMaximized);

    // Listen for window resize events to update maximized state
    const checkMaximized = () => {
      api.window.isMaximized().then(setIsMaximized);
    };

    window.addEventListener("resize", checkMaximized);
    return () => window.removeEventListener("resize", checkMaximized);
  }, [isDesktop, api]);

  // Don't render on web
  if (!isDesktop) {
    return null;
  }

  const handleMinimize = async () => {
    await api.window.minimize();
  };

  const handleMaximize = async () => {
    if (isMaximized) {
      await api.window.unmaximize();
    } else {
      await api.window.maximize();
    }
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    await api.window.close();
  };

  return (
    <div className="flex items-center gap-1.5" data-tauri-drag-region>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 titlebar-button text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        onClick={handleMinimize}
        aria-label="Minimize window"
      >
        <Minus className="h-4.5 w-4.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 titlebar-button text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        onClick={handleMaximize}
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
      >
        {isMaximized ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0 titlebar-button titlebar-button-close text-zinc-500"
        onClick={handleClose}
        aria-label="Close window"
      >
        <X className="h-4.5 w-4.5" />
      </Button>
    </div>
  );
}
