"use client";

import type React from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

const MENU_APPROX_HEIGHT_PX: number = 220;

type SessionTone = "secure" | "limited" | "offline";

type SessionChipProps = Readonly<{
  identityUnlocked: boolean;
  relayOpenCount: number;
  relayTotalCount: number;
}>;

const getTone = (props: SessionChipProps): SessionTone => {
  if (!props.identityUnlocked) {
    return "offline";
  }
  if (props.relayOpenCount <= 0) {
    return "limited";
  }
  return "secure";
};

const getToneLabel = (tone: SessionTone): string => {
  if (tone === "secure") {
    return "Secure";
  }
  if (tone === "limited") {
    return "Limited";
  }
  return "Offline";
};

const getToneDotClassName = (tone: SessionTone): string => {
  if (tone === "secure") {
    return "bg-emerald-500";
  }
  if (tone === "limited") {
    return "bg-amber-500";
  }
  return "bg-zinc-400";
};

const SessionChip = (props: SessionChipProps): React.JSX.Element => {
  const [open, setOpen] = useState<boolean>(false);
  const [openUp, setOpenUp] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { identityUnlocked, relayOpenCount, relayTotalCount } = props;
  const tone: SessionTone = getTone({ identityUnlocked, relayOpenCount, relayTotalCount });
  const label: string = getToneLabel(tone);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50",
          "dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
        )}
        aria-label="Session status"
        aria-expanded={open}
        onClick={(): void => {
          setOpen((v: boolean): boolean => {
            const next: boolean = !v;
            if (next) {
              setOpenUp(computeOpenUp());
            }
            return next;
          });
        }}
      >
        <span className={cn("h-2 w-2 rounded-full", getToneDotClassName(tone))} aria-hidden="true" />
        <span>{label}</span>
      </button>

      {open ? (
        <div
          className={cn(
            "absolute right-0 w-72 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950",
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <div className="border-b border-black/10 px-3 py-2 text-xs font-semibold text-zinc-600 dark:border-white/10 dark:text-zinc-300">
            Session
          </div>
          <div className="space-y-2 px-3 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-zinc-700 dark:text-zinc-200">Identity</div>
              <div className={cn("text-xs font-semibold", identityUnlocked ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-600 dark:text-zinc-400")}>
                {identityUnlocked ? "Unlocked" : "Locked"}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-zinc-700 dark:text-zinc-200">Relays</div>
              <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {relayOpenCount}/{relayTotalCount} open
              </div>
            </div>
            <div className="pt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              {tone === "secure"
                ? "You can send and receive encrypted messages."
                : tone === "limited"
                  ? "Identity is unlocked, but no relays are open. Messaging may be delayed."
                  : "Unlock your local keypair to send and receive encrypted messages."}
            </div>
            <div className="pt-1">
              <Link
                href="/settings"
                className="inline-flex items-center rounded-lg border border-black/10 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                onClick={(): void => setOpen(false)}
              >
                Open Settings
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export { SessionChip };
