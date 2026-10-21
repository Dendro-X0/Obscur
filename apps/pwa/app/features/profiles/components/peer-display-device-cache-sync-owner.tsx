"use client";

import { useEffect } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { upsertDevicePeerDisplay } from "@/app/features/search/services/device-peer-display-cache";

type Props = Readonly<{
  publicKeyHex: PublicKeyHex | null;
}>;

/**
 * Publishes this unlocked identity's local display (name + avatar) into the
 * device-shared AppData peer-display cache so other profile windows can hydrate it.
 */
export function PeerDisplayDeviceCacheSyncOwner(props: Props): null {
  const { state } = useProfile();
  const username = state.profile.username.trim();
  const avatarUrl = state.profile.avatarUrl.trim();

  useEffect(() => {
    if (!props.publicKeyHex) {
      return;
    }
    if (!username && !avatarUrl) {
      return;
    }
    void upsertDevicePeerDisplay({
      pubkey: props.publicKeyHex,
      displayName: username || undefined,
      avatarUrl: avatarUrl || undefined,
    });
  }, [props.publicKeyHex, username, avatarUrl]);

  return null;
}
