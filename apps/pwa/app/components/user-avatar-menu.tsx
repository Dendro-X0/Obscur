"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "./user-avatar";
import { cn } from "../lib/cn";
import { useProfile } from "../lib/use-profile";

const MENU_APPROX_HEIGHT_PX: number = 176;

type UserAvatarMenuProps = Readonly<{
  compact?: boolean;
  preferUp?: boolean;
  alignStart?: boolean;
}>;

const UserAvatarMenu = (props: UserAvatarMenuProps): React.JSX.Element => {
  const profile = useProfile();
  const [open, setOpen] = useState<boolean>(false);
  const [openUp, setOpenUp] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const computeOpenUp = (): boolean => {
    const root: HTMLDivElement | null = rootRef.current;
    if (!root || typeof window === "undefined") {
      return false;
    }
    const rect: DOMRect = root.getBoundingClientRect();
    const spaceAbove: number = rect.top;
    const spaceBelow: number = window.innerHeight - rect.bottom;
    const prefersUp: boolean = spaceBelow < MENU_APPROX_HEIGHT_PX && spaceAbove > spaceBelow;
    return prefersUp;
  };

  useEffect((): (() => void) => {
    const onPointerDown = (event: PointerEvent): void => {
      if (!open) {
        return;
      }
      const target: EventTarget | null = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!open) {
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return (): void => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const username: string = profile.state.profile.username.trim() || "Anon";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(): void => {
          setOpen((v: boolean): boolean => {
            const next: boolean = !v;
            if (next) {
              setOpenUp(props.preferUp ? true : computeOpenUp());
            }
            return next;
          });
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-black/40 dark:text-zinc-200 dark:hover:bg-zinc-900/40",
          props.compact ? "px-1.5" : ""
        )}
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        <UserAvatar username={profile.state.profile.username} avatarUrl={profile.state.profile.avatarUrl} sizePx={28} />
        {props.compact ? null : <span className="max-w-[18ch] truncate">{username}</span>}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute w-56 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950",
            props.alignStart ? "left-0" : "right-0",
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <div className="border-b border-black/10 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:text-zinc-300">Profile</div>
          <Link
            href="/settings#profile"
            className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-white/5"
            onClick={(): void => setOpen(false)}
          >
            Edit profile
          </Link>
          <Link
            href="/settings"
            className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-white/5"
            onClick={(): void => setOpen(false)}
          >
            Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
};

export { UserAvatarMenu };
