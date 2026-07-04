import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  assertAccountNotActiveInOtherProfileWindow,
  assertAccountNotActiveInOtherProfileWindowAsync,
} from "./cross-profile-active-session-lease";
import {
  assertProfileSlotAllowsLogin,
} from "./profile-slot-login-guard";

/** Canonical pre-unlock guard: profile-slot data ownership + single active session per account. */
export const assertAccountUnlockAllowed = (params: Readonly<{
  profileId: string;
  incomingPublicKeyHex: PublicKeyHex;
  currentWindowLabel?: string;
}>): void => {
  assertProfileSlotAllowsLogin({
    profileId: params.profileId,
    incomingPublicKeyHex: params.incomingPublicKeyHex,
  });
  assertAccountNotActiveInOtherProfileWindow({
    incomingPublicKeyHex: params.incomingPublicKeyHex,
    currentProfileId: params.profileId,
    currentWindowLabel: params.currentWindowLabel,
  });
};

export const assertAccountUnlockAllowedAsync = async (params: Readonly<{
  profileId: string;
  incomingPublicKeyHex: PublicKeyHex;
  currentWindowLabel?: string;
}>): Promise<void> => {
  assertProfileSlotAllowsLogin({
    profileId: params.profileId,
    incomingPublicKeyHex: params.incomingPublicKeyHex,
  });
  await assertAccountNotActiveInOtherProfileWindowAsync({
    incomingPublicKeyHex: params.incomingPublicKeyHex,
    currentProfileId: params.profileId,
    currentWindowLabel: params.currentWindowLabel,
  });
};
