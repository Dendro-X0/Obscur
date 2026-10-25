"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { AUTH_CLIENT_REVISION } from "@/app/features/auth/services/auth-profile-local-evidence";
import { cn } from "@/app/lib/cn";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";

/** Client-only badge — avoids SSR hydration mismatch. Hidden in production builds. */
export function ClientSurfaceRevisionBadge(): React.JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const compact = useMobileCompactLayout();
  const mobileShell = isMobileShellProduct();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (process.env.NODE_ENV !== "development" || !mounted) {
    return null;
  }

  // Keep off primary CTAs on phone / mobile-shell welcome (was covering Restore on SE).
  const pinTop = compact || mobileShell;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[10000] max-w-[min(18rem,calc(100vw-1rem))] truncate rounded-lg border border-emerald-400/60 bg-emerald-600/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100 shadow-lg backdrop-blur-sm",
        pinTop
          ? "left-2 top-[calc(0.5rem+env(safe-area-inset-top,0px))]"
          : "bottom-12 right-2",
      )}
      data-testid="client-surface-revision"
      title={`Client ${AUTH_CLIENT_REVISION}`}
    >
      Client {AUTH_CLIENT_REVISION}
    </div>
  );
}
