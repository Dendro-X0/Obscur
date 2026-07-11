"use client";

import type React from "react";
import { useEffect } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { syncProfileDraftFromStoredIdentity } from "@/app/features/profiles/services/profile-identity-draft-sync";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

/** Keeps Settings → Profile aligned with the unlocked identity display name when the draft is still empty. */
export function ProfileIdentityDraftSyncOwner(props: Props): null {
  useEffect(() => {
    if (!props.publicKeyHex) {
      return;
    }
    void syncProfileDraftFromStoredIdentity({ publicKeyHex: props.publicKeyHex });
  }, [props.publicKeyHex]);

  return null;
}
