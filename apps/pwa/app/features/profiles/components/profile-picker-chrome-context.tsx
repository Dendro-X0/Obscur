"use client";

import type React from "react";
import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { isAuthPublicProfileRoute } from "@/app/features/profiles/services/auth-public-routes";

type ProfilePickerChromeValue = Readonly<{
  isMinimalChrome: boolean;
}>;

const ProfilePickerChromeContext = createContext<ProfilePickerChromeValue>({
  isMinimalChrome: false,
});

const isUnlockedRuntimePhase = (phase: string): boolean => (
  phase === "activating_runtime" || phase === "ready" || phase === "degraded"
);

export function ProfilePickerChromeHost(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const pathname = usePathname();
  const runtime = useWindowRuntime();
  const isUnlocked = isUnlockedRuntimePhase(runtime.snapshot.phase);
  const isMinimalChrome = isAuthPublicProfileRoute(pathname) && hasNativeRuntime() && !isUnlocked;
  const value = useMemo((): ProfilePickerChromeValue => ({ isMinimalChrome }), [isMinimalChrome]);

  return (
    <ProfilePickerChromeContext.Provider value={value}>
      {props.children}
    </ProfilePickerChromeContext.Provider>
  );
}

export const useProfilePickerChrome = (): ProfilePickerChromeValue => useContext(ProfilePickerChromeContext);
