"use client";

import type React from "react";

/**
 * Lightweight content wrapper for /profiles when the window is not unlocked.
 * Desktop title bar (logo + window controls) is rendered by TitleBar in providers.
 */
export function ProfileManagementShell(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-100 dark:bg-zinc-950">
      <main className="min-h-0 flex-1 overflow-y-auto">
        {props.children}
      </main>
    </div>
  );
}
