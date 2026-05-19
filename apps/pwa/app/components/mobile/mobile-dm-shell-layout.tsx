"use client";

import type React from "react";
import { cn } from "@/app/lib/utils";

type MobileDmShellLayoutProps = Readonly<{
  children: React.ReactNode;
  className?: string;
}>;

/**
 * Full-height stack for mobile-shell DM navigation (list ↔ thread).
 */
export function MobileDmShellLayout({ children, className }: MobileDmShellLayoutProps) {
  return (
    <div
      className={cn(
        "mobile-dm-shell flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
