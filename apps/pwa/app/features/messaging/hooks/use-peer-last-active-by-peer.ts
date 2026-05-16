import React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  loadPeerLastActiveByPeerPubkey,
  peerInteractionStoreInternals,
} from "@/app/features/messaging/services/peer-interaction-store";
import { useOptionalProfileMessageBus, useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { subscribePeerInteractionUpdatedDual } from "@/app/features/profiles/services/subscribe-peer-interaction-updated-dual";

export const usePeerLastActiveByPeer = (
  publicKeyHex: PublicKeyHex | null
): Readonly<Record<string, number>> => {
  const [snapshot, setSnapshot] = React.useState<Readonly<Record<string, number>>>({});
  const optionalProfileBus = useOptionalProfileMessageBus();
  const optionalRuntime = useOptionalProfileRuntime();

  React.useEffect(() => {
    if (!publicKeyHex) {
      setSnapshot({});
      return;
    }

    const refresh = (): void => {
      setSnapshot(loadPeerLastActiveByPeerPubkey(publicKeyHex, optionalRuntime?.profileId));
    };

    refresh();

    if (typeof window === "undefined") {
      const unsubPeerDual = subscribePeerInteractionUpdatedDual((detail) => {
        if (detail.publicKeyHex === publicKeyHex) {
          refresh();
        }
      }, optionalProfileBus);
      return (): void => {
        unsubPeerDual();
      };
    }

    const onStorage = (event: StorageEvent): void => {
      if (!event.key || !event.key.includes(peerInteractionStoreInternals.storagePrefix)) {
        return;
      }
      refresh();
    };

    const unsubPeerDual = subscribePeerInteractionUpdatedDual((detail) => {
      if (detail.publicKeyHex === publicKeyHex) {
        refresh();
      }
    }, optionalProfileBus);

    window.addEventListener("storage", onStorage);
    return () => {
      unsubPeerDual();
      window.removeEventListener("storage", onStorage);
    };
  }, [publicKeyHex, optionalProfileBus, optionalRuntime?.profileId]);

  return snapshot;
};

