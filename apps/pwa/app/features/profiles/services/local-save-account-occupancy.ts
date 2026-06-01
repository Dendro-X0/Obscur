import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getProfileSlotOccupantPublicKeyHex } from "./profile-slot-login-guard";
import type { ProfileSummary } from "./profile-isolation-contracts";

export type LocalSaveAccountOccupancy = Readonly<
  | { kind: "available" }
  | { kind: "this_slot_match" }
  | { kind: "this_slot_conflict"; occupantPublicKeyHex: PublicKeyHex }
  | { kind: "other_slot"; profileId: string; profileLabel: string }
>;

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
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
  const currentOccupant = getProfileSlotOccupantPublicKeyHex(currentProfileId);
  if (currentOccupant) {
    if (currentOccupant === target) {
      return { kind: "this_slot_match" };
    }
    return { kind: "this_slot_conflict", occupantPublicKeyHex: currentOccupant };
  }

  for (const profile of params.profiles) {
    if (profile.profileId === currentProfileId) {
      continue;
    }
    const occupant = getProfileSlotOccupantPublicKeyHex(profile.profileId);
    if (occupant === target) {
      return {
        kind: "other_slot",
        profileId: profile.profileId,
        profileLabel: profile.label.trim() || profile.profileId,
      };
    }
  }

  return { kind: "available" };
};

export const localSaveOccupancyLabel = (occupancy: LocalSaveAccountOccupancy): string => {
  switch (occupancy.kind) {
    case "available":
      return "Ready to restore";
    case "this_slot_match":
      return "On this device · unlock to import";
    case "this_slot_conflict":
      return "Blocked · different account in this window";
    case "other_slot":
      return `Active in ${occupancy.profileLabel}`;
  }
};

export const localSaveOccupancyIsBlocked = (occupancy: LocalSaveAccountOccupancy): boolean => (
  occupancy.kind === "this_slot_conflict"
);
