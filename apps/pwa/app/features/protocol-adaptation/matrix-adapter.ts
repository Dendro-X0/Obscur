import type { DmConversation, Message } from "@/app/features/messaging/types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { LoadDmKernelThreadParams } from "@/app/features/dm-kernel/dm-kernel-thread-port";
import {
  matrixListRoomMessages,
  matrixLoginPassword,
  matrixSendRoomText,
  matrixSyncRooms,
  matrixWhoami,
  type MatrixClientSession,
} from "./matrix-cs-client";
import {
  clearMatrixSession,
  readMatrixSession,
  writeMatrixSession,
  type MatrixSession,
} from "./matrix-session";
import type {
  CanonicalConversation,
  CanonicalMessage,
  ProtocolAdapter,
  ProtocolCapabilities,
  TransportId,
} from "./types";

let connectedTransport: TransportId | null = null;

const requireSession = (profileId?: string): MatrixClientSession => {
  const session = readMatrixSession(profileId);
  if (!session) {
    throw new Error("MatrixAdapter: no session — log in via Settings → Protocols");
  }
  return session;
};

const roomToDmConversation = (room: Readonly<{
  roomId: string;
  title: string;
  lastMessagePreview: string;
  lastMessageAtUnixMs: number;
}>): DmConversation => ({
  kind: "dm",
  id: room.roomId,
  displayName: room.title,
  // Room id in pubkey slot so composer peerPublicKeyInput routes Matrix send (starts with "!").
  pubkey: room.roomId as PublicKeyHex,
  lastMessage: room.lastMessagePreview,
  unreadCount: 0,
  lastMessageTime: new Date(room.lastMessageAtUnixMs || Date.now()),
});

const timelineToMessage = (
  entry: Readonly<{
    eventId: string;
    roomId: string;
    body: string;
    sentAtUnixMs: number;
    senderUserId: string;
  }>,
  myUserId: string,
): Message => ({
  id: entry.eventId,
  kind: "user",
  content: entry.body,
  timestamp: new Date(entry.sentAtUnixMs || Date.now()),
  isOutgoing: entry.senderUserId === myUserId,
  status: "delivered",
  conversationId: entry.roomId,
  eventId: entry.eventId,
});

const timelineToCanonical = (
  entry: Readonly<{
    eventId: string;
    roomId: string;
    body: string;
    sentAtUnixMs: number;
    senderUserId: string;
  }>,
  myUserId: string,
): CanonicalMessage => ({
  id: entry.eventId,
  conversationId: entry.roomId,
  body: entry.body,
  sentAtUnixMs: entry.sentAtUnixMs || Date.now(),
  direction: entry.senderUserId === myUserId ? "out" : "in",
  status: "delivered",
});

export const matrixLogin = async (params: Readonly<{
  homeserverUrl: string;
  userId: string;
  password: string;
  profileId?: string;
  fetchImpl?: typeof fetch;
}>): Promise<MatrixSession> => {
  const result = await matrixLoginPassword({
    homeserverUrl: params.homeserverUrl,
    userId: params.userId,
    password: params.password,
    fetchImpl: params.fetchImpl,
  });
  const session: MatrixSession = {
    homeserverUrl: result.homeserverUrl,
    userId: result.userId,
    accessToken: result.accessToken,
    deviceId: result.deviceId,
  };
  writeMatrixSession(session, params.profileId);
  return session;
};

/** Import session from an existing access token (SSO / Element). Validates via whoami. */
export const matrixLoginAccessToken = async (params: Readonly<{
  homeserverUrl: string;
  accessToken: string;
  /** Optional hint; whoami user_id wins when present. */
  userId?: string;
  profileId?: string;
  fetchImpl?: typeof fetch;
}>): Promise<MatrixSession> => {
  const homeserverUrl = params.homeserverUrl.trim().replace(/\/+$/, "");
  const accessToken = params.accessToken.trim();
  if (!homeserverUrl || !accessToken) {
    throw new Error("Matrix access-token login: homeserver and token required");
  }
  const whoami = await matrixWhoami({
    homeserverUrl,
    accessToken,
    fetchImpl: params.fetchImpl,
  });
  const session: MatrixSession = {
    homeserverUrl,
    userId: whoami.userId,
    accessToken,
    deviceId: whoami.deviceId,
  };
  writeMatrixSession(session, params.profileId);
  return session;
};

export const matrixLogout = (profileId?: string): void => {
  clearMatrixSession(profileId);
};

/**
 * C2 Matrix adapter — HS REST only; never dual-writes to Nostr.
 */
export const matrixAdapter: ProtocolAdapter & {
  listDmConversations: (profileId: string) => Promise<ReadonlyArray<DmConversation>>;
  listDmMessages: (params: LoadDmKernelThreadParams) => Promise<ReadonlyArray<Message>>;
  login: typeof matrixLogin;
  loginAccessToken: typeof matrixLoginAccessToken;
  logout: typeof matrixLogout;
} = {
  id: "matrix",

  capabilities: (): ProtocolCapabilities => ({
    dms: true,
    groups: true,
    reactions: false,
    media: false,
  }),

  connect: async (transport: TransportId): Promise<void> => {
    // Transport plane is orthogonal (C1 Tor/clearnet). Matrix uses HTTPS; SOCKS is OS/gateway.
    connectedTransport = transport;
    requireSession();
  },

  disconnect: async (): Promise<void> => {
    connectedTransport = null;
  },

  listConversations: async (profileId: string): Promise<ReadonlyArray<CanonicalConversation>> => {
    const session = requireSession(profileId);
    const rooms = await matrixSyncRooms(session);
    return rooms.map((room) => ({ id: room.roomId, title: room.title }));
  },

  listMessages: async (params): Promise<ReadonlyArray<CanonicalMessage>> => {
    const session = requireSession(params.profileId);
    const rows = await matrixListRoomMessages(session, params.conversationId, {
      limit: params.limit,
    });
    return rows.map((row) => timelineToCanonical(row, session.userId));
  },

  sendMessage: async (params): Promise<CanonicalMessage> => {
    const session = requireSession();
    const sent = await matrixSendRoomText(session, {
      roomId: params.conversationId,
      body: params.body,
    });
    return {
      id: sent.eventId,
      conversationId: params.conversationId,
      body: params.body,
      sentAtUnixMs: Date.now(),
      direction: "out",
      status: "sent",
    };
  },

  listDmConversations: async (profileId: string): Promise<ReadonlyArray<DmConversation>> => {
    const session = requireSession(profileId);
    const rooms = await matrixSyncRooms(session);
    return rooms.map(roomToDmConversation);
  },

  listDmMessages: async (params: LoadDmKernelThreadParams): Promise<ReadonlyArray<Message>> => {
    const session = requireSession(params.profileId);
    const rows = await matrixListRoomMessages(session, params.conversationId, {
      limit: params.limit,
    });
    return rows.map((row) => timelineToMessage(row, session.userId));
  },

  login: matrixLogin,
  loginAccessToken: matrixLoginAccessToken,
  logout: matrixLogout,
};

export const getMatrixConnectedTransport = (): TransportId | null => connectedTransport;
