"use client";

import type React from "react";
import { createContext, useCallback, useContext } from "react";
import type { UseEnhancedDMControllerResult } from "@/app/features/messaging/controllers/enhanced-dm-controller";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import type { Message } from "@/app/features/messaging/lib/message-queue";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useWindowRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-supervisor";
import { useAccountProjectionSnapshot } from "@/app/features/account-sync/hooks/use-account-projection-snapshot";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { recordPeerLastActive } from "@/app/features/messaging/services/peer-interaction-store";

const ACTIVE_OWNER_RUNTIME_PHASES = new Set(["activating_runtime", "ready", "degraded"]);
const RUNTIME_TRANSPORT_OWNER_ID = "runtime_singleton_owner";

const RuntimeMessagingTransportOwnerContext = createContext<UseEnhancedDMControllerResult | null>(null);

export function RuntimeMessagingTransportOwnerProvider(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const identity = useIdentity();
  const runtimeSnapshot = useWindowRuntimeSnapshot();
  const { relayPool } = useRelay();
  const { blocklist, peerTrust, requestsInbox } = useNetwork();
  const projection = useAccountProjectionSnapshot();
  const activePublicKeyHex = identity.state.publicKeyHex ?? null;
  const projectionBoundToActiveIdentity = (
    !!activePublicKeyHex
    && projection.accountPublicKeyHex === activePublicKeyHex
  );
  const projectionAllowsIncomingOwner = (
    // Normal ready steady-state.
    projection.accountProjectionReady
    // Keep incoming transport alive during restore/bootstrap for the same
    // unlocked account so live DMs and delete commands do not stall behind
    // projection replay/import progress.
    || (
      projection.phase === "bootstrapping"
      && projectionBoundToActiveIdentity
    )
    // Keep owner stable during deterministic replay for the same account so
    // transport doesn't flap unregister/register on every replay pass.
    || (
      projection.phase === "replaying_event_log"
      && projectionBoundToActiveIdentity
      && projection.projection !== null
    )
  );
  const ownerEnabled = identity.state.status === "unlocked"
    && ACTIVE_OWNER_RUNTIME_PHASES.has(runtimeSnapshot.phase)
    && projectionAllowsIncomingOwner;
  const myPublicKeyHex = ownerEnabled ? (identity.state.publicKeyHex ?? null) : null;
  const myPrivateKeyHex = ownerEnabled ? (identity.state.privateKeyHex ?? null) : null;
  const handleNewMessage = useCallback((message: Message) => {
    if (!message.isOutgoing && activePublicKeyHex && message.senderPubkey) {
      recordPeerLastActive({
        publicKeyHex: activePublicKeyHex,
        peerPublicKeyHex: message.senderPubkey,
        activeAtMs: message.eventCreatedAt?.getTime() ?? message.timestamp.getTime(),
      });
    }
    messageBus.emitNewMessage(message.conversationId, message);
  }, [activePublicKeyHex]);

  const handleMessageDeleted = useCallback((params: Readonly<{
    conversationId: string;
    messageId: string;
  }>) => {
    messageBus.emitMessageDeleted(params.conversationId, params.messageId);
  }, []);

  const controller = useEnhancedDmController({
    myPublicKeyHex,
    myPrivateKeyHex,
    pool: relayPool,
    blocklist,
    peerTrust,
    requestsInbox,
    onNewMessage: handleNewMessage,
    onMessageDeleted: handleMessageDeleted,
    autoSubscribeIncoming: ownerEnabled,
    enableIncomingTransport: ownerEnabled,
    enableAutoQueueProcessing: ownerEnabled,
    transportOwnerId: RUNTIME_TRANSPORT_OWNER_ID,
  });

  return (
    <RuntimeMessagingTransportOwnerContext.Provider value={controller}>
      {props.children}
    </RuntimeMessagingTransportOwnerContext.Provider>
  );
}

export const useRuntimeMessagingTransportOwnerController = (): UseEnhancedDMControllerResult => {
  const context = useContext(RuntimeMessagingTransportOwnerContext);
  if (!context) {
    throw new Error("useRuntimeMessagingTransportOwnerController must be used within RuntimeMessagingTransportOwnerProvider");
  }
  return context;
};
