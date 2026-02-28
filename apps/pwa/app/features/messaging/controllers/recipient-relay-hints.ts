import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { nip19 } from "nostr-tools";

export const applyRecipientRelayHints = (params: Readonly<{
  peerPublicKeyInput: string;
  recipientPubkey: PublicKeyHex;
  addTransientRelay?: (url: string) => void;
  getWriteRelays: (pubkey: PublicKeyHex) => ReadonlyArray<string>;
}>): void => {
  if (params.peerPublicKeyInput.startsWith("nprofile")) {
    try {
      const decoded = nip19.decode(params.peerPublicKeyInput);
      if (decoded.type === "nprofile" && decoded.data.relays) {
        decoded.data.relays.forEach(url => {
          params.addTransientRelay?.(url);
        });
      }
    } catch (e) {
      console.error("Failed to extract nprofile hints", e);
    }
  }

  const recipientRelays = params.getWriteRelays(params.recipientPubkey);
  recipientRelays.forEach(url => {
    params.addTransientRelay?.(url);
  });
};
