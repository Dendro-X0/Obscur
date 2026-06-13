"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, toast } from "@dweb/ui-kit";
import { ArrowLeft, LogIn, Plus, Settings2, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { PageShell } from "@/app/components/page-shell";
import { UserAvatar } from "@/app/components/user-avatar";
import { cn } from "@/app/lib/utils";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { desktopProfileRuntime, useDesktopProfileIsolationSnapshot } from "@/app/features/profiles/services/desktop-profile-runtime";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { useWindowRuntime } from "@/app/features/runtime/services/window-runtime-supervisor";
import { finalizeProfileWindowRemoval } from "@/app/features/profiles/services/profile-session-lifecycle";
import type { ProfileWorkspaceArchiveWriteResult } from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import { ProfileArchiveResultBanner } from "@/app/features/profiles/components/profile-archive-result-banner";
import { PortabilityQuickActionsPanel } from "@/app/features/profiles/components/portability-quick-actions-panel";
import { ProfileWindowImportPanel } from "@/app/features/profiles/components/profile-window-import-panel";
import { ProfilePickerCardGrid } from "@/app/features/profiles/components/profile-picker-card-grid";
import { PROFILE_SIGN_IN_ROUTE } from "@/app/features/profiles/services/auth-public-routes";
import {
  buildDesktopProfileMenuEntries,
  deriveDesktopProfileSessionMismatch,
  loadDesktopProfilePreviewMap,
  type DesktopProfileMenuEntry,
  type DesktopProfilePreview,
} from "@/app/features/profiles/services/desktop-profile-switcher-view";

const getDefaultNewProfileLabel = (count: number): string => `Profile ${count + 1}`;

const isUnlockedRuntimePhase = (phase: string): boolean => (
  phase === "activating_runtime" || phase === "ready" || phase === "degraded"
);

export default function ProfilesPage(): React.JSX.Element {
  const router = useRouter();
  const identity = useIdentity();
  const profile = useProfile();
  const runtime = useWindowRuntime();
  const snapshot = useDesktopProfileIsolationSnapshot();
  const isUnlocked = isUnlockedRuntimePhase(runtime.snapshot.phase);
  const isPublicPickerMode = hasNativeRuntime() && !isUnlocked;
  const [showAdvancedManagement, setShowAdvancedManagement] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Readonly<{ profileId: string; label: string }> | null>(null);
  const [isRemovingProfile, setIsRemovingProfile] = useState(false);
  const [removeStep, setRemoveStep] = useState<"confirm" | "complete">("confirm");
  const [removeArchiveResult, setRemoveArchiveResult] = useState<ProfileWorkspaceArchiveWriteResult | null>(null);

  const [previewByProfileId, setPreviewByProfileId] = useState<Readonly<Record<string, DesktopProfilePreview | undefined>>>({});
  const currentPublicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? undefined;
  const sessionMismatch = deriveDesktopProfileSessionMismatch({
    storedPublicKeyHex: identity.state.stored?.publicKeyHex,
    unlockedPublicKeyHex: identity.state.publicKeyHex,
  });
  const navBadges = useNavBadges({ publicKeyHex: (currentPublicKeyHex as PublicKeyHex | null) ?? null });

  const resolveActivePrivateKeyHex = async (): Promise<PrivateKeyHex | null> => {
    if (identity.state.status !== "unlocked" || !identity.state.privateKeyHex) {
      return null;
    }
    return identity.state.privateKeyHex as PrivateKeyHex;
  };

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

  const entries = useMemo((): ReadonlyArray<DesktopProfileMenuEntry> => {
    return buildDesktopProfileMenuEntries({
      snapshot,
      previewByProfileId,
      currentProfileUsername: profile.state.profile.username,
      currentProfileAvatarUrl: profile.state.profile.avatarUrl,
      currentPublicKeyHex,
      sessionMismatch,
    });
  }, [currentPublicKeyHex, previewByProfileId, profile.state.profile.avatarUrl, profile.state.profile.username, sessionMismatch, snapshot]);

  const currentWindowEntry = entries.find((entry) => entry.isCurrentWindow);

  const handleOpenWindow = async (profileId: string): Promise<void> => {
    try {
      await desktopProfileRuntime.openProfileWindow(profileId);
      toast.success("Profile window opened.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open profile window.");
    }
  };

  const handleSwitchHere = async (profileId: string): Promise<void> => {
    if (sessionMismatch) {
      toast.error("This window has an identity mismatch. Reload it before rebinding another profile.");
      return;
    }
    if (identity.state.status === "unlocked" && currentPublicKeyHex) {
      const confirmed = window.confirm(
        "This window is signed in. Switching profiles here will reload the window and clear in-memory session state for this window. Continue?"
      );
      if (!confirmed) {
        return;
      }
    }
    try {
      await desktopProfileRuntime.bindCurrentWindowProfile(profileId);
      toast.success("Profile bound to this window. Reloading...");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bind profile to this window.");
    }
  };

  const handleCreateAndOpen = async (): Promise<void> => {
    const trimmedLabel = newLabel.trim() || getDefaultNewProfileLabel(snapshot.profiles.length);
    try {
      const beforeIds = new Set(snapshot.profiles.map((profileSummary) => profileSummary.profileId));
      const nextSnapshot = await desktopProfileRuntime.createProfile(trimmedLabel);
      const created = nextSnapshot.profiles.find((profileSummary) => !beforeIds.has(profileSummary.profileId));
      if (!created) {
        throw new Error("Profile was created, but the new window target could not be resolved.");
      }
      setNewLabel("");
      await desktopProfileRuntime.openProfileWindow(created.profileId);
      toast.success("New profile window opened. Create or log in to another account there.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create a new profile window.");
    }
  };

  const handleSignInHere = (): void => {
    router.replace(PROFILE_SIGN_IN_ROUTE);
  };

  const handleRemoveProfile = (profileId: string): void => {
    if (profileId === snapshot.currentWindow.profileId) {
      toast.error("Cannot remove the profile bound to this window.");
      return;
    }
    if (profileId === "default") {
      toast.error("The default profile cannot be removed.");
      return;
    }

    const entry = entries.find((item) => item.profileId === profileId);
    const label = entry?.label || profileId;
    setRemoveStep("confirm");
    setRemoveArchiveResult(null);
    setRemoveTarget({ profileId, label });
  };

  const closeRemoveFlow = (): void => {
    setRemoveTarget(null);
    setRemoveStep("confirm");
    setRemoveArchiveResult(null);
  };

  const confirmRemoveProfile = async (): Promise<void> => {
    if (!removeTarget) {
      return;
    }

    setIsRemovingProfile(true);
    try {
      const removedPreview = previewByProfileId[removeTarget.profileId];
      const archiveResult = await finalizeProfileWindowRemoval({
        profileId: removeTarget.profileId,
        profileLabel: removeTarget.label,
        publicKeyHex: removedPreview?.publicKeyHex as PublicKeyHex | undefined,
      });
      await desktopProfileRuntime.removeProfile(removeTarget.profileId);
      setRemoveArchiveResult(archiveResult);
      setRemoveStep("complete");
    } catch (error) {
      console.error("[ProfilesPage] Failed to remove profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove profile.");
    } finally {
      setIsRemovingProfile(false);
    }
  };

  const pageInner = (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/40">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">Manage Profiles</div>
              <div className="mt-2 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
                {isPublicPickerMode
                  ? "Each window is independent. Open any profile in its own window or sign in here — no window depends on another having launched first."
                  : "Saved profiles stay isolated. Adding a profile opens a new desktop window with its own local environment, data, and login flow."}
              </div>
            </div>
            {isUnlocked ? (
              <Button type="button" variant="outline" onClick={() => void router.push("/settings?tab=identity#profiles")}>
                <Settings2 className="h-3.5 w-3.5" />
                Advanced Profile Settings
              </Button>
            ) : null}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
          <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/40">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Saved Profiles</div>
            <div className="mt-4 space-y-3">
              {entries.map((entry) => (
                <div key={entry.profileId} className="rounded-2xl border border-black/10 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-start gap-3">
                    <UserAvatar username={entry.avatarName} avatarUrl={entry.avatarUrl} sizePx={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{entry.label}</div>
                        {entry.isCurrentWindow ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">This Window</span>
                        ) : null}
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          entry.hasStoredIdentity
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        )}>
                          {entry.hasStoredIdentity ? "Saved account" : "Needs setup"}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{entry.subtitle}</div>
                      <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">Last used {entry.lastUsedLabel}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!entry.isCurrentWindow ? (
                      <>
                        <Button size="sm" onClick={() => void handleOpenWindow(entry.profileId)}>
                          <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                          Open in New Window
                        </Button>
                        <Button size="sm" variant="outline" disabled={!entry.canSwitchHere} onClick={() => void handleSwitchHere(entry.profileId)}>
                          Switch This Window
                        </Button>
                        {entry.profileId !== "default" ? (
                          <Button size="sm" variant="outline" onClick={() => handleRemoveProfile(entry.profileId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        ) : null}
                      </>
                    ) : isPublicPickerMode ? (
                      <Button size="sm" onClick={handleSignInHere}>
                        <LogIn className="h-3.5 w-3.5" />
                        Sign in to This Profile
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Active in This Window
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            {isUnlocked ? (
              <PortabilityQuickActionsPanel
                publicKeyHex={(currentPublicKeyHex as PublicKeyHex | null) ?? null}
                profileLabel={currentWindowEntry?.label}
                resolveActivePrivateKeyHex={resolveActivePrivateKeyHex}
              />
            ) : null}
            <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/40">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Add Profile</div>
              <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                Create a fresh profile shell and launch it in a separate window. You can create a new account or log in with another key there.
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  value={newLabel}
                  onChange={(event) => setNewLabel(event.target.value)}
                  placeholder={getDefaultNewProfileLabel(snapshot.profiles.length)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateAndOpen();
                    }
                  }}
                />
                <Button className="w-full" onClick={() => void handleCreateAndOpen()}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Profile in New Window
                </Button>
                {isUnlocked && currentWindowEntry && !currentWindowEntry.hasStoredIdentity ? (
                  <ProfileWindowImportPanel
                    publicKeyHex={(currentPublicKeyHex as PublicKeyHex | null) ?? null}
                    resolveActivePrivateKeyHex={resolveActivePrivateKeyHex}
                  />
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/40">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">How this works</div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                <p>Each profile is a separate local workspace on this device.</p>
                <p>Opening a profile creates an isolated desktop window. In-memory state and account data are not shared across windows.</p>
                <p>Profiles you log into stay listed here so you can reopen them later.</p>
                <p>
                  <span className="font-semibold">Lock</span> pauses your session but keeps stay signed in — restart restores from OS secure storage.
                </p>
                <p>
                  <span className="font-semibold">Log out</span> clears the device session (keychain) but keeps this profile window&apos;s local data.
                </p>
                <p>
                  <span className="font-semibold">Remove profile</span> (Profile 2 and above) exports a workspace archive (`.obscur-profile.json`) under
                  <span className="font-semibold"> profile-archives </span>
                  on desktop, then clears that slot. You will see where the file was saved.
                </p>
                {!isPublicPickerMode ? (
                  <p>
                    To wipe the main profile window or clear data without removing the profile entry, use Settings → Identity → Local data management.
                  </p>
                ) : null}
                <p className="rounded-xl border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-orange-900 dark:text-orange-100">
                  <span className="font-semibold">Desktop:</span> unified account export/import in Settings → Profile.
                  <br />
                  <span className="font-semibold">Mobile (PWA):</span> use browser download/import; keep one account per browser profile. Full backup + vault export is desktop-first today.
                </p>
              </div>
            </section>
          </aside>
        </div>
    </div>
  );

  const removeDialog = removeTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            {removeStep === "confirm" ? (
              <>
                <h3 className="text-xl font-bold text-white">Remove profile</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Remove &quot;{removeTarget.label}&quot;? A workspace archive is saved to profile-archives first, then local data for that profile is cleared.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={closeRemoveFlow}
                    disabled={isRemovingProfile}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => void confirmRemoveProfile()}
                    disabled={isRemovingProfile}
                  >
                    {isRemovingProfile ? "Removing…" : "Remove profile"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white">Profile removed</h3>
                <p className="mt-2 text-sm text-zinc-300">
                  &quot;{removeTarget.label}&quot; was removed from this device. Your archive is below.
                </p>
                <div className="mt-4">
                  <ProfileArchiveResultBanner
                    result={removeArchiveResult}
                    profileLabel={removeTarget.label}
                    label="Workspace archive location"
                  />
                </div>
                <div className="mt-6">
                  <Button className="w-full" onClick={() => {
                    closeRemoveFlow();
                    toast.success("Profile removed.");
                  }}
                  >
                    Done
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
  ) : null;

  if (isPublicPickerMode && !showAdvancedManagement) {
    return (
      <>
        <ProfilePickerCardGrid
          entries={entries}
          onSelectProfile={handleSignInHere}
          onOpenInNewWindow={(profileId) => void handleOpenWindow(profileId)}
          onSwitchHere={(profileId) => void handleSwitchHere(profileId)}
          onAddProfile={() => void handleCreateAndOpen()}
          onAdvancedManagement={() => setShowAdvancedManagement(true)}
        />
        {removeDialog}
      </>
    );
  }

  if (isPublicPickerMode) {
    return (
      <>
        <div className="border-b border-black/10 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-zinc-900/40">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvancedManagement(false)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to profile picker
          </Button>
        </div>
        {pageInner}
        {removeDialog}
      </>
    );
  }

  return (
    <PageShell
      title="Profiles"
      navBadgeCounts={navBadges.navBadgeCounts}
      rightContent={(
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
      )}
    >
      {pageInner}
      {removeDialog}
    </PageShell>
  );
}
