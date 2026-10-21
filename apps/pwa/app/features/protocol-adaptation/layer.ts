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
import { hasMatrixSession } from "./matrix-session";
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
]);

const getRichListAdapter = (protocolId: ProtocolId) => {
  if (protocolId === "matrix") {
    return matrixAdapter;
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
    await ProtocolAdaptationLayer.getActiveAdapter(profileId).connect(transportId);
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
    await adapter.connect(transport);
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
    params: Readonly<{ conversationId: string; body: string }>,
    profileId?: string,
  ): Promise<CanonicalMessage> => (
    ProtocolAdaptationLayer.getActiveAdapter(profileId).sendMessage(params)
  ),

  /**
   * Obscur-Nostr rich compatibility — MessagingProvider / dm-controller / thread hook.
   * Not the platform DTO. Routed by activeProtocolId (no dual-write).
   * Nostr-only pipelines that must ignore Matrix selection use `nostrAdapter.sendDm`.
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
   * For always-Nostr send (delete/retry), call `nostrAdapter.sendDm` instead.
   */
  sendDm: (async (...args: Parameters<typeof nostrAdapter.sendDm>): Promise<SendResult> => {
    const params = args[0];
    if (readActiveProtocolId() === "matrix") {
      const roomId = params.recipientPublicKeyHex.trim();
      try {
        const sent = await matrixAdapter.sendMessage({
          conversationId: roomId,
          body: params.plaintext,
        });
        params.onConfirmed?.({
          success: true,
          deliveryStatus: "sent_quorum",
          relayResults: [],
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

  sendConnectionRequest: ((...args: Parameters<typeof nostrAdapter.sendConnectionRequest>) => {
    if (readActiveProtocolId() === "matrix") {
      throw new Error("MatrixAdapter: connection requests are Nostr-only");
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
export const sendConnectionRequest = ProtocolAdaptationLayer.sendConnectionRequest;
