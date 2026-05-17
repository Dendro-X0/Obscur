"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
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
import { logAppEvent } from "@/app/shared/log-app-event";

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
  const runtimePhaseAllowsOwner = ACTIVE_OWNER_RUNTIME_PHASES.has(runtimeSnapshot.phase);
  // Incoming relay transport must remain attached for the unlocked runtime owner
  // even when account projection is replaying/degraded, otherwise one-way DM
  // receive gaps can occur during projection lifecycle transitions.
  const ownerEnabled = identity.state.status === "unlocked"
    && runtimePhaseAllowsOwner;
  const ownerGateReason = ownerEnabled
    ? "enabled"
    : identity.state.status !== "unlocked"
      ? `identity_${identity.state.status}`
      : `runtime_phase_${runtimeSnapshot.phase}`;
  const ownerGateLogKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const logKey = [
      ownerEnabled ? "enabled" : "disabled",
      ownerGateReason,
      runtimeSnapshot.phase,
      identity.state.status,
      identity.state.publicKeyHex ?? "none",
      projection.phase,
      projection.status,
      projection.accountProjectionReady ? "projection_ready" : "projection_not_ready",
      projection.accountPublicKeyHex ?? "none",
    ].join("|");
    if (ownerGateLogKeyRef.current === logKey) {
      return;
    }
    ownerGateLogKeyRef.current = logKey;
    logAppEvent({
      name: ownerEnabled
        ? "messaging.transport.runtime_owner_enabled"
        : "messaging.transport.runtime_owner_disabled",
      level: ownerEnabled ? "info" : "warn",
      scope: { feature: "messaging", action: "transport_owner_gate" },
      context: {
        reason: ownerGateReason,
        runtimePhase: runtimeSnapshot.phase,
        identityStatus: identity.state.status,
        accountPublicKeyHex: identity.state.publicKeyHex?.slice(0, 16) ?? null,
        projectionPhase: projection.phase,
        projectionStatus: projection.status,
        projectionReady: projection.accountProjectionReady,
        projectionAccountPublicKeyHex: projection.accountPublicKeyHex?.slice(0, 16) ?? null,
      },
    });
  }, [
    identity.state.publicKeyHex,
    identity.state.status,
    ownerEnabled,
    ownerGateReason,
    projection.accountProjectionReady,
    projection.accountPublicKeyHex,
    projection.phase,
    projection.status,
    runtimeSnapshot.phase,
  ]);
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
