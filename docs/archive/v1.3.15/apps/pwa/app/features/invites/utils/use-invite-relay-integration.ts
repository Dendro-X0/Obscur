/**
 * Hook to integrate invite system with existing relay pool
 * Ensures invite system works with the existing relay infrastructure
 */

import { useEffect, useCallback } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { useRelay } from "../../relays/providers/relay-provider";
import {
  syncConnectionRequestsFromRelays,
  handleIncomingConnectionRequest
} from "./messaging-integration";

type UseInviteRelayIntegrationParams = {
  myPublicKey: PublicKeyHex | null;
  myPrivateKey: PrivateKeyHex | null;
  relayUrls: string[];
  enabled?: boolean;
};

/**
 * Integrates the invite system with the existing relay pool
 * Handles syncing connection requests and processing incoming requests
 */
export const useInviteRelayIntegration = ({
  myPublicKey,
  myPrivateKey,
  relayUrls,
  enabled = true
}: UseInviteRelayIntegrationParams) => {
  const { relayPool: pool } = useRelay();


  // Sync connection requests when relays connect
  useEffect(() => {
    if (!enabled || !myPublicKey || !myPrivateKey) {
      return;
    }

    const hasOpenConnection = pool.connections.some(conn => conn.status === "open");

    if (hasOpenConnection) {
      // Sync connection requests from relays
      syncConnectionRequestsFromRelays(myPublicKey, myPrivateKey).catch(error => {
        console.error("Failed to sync connection requests:", error);
      });
    }
  }, [enabled, myPublicKey, myPrivateKey, pool.connections]);

  // Subscribe to incoming connection request events
  useEffect(() => {
    if (!enabled || !myPublicKey || !myPrivateKey) {
      return;
    }

    // In a full implementation, this would subscribe to connection request events
    // For now, we rely on the existing DM subscription which handles kind 4 events

    const unsubscribe = pool.subscribeToMessages(async ({ url, message }) => {
      // Parse and handle connection request events
      // This would check for specific event kinds related to connection requests

      try {
        const parsed = JSON.parse(message);

        // Check if this is an EVENT message
        if (Array.isArray(parsed) && parsed[0] === "EVENT") {
          const event = parsed[2];

          // Check if this is a connection request event (would use a specific kind)
          // For now, we'll let the existing DM handler process these
          // In a full implementation, we'd have a dedicated kind for connection requests
          if (event.kind === 4) {
            await handleIncomingConnectionRequest(event, myPublicKey, myPrivateKey);
          }
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

    await syncConnectionRequestsFromRelays(myPublicKey, myPrivateKey);
  }, [myPublicKey, myPrivateKey]);

  return {
    syncNow,
    relayConnections: pool.connections
  };
};
