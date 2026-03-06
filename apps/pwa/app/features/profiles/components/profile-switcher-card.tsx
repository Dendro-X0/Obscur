"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@dweb/ui-kit";
import { Input } from "@dweb/ui-kit";
import { toast } from "@dweb/ui-kit";
import { ProfileRegistryService, PROFILE_CHANGED_EVENT, type ActiveProfileState } from "@/app/features/profiles/services/profile-registry-service";
import { clearProfileLocalData } from "@/app/features/profiles/services/profile-data-cleanup";

type Props = Readonly<{
  onBeforeSwitch: () => void;
}>;

const readState = (): ActiveProfileState => ProfileRegistryService.getState();

export function ProfileSwitcherCard({ onBeforeSwitch }: Props): React.JSX.Element {
  const [state, setState] = useState<ActiveProfileState>(() => readState());
  const [newLabel, setNewLabel] = useState("");
  const [renameLabel, setRenameLabel] = useState("");

  useEffect(() => {
    const onChange = (): void => {
      setState(readState());
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, onChange);
    return (): void => window.removeEventListener(PROFILE_CHANGED_EVENT, onChange);
  }, []);

  const activeProfile = useMemo(
    () => state.profiles.find((profile) => profile.profileId === state.activeProfileId),
    [state.activeProfileId, state.profiles]
  );

  const handleCreate = (): void => {
    const nextLabel = newLabel.trim();
    if (!nextLabel) return;
    const result = ProfileRegistryService.createProfile(nextLabel);
    if (!result.ok) {
      toast.error(result.message || "Failed to create profile.");
      return;
    }
    setState(result.value);
    setNewLabel("");
    toast.success("Profile created.");
  };

  const handleRenameActive = (): void => {
    const nextLabel = renameLabel.trim();
    if (!nextLabel || !activeProfile) return;
    const result = ProfileRegistryService.renameProfile(activeProfile.profileId, nextLabel);
    if (!result.ok) {
      toast.error(result.message || "Failed to rename profile.");
      return;
    }
    setState(result.value);
    setRenameLabel("");
    toast.success("Profile renamed.");
  };

  const handleSwitch = (profileId: string): void => {
    if (profileId === state.activeProfileId) return;
    onBeforeSwitch();
    const result = ProfileRegistryService.switchProfile(profileId);
    if (!result.ok) {
      toast.error(result.message || "Failed to switch profile.");
      return;
    }
    setState(result.value);
    toast.success("Profile switched. Reloading...");
    window.location.reload();
  };

  const handleRemove = async (profileId: string): Promise<void> => {
    const profile = state.profiles.find((item) => item.profileId === profileId);
    if (!profile) return;
    const ok = window.confirm(`Remove profile "${profile.label}" from this device?`);
    if (!ok) return;

    const result = ProfileRegistryService.removeProfile(profileId);
    if (!result.ok) {
      toast.error(result.message || "Failed to remove profile.");
      return;
    }
    await clearProfileLocalData(profileId);
    setState(result.value);
    toast.success("Profile removed.");
  };

  return (
    <div className="rounded-2xl border border-black/5 p-4 dark:border-white/10 bg-zinc-50/60 dark:bg-zinc-900/40 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Profiles</h3>
        <p className="text-xs text-zinc-500">Single active profile. Switching locks current session and reloads profile-scoped state.</p>
      </div>

      <div className="space-y-2">
        {state.profiles.map((profile) => {
          const active = profile.profileId === state.activeProfileId;
          return (
            <div key={profile.profileId} className="flex items-center gap-2 rounded-xl border border-black/5 px-3 py-2 dark:border-white/10 bg-white/70 dark:bg-black/20">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{profile.label}</div>
                <div className="truncate text-[10px] text-zinc-500">{profile.profileId}</div>
              </div>
              {active ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => handleSwitch(profile.profileId)}>Switch</Button>
              )}
              {profile.profileId !== "default" ? (
                <Button size="sm" variant="ghost" onClick={() => void handleRemove(profile.profileId)}>Remove</Button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-500">Create profile</label>
          <div className="flex gap-2">
            <Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder="Team / Persona" />
            <Button type="button" onClick={handleCreate}>Create</Button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-zinc-500">Rename active</label>
          <div className="flex gap-2">
            <Input value={renameLabel} onChange={(event) => setRenameLabel(event.target.value)} placeholder={activeProfile?.label || "Active profile"} />
            <Button type="button" variant="secondary" onClick={handleRenameActive}>Rename</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
