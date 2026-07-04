"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button, Input, toast } from "@dweb/ui-kit";
import { ArrowLeft, Plus, Settings2, SquareArrowOutUpRight, Trash2 } from "lucide-react";
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
import {
  buildDesktopProfileMenuEntries,
  deriveDesktopProfileSessionMismatch,
  loadDesktopProfilePreviewMap,
  type DesktopProfileMenuEntry,
  type DesktopProfilePreview,
} from "@/app/features/profiles/services/desktop-profile-switcher-view";
import {
  ACTIVE_SESSION_LEASE_HEARTBEAT_MS,
  listActiveSessionLeasesAsync,
  type ActiveSessionLeaseRecord,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { resolveDesktopProfileAccountPresenceLabelKey } from "@/app/features/profiles/services/desktop-profile-account-presence-label";
import { PROFILE_SIGN_IN_ROUTE } from "@/app/features/profiles/services/auth-public-routes";
import { resolveDesktopProfileCardDisplay } from "@/app/features/profiles/services/desktop-profile-card-display";
import { canRemoveDesktopProfileEntry } from "@/app/features/profiles/services/can-remove-desktop-profile";

const getDefaultNewProfileLabel = (count: number): string => `Profile ${count + 1}`;

const isUnlockedRuntimePhase = (phase: string): boolean => (
  phase === "activating_runtime" || phase === "ready" || phase === "degraded"
);

export default function ProfilesPage(): React.JSX.Element {
  const { t } = useTranslation();
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
  const [activeLeases, setActiveLeases] = useState<ReadonlyArray<ActiveSessionLeaseRecord>>([]);
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
    void loadDesktopProfilePreviewMap(
      snapshot.profiles.map((profileSummary) => ({
        profileId: profileSummary.profileId,
        label: profileSummary.label,
      })),
    )
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
    if (!isPublicPickerMode) {
      return;
    }
    let cancelled = false;
    const refreshLeases = (): void => {
      void listActiveSessionLeasesAsync()
        .then((leases) => {
          if (!cancelled) {
            setActiveLeases(leases);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setActiveLeases([]);
          }
        });
    };
    refreshLeases();
    const intervalId = window.setInterval(refreshLeases, ACTIVE_SESSION_LEASE_HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isPublicPickerMode, snapshot.currentWindow.profileId, snapshot.currentWindow.windowLabel]);

  const entries = useMemo((): ReadonlyArray<DesktopProfileMenuEntry> => {
    return buildDesktopProfileMenuEntries({
      snapshot,
      previewByProfileId,
      currentProfileUsername: profile.state.profile.username,
      currentProfileAvatarUrl: profile.state.profile.avatarUrl,
      currentPublicKeyHex,
      sessionMismatch,
      activeLeases: isPublicPickerMode ? activeLeases : undefined,
    });
  }, [activeLeases, currentPublicKeyHex, isPublicPickerMode, previewByProfileId, profile.state.profile.avatarUrl, profile.state.profile.username, sessionMismatch, snapshot]);

  const currentWindowEntry = entries.find((entry) => entry.isCurrentWindow);

  const handleLaunchProfile = async (profileId: string): Promise<void> => {
    const entry = entries.find((item) => item.profileId === profileId);
    if (!entry) {
      return;
    }
    if (entry.isCurrentWindow) {
      router.push(PROFILE_SIGN_IN_ROUTE);
      return;
    }
    if (entry.shouldFocusExistingWindow && entry.focusTargetProfileId) {
      try {
        await desktopProfileRuntime.openProfileWindow(entry.focusTargetProfileId);
        toast.success(t("profiles.picker.focusedExistingWindow"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to focus the existing profile window.");
      }
      return;
    }
    try {
      await desktopProfileRuntime.openProfileWindow(profileId);
      toast.success(t("profiles.picker.openedProfileWindow"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open profile window.");
    }
  };

  const handleOpenWindow = async (profileId: string): Promise<void> => {
    await handleLaunchProfile(profileId);
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

  const handleRemoveProfile = (profileId: string): void => {
    const entry = entries.find((item) => item.profileId === profileId);
    if (!entry || !canRemoveDesktopProfileEntry(entry)) {
      if (profileId === snapshot.currentWindow.profileId) {
        toast.error("Cannot remove the profile bound to this window.");
      } else if (profileId === "default") {
        toast.error("The default profile cannot be removed.");
      }
      return;
    }

    const display = resolveDesktopProfileCardDisplay(entry);
    const label = display.displayName || entry.label || profileId;
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
              {entries.map((entry) => {
                const display = resolveDesktopProfileCardDisplay(entry);
                const presenceLabel = t(resolveDesktopProfileAccountPresenceLabelKey(entry));
                return (
                <div key={entry.profileId} className="rounded-2xl border border-black/10 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-black/20">
                  <div className="flex items-start gap-3">
                    <UserAvatar username={display.avatarName} avatarUrl={display.avatarUrl} sizePx={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                          {display.showAccountIdentity && display.displayName
                            ? display.displayName
                            : t("profiles.picker.profileSlot")}
                        </div>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          entry.hasStoredIdentity
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : entry.shouldFocusExistingWindow
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                              : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        )}>
                          {presenceLabel}
                        </span>
                      </div>
                      {display.showAccountIdentity ? (
                        <div className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{entry.subtitle}</div>
                      ) : null}
                      <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">Last used {entry.lastUsedLabel}</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {!entry.isCurrentWindow ? (
                      <>
                        <Button size="sm" onClick={() => void handleOpenWindow(entry.profileId)}>
                          <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                          {entry.shouldFocusExistingWindow
                            ? t("profiles.picker.goToActiveWindow")
                            : t("profiles.picker.openInNewWindow")}
                        </Button>
                        <Button size="sm" variant="outline" disabled={!entry.canSwitchHere} onClick={() => void handleSwitchHere(entry.profileId)}>
                          Switch This Window
                        </Button>
                        {canRemoveDesktopProfileEntry(entry) ? (
                          <Button size="sm" variant="outline" onClick={() => handleRemoveProfile(entry.profileId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        ) : null}
                      </>
                    ) : isPublicPickerMode ? (
                      <Button size="sm" onClick={() => void handleLaunchProfile(entry.profileId)}>
                        <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                        Open Profile Window
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Active in This Window
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
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
                  <span className="font-semibold">Lock</span> pauses your in-memory session. You will need your password again after refresh or restart.
                </p>
                <p>
                  <span className="font-semibold">Log out</span> clears the in-memory session but keeps this profile window open.
                </p>
                <p>
                  <span className="font-semibold">Log out & close window</span> signs out and hides this desktop window. The main window reopens from the tray; other profile windows stay closed until you open them again from Manage Profiles.
                </p>
                <p>
                  <span className="font-semibold">Remove profile</span> (non-default slots) exports a workspace archive (`.obscur-profile.json`) under
                  <span className="font-semibold"> profile-archives </span>
                  on desktop, then clears that slot. You will see where the file was saved.
                </p>
                {!isPublicPickerMode ? (
                  <p>
                    To wipe local data for this window without removing the profile entry, use Settings → Identity → Local data management.
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
                <h3 className="text-xl font-bold text-white">{t("profiles.portability.remove.title")}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {t("profiles.portability.remove.confirmDesc", { label: removeTarget.label })}
                </p>
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={closeRemoveFlow}
                    disabled={isRemovingProfile}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => void confirmRemoveProfile()}
                    disabled={isRemovingProfile}
                  >
                    {isRemovingProfile ? t("profiles.portability.remove.removing") : t("profiles.portability.remove.action")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-white">{t("profiles.portability.archive.profileRemoved")}</h3>
                <p className="mt-2 text-sm text-zinc-300">
                  {t("profiles.portability.archive.profileRemovedFromDevice", { label: removeTarget.label })}
                </p>
                <div className="mt-4">
                  <ProfileArchiveResultBanner
                    result={removeArchiveResult}
                    profileLabel={removeTarget.label}
                    label={t("profiles.portability.archive.locationTitle")}
                  />
                </div>
                <div className="mt-6">
                  <Button className="w-full" onClick={() => {
                    closeRemoveFlow();
                    toast.success(t("profiles.portability.remove.successToast"));
                  }}
                  >
                    {t("profiles.portability.archive.done")}
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
          onLaunchProfile={(profileId) => void handleLaunchProfile(profileId)}
          onSwitchHere={(profileId) => void handleSwitchHere(profileId)}
          onRemoveProfile={handleRemoveProfile}
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
      title={t("profiles.picker.pageTitle")}
      navBadgeCounts={navBadges.navBadgeCounts}
      rightContent={(
        <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("common.back")}
        </Button>
      )}
    >
      {pageInner}
      {removeDialog}
    </PageShell>
  );
}
