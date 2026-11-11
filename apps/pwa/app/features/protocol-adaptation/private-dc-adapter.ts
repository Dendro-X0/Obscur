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
  privateDcSendEnvelope,
  privateDcSendMessage,
} from "./private-dc-client";
import { PRIVATE_DC_CAPABILITIES } from "./private-dc-capabilities";
import {
  mapPrivateDcConversationToRich,
  mapPrivateDcMessageToRich,
} from "./private-dc-rich-map";
import { hasPrivateDcSession, readPrivateDcSession } from "./private-dc-session";
import {
  PRIVATE_DC_T3_PLAINTEXT_REFUSED,
  privateDcRequiresT3Wire,
} from "./private-trust-send-policy";
import type { PrivateDcCipherEnvelope } from "./private-dc-client";

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
  sendEnvelope: (params: Readonly<{
    profileId: string;
    conversationId: string;
    envelope: string;
    clientMessageId: string;
  }>) => Promise<PrivateDcCipherEnvelope>;
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

  /**
   * Cut 1.4 / K-PROTO-PLAIN — refuse plaintext body when T3 wire is required.
   * Use `sendEnvelope` or `sendPrivateTrustT3Message` for product send.
   */
  sendMessage: async (params): Promise<CanonicalMessage> => {
    if (privateDcRequiresT3Wire()) {
      throw new Error(PRIVATE_DC_T3_PLAINTEXT_REFUSED);
    }
    const session = requireSession(params.profileId);
    return privateDcSendMessage(session, {
      conversationId: params.conversationId,
      body: params.body,
    }, fetchImpl);
  },

  sendEnvelope: async (params): Promise<PrivateDcCipherEnvelope> => {
    const session = requireSession(params.profileId);
    return privateDcSendEnvelope(session, {
      conversationId: params.conversationId,
      envelope: params.envelope,
      clientMessageId: params.clientMessageId,
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
