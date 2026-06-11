"use client";

/**
 * runtime-messaging-transport-owner-provider.tsx
 *
 * V2 messaging pipeline integration.
 * Delegates to controllers/v2/dm-controller.ts for all messaging logic.
 * Preserves the same exported component + hook names for zero-change integration.
 */

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { useDmController, type UseDmControllerResult } from "@/app/features/messaging/controllers/v2/dm-controller";
import type { Message } from "@/app/features/messaging/types";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useWindowRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-supervisor";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { recordPeerLastActive } from "@/app/features/messaging/services/peer-interaction-store";
import { logAppEvent } from "@/app/shared/log-app-event";
import { isExperimentOfflineStubEnabled } from "@/app/features/runtime/experiment-shell-policy";
import {
  subscribeNativeDmRelayBackfillRepair,
  type NativeDmSqliteRelayBackfillRepairDetail,
} from "@/app/features/messaging/services/native-dm-sqlite-repair";

const ACTIVE_OWNER_RUNTIME_PHASES = new Set(["activating_runtime", "ready", "degraded"]);
const RUNTIME_TRANSPORT_OWNER_ID = "runtime_singleton_owner_v2";

const RuntimeMessagingTransportOwnerContext = createContext<UseDmControllerResult | null>(null);

export function RuntimeMessagingTransportOwnerProvider(props: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  const identity = useIdentity();
  const runtimeSnapshot = useWindowRuntimeSnapshot();
  const { relayPool } = useRelay();
  const { blocklist, peerTrust } = useNetwork();
  const activePublicKeyHex = identity.state.publicKeyHex ?? null;
  const runtimePhaseAllowsOwner = ACTIVE_OWNER_RUNTIME_PHASES.has(runtimeSnapshot.phase);
  const ownerEnabled = (
    !isExperimentOfflineStubEnabled()
    && identity.state.status === "unlocked"
    && runtimePhaseAllowsOwner
  );
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
    ].join("|");
    if (ownerGateLogKeyRef.current === logKey) return;
    ownerGateLogKeyRef.current = logKey;
    logAppEvent({
      name: ownerEnabled
        ? "messaging.transport.v2_runtime_owner_enabled"
        : "messaging.transport.v2_runtime_owner_disabled",
      level: ownerEnabled ? "info" : "warn",
      scope: { feature: "messaging", action: "transport_owner_gate" },
      context: {
        reason: ownerGateReason,
        runtimePhase: runtimeSnapshot.phase,
        identityStatus: identity.state.status,
        accountPublicKeyHex: identity.state.publicKeyHex?.slice(0, 16) ?? null,
      },
    });
  }, [identity.state.publicKeyHex, identity.state.status, ownerEnabled, ownerGateReason, runtimeSnapshot.phase]);

  const myPublicKeyHex = ownerEnabled ? (identity.state.publicKeyHex ?? null) : null;
  const myPrivateKeyHex = ownerEnabled ? (identity.state.privateKeyHex ?? null) : null;

  const resolveBusConversationId = useCallback((message: Message): string => {
    const direct = message.conversationId?.trim();
    if (direct) {
      return direct;
    }
    if (!activePublicKeyHex) {
      return "";
    }
    const peerPublicKeyHex = message.isOutgoing
      ? message.recipientPubkey
      : message.senderPubkey;
    if (!peerPublicKeyHex) {
      return "";
    }
    return toDmConversationId({
      myPublicKeyHex: activePublicKeyHex,
      peerPublicKeyHex,
    }) ?? "";
  }, [activePublicKeyHex]);

  const handleMessageUpdated = useCallback((params: Readonly<{
    conversationId: string;
    message: Message;
  }>) => {
    const sourceProfileId = getResolvedProfileId()?.trim() || undefined;
    const conversationId = params.conversationId.trim() || resolveBusConversationId(params.message);
    messageBus.emitMessageUpdated(conversationId, params.message, { sourceProfileId });
  }, [resolveBusConversationId]);

  const handleNewMessage = useCallback((message: Message) => {
    const sourceProfileId = getResolvedProfileId()?.trim() || undefined;
    if (!message.isOutgoing && activePublicKeyHex && message.senderPubkey) {
      recordPeerLastActive({
        publicKeyHex: activePublicKeyHex,
        peerPublicKeyHex: message.senderPubkey,
        activeAtMs: message.eventCreatedAt?.getTime() ?? message.timestamp.getTime(),
        profileId: sourceProfileId,
      });
    }
    messageBus.emitNewMessage(resolveBusConversationId(message), message, { sourceProfileId });
  }, [activePublicKeyHex, resolveBusConversationId]);

  const handleMessageDeleted = useCallback((params: Readonly<{
    conversationId: string;
    messageId?: string;
    messageIdentityIds?: ReadonlyArray<string>;
    conversationIdOriginal?: string;
  }>) => {
    const primaryMessageId = (
      params.messageId?.trim()
      || params.messageIdentityIds?.find((id) => id.trim().length > 0)?.trim()
      || ""
    );
    if (!primaryMessageId) {
      console.warn("[runtime-messaging] message delete bus emit skipped — no message id");
      return;
    }
    const sourceProfileId = getResolvedProfileId()?.trim() || undefined;
    messageBus.emitMessageDeleted(params.conversationId, primaryMessageId, {
      messageIdentityIds: params.messageIdentityIds,
      conversationIdOriginal: params.conversationIdOriginal,
      sourceProfileId,
    });
  }, []);

  const controller = useDmController({
    myPublicKeyHex,
    myPrivateKeyHex,
    pool: relayPool,
    blocklist,
    peerTrust,
    onNewMessage: handleNewMessage,
    onMessageUpdated: handleMessageUpdated,
    onMessageDeleted: handleMessageDeleted,
    autoSubscribeIncoming: ownerEnabled,
    enableIncomingTransport: ownerEnabled,
    transportOwnerId: RUNTIME_TRANSPORT_OWNER_ID,
  });

  const syncMissedMessagesRef = useRef(controller.syncMissedMessages);
  syncMissedMessagesRef.current = controller.syncMissedMessages;

  useEffect(() => {
    if (!ownerEnabled) {
      return;
    }
    const activeProfileId = runtimeSnapshot.session.profileId?.trim() || "";
    if (!activeProfileId) {
      return;
    }
    return subscribeNativeDmRelayBackfillRepair((detail: NativeDmSqliteRelayBackfillRepairDetail) => {
      if (detail.profileId.trim() !== activeProfileId) {
        return;
      }
      logAppEvent({
        name: "messaging.native_dm_sqlite_repair_relay_backfill_executing",
        level: "info",
        scope: { feature: "messaging", action: "native_dm_sqlite_repair" },
        context: {
          profileId: detail.profileId,
          reason: detail.reason,
          trigger: detail.trigger,
          sinceUnixMs: detail.sinceUnixMs,
          conversationCount: detail.conversationIds.length,
        },
      });
      void syncMissedMessagesRef.current(new Date(detail.sinceUnixMs));
    });
  }, [ownerEnabled, runtimeSnapshot.session.profileId]);

  return (
    <RuntimeMessagingTransportOwnerContext.Provider value={controller}>
      {props.children}
    </RuntimeMessagingTransportOwnerContext.Provider>
  );
}

export const useRuntimeMessagingTransportOwnerController = (): UseDmControllerResult => {
  const context = useContext(RuntimeMessagingTransportOwnerContext);
  if (!context) {
    throw new Error("useRuntimeMessagingTransportOwnerController must be used within RuntimeMessagingTransportOwnerProvider");
  }
  return context;
};
