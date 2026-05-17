"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { AppLoadingScreen } from "@/app/components/app-loading-screen";

const LOADING_SOFT_TIMEOUT_MS = 8_000;
const LOADING_AUTO_RECOVERY_TIMEOUT_MS = 15_000;
const LOADING_WATCHDOG_STORAGE_PREFIX = "obscur.route.loading.auto_recovery.v1";
const LOADING_WATCHDOG_MAX_AUTO_ATTEMPTS = 1;

const readAttemptCount = (storageKey: string): number => {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return 0;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  } catch {
    return LOADING_WATCHDOG_MAX_AUTO_ATTEMPTS;
  }
};

const reserveAutoAttempt = (storageKey: string): boolean => {
  try {
    const nextAttemptCount = readAttemptCount(storageKey) + 1;
    window.sessionStorage.setItem(storageKey, String(nextAttemptCount));
    return true;
  } catch {
    return false;
  }
};

export default function Loading(): React.JSX.Element {
  const [canShowRecoveryActions, setCanShowRecoveryActions] = useState(false);
  const [autoRecoveryAttempted, setAutoRecoveryAttempted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const routeSignature = useMemo(() => {
    if (typeof window === "undefined") {
      return "unknown";
    }
    return `${window.location.pathname}${window.location.search}`;
  }, []);
  const storageKey = `${LOADING_WATCHDOG_STORAGE_PREFIX}:${routeSignature}`;

  useEffect(() => {
    const startedAtUnixMs = Date.now();
    const intervalId = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAtUnixMs));
    }, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const revealTimeoutId = window.setTimeout(() => {
      setCanShowRecoveryActions(true);
    }, LOADING_SOFT_TIMEOUT_MS);
    return () => {
      window.clearTimeout(revealTimeoutId);
    };
  }, []);

  useEffect(() => {
    const autoRecoveryTimeoutId = window.setTimeout(() => {
      const currentAttemptCount = readAttemptCount(storageKey);
      if (currentAttemptCount >= LOADING_WATCHDOG_MAX_AUTO_ATTEMPTS) {
        setCanShowRecoveryActions(true);
        return;
      }
      if (!reserveAutoAttempt(storageKey)) {
        setCanShowRecoveryActions(true);
        return;
      }
      setAutoRecoveryAttempted(true);
      window.location.assign(window.location.href);
    }, LOADING_AUTO_RECOVERY_TIMEOUT_MS);
    return () => {
      window.clearTimeout(autoRecoveryTimeoutId);
    };
  }, [storageKey]);

  if (!canShowRecoveryActions) {
    return <AppLoadingScreen title="Booting Obscur" detail="Preparing login and runtime services..." />;
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-zinc-50/95 px-6 text-zinc-900 dark:bg-black/90 dark:text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Obscur</div>
        <div className="mt-3 text-2xl font-semibold">Startup Is Taking Longer Than Expected</div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Runtime route loading is still in progress. You can retry this route or return to the main chat workspace.
        </div>
        <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
          Elapsed: {Math.round(elapsedMs / 1000)}s
        </div>
        {autoRecoveryAttempted ? (
          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Automatic recovery was attempted once for this route.
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              window.location.assign(window.location.href);
            }}
          >
            Retry Route
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              window.location.assign("/");
            }}
          >
            Go To Chats
          </button>
        </div>
      </div>
    </div>
  );
}
