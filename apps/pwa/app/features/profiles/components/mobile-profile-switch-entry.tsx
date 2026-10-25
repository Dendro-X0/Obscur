"use client";

import type React from "react";
import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/app/components/user-avatar";
import { cn } from "@/app/lib/utils";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";

type MobileProfileSwitchEntryProps = Readonly<{
  className?: string;
  /** Called before navigation (e.g. close a drawer). */
  onNavigate?: () => void;
}>;

/**
 * Mobile shell entry to `/profiles` — current account chip + switch CTA.
 * Not Soft L3 dual-window; same-device profile bind/switch only.
 */
export function MobileProfileSwitchEntry(
  props: MobileProfileSwitchEntryProps,
): React.JSX.Element {
  const { t } = useTranslation();
  const profile = useProfile();
  const snapshot = useDesktopProfileIsolationSnapshot();
  const username = profile.state.profile.username.trim() || snapshot.currentWindow.profileLabel || "Account";
  const slotLabel = snapshot.currentWindow.profileLabel || snapshot.currentWindow.profileId;

  return (
    <Link
      href="/profiles"
      data-testid="mobile-profile-switch-entry"
      onClick={props.onNavigate}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-3 text-left shadow-sm transition active:scale-[0.99]",
        "dark:border-white/10 dark:bg-zinc-900/70",
        props.className,
      )}
      aria-label={t("profiles.mobile.switchAria")}
    >
      <UserAvatar
        username={username}
        avatarUrl={profile.state.profile.avatarUrl}
        sizePx={40}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
          {username}
        </div>
        <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {t("profiles.mobile.switchHint", { slot: slotLabel })}
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-purple-700 dark:text-purple-200">
        <UsersRound className="h-3 w-3" aria-hidden />
        {t("profiles.mobile.switchCta")}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
    </Link>
  );
}
