"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@dweb/ui-kit";
import { AlertTriangle, ChevronDown, Lock, LogOut, RefreshCw, Settings2, UserPlus } from "lucide-react";
import { UserAvatar } from "@/app/components/user-avatar";
import { cn } from "@/app/lib/utils";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { getAuthTokenStorageKey } from "@/app/features/auth/utils/auth-storage-keys";
import { clearAuthSessionPersistence } from "@/app/features/auth/utils/clear-auth-session-persistence";
import { isRememberMeEnabledForProfile } from "@/app/features/auth/utils/remember-me-state";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { useTauri } from "@/app/features/desktop/hooks/use-tauri";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import {
  buildDesktopProfileMenuEntries,
  deriveDesktopProfileSessionMismatch,
  loadDesktopProfilePreviewMap,
  type DesktopProfileMenuEntry,
  type DesktopProfilePreview,
} from "@/app/features/profiles/services/desktop-profile-switcher-view";

type Props = Readonly<{
  title: string;
}>;

export function TitleBarProfileSwitcher({ title }: Props): React.JSX.Element | null {
  const router = useRouter();
  const identity = useIdentity();
  const profile = useProfile();
  const snapshot = useDesktopProfileIsolationSnapshot();
  const { isDesktop, api } = useTauri();
  const [open, setOpen] = useState(false);
  const [previewByProfileId, setPreviewByProfileId] = useState<Readonly<Record<string, DesktopProfilePreview | undefined>>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isUnlocked = identity.state.status === "unlocked";
  const currentPublicKeyHex = isUnlocked ? identity.state.publicKeyHex ?? undefined : undefined;
  const sessionMismatch = deriveDesktopProfileSessionMismatch({
    storedPublicKeyHex: identity.state.stored?.publicKeyHex,
    unlockedPublicKeyHex: identity.state.publicKeyHex,
  });

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

  const menuEntries = useMemo((): ReadonlyArray<DesktopProfileMenuEntry> => {
    return buildDesktopProfileMenuEntries({
      snapshot,
      previewByProfileId,
      currentProfileUsername: profile.state.profile.username,
      currentProfileAvatarUrl: profile.state.profile.avatarUrl,
      currentPublicKeyHex,
      sessionMismatch,
    });
  }, [currentPublicKeyHex, previewByProfileId, profile.state.profile.avatarUrl, profile.state.profile.username, sessionMismatch, snapshot]);

  const currentEntry = menuEntries.find((entry) => entry.isCurrentWindow) ?? menuEntries[0];
  const currentWindowHasAccount = isUnlocked && Boolean(currentPublicKeyHex);
  const currentChipName = currentWindowHasAccount
    ? (currentEntry?.avatarName || currentEntry?.label || snapshot.currentWindow.profileLabel)
    : "No Account";
  const currentChipAvatarUrl = currentWindowHasAccount ? (currentEntry?.avatarUrl || "") : "";
  const currentChipSubtitle = currentWindowHasAccount
    ? (currentEntry?.subtitle || snapshot.currentWindow.profileId)
    : "Not signed in";
  const shouldRenderProfileChip = isUnlocked && Boolean(currentPublicKeyHex);

  const handleLock = (): void => {
    if (!isRememberMeEnabledForProfile(snapshot.currentWindow.profileId)) {
      localStorage.removeItem(getAuthTokenStorageKey(snapshot.currentWindow.profileId));
    }
    identity.lockIdentity();
    setOpen(false);
    toast.success("Session locked.");
    router.replace("/");
  };

  const clearNativeSessionBestEffort = async (): Promise<void> => {
    const cs = cryptoService as unknown as { clearNativeSession?: () => Promise<void> };
    if (typeof cs.clearNativeSession !== "function") {
      return;
    }
    try {
      await cs.clearNativeSession();
    } catch {
      // Best-effort; keep logout resilient even if native bridge is unavailable.
    }
  };

  const handleLogout = async (): Promise<void> => {
    clearAuthSessionPersistence({ profileId: snapshot.currentWindow.profileId });
    await clearNativeSessionBestEffort();
    identity.lockIdentity();
    setOpen(false);
    toast.success("Logged out.");
    router.replace("/");
  };

  const handleLogoutAndClose = async (): Promise<void> => {
    clearAuthSessionPersistence({ profileId: snapshot.currentWindow.profileId });
    await clearNativeSessionBestEffort();
    identity.lockIdentity();
    setOpen(false);
    toast.success("Logged out.");
    if (isDesktop && snapshot.currentWindow.windowLabel !== "main") {
      try {
        await api.window.close();
        return;
      } catch {
        // Fall back to routing if window close fails.
      }
    }
    router.replace("/");
  };

  if (!shouldRenderProfileChip) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/80 px-2.5 py-1.5 text-left shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        aria-label="Open desktop profile switcher"
        aria-expanded={open}
      >
        <UserAvatar
          username={currentChipName}
          avatarUrl={currentChipAvatarUrl}
          sizePx={30}
        />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-zinc-900 dark:text-zinc-100">
            {currentChipName}
          </div>
          <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
            {`${title} / ${currentChipSubtitle}`}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-zinc-500 transition-transform", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-[10020] mt-2 w-[20rem] overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
          <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-3">
              <UserAvatar
                username={currentChipName}
                avatarUrl={currentChipAvatarUrl}
                sizePx={36}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {currentChipName}
                </div>
                <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {currentChipSubtitle}
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                This Window
              </span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              One window equals one profile. Open another profile in a new window for side-by-side testing.
            </p>
          </div>

          {sessionMismatch ? (
            <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-400/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Isolation warning</div>
                  <div className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-300/90">
                    The unlocked identity does not match the stored owner for this bound profile.
                  </div>
                </div>
              </div>
              <Button className="mt-3 w-full" size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reload This Window
              </Button>
            </div>
          ) : null}

          <div className="p-3">
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void router.push("/profiles");
                }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Manage Profiles
              </Button>
              <Button type="button" variant="outline" onClick={handleLock}>
                <Lock className="h-3.5 w-3.5" />
                Lock
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  void router.push("/settings?tab=identity#profiles");
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Advanced Profile Settings
              </Button>
              <Button type="button" variant="outline" onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" />
                Log Out
              </Button>
              {snapshot.currentWindow.windowLabel !== "main" ? (
                <Button type="button" variant="outline" onClick={handleLogoutAndClose}>
                  <LogOut className="h-3.5 w-3.5" />
                  Log Out & Close Window
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
