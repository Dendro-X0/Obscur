import type { DmConversation, Message } from "@/app/features/messaging/types";
import type { LoadDmKernelThreadParams } from "@/app/features/dm-kernel/dm-kernel-thread-port";
import type {
  CanonicalConversation,
  CanonicalMessage,
  ProtocolAdapter,
  ProtocolCapabilities,
  TransportId,
} from "./types";
import {
  privateDcListConversations,
  privateDcListMessages,
  privateDcSendMessage,
} from "./private-dc-client";
import { PRIVATE_DC_CAPABILITIES } from "./private-dc-capabilities";
import {
  mapPrivateDcConversationToRich,
  mapPrivateDcMessageToRich,
} from "./private-dc-rich-map";
import { hasPrivateDcSession, readPrivateDcSession } from "./private-dc-session";

/**
 * P4b/P4g/P4h — private DC carrier with HTTPS JSON wire behind ProtocolAdaptationLayer.
 * @see specs/backend/platform-p4b-private-dc-http-wire-design-2026-11.md
 * @see specs/backend/platform-p4g-private-dc-rich-list-shim-2026-11.md
 * @see specs/backend/platform-p4h-private-dc-capabilities-rich-map-2026-11.md
 */

let connectedTransport: TransportId | null = null;
let fetchImpl: typeof fetch = fetch;

const requireSession = (profileId?: string) => {
  const session = readPrivateDcSession(profileId);
  if (!session) {
    throw new Error("PrivateDcAdapter: no session — configure Settings → Protocols → Private DC");
  }
  return session;
};

export const privateDcAdapter: ProtocolAdapter & {
  listDmConversations: (profileId: string) => Promise<ReadonlyArray<DmConversation>>;
  listDmMessages: (params: LoadDmKernelThreadParams) => Promise<ReadonlyArray<Message>>;
} = {
  id: "private_dc",

  capabilities: (): ProtocolCapabilities => PRIVATE_DC_CAPABILITIES,

  connect: async (transport: TransportId, profileId?: string): Promise<void> => {
    if (!hasPrivateDcSession(profileId)) {
      throw new Error("PrivateDcAdapter: no session — configure base URL first");
    }
    connectedTransport = transport;
  },

  disconnect: async (): Promise<void> => {
    connectedTransport = null;
  },

  listConversations: async (profileId: string): Promise<ReadonlyArray<CanonicalConversation>> => {
    const session = requireSession(profileId);
    return privateDcListConversations(session, fetchImpl);
  },

  listMessages: async (params): Promise<ReadonlyArray<CanonicalMessage>> => {
    const session = requireSession(params.profileId);
    return privateDcListMessages(session, {
      conversationId: params.conversationId,
      limit: params.limit,
    }, fetchImpl);
  },

  sendMessage: async (params): Promise<CanonicalMessage> => {
    const session = requireSession(params.profileId);
    return privateDcSendMessage(session, {
      conversationId: params.conversationId,
      body: params.body,
    }, fetchImpl);
  },

  /** P4g — rich shell sidebar; never fall through to Nostr when private_dc is active. */
  listDmConversations: async (profileId: string): Promise<ReadonlyArray<DmConversation>> => {
    const rows = await privateDcAdapter.listConversations(profileId);
    return rows.map(mapPrivateDcConversationToRich);
  },

  listDmMessages: async (params: LoadDmKernelThreadParams): Promise<ReadonlyArray<Message>> => {
    const rows = await privateDcAdapter.listMessages(params);
    return rows.map(mapPrivateDcMessageToRich);
  },
};

/** Test / diagnostics — last transport passed to connect. */
export const getPrivateDcConnectedTransport = (): TransportId | null => connectedTransport;

/** Test helper — inject fetch (defaults to global fetch). */
export const setPrivateDcFetchImplForTests = (next: typeof fetch): void => {
  fetchImpl = next;
};

export const resetPrivateDcFetchImplForTests = (): void => {
  fetchImpl = fetch;
};
