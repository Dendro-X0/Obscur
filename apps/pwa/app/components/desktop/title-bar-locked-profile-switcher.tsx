"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, toast } from "@dweb/ui-kit";
import { ChevronDown, SquareArrowOutUpRight, Users } from "lucide-react";
import { UserAvatar } from "@/app/components/user-avatar";
import { cn } from "@/app/lib/utils";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { desktopProfileRuntime, useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { isAuthPublicProfileRoute } from "@/app/features/profiles/services/auth-public-routes";
import {
  buildDesktopProfileMenuEntries,
  loadDesktopProfilePreviewMap,
  type DesktopProfileMenuEntry,
  type DesktopProfilePreview,
} from "@/app/features/profiles/services/desktop-profile-switcher-view";

export function TitleBarLockedProfileSwitcher(): React.JSX.Element | null {
  const router = useRouter();
  const pathname = usePathname();
  const identity = useIdentity();
  const profile = useProfile();
  const snapshot = useDesktopProfileIsolationSnapshot();
  const [open, setOpen] = useState(false);
  const [previewByProfileId, setPreviewByProfileId] = useState<Readonly<Record<string, DesktopProfilePreview | undefined>>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isLocked = identity.state.status !== "unlocked";
  const isPublicProfilePicker = isAuthPublicProfileRoute(pathname);

  useEffect(() => {
    let cancelled = false;
    void loadDesktopProfilePreviewMap(snapshot.profiles.map((profileSummary) => profileSummary.profileId))
      .then((previews) => {
        if (!cancelled) {
          setPreviewByProfileId(previews);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewByProfileId({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot.profiles]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuEntries = useMemo((): ReadonlyArray<DesktopProfileMenuEntry> => (
    buildDesktopProfileMenuEntries({
      snapshot,
      previewByProfileId,
      currentProfileUsername: profile.state.profile.username,
      currentProfileAvatarUrl: profile.state.profile.avatarUrl,
      currentPublicKeyHex: identity.state.stored?.publicKeyHex,
      sessionMismatch: false,
    })
  ), [identity.state.stored?.publicKeyHex, previewByProfileId, profile.state.profile.avatarUrl, profile.state.profile.username, snapshot]);

  const currentEntry = menuEntries.find((entry) => entry.isCurrentWindow) ?? menuEntries[0];
  const otherEntries = menuEntries.filter((entry) => !entry.isCurrentWindow);

  if (!isLocked || isPublicProfilePicker || !currentEntry) {
    return null;
  }

  const handleOpenProfilePicker = (): void => {
    setOpen(false);
    router.replace("/profiles");
  };

  const handleOpenInNewWindow = async (profileId: string): Promise<void> => {
    setOpen(false);
    try {
      await desktopProfileRuntime.openProfileWindow(profileId);
      toast.success("Profile window opened.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open profile window.");
    }
  };

  const handleSwitchHere = async (profileId: string): Promise<void> => {
    setOpen(false);
    try {
      await desktopProfileRuntime.bindCurrentWindowProfile(profileId);
      toast.success("Profile bound to this window. Reloading...");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bind profile to this window.");
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-left shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        aria-label="Switch profile before sign-in"
        aria-expanded={open}
      >
        <UserAvatar
          username={currentEntry.avatarName}
          avatarUrl={currentEntry.avatarUrl}
          sizePx={30}
        />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
            {currentEntry.label}
          </div>
          <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
            Switch profile
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[10020] mt-2 w-[20rem] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              Signed out
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Open another profile or return to the picker without finishing sign-in for {currentEntry.label}.
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto p-2">
            {otherEntries.map((entry) => (
              <div
                key={entry.profileId}
                className="rounded-xl border border-transparent px-2 py-2 hover:border-black/5 hover:bg-zinc-50 dark:hover:border-white/10 dark:hover:bg-zinc-900/60"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar username={entry.avatarName} avatarUrl={entry.avatarUrl} sizePx={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{entry.label}</div>
                    <div className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {entry.hasStoredIdentity ? "Saved account" : "Needs setup"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => void handleOpenInNewWindow(entry.profileId)}>
                    <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                    New window
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleSwitchHere(entry.profileId)}>
                    Use here
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-black/10 p-3 dark:border-white/10">
            <Button type="button" className="w-full" onClick={handleOpenProfilePicker}>
              <Users className="h-3.5 w-3.5" />
              All profiles
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
