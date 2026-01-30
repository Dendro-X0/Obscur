/**
 * Integration layer between the invite system and existing messaging system
 * Connects contact requests with the enhanced DM controller
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { inviteManager } from "./invite-manager";
import { contactStore } from "./contact-store";
import type { Contact, ContactRequest } from "./types";

/**
 * Process accepted contact requests and enable messaging
 * This integrates with the existing DM controller to enable direct messaging
 */
export const enableMessagingForContact = async (
  contactRequest: ContactRequest,
  myPublicKey: PublicKeyHex,
  myPrivateKey: PrivateKeyHex
): Promise<Contact> => {
  // Accept the contact request through invite manager
  const contact = await inviteManager.acceptContactRequest(contactRequest.id);
  
  // The contact is now added to the contact store
  // The existing DM controller will automatically handle messaging
  // since it subscribes to all DMs for the user's public key
  
  return contact;
};

/**
 * Send a contact request as a Nostr DM
 * This allows contact requests to be sent through the existing relay infrastructure
 */
export const sendContactRequestViaDM = async (
  recipientPublicKey: PublicKeyHex,
  message: string | undefined,
  myPublicKey: PublicKeyHex,
  myPrivateKey: PrivateKeyHex
): Promise<void> => {
  // Create the contact request
  await inviteManager.sendContactRequest({
    recipientPublicKey,
    message,
    includeProfile: true
  });
  
  // The contact request is now stored locally
  // In a full implementation, this would also send a Nostr event
  // to notify the recipient through the relay network
};

/**
 * Check if a contact exists before allowing messaging
 */
export const canMessageContact = async (
  peerPublicKey: PublicKeyHex
): Promise<boolean> => {
  try {
    const contact = await contactStore.getContactByPublicKey(peerPublicKey);
    
    if (!contact) {
      return false;
    }
    
    // Check if contact is blocked
    if (contact.trustLevel === "blocked") {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

/**
 * Get contact information for display in messaging UI
 */
export const getContactInfo = async (
  peerPublicKey: PublicKeyHex
): Promise<{
  displayName: string;
  avatar?: string;
  trustLevel: "trusted" | "neutral" | "blocked";
} | null> => {
  try {
    const contact = await contactStore.getContactByPublicKey(peerPublicKey);
    
    if (!contact) {
      return null;
    }
    
    return {
      displayName: contact.displayName,
      avatar: contact.avatar,
      trustLevel: contact.trustLevel
    };
  } catch {
    return null;
  }
};

/**
 * Sync contact requests with relay network
 * This would fetch pending contact requests from relays
 */
export const syncContactRequestsFromRelays = async (
  myPublicKey: PublicKeyHex,
  myPrivateKey: PrivateKeyHex
): Promise<void> => {
  // In a full implementation, this would:
  // 1. Query relays for contact request events
  // 2. Decrypt and validate them
  // 3. Add them to the local contact request inbox
  
  // For now, this is a placeholder that would integrate with
  // the existing relay pool infrastructure
  console.log("Syncing contact requests from relays...");
};

/**
 * Handle incoming contact request from relay
 * This would be called by the relay message handler
 */
export const handleIncomingContactRequest = async (
  senderPublicKey: PublicKeyHex,
  encryptedPayload: string,
  myPrivateKey: PrivateKeyHex
): Promise<void> => {
  // In a full implementation, this would:
  // 1. Decrypt the contact request payload
  // 2. Validate the signature
  // 3. Create a ContactRequest object
  // 4. Add it to the inbox
  
  console.log("Handling incoming contact request from:", senderPublicKey);
};
