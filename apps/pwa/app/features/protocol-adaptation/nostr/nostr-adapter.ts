import type { DmConversation, Message } from "@/app/features/messaging/types";
import {
  formatNostrCanonicalSendRequiresCredentialsError,
  mapRichConversationToCanonical,
  mapRichMessageToCanonical,
  OBSCUR_NOSTR_CAPABILITIES,
} from "@obscur/protocol-nostr";
import { loadDmKernelSidebar } from "@/app/features/dm-kernel/dm-kernel-sidebar-port";
import {
  loadDmKernelThread,
  type LoadDmKernelThreadParams,
} from "@/app/features/dm-kernel/dm-kernel-thread-port";
import {
  sendDm as sendDmPipeline,
  sendConnectionRequest as sendConnectionRequestPipeline,
} from "@/app/features/messaging/controllers/v2/dm-send-pipeline";
import { applyActiveTransport } from "../apply-active-transport";
import type { SendConfirmation } from "../send-confirmation";
import type {
  CanonicalConversation,
  CanonicalMessage,
  ProtocolAdapter,
  ProtocolCapabilities,
  TransportId,
} from "../types";

/** @deprecated Import `SendConfirmation` from `protocol-adaptation/layer` or `send-confirmation`. */
export type { SendConfirmation };

let connectedTransport: TransportId | null = null;

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

  capabilities: (): ProtocolCapabilities => OBSCUR_NOSTR_CAPABILITIES,

  connect: async (transport: TransportId, _profileId?: string): Promise<void> => {
    // C1: Clearnet|Tor honors existing Tor gateway; Quiet persists without uncapped Quiet.
    // profileId reserved for session carriers (Matrix / private_dc); Nostr uses transport prefs.
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
    return rows.map(mapRichConversationToCanonical);
  },

  listMessages: async (params): Promise<ReadonlyArray<CanonicalMessage>> => {
    const rows = await loadDmKernelThread(params);
    return rows.map((row) => mapRichMessageToCanonical(row, params.conversationId));
  },

  sendMessage: async (params): Promise<CanonicalMessage> => {
    throw new Error(formatNostrCanonicalSendRequiresCredentialsError(params.conversationId));
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
