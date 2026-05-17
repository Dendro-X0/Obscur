"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { getRuntimeHostInfo, hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

type RuntimeMode = "checking" | "native" | "web";

const WEB_RUNTIME_PROD_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WEB_RUNTIME_PROD === "1"
  || process.env.NEXT_PUBLIC_ENABLE_WEB_RUNTIME_PROD === "true";
const NATIVE_BOOT_WAIT_MS = 5000;

const isDevWebAllowed = (): boolean => {
  const host = getRuntimeHostInfo();
  return process.env.NODE_ENV !== "production" || host.isLocalDevelopment;
};

const shouldBlockWebRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  if (hasNativeRuntime()) return false;
  if (isDevWebAllowed()) return false;
  return !WEB_RUNTIME_PROD_ENABLED;
};

export function NativeRuntimeGate({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const [mode, setMode] = useState<RuntimeMode>(() => (shouldBlockWebRuntime() ? "checking" : "native"));

  useEffect(() => {
    if (!shouldBlockWebRuntime()) {
      setMode("native");
      return;
    }

    const checkNow = (): boolean => {
      if (hasNativeRuntime()) {
        setMode("native");
        return true;
      }
      return false;
    };

    if (checkNow()) return;

    const interval = window.setInterval(() => {
      if (checkNow()) {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      }
    }, 150);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setMode("web");
    }, NATIVE_BOOT_WAIT_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, []);

  if (mode === "native") {
    return <>{children}</>;
  }

  if (mode === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030816] px-6 text-center text-zinc-300">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold text-white">Launching Native Runtime</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Waiting for desktop/mobile runtime bridge...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030816] px-6 text-center text-zinc-300">
      <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-7">
        <h1 className="text-xl font-semibold text-white">Web Runtime Disabled</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Production web runtime is disabled by policy for v0.8.9 stabilization.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Desktop and mobile remain fully supported. Use localhost/dev for web test harness flows.
          Override for controlled environments: <code className="rounded bg-black/30 px-1.5 py-0.5">NEXT_PUBLIC_ENABLE_WEB_RUNTIME_PROD=1</code>.
        </p>
      </div>
    </div>
  );
}
