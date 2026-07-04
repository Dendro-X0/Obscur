"use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import { MoreHorizontal, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit";
import { UserAvatar } from "@/app/components/user-avatar";
import { LanguageSelector } from "@/app/components/language-selector";
import { cn } from "@/app/lib/utils";
import type { DesktopProfileMenuEntry } from "@/app/features/profiles/services/desktop-profile-switcher-view";
import { resolveDesktopProfileAccountPresenceLabelKey } from "@/app/features/profiles/services/desktop-profile-account-presence-label";
import { resolveDesktopProfileCardDisplay } from "@/app/features/profiles/services/desktop-profile-card-display";
import { ProfilePickerShowOnStartupFooter } from "./profile-picker-show-on-startup-footer";
import { canRemoveDesktopProfileEntry } from "@/app/features/profiles/services/can-remove-desktop-profile";

type Props = Readonly<{
  entries: ReadonlyArray<DesktopProfileMenuEntry>;
  onLaunchProfile: (profileId: string) => void;
  onSwitchHere: (profileId: string) => void;
  onRemoveProfile: (profileId: string) => void;
  onAddProfile: () => void;
  onAdvancedManagement: () => void;
}>;

export function ProfilePickerCardGrid(props: Props): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-full flex-col items-center px-4 py-8 md:py-12">
      <div className="absolute top-6 right-6 z-[160]">
        <LanguageSelector variant="minimal" />
      </div>

      <div className="flex flex-col items-center text-center">
        <Image src="/obscur-logo-light.svg" alt="Obscur" width={48} height={48} className="dark:hidden" />
        <Image src="/obscur-logo-dark.svg" alt="Obscur" width={48} height={48} className="hidden dark:block" />
        <h1 className="mt-6 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
          {t("profiles.picker.title")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          {t("profiles.picker.subtitle")}
        </p>
      </div>

      <div className="mt-10 flex w-full max-w-5xl flex-wrap items-stretch justify-center gap-5">
        {props.entries.map((entry) => (
          <ProfilePickerCard
            key={entry.profileId}
            entry={entry}
            onPrimaryAction={() => {
              props.onLaunchProfile(entry.profileId);
            }}
            onSwitchHere={() => props.onSwitchHere(entry.profileId)}
            onRemoveProfile={() => props.onRemoveProfile(entry.profileId)}
          />
        ))}
        <button
          type="button"
          className="flex w-[10.5rem] flex-col items-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white/40 p-4 text-left transition hover:border-violet-400 hover:bg-violet-500/5 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:border-violet-500/60"
          onClick={props.onAddProfile}
        >
          <div className="flex w-full items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {t("profiles.picker.add")}
          </div>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              <Plus className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-4 w-full truncate text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {t("profiles.picker.newProfile")}
          </div>
        </button>
      </div>

      <div className="mt-8">
        <Button type="button" variant="outline" size="sm" onClick={props.onAdvancedManagement}>
          {t("profiles.picker.advancedManagement")}
        </Button>
      </div>

      <div className="mt-auto w-full max-w-5xl">
        <ProfilePickerShowOnStartupFooter />
      </div>
    </div>
  );
}

type CardProps = Readonly<{
  entry: DesktopProfileMenuEntry;
  onPrimaryAction: () => void;
  onSwitchHere: () => void;
  onRemoveProfile: () => void;
}>;

function ProfilePickerCard(props: CardProps): React.JSX.Element {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const display = resolveDesktopProfileCardDisplay(props.entry);
  const presenceLabel = t(resolveDesktopProfileAccountPresenceLabelKey(props.entry));
  const canRemove = canRemoveDesktopProfileEntry(props.entry);
  const showMenu = true;

  return (
    <div className="relative w-[10.5rem]">
      <button
        type="button"
        className={cn(
          "flex w-full flex-col rounded-2xl border bg-white/70 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900/50",
          props.entry.shouldFocusExistingWindow
            ? "border-violet-400 ring-2 ring-violet-400/40 shadow-violet-500/10"
            : "border-black/10 dark:border-white/10",
        )}
        onClick={props.onPrimaryAction}
      >
        <div className="flex w-full items-center justify-end gap-2 min-h-[1.25rem]">
          {showMenu ? (
            <span
              role="button"
              tabIndex={0}
              className="rounded-md p-1 text-zinc-400 hover:bg-black/5 hover:text-zinc-600 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((current) => !current);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenuOpen((current) => !current);
                }
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-1 items-center justify-center">
          <UserAvatar username={display.avatarName} avatarUrl={display.avatarUrl} sizePx={80} />
        </div>
        {display.showAccountIdentity && display.displayName ? (
          <div className="mt-4 truncate text-center text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {display.displayName}
          </div>
        ) : (
          <div className="mt-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {t("profiles.picker.profileSlot")}
          </div>
        )}
        <div className="mt-1 truncate text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          {presenceLabel}
        </div>
      </button>
      {menuOpen && showMenu ? (
        <div className="absolute right-0 top-10 z-20 min-w-[11rem] rounded-xl border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setMenuOpen(false);
              props.onSwitchHere();
            }}
          >
            {t("profiles.picker.useInThisWindow")}
          </button>
          {canRemove ? (
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => {
                setMenuOpen(false);
                props.onRemoveProfile();
              }}
            >
              {t("profiles.picker.removeProfile")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
