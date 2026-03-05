"use client";

import { useEffect, useState } from "react";
import { getTauriAPI, isDesktopEnvironment, type TauriAPI } from "../utils/tauri-api";

/**
 * Hook to access Tauri API with desktop environment detection
 */
export function useTauri() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => isDesktopEnvironment());
  const [api] = useState<TauriAPI>(() => getTauriAPI());

  useEffect(() => {
    if (isDesktopEnvironment()) {
      setIsDesktop(true);
      return;
    }
    const timers = [
      window.setTimeout(() => setIsDesktop(isDesktopEnvironment()), 0),
      window.setTimeout(() => setIsDesktop(isDesktopEnvironment()), 150),
      window.setTimeout(() => setIsDesktop(isDesktopEnvironment()), 500),
    ];
    const interval = window.setInterval(() => {
      if (isDesktopEnvironment()) {
        setIsDesktop(true);
        window.clearInterval(interval);
      }
    }, 250);
    const stopIntervalTimer = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 5000);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
      window.clearTimeout(stopIntervalTimer);
    };
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
  const [isDesktop, setIsDesktop] = useState<boolean>(() => isDesktopEnvironment());

  useEffect(() => {
    if (isDesktopEnvironment()) {
      setIsDesktop(true);
      return;
    }
    const timers = [
      window.setTimeout(() => setIsDesktop(isDesktopEnvironment()), 0),
      window.setTimeout(() => setIsDesktop(isDesktopEnvironment()), 150),
      window.setTimeout(() => setIsDesktop(isDesktopEnvironment()), 500),
    ];
    const interval = window.setInterval(() => {
      if (isDesktopEnvironment()) {
        setIsDesktop(true);
        window.clearInterval(interval);
      }
    }, 250);
    const stopIntervalTimer = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 5000);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(interval);
      window.clearTimeout(stopIntervalTimer);
    };
  }, []);

  return isDesktop;
}
