"use client";

import { useState } from "react";
import { getTauriAPI, isDesktopEnvironment, type TauriAPI } from "../utils/tauri-api";

/**
 * Hook to access Tauri API with desktop environment detection
 */
export function useTauri() {
  const [isDesktop] = useState<boolean>(() => isDesktopEnvironment());
  const [api] = useState<TauriAPI>(() => getTauriAPI());

  return {
    isDesktop,
    api,
  };
}

/**
 * Hook to detect if running in desktop environment
 */
export function useIsDesktop(): boolean {
  const [isDesktop] = useState<boolean>(() => isDesktopEnvironment());

  return isDesktop;
}
