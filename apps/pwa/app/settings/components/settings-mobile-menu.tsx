"use client";

import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/app/lib/utils";

type SettingsNavItem = Readonly<{ href: string; label: string }>;

const SETTINGS_NAV_ITEMS: ReadonlyArray<SettingsNavItem> = [
  { href: "/", label: "Chats" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
  { href: "/profile", label: "Profile" },
];

const SettingsMobileMenu = (): React.JSX.Element => {
  const pathname: string = usePathname();
  const [open, setOpen] = useState<boolean>(false);

  const activeHref: string = useMemo((): string => {
    const match: SettingsNavItem | undefined = SETTINGS_NAV_ITEMS.find((item: SettingsNavItem): boolean => pathname === item.href);
    return match?.href ?? "";
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
        onClick={(): void => setOpen(true)}
        aria-label="Open settings menu"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur">
          <div className="absolute right-0 top-0 h-full w-[82vw] max-w-xs border-l border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950/90">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Quick nav</div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                onClick={(): void => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              <div className="space-y-2">
                {SETTINGS_NAV_ITEMS.map((item: SettingsNavItem): React.JSX.Element => {
                  const isActive: boolean = item.href === activeHref;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(): void => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border border-black/10 px-3 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-zinc-900/60",
                        isActive && "border-emerald-400/60 bg-emerald-50/70 text-emerald-800 shadow-sm dark:border-emerald-400/60 dark:bg-emerald-500/10 dark:text-emerald-100"
                      )}
                      aria-label={`Go to ${item.label}`}
                    >
                      <span>{item.label}</span>
                      {isActive ? <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-200">Current</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export { SettingsMobileMenu };
