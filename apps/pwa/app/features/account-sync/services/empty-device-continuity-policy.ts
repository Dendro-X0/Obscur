/**
 * P0 empty-device continuity gate — when unlock skips auto account-sync,
 * surface an explicit restore/import path instead of a silent blank Network.
 *
 * @see specs/backend/cross-device-data-continuity-design-2026-10.md
 */

export type EmptyDeviceContinuityEvidence = Readonly<{
  identityReady: boolean;
  peerTrustHydrated: boolean;
  messagingHydrated: boolean;
  acceptedPeerCount: number;
  localConnectionCount: number;
  dismissed: boolean;
}>;

export const shouldOfferEmptyDeviceContinuityGate = (
  evidence: EmptyDeviceContinuityEvidence,
): boolean => {
  if (!evidence.identityReady) {
    return false;
  }
  if (!evidence.peerTrustHydrated || !evidence.messagingHydrated) {
    return false;
  }
  if (evidence.dismissed) {
    return false;
  }
  if (evidence.acceptedPeerCount > 0 || evidence.localConnectionCount > 0) {
    return false;
  }
  return true;
};

const dismissStorageKey = (profileId: string, publicKeyHex: string): string => (
  `obscur.empty_device_continuity.dismissed.v1.${profileId}.${publicKeyHex.trim().toLowerCase()}`
);

export const readEmptyDeviceContinuityDismissed = (
  profileId: string,
  publicKeyHex: string,
): boolean => {
  if (typeof window === "undefined" || !publicKeyHex.trim()) {
    return false;
  }
  try {
    return window.sessionStorage.getItem(dismissStorageKey(profileId, publicKeyHex)) === "1";
  } catch {
    return false;
  }
};

export const writeEmptyDeviceContinuityDismissed = (
  profileId: string,
  publicKeyHex: string,
): void => {
  if (typeof window === "undefined" || !publicKeyHex.trim()) {
    return;
  }
  try {
    window.sessionStorage.setItem(dismissStorageKey(profileId, publicKeyHex), "1");
  } catch {
    // ignore quota / private mode
  }
};

export const clearEmptyDeviceContinuityDismissed = (
  profileId: string,
  publicKeyHex: string,
): void => {
  if (typeof window === "undefined" || !publicKeyHex.trim()) {
    return;
  }
  try {
    window.sessionStorage.removeItem(dismissStorageKey(profileId, publicKeyHex));
  } catch {
    // ignore
  }
};
