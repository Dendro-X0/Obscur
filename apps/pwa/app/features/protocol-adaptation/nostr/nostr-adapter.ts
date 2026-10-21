import type { DmConversation, Message } from "@/app/features/messaging/types";
import { loadDmKernelSidebar } from "@/app/features/dm-kernel/dm-kernel-sidebar-port";
import {
  loadDmKernelThread,
  type LoadDmKernelThreadParams,
} from "@/app/features/dm-kernel/dm-kernel-thread-port";
import {
  sendDm as sendDmPipeline,
  sendConnectionRequest as sendConnectionRequestPipeline,
} from "@/app/features/messaging/controllers/v2/dm-send-pipeline";
import type { SendConfirmation } from "@/app/features/messaging/controllers/v2/dm-send-pipeline";
import { applyActiveTransport } from "../apply-active-transport";
import type {
  CanonicalConversation,
  CanonicalMessage,
  ProtocolAdapter,
  ProtocolCapabilities,
  TransportId,
} from "../types";

export type { SendConfirmation };

let connectedTransport: TransportId | null = null;

const mapMessageStatus = (
  status: Message["status"],
): CanonicalMessage["status"] => {
  if (status === "failed" || status === "rejected") {
    return "failed";
  }
  if (status === "sending" || status === "queued") {
    return "sending";
  }
  if (status === "delivered") {
    return "delivered";
  }
  return "sent";
};

const toCanonicalMessage = (
  message: Message,
  conversationId: string,
): CanonicalMessage => ({
  id: message.id,
  conversationId: message.conversationId ?? conversationId,
  body: message.content,
  sentAtUnixMs: message.timestamp.getTime(),
  direction: message.isOutgoing ? "out" : "in",
  status: mapMessageStatus(message.status),
});

const toCanonicalConversation = (conversation: DmConversation): CanonicalConversation => ({
  id: conversation.id,
  title: conversation.displayName,
});

/**
 * Phase 0 Nostr adapter — wraps existing DM send/list ports.
 * Rich Nostr types stay inside this module; UI uses layer ports.
 */
export const nostrAdapter: ProtocolAdapter & {
  listDmConversations: (profileId: string) => Promise<ReadonlyArray<DmConversation>>;
  listDmMessages: (params: LoadDmKernelThreadParams) => Promise<ReadonlyArray<Message>>;
  sendDm: typeof sendDmPipeline;
  sendConnectionRequest: typeof sendConnectionRequestPipeline;
} = {
  id: "nostr",

  capabilities: (): ProtocolCapabilities => ({
    dms: true,
    groups: true,
    reactions: true,
    media: true,
  }),

  connect: async (transport: TransportId): Promise<void> => {
    // C1: Clearnet|Tor honors existing Tor gateway; Quiet persists without uncapped Quiet.
    const result = await applyActiveTransport(transport);
    connectedTransport = result.transportId;
    if (result.errorMessage) {
      console.warn("[NostrAdapter.connect]", result.errorMessage);
    }
  },

  disconnect: async (): Promise<void> => {
    await applyActiveTransport("clearnet");
    connectedTransport = null;
  },

  listConversations: async (profileId: string): Promise<ReadonlyArray<CanonicalConversation>> => {
    const rows = await loadDmKernelSidebar(profileId);
    return rows.map(toCanonicalConversation);
  },

  listMessages: async (params): Promise<ReadonlyArray<CanonicalMessage>> => {
    const rows = await loadDmKernelThread(params);
    return rows.map((row) => toCanonicalMessage(row, params.conversationId));
  },

  sendMessage: async (params): Promise<CanonicalMessage> => {
    throw new Error(
      `NostrAdapter.sendMessage requires full DM credentials; use ProtocolAdaptationLayer.sendDm or nostrAdapter.sendDm (conversation=${params.conversationId.slice(0, 16)})`,
    );
  },

  /** Rich native sidebar list — used by MessagingProvider through the layer. */
  listDmConversations: (profileId: string): Promise<ReadonlyArray<DmConversation>> => (
    loadDmKernelSidebar(profileId)
  ),

  /** Rich native thread list — used by useDmKernelThread through the layer. */
  listDmMessages: (params: LoadDmKernelThreadParams): Promise<ReadonlyArray<Message>> => (
    loadDmKernelThread(params)
  ),

  sendDm: sendDmPipeline,

  sendConnectionRequest: sendConnectionRequestPipeline,
};

export const getNostrConnectedTransport = (): TransportId | null => connectedTransport;
