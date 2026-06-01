"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { AUTH_CLIENT_REVISION } from "@/app/features/auth/services/auth-profile-local-evidence";

/** Client-only badge — avoids SSR hydration mismatch. */
export function ClientSurfaceRevisionBadge(): React.JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-12 right-2 z-[10000] rounded-lg border border-emerald-400/60 bg-emerald-600/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100 shadow-lg backdrop-blur-sm"
      data-testid="client-surface-revision"
    >
      Client {AUTH_CLIENT_REVISION}
    </div>
  );
}
