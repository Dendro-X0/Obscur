/**
 * Hook to integrate invite system with existing relay pool
 * Ensures invite system works with the existing relay infrastructure
 */

import { useEffect, useCallback } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useRelayPool } from "../relays/use-relay-pool";
import { 
  syncContactRequestsFromRelays, 
  handleIncomingContactRequest 
} from "./messaging-integration";

type UseInviteRelayIntegrationParams = {
  myPublicKey: PublicKeyHex | null;
  myPrivateKey: PrivateKeyHex | null;
  relayUrls: string[];
  enabled?: boolean;
};

/**
 * Integrates the invite system with the existing relay pool
 * Handles syncing contact requests and processing incoming requests
 */
export const useInviteRelayIntegration = ({
  myPublicKey,
  myPrivateKey,
  relayUrls,
  enabled = true
}: UseInviteRelayIntegrationParams) => {
  const pool = useRelayPool(relayUrls);

  // Sync contact requests when relays connect
  useEffect(() => {
    if (!enabled || !myPublicKey || !myPrivateKey) {
      return;
    }

    const hasOpenConnection = pool.connections.some(conn => conn.status === "open");
    
    if (hasOpenConnection) {
      // Sync contact requests from relays
      syncContactRequestsFromRelays(myPublicKey, myPrivateKey).catch(error => {
        console.error("Failed to sync contact requests:", error);
      });
    }
  }, [enabled, myPublicKey, myPrivateKey, pool.connections]);

  // Subscribe to incoming contact request events
  useEffect(() => {
    if (!enabled || !myPublicKey || !myPrivateKey) {
      return;
    }

    // In a full implementation, this would subscribe to contact request events
    // For now, we rely on the existing DM subscription which handles kind 4 events
    
    const unsubscribe = pool.subscribeToMessages(async ({ url, message }) => {
      // Parse and handle contact request events
      // This would check for specific event kinds related to contact requests
      
      try {
        const parsed = JSON.parse(message);
        
        // Check if this is an EVENT message
        if (Array.isArray(parsed) && parsed[0] === "EVENT") {
          const event = parsed[2];
          
          // Check if this is a contact request event (would use a specific kind)
          // For now, we'll let the existing DM handler process these
          // In a full implementation, we'd have a dedicated kind for contact requests
        }
      } catch (error) {
        // Ignore parse errors
      }
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, myPublicKey, myPrivateKey, pool]);

  const syncNow = useCallback(async () => {
    if (!myPublicKey || !myPrivateKey) {
      return;
    }

    await syncContactRequestsFromRelays(myPublicKey, myPrivateKey);
  }, [myPublicKey, myPrivateKey]);

  return {
    syncNow,
    relayConnections: pool.connections
  };
};
