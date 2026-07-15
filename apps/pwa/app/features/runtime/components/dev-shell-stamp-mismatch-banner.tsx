"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { CLIENT_BUILD_STAMP } from "@/app/shared/client-build-stamp";
import { cn } from "@/app/lib/cn";

declare global {
  interface Window {
    __OBSCUR_CLIENT_BUILD__?: string;
    __OBSCUR_EXPECTED_SHELL_STAMP__?: string;
  }
}

function readExpectedStamp(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromWindow = window.__OBSCUR_EXPECTED_SHELL_STAMP__;
  if (typeof fromWindow === "string" && fromWindow.trim()) {
    return fromWindow.trim();
  }
  const fromDom = document.documentElement.getAttribute(
    "data-obscur-expected-shell-stamp",
  );
  if (fromDom && fromDom.trim()) {
    return fromDom.trim();
  }
  return null;
}

function readActualStamp(): string {
  if (typeof window === "undefined") {
    return CLIENT_BUILD_STAMP;
  }
  const fromWindow = window.__OBSCUR_CLIENT_BUILD__;
  if (typeof fromWindow === "string" && fromWindow.trim()) {
    return fromWindow.trim();
  }
  const fromDom = document.documentElement.getAttribute("data-obscur-client-build");
  if (fromDom && fromDom.trim()) {
    return fromDom.trim();
  }
  return CLIENT_BUILD_STAMP;
}

/**
 * Dev-only fail-closed banner when static desktop shell stamp mismatches the on-disk manifest.
 * Active only when Tauri injected `__OBSCUR_EXPECTED_SHELL_STAMP__` (OBSCUR_DESKTOP_STATIC_DEV=1).
 */
export function DevShellStampMismatchBanner(): React.JSX.Element | null {
  const [mismatch, setMismatch] = useState<{
    expected: string;
    actual: string;
  } | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    const expected = readExpectedStamp();
    if (!expected) {
      return;
    }
    const actual = readActualStamp();
    if (actual === expected) {
      return;
    }
    const detail = { expected, actual };
    console.error(
      "[obscur] FATAL: static-dev shell stamp mismatch — WebView JS is stale vs on-disk manifesto",
      detail,
    );
    window.dispatchEvent(
      new CustomEvent("dev_shell_stamp_mismatch", { detail }),
    );
    setMismatch(detail);
  }, []);

  if (!mismatch) {
    return null;
  }

  return (
    <div
      role="alert"
      data-testid="dev-shell-stamp-mismatch-banner"
      className="pointer-events-auto fixed inset-0 z-[10000] flex items-start justify-center bg-black/70 p-4 pt-16"
    >
      <div
        className={cn(
          "w-full max-w-lg rounded-md border border-red-500/60 bg-red-950 px-4 py-3 text-left text-xs text-red-100 shadow-lg",
        )}
      >
        <p className="font-semibold uppercase tracking-wide text-red-200">
          Dev shell stamp mismatch — unlock blocked until rebuild refreshes
        </p>
        <p className="mt-2 font-mono text-[11px] text-red-100/90">
          expected={mismatch.expected} · actual={mismatch.actual}
        </p>
        <p className="mt-2 text-[11px] text-red-200/80">
          Run `pnpm dev:desktop -- --rebuild`, confirm `obscur-dev-clean` ran, then hard-reload.
          Event: `dev_shell_stamp_mismatch`.
        </p>
      </div>
    </div>
  );
}
