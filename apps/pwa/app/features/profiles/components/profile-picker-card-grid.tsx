"use client";

import type React from "react";
import { useState } from "react";
import Image from "next/image";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { UserAvatar } from "@/app/components/user-avatar";
import { cn } from "@/app/lib/utils";
import type { DesktopProfileMenuEntry } from "@/app/features/profiles/services/desktop-profile-switcher-view";
import { ProfilePickerShowOnStartupFooter } from "./profile-picker-show-on-startup-footer";

type Props = Readonly<{
  entries: ReadonlyArray<DesktopProfileMenuEntry>;
  onSelectProfile: (profileId: string) => void;
  onOpenInNewWindow: (profileId: string) => void;
  onSwitchHere: (profileId: string) => void;
  onAddProfile: () => void;
  onAdvancedManagement: () => void;
}>;

export function ProfilePickerCardGrid(props: Props): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col items-center px-4 py-8 md:py-12">
      <div className="flex flex-col items-center text-center">
        <Image src="/obscur-logo-light.svg" alt="Obscur" width={48} height={48} className="dark:hidden" />
        <Image src="/obscur-logo-dark.svg" alt="Obscur" width={48} height={48} className="hidden dark:block" />
        <h1 className="mt-6 text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 md:text-3xl">
          Who&apos;s using Obscur?
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Each profile is an isolated desktop window. Open any account side by side — windows do not depend on one another.
        </p>
      </div>

      <div className="mt-10 flex w-full max-w-5xl flex-wrap items-stretch justify-center gap-5">
        {props.entries.map((entry) => (
          <ProfilePickerCard
            key={entry.profileId}
            entry={entry}
            onPrimaryAction={() => {
              if (entry.isCurrentWindow) {
                props.onSelectProfile(entry.profileId);
                return;
              }
              props.onOpenInNewWindow(entry.profileId);
            }}
            onSwitchHere={() => props.onSwitchHere(entry.profileId)}
          />
        ))}
        <button
          type="button"
          className="flex w-[10.5rem] flex-col items-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white/40 p-4 text-left transition hover:border-violet-400 hover:bg-violet-500/5 dark:border-zinc-700 dark:bg-zinc-900/30 dark:hover:border-violet-500/60"
          onClick={props.onAddProfile}
        >
          <div className="flex w-full items-center justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Add
          </div>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200/80 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              <Plus className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-4 w-full truncate text-center text-sm font-medium text-zinc-600 dark:text-zinc-300">
            New profile
          </div>
        </button>
      </div>

      <div className="mt-8">
        <Button type="button" variant="outline" size="sm" onClick={props.onAdvancedManagement}>
          Advanced profile management
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
}>;

function ProfilePickerCard(props: CardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative w-[10.5rem]">
      <button
        type="button"
        className={cn(
          "flex w-full flex-col rounded-2xl border bg-white/70 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900/50",
          props.entry.isCurrentWindow
            ? "border-violet-400/60 ring-1 ring-violet-400/30"
            : "border-black/10 dark:border-white/10",
        )}
        onClick={props.onPrimaryAction}
      >
        <div className="flex w-full items-center justify-between gap-2">
          <div className="truncate text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            {props.entry.label}
          </div>
          {!props.entry.isCurrentWindow ? (
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
        <div className="mt-6 flex flex-1 items-center justify-center">
          <UserAvatar username={props.entry.avatarName} avatarUrl={props.entry.avatarUrl} sizePx={80} />
        </div>
        <div className="mt-4 truncate text-center text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {props.entry.avatarName}
        </div>
        <div className="mt-1 truncate text-center text-[11px] text-zinc-400 dark:text-zinc-500">
          {props.entry.isCurrentWindow ? "This window" : props.entry.hasStoredIdentity ? "Saved account" : "Needs setup"}
        </div>
      </button>
      {menuOpen && !props.entry.isCurrentWindow ? (
        <div className="absolute right-0 top-10 z-20 min-w-[10rem] rounded-xl border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-zinc-900">
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setMenuOpen(false);
              props.onSwitchHere();
            }}
          >
            Use in this window
          </button>
        </div>
      ) : null}
    </div>
  );
}
