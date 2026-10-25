"use client";

import type React from "react";
import { AppChromeProvider } from "@/app/components/app-chrome-registry";

/**
 * Lightweight content wrapper for /profiles (PL1/N1 — stays light even after keychain rehydrate).
 * Provides AppChromeRegistry so PageShell / useRegisterAppChrome do not throw outside the unlocked tree.
 * Desktop title bar (logo + window controls) is rendered by TitleBar in providers.
 */
export function ProfileManagementShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <AppChromeProvider>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
        <main className="min-h-0 flex-1 overflow-y-auto">
          {props.children}
        </main>
      </div>
    </AppChromeProvider>
  );
}
