import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  CONTACT_TRUST_SENSITIVITY_LEVELS,
  DEFAULT_CONTACT_TRUST_SENSITIVITY,
  type ContactTrustSensitivity,
} from "./contact-trust-sensitivity";

const STORAGE_ROOT = "obscur.contact_trust_sensitivity.v1";

type StoredSensitivityByPeer = Readonly<Record<string, ContactTrustSensitivity>>;

const normalizePeerKey = (peerPublicKeyHex: string): string => peerPublicKeyHex.trim().toLowerCase();

const isContactTrustSensitivity = (value: unknown): value is ContactTrustSensitivity => (
  typeof value === "string"
  && (CONTACT_TRUST_SENSITIVITY_LEVELS as ReadonlyArray<string>).includes(value)
);

const readStore = (profileId: string): StoredSensitivityByPeer => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_ROOT, profileId));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as StoredSensitivityByPeer;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (profileId: string, store: StoredSensitivityByPeer): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getScopedStorageKey(STORAGE_ROOT, profileId), JSON.stringify(store));
  } catch {
    // Best-effort local recipient preference only.
  }
};

export const getContactTrustSensitivity = (
  profileId: string,
  peerPublicKeyHex: PublicKeyHex | string,
): ContactTrustSensitivity => {
  const store = readStore(profileId);
  const stored = store[normalizePeerKey(peerPublicKeyHex)];
  return isContactTrustSensitivity(stored) ? stored : DEFAULT_CONTACT_TRUST_SENSITIVITY;
};

export const setContactTrustSensitivity = (
  profileId: string,
  peerPublicKeyHex: PublicKeyHex | string,
  sensitivity: ContactTrustSensitivity,
): ContactTrustSensitivity => {
  const peerKey = normalizePeerKey(peerPublicKeyHex);
  const store = { ...readStore(profileId), [peerKey]: sensitivity };
  writeStore(profileId, store);
  return sensitivity;
};

export const getResolvedContactTrustSensitivity = (
  peerPublicKeyHex: PublicKeyHex | string,
): ContactTrustSensitivity => (
  getContactTrustSensitivity(getResolvedProfileId(), peerPublicKeyHex)
);
