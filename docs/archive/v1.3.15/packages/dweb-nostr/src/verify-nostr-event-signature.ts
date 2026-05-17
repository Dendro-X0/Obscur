import { schnorr } from "@noble/curves/secp256k1";
import { toArrayBuffer } from "@dweb/crypto/to-array-buffer";
import type { NostrEvent } from "./nostr-event";

/**
 * Verify the signature of a Nostr event
 * 
 * @param event - The signed Nostr event to verify
 * @returns Promise resolving to true if signature is valid, false otherwise
 */
export const verifyNostrEventSignature = async (event: NostrEvent): Promise<boolean> => {
  try {
    // Reconstruct the event ID to verify
    const idPayload = JSON.stringify([
      0,
      event.pubkey,
      event.created_at,
      event.kind,
      event.tags,
      event.content
    ]);
    
    // Hash the payload
    const bytes = new TextEncoder().encode(idPayload);
    const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
    const expectedId = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    // Check if the ID matches
    if (expectedId !== event.id) {
      return false;
    }
    
    // Verify the signature using schnorr
    return schnorr.verify(event.sig, event.id, event.pubkey);
  } catch {
    return false;
  }
};