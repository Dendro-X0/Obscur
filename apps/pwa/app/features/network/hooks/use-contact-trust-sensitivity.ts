"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import type { ContactTrustSensitivity } from "@/app/features/dm-kernel/contact-trust-sensitivity";
import {
  getContactTrustSensitivity,
  setContactTrustSensitivity,
} from "@/app/features/dm-kernel/contact-trust-sensitivity-state";

export type UseContactTrustSensitivityResult = Readonly<{
  sensitivity: ContactTrustSensitivity;
  setSensitivity: (value: ContactTrustSensitivity) => void;
  hasHydrated: boolean;
}>;

export const useContactTrustSensitivity = (
  peerPublicKeyHex: PublicKeyHex | string | null | undefined,
): UseContactTrustSensitivityResult => {
  const profileId = getResolvedProfileId();
  const [sensitivity, setSensitivityState] = useState<ContactTrustSensitivity>(() => {
    if (!peerPublicKeyHex) {
      return "standard";
    }
    return getContactTrustSensitivity(profileId, peerPublicKeyHex);
  });
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (!peerPublicKeyHex) {
      return;
    }
    queueMicrotask(() => {
      setSensitivityState(getContactTrustSensitivity(profileId, peerPublicKeyHex));
      setHasHydrated(true);
    });
  }, [peerPublicKeyHex, profileId]);

  const setSensitivity = useCallback((value: ContactTrustSensitivity) => {
    if (!peerPublicKeyHex) {
      return;
    }
    setContactTrustSensitivity(profileId, peerPublicKeyHex, value);
    setSensitivityState(value);
  }, [peerPublicKeyHex, profileId]);

  return { sensitivity, setSensitivity, hasHydrated };
};
