import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";
import {
  getLastBoundAccountPublicKeyHex,
} from "./profile-window-account-binding";

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
};

/** Account currently owning local data in this profile window slot, if any. */
export const getProfileSlotOccupantPublicKeyHex = (profileId: string): PublicKeyHex | null => {
  const fromBinding = getLastBoundAccountPublicKeyHex(profileId);
  if (fromBinding) {
    return fromBinding;
  }
  const stored = readIdentityRecordFromLocalStorage(profileId);
  return stored ? normalizePublicKeyHex(stored.publicKeyHex) : null;
};

export const profileSlotHasLocalAccountData = (profileId: string): boolean => (
  getProfileSlotOccupantPublicKeyHex(profileId) !== null
);

export type ProfileSlotLoginAttemptResult = Readonly<
  | {
    status: "allowed";
    profileId: string;
    incomingPublicKeyHex: PublicKeyHex;
    occupantPublicKeyHex: PublicKeyHex | null;
  }
  | {
    status: "blocked_different_account";
    profileId: string;
    incomingPublicKeyHex: PublicKeyHex;
    occupantPublicKeyHex: PublicKeyHex;
  }
>;

export const evaluateProfileSlotLoginAttempt = (params: Readonly<{
  profileId: string;
  incomingPublicKeyHex: PublicKeyHex;
}>): ProfileSlotLoginAttemptResult => {
  const profileId = params.profileId.trim();
  const incomingPublicKeyHex = normalizePublicKeyHex(params.incomingPublicKeyHex);
  if (!incomingPublicKeyHex) {
    throw new Error("Invalid account public key.");
  }
  const occupantPublicKeyHex = getProfileSlotOccupantPublicKeyHex(profileId);
  if (!occupantPublicKeyHex || occupantPublicKeyHex === incomingPublicKeyHex) {
    return {
      status: "allowed",
      profileId,
      incomingPublicKeyHex,
      occupantPublicKeyHex,
    };
  }
  return {
    status: "blocked_different_account",
    profileId,
    incomingPublicKeyHex,
    occupantPublicKeyHex,
  };
};

export class ProfileSlotAccountConflictError extends Error {
  readonly code = "PROFILE_SLOT_ACCOUNT_CONFLICT" as const;

  readonly detail: Extract<ProfileSlotLoginAttemptResult, { status: "blocked_different_account" }>;

  constructor(detail: Extract<ProfileSlotLoginAttemptResult, { status: "blocked_different_account" }>) {
    super(
      `This profile window already has local data for account ${detail.occupantPublicKeyHex.slice(0, 8)}…. `
      + `Sign in with that account, open another profile window for ${detail.incomingPublicKeyHex.slice(0, 8)}…, `
      + "or export and reset this window first.",
    );
    this.name = "ProfileSlotAccountConflictError";
    this.detail = detail;
  }
}

export const assertProfileSlotAllowsLogin = (params: Readonly<{
  profileId: string;
  incomingPublicKeyHex: PublicKeyHex;
}>): void => {
  const result = evaluateProfileSlotLoginAttempt(params);
  if (result.status === "blocked_different_account") {
    throw new ProfileSlotAccountConflictError(result);
  }
};

/** Blocks creating a brand-new identity in a slot that already has account data. */
export const assertProfileSlotIsEmptyForNewIdentity = (profileId: string): void => {
  const occupantPublicKeyHex = getProfileSlotOccupantPublicKeyHex(profileId);
  if (!occupantPublicKeyHex) {
    return;
  }
  throw new ProfileSlotAccountConflictError({
    status: "blocked_different_account",
    profileId: profileId.trim(),
    incomingPublicKeyHex: occupantPublicKeyHex,
    occupantPublicKeyHex,
  });
};
