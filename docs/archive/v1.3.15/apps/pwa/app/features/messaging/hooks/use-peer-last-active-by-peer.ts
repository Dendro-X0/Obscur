import React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  loadPeerLastActiveByPeerPubkey,
  peerInteractionStoreInternals,
} from "@/app/features/messaging/services/peer-interaction-store";

export const usePeerLastActiveByPeer = (
  publicKeyHex: PublicKeyHex | null
): Readonly<Record<string, number>> => {
  const [snapshot, setSnapshot] = React.useState<Readonly<Record<string, number>>>({});

  React.useEffect(() => {
    if (!publicKeyHex) {
      setSnapshot({});
      return;
    }

    const refresh = (): void => {
      setSnapshot(loadPeerLastActiveByPeerPubkey(publicKeyHex));
    };

    refresh();

    if (typeof window === "undefined") {
      return;
    }

    const onStoreUpdated = (): void => {
      refresh();
    };

    const onStorage = (event: StorageEvent): void => {
      if (!event.key || !event.key.includes(peerInteractionStoreInternals.storagePrefix)) {
        return;
      }
      refresh();
    };

    window.addEventListener(peerInteractionStoreInternals.storageUpdateEvent, onStoreUpdated);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(peerInteractionStoreInternals.storageUpdateEvent, onStoreUpdated);
      window.removeEventListener("storage", onStorage);
    };
  }, [publicKeyHex]);

  return snapshot;
};

