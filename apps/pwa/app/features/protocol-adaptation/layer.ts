import type { DmConversation, Message } from "@/app/features/messaging/types";
import type { LoadDmKernelThreadParams } from "@/app/features/dm-kernel/dm-kernel-thread-port";
import type { SendResult } from "@/app/features/messaging/controllers/v2/dm-controller-types";
import {
  readActiveProtocolId,
  readActiveTransportId,
  writeActiveProtocolId,
  writeActiveTransportId,
} from "./preferences";
import { nostrAdapter } from "./nostr-adapter";
import { matrixAdapter } from "./matrix-adapter";
import { privateDcAdapter } from "./private-dc-adapter";
import { hasMatrixSession } from "./matrix-session";
import { hasPrivateDcSession } from "./private-dc-session";
import { sendPrivateTrustT3Message } from "./private-trust-t3-send";
import { privateDcRequiresT3Wire } from "./private-trust-send-policy";
import { resolveConnectionRequestInvitePolicy } from "./private-trust-invite-policy";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import type {
  CanonicalConversation,
  CanonicalMessage,
  ProtocolAdapter,
  ProtocolId,
  TransportId,
} from "./types";
import { SELECTABLE_PROTOCOL_IDS } from "./types";

/** Prefer Tor preference honesty when Security toggle and transport plane diverge. */
const resolveHonestTransportId = (profileId?: string): TransportId => {
  const stored = readActiveTransportId(profileId);
  const torOn = PrivacySettingsService.getSettings().enableTorProxy;
  if (torOn && stored !== "tor") {
    return "tor";
  }
  if (!torOn && stored === "tor") {
    return "clearnet";
  }
  return stored;
};

const registry = new Map<ProtocolId, ProtocolAdapter>([
  ["nostr", nostrAdapter],
  ["matrix", matrixAdapter],
  ["private_dc", privateDcAdapter],
]);

  const getRichListAdapter = (protocolId: ProtocolId) => {
  if (protocolId === "matrix") {
    return matrixAdapter;
  }
  if (protocolId === "private_dc") {
    return privateDcAdapter;
  }
  return nostrAdapter;
};

/** Sole switch owner — active adapter + active transport. */
export const ProtocolAdaptationLayer = {
  getActiveProtocolId: (profileId?: string): ProtocolId => readActiveProtocolId(profileId),

  getActiveTransportId: (profileId?: string): TransportId => resolveHonestTransportId(profileId),

  setActiveProtocolId: (protocolId: ProtocolId, profileId?: string): void => {
    if (!SELECTABLE_PROTOCOL_IDS.includes(protocolId)) {
      throw new Error(
        `ProtocolAdaptationLayer: protocol "${protocolId}" is not selectable`,
      );
    }
    if (protocolId === "matrix" && !hasMatrixSession(profileId)) {
      throw new Error(
        "ProtocolAdaptationLayer: Matrix requires a homeserver login (Settings → Protocols)",
      );
    }
    if (protocolId === "private_dc" && !hasPrivateDcSession(profileId)) {
      throw new Error(
        "ProtocolAdaptationLayer: Private DC requires a configured server (Settings → Protocols)",
      );
    }
    writeActiveProtocolId(protocolId, profileId);
  },

  setActiveTransportId: (transportId: TransportId, profileId?: string): void => {
    writeActiveTransportId(transportId, profileId);
  },

  /**
   * Persist + apply transport (C1). Prefer this over setActiveTransportId alone
   * so NostrAdapter.connect reaches the Tor gateway.
   */
  applyTransport: async (
    transportId: TransportId,
    profileId?: string,
  ): Promise<void> => {
    await ProtocolAdaptationLayer.getActiveAdapter(profileId).connect(transportId, profileId);
  },

  getActiveAdapter: (profileId?: string): ProtocolAdapter => {
    const protocolId = readActiveProtocolId(profileId);
    const adapter = registry.get(protocolId);
    if (!adapter) {
      throw new Error(
        `ProtocolAdaptationLayer: no adapter registered for "${protocolId}"`,
      );
    }
    return adapter;
  },

  capabilities: (profileId?: string) => (
    ProtocolAdaptationLayer.getActiveAdapter(profileId).capabilities()
  ),

  connect: async (profileId?: string): Promise<void> => {
    const adapter = ProtocolAdaptationLayer.getActiveAdapter(profileId);
    const transport = readActiveTransportId(profileId);
    await adapter.connect(transport, profileId);
  },

  disconnect: async (profileId?: string): Promise<void> => {
    await ProtocolAdaptationLayer.getActiveAdapter(profileId).disconnect();
  },

  /** Platform canonical — prefer for new shell code (see port-surfaces.ts). */
  listConversations: async (
    profileId: string,
  ): Promise<ReadonlyArray<CanonicalConversation>> => (
    ProtocolAdaptationLayer.getActiveAdapter(profileId).listConversations(profileId)
  ),

  /** Platform canonical — prefer for new shell code (see port-surfaces.ts). */
  listMessages: async (
    params: LoadDmKernelThreadParams,
  ): Promise<ReadonlyArray<CanonicalMessage>> => (
    ProtocolAdaptationLayer.getActiveAdapter(params.profileId).listMessages(params)
  ),

  /** Platform canonical — prefer for new shell code (see port-surfaces.ts). */
  sendMessage: async (
    params: Readonly<{ profileId: string; conversationId: string; body: string }>,
  ): Promise<CanonicalMessage> => (
    ProtocolAdaptationLayer.getActiveAdapter(params.profileId).sendMessage(params)
  ),

  /**
   * Obscur-Nostr rich compatibility — MessagingProvider / dm-controller / thread hook.
   * Not the platform DTO. Routed by activeProtocolId (no dual-write).
   * Nostr-only pipelines that must ignore Matrix selection use `sendDmNostrOnly`.
   */
  listDmConversations: async (
    profileId: string,
  ): Promise<ReadonlyArray<DmConversation>> => (
    getRichListAdapter(readActiveProtocolId(profileId)).listDmConversations(profileId)
  ),

  /** Obscur-Nostr rich compatibility — see listDmConversations. */
  listDmMessages: async (
    params: LoadDmKernelThreadParams,
  ): Promise<ReadonlyArray<Message>> => (
    getRichListAdapter(readActiveProtocolId(params.profileId)).listDmMessages(params)
  ),

  /**
   * Obscur-Nostr rich send (layer-routed). Matrix active → Matrix sendMessage shim.
   * Always-Nostr wire (delete commands / offline retry) → `sendDmNostrOnly`.
   */
  sendDm: (async (...args: Parameters<typeof nostrAdapter.sendDm>): Promise<SendResult> => {
    const params = args[0];
    const profileId = params.profileId ?? "";
    const activeProtocol = readActiveProtocolId(profileId || undefined);
    if (activeProtocol === "private_dc" && privateDcRequiresT3Wire()) {
      const conversationId = params.recipientPublicKeyHex.trim();
      try {
        // Cut 1.4 — T3 envelope H-dc; never plaintext body on private_dc.
        const sent = await sendPrivateTrustT3Message({
          profileId: profileId || "default",
          conversationId,
          peerPubkey: params.recipientPublicKeyHex,
          plaintext: params.plaintext,
        });
        params.onConfirmed?.({
          success: true,
          deliveryStatus: "sent_quorum",
          successCount: 1,
          totalRelays: 1,
        });
        return {
          success: true,
          deliveryStatus: "sent_quorum",
          messageId: sent.id,
          eventId: sent.id,
          relayResults: [],
        };
      } catch (error) {
        // Cut 2.2 — fail closed; never fall through to nostrAdapter.sendDm.
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          deliveryStatus: "failed",
          messageId: "",
          eventId: "",
          relayResults: [],
          error: message,
        };
      }
    }
    if (activeProtocol === "matrix" || activeProtocol === "private_dc") {
      const conversationId = params.recipientPublicKeyHex.trim();
      const adapter = activeProtocol === "matrix" ? matrixAdapter : privateDcAdapter;
      try {
        const sent = await adapter.sendMessage({
          profileId: profileId || "default",
          conversationId,
          body: params.plaintext,
        });
        params.onConfirmed?.({
          success: true,
          deliveryStatus: "sent_quorum",
          successCount: 1,
          totalRelays: 1,
        });
        return {
          success: true,
          deliveryStatus: "sent_quorum",
          messageId: sent.id,
          eventId: sent.id,
          relayResults: [],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          deliveryStatus: "failed",
          messageId: "",
          eventId: "",
          relayResults: [],
          error: message,
        };
      }
    }
    return nostrAdapter.sendDm(...args);
  }) as typeof nostrAdapter.sendDm,

  /**
   * K1 — always Nostr wire; ignores activeProtocolId.
   * Messaging delete/retry must call this (or sendDm) — never import nostrAdapter.
   */
  sendDmNostrOnly: ((...args: Parameters<typeof nostrAdapter.sendDm>): ReturnType<typeof nostrAdapter.sendDm> => (
    nostrAdapter.sendDm(...args)
  )) as typeof nostrAdapter.sendDm,

  sendConnectionRequest: ((...args: Parameters<typeof nostrAdapter.sendConnectionRequest>) => {
    const params = args[0];
    const profileId = (params as { profileId?: string } | undefined)?.profileId;
    const activeProtocol = readActiveProtocolId(profileId);
    const invitePolicy = resolveConnectionRequestInvitePolicy(activeProtocol);
    if (!invitePolicy.allowed) {
      // Cut 2.3 — honest refuse (SendResult), never throw that strands UI.
      return Promise.resolve({
        success: false,
        deliveryStatus: "failed" as const,
        messageId: "",
        eventId: "",
        relayResults: [],
        error: `[${invitePolicy.reasonCode}] ${invitePolicy.userMessage}`,
      });
    }
    return nostrAdapter.sendConnectionRequest(...args);
  }) as typeof nostrAdapter.sendConnectionRequest,
};

/** Platform canonical named exports (preferred for new protocol-neutral work). */
export const listConversations = ProtocolAdaptationLayer.listConversations;
export const listMessages = ProtocolAdaptationLayer.listMessages;
export const sendMessage = ProtocolAdaptationLayer.sendMessage;

/** Obscur-Nostr rich named exports (existing shell; not the long-term platform DTO). */
export const listDmConversations = ProtocolAdaptationLayer.listDmConversations;
export const listDmMessages = ProtocolAdaptationLayer.listDmMessages;
export const sendDm = ProtocolAdaptationLayer.sendDm;
export const sendDmNostrOnly = ProtocolAdaptationLayer.sendDmNostrOnly;
export const sendConnectionRequest = ProtocolAdaptationLayer.sendConnectionRequest;

export type {
  CanonicalSendConfirmation,
  CanonicalDeliveryStatus,
  SendConfirmation,
} from "./send-confirmation";
export { toCanonicalSendConfirmation } from "./send-confirmation";
