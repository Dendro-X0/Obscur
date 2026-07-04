import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { findActiveSessionLeaseForAccount } from "./cross-profile-active-session-lease";
import { getProfileSlotOccupantPublicKeyHex } from "./profile-slot-login-guard";
import {
  listProfileIdsWithBoundAccountPublicKeyHex,
} from "./profile-window-account-binding";
import type { ProfileSummary } from "./profile-isolation-contracts";

export type LocalSaveAccountOccupancy = Readonly<
  | { kind: "available" }
  | { kind: "this_slot_match" }
  | { kind: "this_slot_conflict"; occupantPublicKeyHex: PublicKeyHex }
  | { kind: "other_slot"; profileId: string; profileLabel: string }
  | { kind: "active_in_other_window"; profileId: string; profileLabel: string; windowLabel: string }
>;

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
};

const resolveProfileLabel = (
  profileId: string,
  profiles: ReadonlyArray<ProfileSummary>,
): string => (
  profiles.find((profile) => profile.profileId === profileId)?.label.trim()
  || profileId
);

const collectCandidateProfileIds = (
  target: PublicKeyHex,
  profiles: ReadonlyArray<ProfileSummary>,
): ReadonlyArray<string> => {
  const ids = new Set<string>();
  profiles.forEach((profile) => {
    if (profile.profileId.trim()) {
      ids.add(profile.profileId.trim());
    }
  });
  listProfileIdsWithBoundAccountPublicKeyHex(target).forEach((profileId) => {
    ids.add(profileId);
  });
  return Array.from(ids);
};

export const resolveLocalSaveAccountOccupancy = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  currentProfileId: string;
  profiles: ReadonlyArray<ProfileSummary>;
}>): LocalSaveAccountOccupancy => {
  const target = normalizePublicKeyHex(params.publicKeyHex);
  if (!target) {
    return { kind: "available" };
  }

  const currentProfileId = params.currentProfileId.trim();
  const activeLease = findActiveSessionLeaseForAccount({
    publicKeyHex: target,
    excludeProfileId: currentProfileId,
  });
  if (activeLease) {
    return {
      kind: "active_in_other_window",
      profileId: activeLease.profileId,
      profileLabel: activeLease.profileLabel,
      windowLabel: activeLease.windowLabel,
    };
  }

  const currentOccupant = getProfileSlotOccupantPublicKeyHex(currentProfileId);
  if (currentOccupant) {
    if (currentOccupant === target) {
      return { kind: "this_slot_match" };
    }
    return { kind: "this_slot_conflict", occupantPublicKeyHex: currentOccupant };
  }

  for (const profileId of collectCandidateProfileIds(target, params.profiles)) {
    if (profileId === currentProfileId) {
      continue;
    }
    const occupant = getProfileSlotOccupantPublicKeyHex(profileId);
    if (occupant === target) {
      return {
        kind: "other_slot",
        profileId,
        profileLabel: resolveProfileLabel(profileId, params.profiles),
      };
    }
  }

  return { kind: "available" };
};

export const localSaveOccupancyLabelKey = (occupancy: LocalSaveAccountOccupancy): string => {
  switch (occupancy.kind) {
    case "available":
      return "profiles.portability.localSave.occupancy.readyToRestore";
    case "this_slot_match":
      return "profiles.portability.localSave.occupancy.thisSlotMatch";
    case "this_slot_conflict":
      return "profiles.portability.localSave.occupancy.thisSlotConflict";
    case "other_slot":
      return "profiles.portability.localSave.occupancy.otherSlot";
    case "active_in_other_window":
      return "profiles.portability.localSave.occupancy.activeInOtherWindow";
  }
};

export const localSaveOccupancyDetailKey = (occupancy: LocalSaveAccountOccupancy): string | null => {
  switch (occupancy.kind) {
    case "this_slot_conflict":
      return "profiles.portability.localSave.occupancy.thisSlotConflictDetail";
    case "other_slot":
      return "profiles.portability.localSave.occupancy.otherSlotDetail";
    case "active_in_other_window":
      return "profiles.portability.localSave.occupancy.activeInOtherWindowDetail";
    default:
      return null;
  }
};

export const localSaveOccupancyIsBlocked = (occupancy: LocalSaveAccountOccupancy): boolean => (
  occupancy.kind === "this_slot_conflict"
  || occupancy.kind === "other_slot"
  || occupancy.kind === "active_in_other_window"
);
