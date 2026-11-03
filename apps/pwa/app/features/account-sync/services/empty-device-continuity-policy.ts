/**
 * P0 empty-device continuity gate — when unlock skips auto account-sync,
 * surface an explicit restore/import path instead of a silent blank Network.
 *
 * Dismiss is durable (localStorage): Continuity→Continue empty / successful
 * restore must survive app relaunch. sessionStorage alone re-prompted every
 * desktop cold start (Tester1 loop 2026-11).
 *
 * @see specs/backend/cross-device-data-continuity-design-2026-10.md
 * @see specs/backend/contacts-empty-after-relay-disable-restore-investigation-2026-11.md
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
  const key = dismissStorageKey(profileId, publicKeyHex);
  try {
    if (window.localStorage.getItem(key) === "1") {
      return true;
    }
    // Migrate one-shot session dismiss from earlier builds so this session
    // does not re-prompt after Continuity→Continue empty.
    if (window.sessionStorage.getItem(key) === "1") {
      window.localStorage.setItem(key, "1");
      window.sessionStorage.removeItem(key);
      return true;
    }
    return false;
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
  const key = dismissStorageKey(profileId, publicKeyHex);
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore quota / private mode
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const clearEmptyDeviceContinuityDismissed = (
  profileId: string,
  publicKeyHex: string,
): void => {
  if (typeof window === "undefined" || !publicKeyHex.trim()) {
    return;
  }
  const key = dismissStorageKey(profileId, publicKeyHex);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
};
