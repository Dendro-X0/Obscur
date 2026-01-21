"use client";

import { useEffect, useState } from "react";
import { getTauriAPI, isDesktopEnvironment, type TauriAPI } from "./tauri-api";

/**
 * Hook to access Tauri API with desktop environment detection
 */
export function useTauri() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [api] = useState<TauriAPI>(() => getTauriAPI());

  useEffect(() => {
    setIsDesktop(isDesktopEnvironment());
  }, []);

  return {
    isDesktop,
    api,
  };
}

/**
 * Hook to detect if running in desktop environment
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopEnvironment());
  }, []);

  return isDesktop;
}
