/**
 * Integration layer between the invite system and existing messaging system
 * Connects connection requests with the enhanced DM controller
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { inviteManager } from "./invite-manager";
import { connectionStore } from "./connection-store";
import type { Connection, ConnectionRequest } from "./types";

const getConnectionByPublicKeyCompat = async (
  peerPublicKey: PublicKeyHex
): Promise<Connection | null> => {
  const store = connectionStore as unknown as {
    getConnectionByPublicKey?: (publicKey: string) => Promise<Connection | null>;
    getContactByPublicKey?: (publicKey: string) => Promise<Connection | null>;
  };

  if (store.getConnectionByPublicKey) {
    return store.getConnectionByPublicKey(peerPublicKey);
  }
  if (store.getContactByPublicKey) {
    return store.getContactByPublicKey(peerPublicKey);
  }
  return null;
};

/**
 * Process accepted connection requests and enable messaging
 * This integrates with the existing DM controller to enable direct messaging
 */
export const enableMessagingForConnection = async (
  connectionRequest: ConnectionRequest,
  myPublicKey: PublicKeyHex,
  myPrivateKey: PrivateKeyHex
): Promise<Connection> => {
  // Accept the connection request through invite manager
  const connection = await inviteManager.acceptConnectionRequest(connectionRequest.id);

  // The connection is now added to the connection store
  // The existing DM controller will automatically handle messaging
  // since it subscribes to all DMs for the user's public key

  return connection;
};

/**
 * Send a connection request as a Nostr DM
 * This allows connection requests to be sent through the existing relay infrastructure
 */
export const sendConnectionRequestViaDM = async (
  recipientPublicKey: PublicKeyHex,
  message: string | undefined,
  myPublicKey: PublicKeyHex,
  myPrivateKey: PrivateKeyHex
): Promise<void> => {
  // Create the connection request
  await inviteManager.sendConnectionRequest({
    recipientPublicKey,
    message,
    includeProfile: true
  });

  // The connection request is now stored locally
  // In a full implementation, this would also send a Nostr event
  // to notify the recipient through the relay network
};

/**
 * Check if a connection exists before allowing messaging
 */
export const canMessageConnection = async (
  peerPublicKey: PublicKeyHex
): Promise<boolean> => {
  try {
    const connection = await getConnectionByPublicKeyCompat(peerPublicKey);

    if (!connection) {
      return false;
    }

    // Check if connection is blocked
    if (connection.trustLevel === "blocked") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Get connection information for display in messaging UI
 */
export const getConnectionInfo = async (
  peerPublicKey: PublicKeyHex
): Promise<{
  displayName: string;
  avatar?: string;
  trustLevel: "trusted" | "neutral" | "blocked";
} | null> => {
  try {
    const connection = await getConnectionByPublicKeyCompat(peerPublicKey);

    if (!connection) {
      return null;
    }

    return {
      displayName: connection.displayName,
      avatar: connection.avatar,
      trustLevel: connection.trustLevel
    };
  } catch {
    return null;
  }
};

/**
 * Sync connection requests with relay network
 * This would fetch pending connection requests from relays
 */
export const syncConnectionRequestsFromRelays = async (
  myPublicKey: PublicKeyHex,
  myPrivateKey: PrivateKeyHex
): Promise<void> => {
  // In a full implementation, this would:
  // 1. Query relays for connection request events
  // 2. Decrypt and validate them
  // 3. Add them to the local connection request inbox

  // For now, this is a placeholder that would integrate with
  // the existing relay pool infrastructure
  console.log("Syncing connection requests from relays...");
};

/**
 * Handle incoming connection request from relay
 * This would be called by the relay message handler
 */
export const handleIncomingConnectionRequest = async (
  event: any,
  myPublicKey: PublicKeyHex | null,
  myPrivateKey: PrivateKeyHex | null
): Promise<void> => {
  // In a full implementation, this would:
  // 1. Decrypt the connection request payload
  // 2. Validate the signature
  // 3. Create a ConnectionRequest object
  // 4. Add it to the inbox

  console.log("Handling incoming connection request from:", event.pubkey);
};
