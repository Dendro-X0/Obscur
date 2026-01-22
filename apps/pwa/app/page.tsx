"use client";

import type React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { AlertTriangle, Check, CheckCheck, Clock, Search } from "lucide-react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { EmptyState } from "./components/ui/empty-state";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { AppShell } from "./components/app-shell";
import { IdentityCard } from "./components/identity-card";
import { MessageLinkPreview } from "./components/message-link-preview";
import { MessageContent } from "./components/message-content";
import { SessionChip } from "./components/session-chip";
import { UserAvatarMenu } from "./components/user-avatar-menu";
import { cn } from "./lib/cn";
import { parsePublicKeyInput } from "./lib/parse-public-key-input";
import { useEnhancedDmController } from "./lib/use-enhanced-dm-controller";
import { useBlocklist } from "./lib/use-blocklist";
import { useIdentity } from "./lib/use-identity";
import { usePeerTrust } from "./lib/use-peer-trust";
import { useRequestsInbox } from "./lib/use-requests-inbox";
import { useRelayList } from "./lib/use-relay-list";
import { useRelayPool } from "./lib/use-relay-pool";
import type { RelayConnection } from "./lib/relay-connection";
import { getNotificationsEnabled } from "./lib/notifications/get-notifications-enabled";
import { showDesktopNotification } from "./lib/notifications/show-desktop-notification";

const ONE_MINUTE_MS: number = 60_000;

const ONE_HOUR_MS: number = 60 * ONE_MINUTE_MS;

const ONE_DAY_MS: number = 24 * ONE_HOUR_MS;

const PROFILE_STORAGE_PREFIX: string = "dweb.nostr.pwa.profile";

const LEGACY_PROFILE_STORAGE_KEY: string = "dweb.nostr.pwa.profile";

const LAST_SEEN_STORAGE_PREFIX: string = "dweb.nostr.pwa.last-seen";

const DEFAULT_VISIBLE_MESSAGES: number = 50;

const LOAD_EARLIER_STEP: number = 50;

const MAX_PERSISTED_MESSAGES_PER_CONVERSATION: number = 500;

const isRecordValue = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const getProfileStorageKey = (publicKeyHex: string): string => `${PROFILE_STORAGE_PREFIX}.${publicKeyHex}`;

const getLastSeenStorageKey = (pk: PublicKeyHex): string => `${LAST_SEEN_STORAGE_PREFIX}.${pk}`;

const loadLastSeen = (pk: PublicKeyHex): LastSeenByConversationId => {
  try {
    const raw: string | null = localStorage.getItem(getLastSeenStorageKey(pk));
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecordValue(parsed)) {
      return {};
    }
    const out: Record<string, number> = {};
    Object.entries(parsed).forEach(([conversationId, value]: [string, unknown]): void => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return;
      }
      out[conversationId] = value;
    });
    return out;
  } catch {
    return {};
  }
};

const saveLastSeen = (pk: PublicKeyHex, next: LastSeenByConversationId): void => {
  try {
    localStorage.setItem(getLastSeenStorageKey(pk), JSON.stringify(next));
  } catch {
    return;
  }
};

const updateLastSeen = (params: Readonly<{ publicKeyHex: PublicKeyHex; conversationId: string; seenAtMs: number }>): void => {
  const existing: LastSeenByConversationId = loadLastSeen(params.publicKeyHex);
  if ((existing[params.conversationId] ?? 0) >= params.seenAtMs) {
    return;
  }
  const next: Record<string, number> = { ...existing, [params.conversationId]: params.seenAtMs };
  saveLastSeen(params.publicKeyHex, next);
};

let nextContactId: number = 4;

let nextGroupId: number = 1;

const INITIAL_MESSAGE_ID: number = 1000;

let nextMessageId: number = INITIAL_MESSAGE_ID;

const createContactId = (): string => {
  const id: string = String(nextContactId);
  nextContactId += 1;
  return id;
};

const createGroupId = (): string => {
  const id: string = `g${nextGroupId}`;
  nextGroupId += 1;
  return id;
};

const createMessageId = (): string => {
  const id: string = `m${nextMessageId}`;
  nextMessageId += 1;
  return id;
};

type NowMsListener = () => void;

const nowMsListeners: Set<NowMsListener> = new Set<NowMsListener>();

let nowMsSnapshot: number | null = null;

let isNowMsScheduled: boolean = false;

const subscribeNowMs = (listener: NowMsListener): (() => void) => {
  nowMsListeners.add(listener);
  if (!isNowMsScheduled) {
    isNowMsScheduled = true;
    queueMicrotask((): void => {
      nowMsSnapshot = Date.now();
      nowMsListeners.forEach((nextListener: NowMsListener): void => {
        nextListener();
      });
    });
  }
  return (): void => {
    nowMsListeners.delete(listener);
  };
};

const getNowMsSnapshot = (): number | null => nowMsSnapshot;

const getNowMsServerSnapshot = (): number | null => null;

const DEFAULT_PROFILE_USERNAME: string = "Anon";
const ONBOARDING_DISMISSED_STORAGE_KEY: string = "dweb.nostr.pwa.ui.onboardingDismissed";

type RelayStatusSummary = Readonly<{
  total: number;
  openCount: number;
  errorCount: number;
}>;

type DmConversation = Readonly<{
  kind: "dm";
  id: string;
  displayName: string;
  pubkey: PublicKeyHex;
  lastMessage: string;
  unreadCount: number;
  lastMessageTime: Date;
}>;

type GroupConversation = Readonly<{
  kind: "group";
  id: string;
  displayName: string;
  memberPubkeys: ReadonlyArray<string>;
  lastMessage: string;
  unreadCount: number;
  lastMessageTime: Date;
}>;

type Conversation = DmConversation | GroupConversation;

type MessageStatus = "delivered" | "sending" | "accepted" | "rejected";

type StatusIcon = (props: Readonly<{ className?: string }>) => React.JSX.Element;

type StatusUi = Readonly<{
  label: string;
  icon: StatusIcon;
}>;

type MessageKind = "user" | "command";

type AttachmentKind = "image" | "video";

type Attachment = Readonly<{
  kind: AttachmentKind;
  url: string;
  contentType: string;
  fileName: string;
}>;

type ReplyTo = Readonly<{
  messageId: string;
  previewText: string;
}>;

type MediaItem = Readonly<{
  messageId: string;
  attachment: Attachment;
  timestamp: Date;
}>;

type LastSeenByConversationId = Readonly<Record<string, number>>;

type ReactionEmoji = "👍" | "❤️" | "😂" | "🔥" | "👏";

type ReactionsByEmoji = Readonly<Record<ReactionEmoji, number>>;

const createEmptyReactions = (): Record<ReactionEmoji, number> => ({
  "👍": 0,
  "❤️": 0,
  "😂": 0,
  "🔥": 0,
  "👏": 0,
});

const toReactionsByEmoji = (value: Record<ReactionEmoji, number>): ReactionsByEmoji => ({
  "👍": value["👍"],
  "❤️": value["❤️"],
  "😂": value["😂"],
  "🔥": value["🔥"],
  "👏": value["👏"],
});

type Message = Readonly<{
  id: string;
  kind: MessageKind;
  content: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: MessageStatus;
  attachment?: Attachment;
  replyTo?: ReplyTo;
  reactions?: ReactionsByEmoji;
  deletedAt?: Date;
}>;

type UnreadByConversationId = Readonly<Record<string, number>>;

type ContactOverridesByContactId = Readonly<
  Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>>
>;

type MessagesByConversationId = Readonly<Record<string, ReadonlyArray<Message>>>;

type UploadApiResponse = Readonly<
  | {
    ok: true;
    url: string;
    contentType: string;
  }
  | {
    ok: false;
    error: string;
  }
>;

type PersistedDmConversation = Readonly<{
  id: string;
  displayName: string;
  pubkey: string;
  lastMessage: string;
  unreadCount: number;
  lastMessageTimeMs: number;
}>;

type PersistedGroupConversation = Readonly<{
  id: string;
  displayName: string;
  memberPubkeys: ReadonlyArray<string>;
  lastMessage: string;
  unreadCount: number;
  lastMessageTimeMs: number;
}>;

type PersistedMessage = Readonly<{
  id: string;
  kind?: MessageKind;
  content: string;
  timestampMs: number;
  isOutgoing: boolean;
  status: MessageStatus;
  attachment?: Attachment;
  replyTo?: ReplyTo;
  reactions?: ReactionsByEmoji;
  deletedAtMs?: number;
}>;

type DeleteCommandMessage = Readonly<{ type: "delete"; targetMessageId: string }>;

const COMMAND_MESSAGE_PREFIX: string = "__dweb_cmd__";

const isMessageKind = (value: unknown): value is MessageKind => value === "user" || value === "command";

const createDeleteCommandMessage = (targetMessageId: string): DeleteCommandMessage => ({ type: "delete", targetMessageId });

const encodeCommandMessage = (payload: DeleteCommandMessage): string => `${COMMAND_MESSAGE_PREFIX}${JSON.stringify(payload)}`;

const parseCommandMessage = (content: string): DeleteCommandMessage | null => {
  if (!content.startsWith(COMMAND_MESSAGE_PREFIX)) {
    return null;
  }
  const raw: string = content.slice(COMMAND_MESSAGE_PREFIX.length);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    const type: unknown = parsed.type;
    const targetMessageId: unknown = parsed.targetMessageId;
    if (type !== "delete" || !isString(targetMessageId)) {
      return null;
    }
    return { type, targetMessageId };
  } catch {
    return null;
  }
};

const isVisibleUserMessage = (message: Message): boolean => message.kind === "user";

const highlightText = (params: Readonly<{ text: string; query: string }>): React.ReactNode => {
  const query: string = params.query.trim();
  if (query.length === 0) {
    return params.text;
  }
  const lowerText: string = params.text.toLowerCase();
  const lowerQuery: string = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor: number = 0;
  while (cursor < params.text.length) {
    const index: number = lowerText.indexOf(lowerQuery, cursor);
    if (index < 0) {
      parts.push(params.text.slice(cursor));
      break;
    }
    if (index > cursor) {
      parts.push(params.text.slice(cursor, index));
    }
    const matchEnd: number = index + query.length;
    parts.push(
      <mark key={`${index}-${matchEnd}`} className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">
        {params.text.slice(index, matchEnd)}
      </mark>
    );
    cursor = matchEnd;
  }
  return <>{parts}</>;
};

type PersistedContactOverride = Readonly<{ lastMessage: string; lastMessageTimeMs: number }>;

type PersistedChatState = Readonly<{
  version: number;
  createdContacts: ReadonlyArray<PersistedDmConversation>;
  createdGroups: ReadonlyArray<PersistedGroupConversation>;
  unreadByConversationId: Readonly<Record<string, number>>;
  contactOverridesByContactId: Readonly<Record<string, PersistedContactOverride>>;
  messagesByConversationId: Readonly<Record<string, ReadonlyArray<PersistedMessage>>>;
}>;

const PERSISTED_CHAT_STATE_VERSION: number = 2;

const PERSISTED_CHAT_STATE_STORAGE_KEY: string = "dweb.nostr.pwa.chatState";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const parseAttachment = (value: unknown): Attachment | null => {
  if (!isRecord(value)) {
    return null;
  }
  const kind: unknown = value.kind;
  const url: unknown = value.url;
  const contentType: unknown = value.contentType;
  const fileName: unknown = value.fileName;
  if (kind !== "image" && kind !== "video") {
    return null;
  }
  if (!isString(url) || !isString(contentType) || !isString(fileName)) {
    return null;
  }
  return { kind, url, contentType, fileName };
};

const parseReplyTo = (value: unknown): ReplyTo | null => {
  if (!isRecord(value)) {
    return null;
  }
  const messageId: unknown = value.messageId;
  const previewText: unknown = value.previewText;
  if (!isString(messageId) || !isString(previewText)) {
    return null;
  }
  return { messageId, previewText };
};

const isReactionEmoji = (value: unknown): value is ReactionEmoji =>
  value === "👍" || value === "❤️" || value === "😂" || value === "🔥" || value === "👏";

const parseReactionsByEmoji = (value: unknown): ReactionsByEmoji | null => {
  if (!isRecord(value)) {
    return null;
  }
  const result: Partial<Record<ReactionEmoji, number>> = {};
  Object.entries(value).forEach(([key, rawCount]: [string, unknown]): void => {
    if (!isReactionEmoji(key)) {
      return;
    }
    if (!isNumber(rawCount)) {
      return;
    }
    if (rawCount <= 0) {
      return;
    }
    result[key] = rawCount;
  });
  const entries: ReadonlyArray<readonly [ReactionEmoji, number]> = Object.entries(result)
    .filter(([emoji, count]: [string, number | undefined]): boolean => isReactionEmoji(emoji) && isNumber(count))
    .map(([emoji, count]: [string, number | undefined]): readonly [ReactionEmoji, number] => [emoji as ReactionEmoji, count ?? 0]);
  if (entries.length === 0) {
    return null;
  }
  const typed: Record<ReactionEmoji, number> = {
    "👍": 0,
    "❤️": 0,
    "😂": 0,
    "🔥": 0,
    "👏": 0,
  };
  entries.forEach(([emoji, count]: readonly [ReactionEmoji, number]): void => {
    typed[emoji] = count;
  });
  const cleaned: Record<ReactionEmoji, number> = {
    "👍": typed["👍"],
    "❤️": typed["❤️"],
    "😂": typed["😂"],
    "🔥": typed["🔥"],
    "👏": typed["👏"],
  };
  const nonZeroEntries: ReadonlyArray<readonly [ReactionEmoji, number]> = (Object.entries(cleaned) as ReadonlyArray<readonly [ReactionEmoji, number]>).filter(([, count]: readonly [ReactionEmoji, number]): boolean => count > 0);
  if (nonZeroEntries.length === 0) {
    return null;
  }
  const final: Record<ReactionEmoji, number> = {
    "👍": 0,
    "❤️": 0,
    "😂": 0,
    "🔥": 0,
    "👏": 0,
  };
  nonZeroEntries.forEach(([emoji, count]: readonly [ReactionEmoji, number]): void => {
    final[emoji] = count;
  });
  return final;
};

const parsePersistedDmConversation = (value: unknown): PersistedDmConversation | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id: unknown = value.id;
  const displayName: unknown = value.displayName;
  const pubkey: unknown = value.pubkey;
  const lastMessage: unknown = value.lastMessage;
  const unreadCount: unknown = value.unreadCount;
  const lastMessageTimeMs: unknown = value.lastMessageTimeMs;
  if (!isString(id) || !isString(displayName) || !isString(pubkey) || !isString(lastMessage)) {
    return null;
  }
  if (!isNumber(unreadCount) || !isNumber(lastMessageTimeMs)) {
    return null;
  }
  return { id, displayName, pubkey, lastMessage, unreadCount, lastMessageTimeMs };
};

const parsePersistedGroupConversation = (value: unknown): PersistedGroupConversation | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id: unknown = value.id;
  const displayName: unknown = value.displayName;
  const memberPubkeys: unknown = value.memberPubkeys;
  const lastMessage: unknown = value.lastMessage;
  const unreadCount: unknown = value.unreadCount;
  const lastMessageTimeMs: unknown = value.lastMessageTimeMs;
  if (!isString(id) || !isString(displayName) || !Array.isArray(memberPubkeys) || !isString(lastMessage)) {
    return null;
  }
  const parsedMemberPubkeys: string[] = memberPubkeys.filter((v: unknown): v is string => isString(v) && v.trim().length > 0).map((v: string): string => v.trim());
  if (parsedMemberPubkeys.length === 0) {
    return null;
  }
  if (!isNumber(unreadCount) || !isNumber(lastMessageTimeMs)) {
    return null;
  }
  return { id, displayName, memberPubkeys: parsedMemberPubkeys, lastMessage, unreadCount, lastMessageTimeMs };
};

const parsePersistedContactOverride = (value: unknown): PersistedContactOverride | null => {
  if (!isRecord(value)) {
    return null;
  }
  const lastMessage: unknown = value.lastMessage;
  const lastMessageTimeMs: unknown = value.lastMessageTimeMs;
  if (!isString(lastMessage) || !isNumber(lastMessageTimeMs)) {
    return null;
  }
  return { lastMessage, lastMessageTimeMs };
};

const parsePersistedMessage = (value: unknown): PersistedMessage | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id: unknown = value.id;
  const kind: unknown = value.kind;
  const content: unknown = value.content;
  const timestampMs: unknown = value.timestampMs;
  const isOutgoing: unknown = value.isOutgoing;
  const status: unknown = value.status;
  const attachment: unknown = value.attachment;
  const replyTo: unknown = value.replyTo;
  const reactions: unknown = value.reactions;
  const deletedAtMs: unknown = value.deletedAtMs;
  if (!isString(id) || !isString(content) || !isNumber(timestampMs) || !isBoolean(isOutgoing)) {
    return null;
  }
  if (kind !== undefined && !isMessageKind(kind)) {
    return null;
  }
  if (status !== "delivered" && status !== "accepted" && status !== "rejected") {
    return null;
  }
  const parsedAttachment: Attachment | null = attachment === undefined ? null : parseAttachment(attachment);
  if (attachment !== undefined && !parsedAttachment) {
    return null;
  }
  const parsedReplyTo: ReplyTo | null = replyTo === undefined ? null : parseReplyTo(replyTo);
  if (replyTo !== undefined && !parsedReplyTo) {
    return null;
  }
  const parsedReactions: ReactionsByEmoji | null = reactions === undefined ? null : parseReactionsByEmoji(reactions);
  if (reactions !== undefined && !parsedReactions) {
    return null;
  }
  const parsedDeletedAtMs: number | undefined = isNumber(deletedAtMs) ? deletedAtMs : undefined;
  return {
    id,
    ...(kind ? { kind } : {}),
    content,
    timestampMs,
    isOutgoing,
    status,
    ...(parsedAttachment ? { attachment: parsedAttachment } : {}),
    ...(parsedReplyTo ? { replyTo: parsedReplyTo } : {}),
    ...(parsedReactions ? { reactions: parsedReactions } : {}),
    ...(parsedDeletedAtMs ? { deletedAtMs: parsedDeletedAtMs } : {}),
  };
};

const parsePersistedChatState = (value: unknown): PersistedChatState | null => {
  if (!isRecord(value)) {
    return null;
  }
  const version: unknown = value.version;
  const createdContacts: unknown = value.createdContacts;
  const createdGroups: unknown = value.createdGroups;
  const unreadByConversationId: unknown = value.unreadByConversationId;
  const unreadByContactId: unknown = value.unreadByContactId;
  const contactOverridesByContactId: unknown = value.contactOverridesByContactId;
  const messagesByConversationId: unknown = value.messagesByConversationId;
  const messagesByContactId: unknown = value.messagesByContactId;
  if (!isNumber(version) || (version !== 1 && version !== PERSISTED_CHAT_STATE_VERSION)) {
    return null;
  }
  if (!Array.isArray(createdContacts) || !isRecord(contactOverridesByContactId)) {
    return null;
  }
  const parsedCreatedContacts: PersistedDmConversation[] = createdContacts
    .map((c: unknown): PersistedDmConversation | null => parsePersistedDmConversation(c))
    .filter((c: PersistedDmConversation | null): c is PersistedDmConversation => c !== null);
  const parsedCreatedGroups: PersistedGroupConversation[] = Array.isArray(createdGroups)
    ? createdGroups
      .map((g: unknown): PersistedGroupConversation | null => parsePersistedGroupConversation(g))
      .filter((g: PersistedGroupConversation | null): g is PersistedGroupConversation => g !== null)
    : [];
  const parsedUnreadByConversationId: Record<string, number> = {};
  const unreadSource: unknown = version === 1 ? unreadByContactId : unreadByConversationId;
  if (isRecord(unreadSource)) {
    Object.entries(unreadSource).forEach(([key, v]: [string, unknown]): void => {
      if (isNumber(v)) {
        parsedUnreadByConversationId[key] = v;
      }
    });
  }
  const parsedOverridesByContactId: Record<string, PersistedContactOverride> = {};
  Object.entries(contactOverridesByContactId).forEach(([key, v]: [string, unknown]): void => {
    const parsed: PersistedContactOverride | null = parsePersistedContactOverride(v);
    if (parsed) {
      parsedOverridesByContactId[key] = parsed;
    }
  });
  const parsedMessagesByConversationId: Record<string, ReadonlyArray<PersistedMessage>> = {};
  const messagesSource: unknown = version === 1 ? messagesByContactId : messagesByConversationId;
  if (!isRecord(messagesSource)) {
    return null;
  }
  Object.entries(messagesSource).forEach(([conversationId, listValue]: [string, unknown]): void => {
    if (!Array.isArray(listValue)) {
      return;
    }
    const parsedList: PersistedMessage[] = listValue
      .map((m: unknown): PersistedMessage | null => parsePersistedMessage(m))
      .filter((m: PersistedMessage | null): m is PersistedMessage => m !== null);
    parsedMessagesByConversationId[conversationId] = parsedList;
  });
  return {
    version: PERSISTED_CHAT_STATE_VERSION,
    createdContacts: parsedCreatedContacts,
    createdGroups: parsedCreatedGroups,
    unreadByConversationId: parsedUnreadByConversationId,
    contactOverridesByContactId: parsedOverridesByContactId,
    messagesByConversationId: parsedMessagesByConversationId,
  };
};

const loadPersistedChatState = (): PersistedChatState | null => {
  try {
    const raw: string | null = localStorage.getItem(PERSISTED_CHAT_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw) as unknown;
    return parsePersistedChatState(parsed);
  } catch {
    return null;
  }
};

const savePersistedChatState = (state: PersistedChatState): void => {
  try {
    localStorage.setItem(PERSISTED_CHAT_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
};

const toPersistedDmConversation = (contact: DmConversation): PersistedDmConversation => ({
  id: contact.id,
  displayName: contact.displayName,
  pubkey: String(contact.pubkey),
  lastMessage: contact.lastMessage,
  unreadCount: contact.unreadCount,
  lastMessageTimeMs: contact.lastMessageTime.getTime(),
});

const fromPersistedDmConversation = (contact: PersistedDmConversation): DmConversation | null => {
  const parsed = parsePublicKeyInput(contact.pubkey);
  if (!parsed.ok) {
    return null;
  }
  return {
    kind: "dm",
    id: contact.id,
    displayName: contact.displayName,
    pubkey: parsed.publicKeyHex,
    lastMessage: contact.lastMessage,
    unreadCount: contact.unreadCount,
    lastMessageTime: new Date(contact.lastMessageTimeMs),
  };
};

const toPersistedGroupConversation = (group: GroupConversation): PersistedGroupConversation => ({
  id: group.id,
  displayName: group.displayName,
  memberPubkeys: [...group.memberPubkeys],
  lastMessage: group.lastMessage,
  unreadCount: group.unreadCount,
  lastMessageTimeMs: group.lastMessageTime.getTime(),
});

const fromPersistedGroupConversation = (group: PersistedGroupConversation): GroupConversation => ({
  kind: "group",
  id: group.id,
  displayName: group.displayName,
  memberPubkeys: [...group.memberPubkeys],
  lastMessage: group.lastMessage,
  unreadCount: group.unreadCount,
  lastMessageTime: new Date(group.lastMessageTimeMs),
});

const toPersistedOverridesByContactId = (
  overrides: ContactOverridesByContactId
): Readonly<Record<string, PersistedContactOverride>> => {
  const result: Record<string, PersistedContactOverride> = {};
  Object.entries(overrides).forEach(([key, value]: [string, Readonly<{ lastMessage: string; lastMessageTime: Date }>]): void => {
    result[key] = { lastMessage: value.lastMessage, lastMessageTimeMs: value.lastMessageTime.getTime() };
  });
  return result;
};

const fromPersistedOverridesByContactId = (
  overrides: Readonly<Record<string, PersistedContactOverride>>
): ContactOverridesByContactId => {
  const result: Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>> = {};
  Object.entries(overrides).forEach(([key, value]: [string, PersistedContactOverride]): void => {
    result[key] = { lastMessage: value.lastMessage, lastMessageTime: new Date(value.lastMessageTimeMs) };
  });
  return result;
};

const toPersistedMessagesByConversationId = (messagesByConversationId: MessagesByConversationId): Readonly<Record<string, ReadonlyArray<PersistedMessage>>> => {
  const result: Record<string, ReadonlyArray<PersistedMessage>> = {};
  Object.entries(messagesByConversationId).forEach(([conversationId, messages]: [string, ReadonlyArray<Message>]): void => {
    const sorted: ReadonlyArray<Message> = [...messages].sort((a: Message, b: Message): number => a.timestamp.getTime() - b.timestamp.getTime());
    const limited: ReadonlyArray<Message> = sorted.slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION);
    result[conversationId] = limited.map((m: Message): PersistedMessage => ({
      id: m.id,
      ...(m.kind !== "user" ? { kind: m.kind } : {}),
      content: m.content,
      timestampMs: m.timestamp.getTime(),
      isOutgoing: m.isOutgoing,
      status: m.status,
      ...(m.attachment ? { attachment: m.attachment } : {}),
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      ...(m.reactions ? { reactions: m.reactions } : {}),
      ...(m.deletedAt ? { deletedAtMs: m.deletedAt.getTime() } : {}),
    }));
  });
  return result;
};

const fromPersistedMessagesByConversationId = (messagesByConversationId: Readonly<Record<string, ReadonlyArray<PersistedMessage>>>): MessagesByConversationId => {
  const result: Record<string, ReadonlyArray<Message>> = {};
  Object.entries(messagesByConversationId).forEach(([conversationId, messages]: [string, ReadonlyArray<PersistedMessage>]): void => {
    const parsed: ReadonlyArray<Message> = messages.map((m: PersistedMessage): Message => ({
      id: m.id,
      kind: m.kind ?? "user",
      content: m.content,
      timestamp: new Date(m.timestampMs),
      isOutgoing: m.isOutgoing,
      status: m.status,
      ...(m.attachment ? { attachment: m.attachment } : {}),
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      ...(m.reactions ? { reactions: m.reactions } : {}),
      ...(m.deletedAtMs ? { deletedAt: new Date(m.deletedAtMs) } : {}),
    }));
    result[conversationId] = [...parsed]
      .sort((a: Message, b: Message): number => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION);
  });
  return result;
};

const syncIdCountersFromState = (params: Readonly<{ createdContacts: ReadonlyArray<DmConversation>; createdGroups: ReadonlyArray<GroupConversation>; messagesByConversationId: MessagesByConversationId }>): void => {
  const contactIds: number[] = params.createdContacts
    .map((c: DmConversation): number => Number.parseInt(c.id, 10))
    .filter((n: number): boolean => Number.isFinite(n));
  const maxContactId: number = contactIds.length > 0 ? Math.max(...contactIds) : nextContactId - 1;
  nextContactId = Math.max(nextContactId, maxContactId + 1);
  const groupNumbers: number[] = params.createdGroups
    .map((g: GroupConversation): number => {
      const match: RegExpMatchArray | null = g.id.match(/^g(\d+)$/);
      return match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
    })
    .filter((n: number): boolean => Number.isFinite(n));
  const maxGroupId: number = groupNumbers.length > 0 ? Math.max(...groupNumbers) : nextGroupId - 1;
  nextGroupId = Math.max(nextGroupId, maxGroupId + 1);
  const messageNumbers: number[] = Object.values(params.messagesByConversationId)
    .flatMap((messages: ReadonlyArray<Message>): ReadonlyArray<number> =>
      messages
        .map((m: Message): number => {
          const match: RegExpMatchArray | null = m.id.match(/^m(\d+)$/);
          return match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
        })
        .filter((n: number): boolean => Number.isFinite(n))
    );
  const maxMessageId: number = messageNumbers.length > 0 ? Math.max(...messageNumbers) : INITIAL_MESSAGE_ID - 1;
  nextMessageId = Math.max(nextMessageId, maxMessageId + 1);
};

const applyContactOverrides = (
  conversation: Conversation,
  overridesByContactId: ContactOverridesByContactId
): Conversation => {
  if (conversation.kind === "group") {
    return conversation;
  }
  const overrides: Readonly<{ lastMessage: string; lastMessageTime: Date }> | undefined =
    overridesByContactId[conversation.id];
  if (!overrides) {
    return conversation;
  }
  return {
    ...conversation,
    lastMessage: overrides.lastMessage,
    lastMessageTime: overrides.lastMessageTime,
  };
};

function NostrMessengerContent() {
  const didHydrateFromStorageRef = useRef<boolean>(false);
  const handledIncomingDmIdsRef = useRef<Set<string>>(new Set<string>());
  const handledAcceptedOutgoingDmIdsRef = useRef<Set<string>>(new Set<string>());
  const handledRejectedOutgoingDmIdsRef = useRef<Set<string>>(new Set<string>());
  const handledSearchParamPubkeyRef = useRef<string | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const identity = useIdentity();
  const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const blocklist = useBlocklist({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const peerTrust = usePeerTrust({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const requestsInbox = useRequestsInbox({ publicKeyHex: identity.state.publicKeyHex ?? null });
  const isPeerBlocked = blocklist.isBlocked;
  const isPeerAccepted = peerTrust.isAccepted;
  const isPeerMuted = peerTrust.isMuted;
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState<boolean>(false);
  const [newChatPubkey, setNewChatPubkey] = useState<string>("");
  const [newChatDisplayName, setNewChatDisplayName] = useState<string>("");
  const [isNewGroupOpen, setIsNewGroupOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [newGroupMemberPubkeys, setNewGroupMemberPubkeys] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [unreadByConversationId, setUnreadByConversationId] = useState<UnreadByConversationId>({});
  const [contactOverridesByContactId, setContactOverridesByContactId] =
    useState<ContactOverridesByContactId>({});
  const [messagesByConversationId, setMessagesByConversationId] =
    useState<MessagesByConversationId>({});
  const [visibleMessageCountByConversationId, setVisibleMessageCountByConversationId] =
    useState<Readonly<Record<string, number>>>({});
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);
  const [pendingAttachmentPreviewUrl, setPendingAttachmentPreviewUrl] = useState<string | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [messageMenu, setMessageMenu] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
  const [reactionPicker, setReactionPicker] = useState<Readonly<{ messageId: string; x: number; y: number }> | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<Readonly<{ conversationId: string; messageId: string }> | null>(null);
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [createdContacts, setCreatedContacts] = useState<ReadonlyArray<DmConversation>>([]);
  const [createdGroups, setCreatedGroups] = useState<ReadonlyArray<GroupConversation>>([]);
  const nowMs: number | null = useSyncExternalStore(
    subscribeNowMs,
    getNowMsSnapshot,
    getNowMsServerSnapshot
  );

  const getActiveProfilePublicKeyHex = useCallback((): string => {
    return identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  }, [identity.state.publicKeyHex, identity.state.stored?.publicKeyHex]);

  const loadLegacyProfileUsername = (): string => {
    try {
      const raw: string | null = localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_PROFILE_USERNAME;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return DEFAULT_PROFILE_USERNAME;
      }
      const username: unknown = parsed.username;
      return isString(username) && username.trim() ? username.trim() : DEFAULT_PROFILE_USERNAME;
    } catch {
      return DEFAULT_PROFILE_USERNAME;
    }
  };

  const loadProfileUsername = useCallback((publicKeyHex: string): string => {
    if (typeof window === "undefined") {
      return DEFAULT_PROFILE_USERNAME;
    }
    const trimmedPublicKeyHex: string = publicKeyHex.trim();
    if (!trimmedPublicKeyHex) {
      return DEFAULT_PROFILE_USERNAME;
    }
    try {
      const raw: string | null = localStorage.getItem(getProfileStorageKey(trimmedPublicKeyHex));
      if (!raw) {
        return loadLegacyProfileUsername();
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) {
        return loadLegacyProfileUsername();
      }
      const username: unknown = parsed.username;
      return isString(username) && username.trim() ? username.trim() : DEFAULT_PROFILE_USERNAME;
    } catch {
      return loadLegacyProfileUsername();
    }
  }, []);

  useEffect((): void => {
    queueMicrotask((): void => {
      const publicKeyHex: string = getActiveProfilePublicKeyHex();
      void loadProfileUsername(publicKeyHex);
    });
  }, [getActiveProfilePublicKeyHex, loadProfileUsername]);

  const enabledRelayUrls: ReadonlyArray<string> = useMemo((): ReadonlyArray<string> => {
    return relayList.state.relays
      .filter((relay: Readonly<{ url: string; enabled: boolean }>): boolean => relay.enabled)
      .map((relay: Readonly<{ url: string; enabled: boolean }>): string => relay.url);
  }, [relayList.state.relays]);

  const relayPool = useRelayPool(enabledRelayUrls);
  const relayStatus = useMemo<RelayStatusSummary>(() => {
    const total: number = relayPool.connections.length;
    let openCount: number = 0;
    let errorCount: number = 0;
    relayPool.connections.forEach((connection: RelayConnection): void => {
      if (connection.status === "open") {
        openCount += 1;
      }
      if (connection.status === "error") {
        errorCount += 1;
      }
    });
    return { total, openCount, errorCount };
  }, [relayPool.connections]);

  const isIdentityUnlocked: boolean = identity.state.status === "unlocked";
  const isIdentityLocked: boolean = identity.state.status === "locked";

  const isRelayConnected: boolean = relayStatus.openCount > 0;
  const isStep1Done: boolean = isIdentityUnlocked;
  const isStep2Done: boolean = isRelayConnected;

  const myPublicKeyHex: PublicKeyHex | null = identity.state.status === "unlocked" ? identity.state.publicKeyHex ?? null : null;
  const myPrivateKeyHex: PrivateKeyHex | null = identity.state.status === "unlocked" ? identity.state.privateKeyHex ?? null : null;
  const dmController = useEnhancedDmController({ myPublicKeyHex, myPrivateKeyHex, pool: relayPool });

  const dismissOnboarding = (): void => {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_STORAGE_KEY, "1");
    } catch {
      return;
    }
    setShowOnboarding(false);
  };

  const handleCopyMyPubkey = (): void => {
    if (!myPublicKeyHex) {
      return;
    }
    void navigator.clipboard.writeText(myPublicKeyHex);
  };

  const handleCopyChatLink = (): void => {
    if (!myPublicKeyHex) {
      return;
    }
    const url: string = `${window.location.origin}/?pubkey=${encodeURIComponent(myPublicKeyHex)}`;
    void navigator.clipboard.writeText(url);
  };

  useEffect((): void => {
    const raw: string | null = searchParams.get("pubkey");
    const trimmed: string = (raw ?? "").trim();
    if (!trimmed) {
      return;
    }
    if (handledSearchParamPubkeyRef.current === trimmed) {
      return;
    }
    handledSearchParamPubkeyRef.current = trimmed;
    const parsed = parsePublicKeyInput(trimmed);
    if (!parsed.ok) {
      return;
    }
    queueMicrotask((): void => {
      setNewChatPubkey(parsed.publicKeyHex);
      setNewChatDisplayName("");
      setIsNewChatOpen(true);
      router.replace("/");
    });
  }, [router, searchParams]);

  useEffect((): void => {
    const accepted = dmController.state.messages
      .filter((m): boolean => m.isOutgoing)
      .filter((m): boolean => m.status === "accepted")
      .filter((m): boolean => !handledAcceptedOutgoingDmIdsRef.current.has(m.id));
    if (accepted.length === 0) {
      return;
    }
    accepted.forEach((m): void => {
      handledAcceptedOutgoingDmIdsRef.current.add(m.id);
    });
    const acceptedIds: ReadonlySet<string> = new Set(accepted.map((m): string => m.id));
    queueMicrotask((): void => {
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const next: Record<string, ReadonlyArray<Message>> = {};
        Object.entries(prev).forEach(([conversationId, messages]: [string, ReadonlyArray<Message>]): void => {
          const updated: ReadonlyArray<Message> = messages.map((msg: Message): Message => {
            if (!acceptedIds.has(msg.id)) {
              return msg;
            }
            if (msg.status === "accepted") {
              return msg;
            }
            return { ...msg, status: "accepted" };
          });
          next[conversationId] = updated;
        });
        return next;
      });
    });
  }, [dmController.state.messages]);

  useEffect((): void => {
    const rejected = dmController.state.messages
      .filter((m): boolean => m.isOutgoing)
      .filter((m): boolean => m.status === "rejected")
      .filter((m): boolean => !handledRejectedOutgoingDmIdsRef.current.has(m.id));
    if (rejected.length === 0) {
      return;
    }
    rejected.forEach((m): void => {
      handledRejectedOutgoingDmIdsRef.current.add(m.id);
    });
    const rejectedIds: ReadonlySet<string> = new Set(rejected.map((m): string => m.id));
    queueMicrotask((): void => {
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const next: Record<string, ReadonlyArray<Message>> = {};
        Object.entries(prev).forEach(([conversationId, messages]: [string, ReadonlyArray<Message>]): void => {
          const updated: ReadonlyArray<Message> = messages.map((msg: Message): Message => {
            if (!rejectedIds.has(msg.id)) {
              return msg;
            }
            if (msg.status === "rejected") {
              return msg;
            }
            return { ...msg, status: "rejected" };
          });
          next[conversationId] = updated;
        });
        return next;
      });
    });
  }, [dmController.state.messages]);

  useEffect((): void => {
    if (!isIdentityUnlocked) {
      return;
    }
    if (dmController.state.status !== "ready") {
      return;
    }
    const incoming = dmController.state.messages
      .filter((m): boolean => !m.isOutgoing)
      .map((m): Readonly<{ id: string; peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }> => ({
        id: m.id,
        peerPublicKeyHex: m.senderPubkey,
        plaintext: m.content,
        createdAtUnixSeconds: Math.floor(m.timestamp.getTime() / 1000),
      }))
      .filter((m): boolean => !isPeerBlocked({ publicKeyHex: m.peerPublicKeyHex }))
      .filter((m): boolean => !isPeerMuted({ publicKeyHex: m.peerPublicKeyHex }))
      .filter((m): boolean => !handledIncomingDmIdsRef.current.has(m.id));
    if (incoming.length === 0) {
      return;
    }
    incoming.forEach((dm): void => {
      handledIncomingDmIdsRef.current.add(dm.id);
    });

    const acceptedIncoming = incoming.filter((dm): boolean => isPeerAccepted({ publicKeyHex: dm.peerPublicKeyHex }));
    const requestIncoming = incoming.filter((dm): boolean => !isPeerAccepted({ publicKeyHex: dm.peerPublicKeyHex }));

    requestIncoming.forEach((dm): void => {
      requestsInbox.upsertIncoming({ peerPublicKeyHex: dm.peerPublicKeyHex, plaintext: dm.plaintext, createdAtUnixSeconds: dm.createdAtUnixSeconds });
    });

    if (acceptedIncoming.length === 0) {
      return;
    }

    const notificationsEnabled: boolean = getNotificationsEnabled().enabled;
    const shouldNotify: boolean =
      notificationsEnabled &&
      typeof document !== "undefined" &&
      document.hidden &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted";
    if (shouldNotify) {
      acceptedIncoming.forEach((dm): void => {
        const peer: string = dm.peerPublicKeyHex;
        showDesktopNotification({ title: "New message", body: `From ${peer.slice(0, 8)}…`, tag: `dm-${peer}` });
      });
    }

    const conversationIdByPeer: Map<PublicKeyHex, string> = new Map();
    createdContacts.forEach((c: DmConversation): void => {
      conversationIdByPeer.set(c.pubkey, c.id);
    });
    const newContacts: DmConversation[] = [];
    acceptedIncoming.forEach((dm): void => {
      if (conversationIdByPeer.has(dm.peerPublicKeyHex)) {
        return;
      }
      const id: string = createContactId();
      const displayName: string = dm.peerPublicKeyHex.slice(0, 8);
      const createdAt: Date = new Date(dm.createdAtUnixSeconds * 1000);
      const contact: DmConversation = { kind: "dm", id, displayName, pubkey: dm.peerPublicKeyHex, lastMessage: dm.plaintext, unreadCount: 0, lastMessageTime: createdAt };
      conversationIdByPeer.set(dm.peerPublicKeyHex, id);
      newContacts.push(contact);
    });
    queueMicrotask((): void => {
      if (newContacts.length > 0) {
        setCreatedContacts((prev: ReadonlyArray<DmConversation>): ReadonlyArray<DmConversation> => [...newContacts, ...prev]);
      }
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const next: Record<string, ReadonlyArray<Message>> = { ...prev };
        acceptedIncoming.forEach((dm): void => {
          const conversationId: string | undefined = conversationIdByPeer.get(dm.peerPublicKeyHex);
          if (!conversationId) {
            return;
          }
          const existing: ReadonlyArray<Message> = next[conversationId] ?? [];
          const timestamp: Date = new Date(dm.createdAtUnixSeconds * 1000);
          const message: Message = { id: dm.id, kind: "user", content: dm.plaintext, timestamp, isOutgoing: false, status: "delivered" };
          next[conversationId] = [...existing, message];
        });
        return next;
      });
      setContactOverridesByContactId((prev: ContactOverridesByContactId): ContactOverridesByContactId => {
        const next: Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>> = { ...prev };
        acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex; plaintext: string; createdAtUnixSeconds: number }>): void => {
          const conversationId: string | undefined = conversationIdByPeer.get(dm.peerPublicKeyHex);
          if (!conversationId) {
            return;
          }
          next[conversationId] = { lastMessage: dm.plaintext, lastMessageTime: new Date(dm.createdAtUnixSeconds * 1000) };
        });
        return next;
      });
      setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => {
        const next: Record<string, number> = { ...prev };
        acceptedIncoming.forEach((dm: Readonly<{ peerPublicKeyHex: PublicKeyHex }>): void => {
          const conversationId: string | undefined = conversationIdByPeer.get(dm.peerPublicKeyHex);
          if (!conversationId) {
            return;
          }
          if (selectedConversation?.id === conversationId) {
            return;
          }
          next[conversationId] = (next[conversationId] ?? 0) + 1;
        });
        return next;
      });
    });
  }, [createdContacts, dmController.state.messages, dmController.state.status, isIdentityUnlocked, isPeerAccepted, isPeerBlocked, isPeerMuted, requestsInbox, selectedConversation?.id]);

  useEffect((): void => {
    if (didHydrateFromStorageRef.current) {
      return;
    }
    const persisted: PersistedChatState | null = loadPersistedChatState();
    queueMicrotask((): void => {
      if (persisted) {
        const nextCreatedContacts: ReadonlyArray<DmConversation> = persisted.createdContacts
          .map((c: PersistedDmConversation): DmConversation | null => fromPersistedDmConversation(c))
          .filter((c: DmConversation | null): c is DmConversation => c !== null);
        const nextCreatedGroups: ReadonlyArray<GroupConversation> = persisted.createdGroups.map((g: PersistedGroupConversation): GroupConversation =>
          fromPersistedGroupConversation(g)
        );
        const nextMessagesByConversationId: MessagesByConversationId = fromPersistedMessagesByConversationId(persisted.messagesByConversationId);
        setCreatedContacts(nextCreatedContacts);
        setCreatedGroups(nextCreatedGroups);
        setUnreadByConversationId(persisted.unreadByConversationId);
        setContactOverridesByContactId(fromPersistedOverridesByContactId(persisted.contactOverridesByContactId));
        setMessagesByConversationId(nextMessagesByConversationId);
        syncIdCountersFromState({ createdContacts: nextCreatedContacts, createdGroups: nextCreatedGroups, messagesByConversationId: nextMessagesByConversationId });
      } else {
        syncIdCountersFromState({ createdContacts: [], createdGroups: [], messagesByConversationId: {} });
      }
      setHasHydrated(true);
      didHydrateFromStorageRef.current = true;
    });
  }, []);

  useEffect((): void => {
    if (!hasHydrated) {
      return;
    }
    queueMicrotask((): void => {
      try {
        const raw: string | null = localStorage.getItem(ONBOARDING_DISMISSED_STORAGE_KEY);
        setShowOnboarding(raw !== "1" && isIdentityLocked);
      } catch {
        setShowOnboarding(isIdentityLocked);
      }
    });
  }, [hasHydrated, isIdentityLocked]);

  useEffect((): (() => void) => {
    if (typeof window === "undefined") {
      return (): void => { };
    }
    const onStorage = (event: StorageEvent): void => {
      if (event.storageArea !== localStorage) {
        return;
      }
      const key: string | null = event.key;
      const publicKeyHex: string = getActiveProfilePublicKeyHex();
      const activeKey: string | null = publicKeyHex ? getProfileStorageKey(publicKeyHex) : null;
      if (key !== LEGACY_PROFILE_STORAGE_KEY && (!activeKey || key !== activeKey)) {
        return;
      }
      void loadProfileUsername(publicKeyHex);
    };
    window.addEventListener("storage", onStorage);
    return (): void => {
      window.removeEventListener("storage", onStorage);
    };
  }, [getActiveProfilePublicKeyHex, loadProfileUsername]);

  useEffect((): (() => void) => {
    const onGlobalKeyDown = (event: KeyboardEvent): void => {
      const isMac: boolean = navigator.platform.toLowerCase().includes("mac");
      const isMod: boolean = isMac ? event.metaKey : event.ctrlKey;
      if (isMod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      if (isNewChatOpen) {
        setIsNewChatOpen(false);
        setNewChatPubkey("");
        setNewChatDisplayName("");
      }
      if (isNewGroupOpen) {
        setIsNewGroupOpen(false);
        setNewGroupName("");
        setNewGroupMemberPubkeys("");
      }
      if (isMediaGalleryOpen) {
        setIsMediaGalleryOpen(false);
      }
      if (lightboxIndex !== null) {
        setLightboxIndex(null);
      }
      setMessageMenu(null);
      setReactionPicker(null);
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return (): void => {
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [isMediaGalleryOpen, isNewChatOpen, isNewGroupOpen, lightboxIndex]);

  useEffect((): void => {
    if (!didHydrateFromStorageRef.current) {
      return;
    }
    const persisted: PersistedChatState = {
      version: PERSISTED_CHAT_STATE_VERSION,
      createdContacts: createdContacts.map((c: DmConversation): PersistedDmConversation => toPersistedDmConversation(c)),
      createdGroups: createdGroups.map((g: GroupConversation): PersistedGroupConversation => toPersistedGroupConversation(g)),
      unreadByConversationId,
      contactOverridesByContactId: toPersistedOverridesByContactId(contactOverridesByContactId),
      messagesByConversationId: toPersistedMessagesByConversationId(messagesByConversationId),
    };
    savePersistedChatState(persisted);
  }, [createdContacts, createdGroups, unreadByConversationId, contactOverridesByContactId, messagesByConversationId]);

  const handleCopyPubkey = (pubkey: string) => {
    navigator.clipboard.writeText(pubkey);
  };

  const copyToClipboard = async (value: string): Promise<void> => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea: HTMLTextAreaElement = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const getReplyPreviewText = (message: Message): string => {
    if (message.content.trim()) {
      return message.content.trim().slice(0, 140);
    }
    if (message.attachment) {
      return message.attachment.fileName;
    }
    return "(message)";
  };

  const getLastMessageSnapshot = (params: Readonly<{ conversationId: string; messagesByConversationId: MessagesByConversationId }>): Readonly<{ lastMessage: string; lastMessageTime: Date }> | null => {
    const combined: ReadonlyArray<Message> = params.messagesByConversationId[params.conversationId] ?? [];
    const last: Message | undefined = [...combined].reverse().find((m: Message): boolean => isVisibleUserMessage(m));
    if (!last) {
      return null;
    }
    const lastMessage: string = last.deletedAt ? "Message deleted" : last.attachment ? last.attachment.fileName : last.content;
    return { lastMessage, lastMessageTime: last.timestamp };
  };

  const openMessageMenu = (params: Readonly<{ messageId: string; x: number; y: number }>): void => {
    setMessageMenu(params);
  };

  const closeMessageMenu = (): void => {
    setMessageMenu(null);
  };

  const closeReactionPicker = (): void => {
    setReactionPicker(null);
  };

  const deleteMessage = (params: Readonly<{ conversationId: string; messageId: string }>): void => {
    const existing: ReadonlyArray<Message> = messagesByConversationId[params.conversationId] ?? [];
    const now: Date = new Date();
    const nextMessagesBase: ReadonlyArray<Message> = existing.map((m: Message): Message => {
      if (m.id !== params.messageId) {
        return m;
      }
      return { ...m, deletedAt: now, content: "" };
    });
    const commandMessage: Message = {
      id: createMessageId(),
      kind: "command",
      content: encodeCommandMessage(createDeleteCommandMessage(params.messageId)),
      timestamp: now,
      isOutgoing: true,
      status: "accepted",
    };
    const nextMessages: ReadonlyArray<Message> = [...nextMessagesBase, commandMessage];
    const nextMessagesByConversationId: MessagesByConversationId = {
      ...messagesByConversationId,
      [params.conversationId]: nextMessages,
    };
    setMessagesByConversationId(nextMessagesByConversationId);
    const snapshot: Readonly<{ lastMessage: string; lastMessageTime: Date }> | null = getLastMessageSnapshot({ conversationId: params.conversationId, messagesByConversationId: nextMessagesByConversationId });
    setContactOverridesByContactId(
      (prev: ContactOverridesByContactId): ContactOverridesByContactId => {
        const next: Record<string, Readonly<{ lastMessage: string; lastMessageTime: Date }>> = { ...prev };
        if (snapshot) {
          next[params.conversationId] = snapshot;
        } else {
          delete next[params.conversationId];
        }
        return next;
      }
    );
  };

  const getMessageById = (params: Readonly<{ conversationId: string; messageId: string }>): Message | null => {
    const list: ReadonlyArray<Message> = messagesByConversationId[params.conversationId] ?? [];
    return list.find((m: Message): boolean => m.id === params.messageId) ?? null;
  };

  const getMediaItemsForConversation = (params: Readonly<{ conversationId: string }>): ReadonlyArray<MediaItem> => {
    const list: ReadonlyArray<Message> = messagesByConversationId[params.conversationId] ?? [];
    return list
      .filter((m: Message): m is Message & Readonly<{ attachment: Attachment }> => m.kind === "user" && Boolean(m.attachment))
      .map((m: Message & Readonly<{ attachment: Attachment }>): MediaItem => ({
        messageId: m.id,
        attachment: m.attachment,
        timestamp: m.timestamp,
      }));
  };

  const isDeletableMessageId = (messageId: string): boolean => {
    void messageId;
    return true;
  };

  const isReactableMessageId = (messageId: string): boolean => {
    void messageId;
    return true;
  };

  const toAbsoluteUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `${window.location.origin}${url}`;
  };

  useEffect((): (() => void) => {
    const onGlobalPointerDown = (event: PointerEvent): void => {
      if (!messageMenu && !reactionPicker) {
        return;
      }
      if (event.button === 2) {
        return;
      }
      const target: EventTarget | null = event.target;
      if (target instanceof Node && messageMenuRef.current?.contains(target)) {
        return;
      }
      closeMessageMenu();
      closeReactionPicker();
    };
    const onGlobalKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }
      closeMessageMenu();
      closeReactionPicker();
    };
    window.addEventListener("pointerdown", onGlobalPointerDown);
    window.addEventListener("keydown", onGlobalKeyDown);
    return (): void => {
      window.removeEventListener("pointerdown", onGlobalPointerDown);
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [messageMenu, reactionPicker]);

  useLayoutEffect((): (() => void) => {
    const marginPx: number = 8;
    const rafId: number = window.requestAnimationFrame((): void => {
      if (messageMenu && messageMenuRef.current) {
        const rect: DOMRect = messageMenuRef.current.getBoundingClientRect();
        const vw: number = window.innerWidth;
        const vh: number = window.innerHeight;
        let nextX: number = messageMenu.x;
        let nextY: number = messageMenu.y;
        if (rect.right > vw - marginPx) {
          nextX = nextX - (rect.right - (vw - marginPx));
        }
        if (rect.bottom > vh - marginPx) {
          nextY = nextY - (rect.bottom - (vh - marginPx));
        }
        if (rect.left < marginPx) {
          nextX = nextX + (marginPx - rect.left);
        }
        if (rect.top < marginPx) {
          nextY = nextY + (marginPx - rect.top);
        }
        if (Math.abs(nextX - messageMenu.x) >= 1 || Math.abs(nextY - messageMenu.y) >= 1) {
          setMessageMenu({ ...messageMenu, x: nextX, y: nextY });
        }
      }
      if (reactionPicker && reactionPickerRef.current) {
        const rect: DOMRect = reactionPickerRef.current.getBoundingClientRect();
        const vw: number = window.innerWidth;
        const vh: number = window.innerHeight;
        let nextX: number = reactionPicker.x;
        let nextY: number = reactionPicker.y;
        if (rect.right > vw - marginPx) {
          nextX = nextX - (rect.right - (vw - marginPx));
        }
        if (rect.bottom > vh - marginPx) {
          nextY = nextY - (rect.bottom - (vh - marginPx));
        }
        if (rect.left < marginPx) {
          nextX = nextX + (marginPx - rect.left);
        }
        if (rect.top < marginPx) {
          nextY = nextY + (marginPx - rect.top);
        }
        if (Math.abs(nextX - reactionPicker.x) >= 1 || Math.abs(nextY - reactionPicker.y) >= 1) {
          setReactionPicker({ ...reactionPicker, x: nextX, y: nextY });
        }
      }
    });
    return (): void => {
      window.cancelAnimationFrame(rafId);
    };
  }, [messageMenu, reactionPicker]);

  const toggleReaction = (params: Readonly<{ conversationId: string; messageId: string; emoji: ReactionEmoji }>): void => {
    setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
      const existing: ReadonlyArray<Message> = prev[params.conversationId] ?? [];
      const nextMessages: ReadonlyArray<Message> = existing.map((m: Message): Message => {
        if (m.id !== params.messageId) {
          return m;
        }
        const currentCount: number = m.reactions?.[params.emoji] ?? 0;
        const nextCount: number = currentCount > 0 ? 0 : 1;
        if (nextCount === 0) {
          const { reactions, ...rest }: Message & Readonly<{ reactions?: ReactionsByEmoji }> = m;
          void reactions;
          return rest;
        }
        const base: Record<ReactionEmoji, number> = createEmptyReactions();
        base[params.emoji] = nextCount;
        return { ...m, reactions: toReactionsByEmoji(base) };
      });
      return { ...prev, [params.conversationId]: nextMessages };
    });
  };

  const clearPendingAttachment = (): void => {
    setPendingAttachment(null);
    if (pendingAttachmentPreviewUrl) {
      URL.revokeObjectURL(pendingAttachmentPreviewUrl);
    }
    setPendingAttachmentPreviewUrl(null);
    setAttachmentError(null);
  };

  const onPickAttachment = (file: File | null): void => {
    clearPendingAttachment();
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setAttachmentError("Only image/video files are supported.");
      return;
    }
    setPendingAttachment(file);
    setPendingAttachmentPreviewUrl(URL.createObjectURL(file));
  };

  const uploadAttachment = async (file: File): Promise<Attachment> => {
    const formData: FormData = new FormData();
    formData.append("file", file);
    const response: Response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const json: unknown = await response.json();
    const parsed: UploadApiResponse = json as UploadApiResponse;
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const kind: AttachmentKind = parsed.contentType.startsWith("video/") ? "video" : "image";
    return {
      kind,
      url: parsed.url,
      contentType: parsed.contentType,
      fileName: file.name,
    };
  };

  const closeNewChat = (): void => {
    setIsNewChatOpen(false);
    setNewChatPubkey("");
    setNewChatDisplayName("");
  };

  const upsertCreatedContact = (nextContact: DmConversation): void => {
    setCreatedContacts((prev: ReadonlyArray<DmConversation>): ReadonlyArray<DmConversation> => {
      const exists: boolean = prev.some((c: DmConversation): boolean => c.id === nextContact.id);
      if (exists) {
        return prev.map((c: DmConversation): DmConversation => (c.id === nextContact.id ? nextContact : c));
      }
      return [nextContact, ...prev];
    });
  };

  const selectConversation = (conversation: Conversation): void => {
    setSelectedConversation(conversation);
    setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => ({
      ...prev,
      [conversation.id]: 0,
    }));
    setVisibleMessageCountByConversationId((prev: Readonly<Record<string, number>>): Readonly<Record<string, number>> => ({
      ...prev,
      [conversation.id]: prev[conversation.id] ?? DEFAULT_VISIBLE_MESSAGES,
    }));
  };

  const createChat = (): void => {
    const pubkey: string = newChatPubkey.trim();
    const displayName: string = (newChatDisplayName.trim() || pubkey.slice(0, 8)).trim();
    if (!pubkey) {
      return;
    }
    const parsed = parsePublicKeyInput(pubkey);
    if (!parsed.ok) {
      return;
    }
    const id: string = createContactId();
    const baseNowMs: number = nowMs ?? 0;
    const contact: DmConversation = {
      kind: "dm",
      id,
      displayName,
      pubkey: parsed.publicKeyHex,
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(baseNowMs),
    };
    upsertCreatedContact(contact);
    setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => ({
      ...prev,
      [id]: 0,
    }));
    closeNewChat();
    selectConversation(contact);
  };

  const createGroup = (): void => {
    const rawName: string = newGroupName.trim();
    const baseNowMs: number = nowMs ?? 0;
    const memberPubkeys: ReadonlyArray<string> = Array.from(
      new Set(
        newGroupMemberPubkeys
          .split(/\s+/)
          .map((v: string): string => v.trim())
          .filter((v: string): boolean => v.length > 0)
      )
    );
    if (memberPubkeys.length === 0) {
      return;
    }
    const id: string = createGroupId();
    const displayName: string = rawName || `Group ${id}`;
    const group: GroupConversation = {
      kind: "group",
      id,
      displayName,
      memberPubkeys,
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(baseNowMs),
    };
    setCreatedGroups((prev: ReadonlyArray<GroupConversation>): ReadonlyArray<GroupConversation> => [group, ...prev]);
    setUnreadByConversationId((prev: UnreadByConversationId): UnreadByConversationId => ({
      ...prev,
      [id]: 0,
    }));
    setIsNewGroupOpen(false);
    setNewGroupName("");
    setNewGroupMemberPubkeys("");
    selectConversation(group);
  };

  const handleSendMessage = (): void => {
    if (!isIdentityUnlocked) {
      return;
    }
    const content: string = messageInput.trim();
    if ((!content && !pendingAttachment) || !selectedConversation) {
      return;
    }
    if (isUploadingAttachment) {
      return;
    }
    const baseNowMs: number = nowMs ?? 0;
    setIsUploadingAttachment(true);
    setAttachmentError(null);
    const send = async (): Promise<void> => {
      const timestamp: Date = new Date(baseNowMs);
      let attachment: Attachment | undefined;
      if (pendingAttachment) {
        attachment = await uploadAttachment(pendingAttachment);
      }
      const resolvedContent: string = content;
      let resolvedMessageId: string = createMessageId();
      let resolvedTimestamp: Date = timestamp;
      let resolvedStatus: MessageStatus = "delivered";
      if (selectedConversation.kind === "dm") {
        if (attachment) {
          throw new Error("Attachments are not supported for DMs yet.");
        }
        if (blocklist.isBlocked({ publicKeyHex: selectedConversation.pubkey })) {
          throw new Error("Recipient is blocked.");
        }
        const sent = await dmController.sendDm({ peerPublicKeyInput: selectedConversation.pubkey, plaintext: resolvedContent });
        if (sent.success && sent.messageId) {
          resolvedMessageId = sent.messageId;
          resolvedTimestamp = new Date(); // Use current time since enhanced controller handles timing
          resolvedStatus = "sending";
        } else {
          throw new Error(sent.error || "Failed to send message");
        }
      }
      const message: Message = {
        id: resolvedMessageId,
        kind: "user",
        content: resolvedContent,
        timestamp: resolvedTimestamp,
        isOutgoing: true,
        status: resolvedStatus,
        ...(attachment ? { attachment } : {}),
        ...(replyTo ? { replyTo } : {}),
      };
      setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
        const existing: ReadonlyArray<Message> = prev[selectedConversation.id] ?? [];
        return {
          ...prev,
          [selectedConversation.id]: [...existing, message],
        };
      });
      setContactOverridesByContactId(
        (prev: ContactOverridesByContactId): ContactOverridesByContactId => ({
          ...prev,
          [selectedConversation.id]: {
            lastMessage: attachment ? attachment.fileName : resolvedContent,
            lastMessageTime: message.timestamp,
          },
        })
      );
      setMessageInput("");
      clearPendingAttachment();
      setReplyTo(null);
    };
    send()
      .catch((error: unknown): void => {
        const message: string = error instanceof Error ? error.message : "Upload failed";
        setAttachmentError(message);
      })
      .finally((): void => {
        setIsUploadingAttachment(false);
      });
  };

  const handleRetryMessage = (message: Message): void => {
    const conversation: Conversation | null = selectedConversationView ?? selectedConversation;
    if (!conversation || conversation.kind !== "dm") {
      return;
    }
    if (blocklist.isBlocked({ publicKeyHex: conversation.pubkey })) {
      setAttachmentError("Recipient is blocked.");
      return;
    }
    const plaintext: string = message.content.trim();
    if (plaintext.length === 0) {
      return;
    }
    dmController
      .sendDm({ peerPublicKeyInput: conversation.pubkey, plaintext })
      .then((sent): void => {
        if (!sent.success || !sent.messageId) {
          return;
        }
        const outgoing: Message = {
          id: sent.messageId,
          kind: "user",
          content: plaintext,
          timestamp: new Date(), // Use current time since enhanced controller handles timing
          isOutgoing: true,
          status: "sending",
        };
        setMessagesByConversationId((prev: MessagesByConversationId): MessagesByConversationId => {
          const existing: ReadonlyArray<Message> = prev[conversation.id] ?? [];
          return { ...prev, [conversation.id]: [...existing, outgoing] };
        });
        setContactOverridesByContactId((prev: ContactOverridesByContactId): ContactOverridesByContactId => ({
          ...prev,
          [conversation.id]: { lastMessage: plaintext, lastMessageTime: outgoing.timestamp },
        }));
      })
      .catch((): void => {
        return;
      });
  };

  const visibleCreatedContacts: ReadonlyArray<DmConversation> = useMemo((): ReadonlyArray<DmConversation> => {
    return createdContacts.filter((c: DmConversation): boolean => isPeerAccepted({ publicKeyHex: c.pubkey }));
  }, [createdContacts, isPeerAccepted]);

  const allConversations: ReadonlyArray<Conversation> = [...visibleCreatedContacts, ...createdGroups].map(
    (conversation: Conversation): Conversation =>
      applyContactOverrides(conversation, contactOverridesByContactId)
  );
  const selectedConversationView: Conversation | null = selectedConversation
    ? applyContactOverrides(selectedConversation, contactOverridesByContactId)
    : null;

  const selectedConversationMediaItems: ReadonlyArray<MediaItem> = selectedConversationView
    ? getMediaItemsForConversation({ conversationId: selectedConversationView.id })
    : [];

  const normalizedSearchQuery: string = searchQuery.trim().toLowerCase();

  const messageSearchResults: ReadonlyArray<Readonly<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>> = (() => {
    if (normalizedSearchQuery.length === 0) {
      return [];
    }
    const results: Array<Readonly<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>> = [];
    allConversations.forEach((conversation: Conversation): void => {
      const conversationId: string = conversation.id;
      const combined: ReadonlyArray<Message> = messagesByConversationId[conversationId] ?? [];
      const commandDeletedIds: ReadonlySet<string> = new Set(
        combined
          .filter((m: Message): boolean => m.kind === "command")
          .map((m: Message): DeleteCommandMessage | null => parseCommandMessage(m.content))
          .filter((cmd: DeleteCommandMessage | null): cmd is DeleteCommandMessage => cmd !== null)
          .map((cmd: DeleteCommandMessage): string => cmd.targetMessageId)
      );
      combined
        .filter((m: Message): boolean => m.kind === "user")
        .forEach((m: Message): void => {
          if (m.deletedAt || commandDeletedIds.has(m.id)) {
            return;
          }
          const haystack: string = (m.attachment?.fileName ?? "") + " " + m.content;
          if (haystack.toLowerCase().includes(normalizedSearchQuery)) {
            const preview: string = m.attachment ? m.attachment.fileName : m.content;
            results.push({ conversationId, messageId: m.id, timestamp: m.timestamp, preview });
          }
        });
    });
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return results.slice(0, 12);
  })();

  const messageMatchConversationIds: ReadonlySet<string> = new Set(
    messageSearchResults.map((r: Readonly<{ conversationId: string; messageId: string; timestamp: Date; preview: string }>): string => r.conversationId)
  );

  const filteredConversations: ReadonlyArray<Conversation> = normalizedSearchQuery.length === 0
    ? allConversations
    : allConversations.filter((conversation: Conversation): boolean => {
      const nameOrKeyMatch: boolean =
        conversation.displayName.toLowerCase().includes(normalizedSearchQuery) ||
        (conversation.kind === "dm" && conversation.pubkey.toLowerCase().includes(normalizedSearchQuery));
      return nameOrKeyMatch || messageMatchConversationIds.has(conversation.id);
    });

  const selectedConversationId: string | null = selectedConversationView?.id ?? null;

  const selectedCombinedMessages: ReadonlyArray<Message> = selectedConversationId
    ? (messagesByConversationId[selectedConversationId] ?? [])
    : [];

  const selectedSortedMessages: ReadonlyArray<Message> = [...selectedCombinedMessages].sort(
    (a: Message, b: Message): number => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const visibleWindowSize: number = selectedConversationView ? (visibleMessageCountByConversationId[selectedConversationView.id] ?? DEFAULT_VISIBLE_MESSAGES) : DEFAULT_VISIBLE_MESSAGES;

  const hasEarlierMessages: boolean = selectedSortedMessages.length > visibleWindowSize;

  const selectedWindowMessages: ReadonlyArray<Message> = selectedSortedMessages.slice(-visibleWindowSize);

  const deletedMessageIdsFromCommands: ReadonlySet<string> = new Set(
    selectedCombinedMessages
      .filter((m: Message): boolean => m.kind === "command")
      .map((m: Message): DeleteCommandMessage | null => parseCommandMessage(m.content))
      .filter((m: DeleteCommandMessage | null): m is DeleteCommandMessage => m !== null)
      .map((cmd: DeleteCommandMessage): string => cmd.targetMessageId)
  );

  const visibleSelectedMessages: ReadonlyArray<Message> = selectedWindowMessages
    .filter((m: Message): boolean => isVisibleUserMessage(m))
    .map((m: Message): Message => {
      if (m.deletedAt || deletedMessageIdsFromCommands.has(m.id)) {
        return { ...m, deletedAt: m.deletedAt ?? new Date(0), content: "" };
      }
      return m;
    });

  useEffect((): void => {
    if (identity.state.status !== "unlocked") {
      return;
    }
    const pk: PublicKeyHex | undefined = identity.state.publicKeyHex;
    if (!pk) {
      return;
    }
    if (!selectedConversationId) {
      return;
    }
    const newestVisible: Message | undefined = [...selectedSortedMessages].reverse().find((m: Message): boolean => m.kind === "user");
    const baselineSeenAtMs: number | null = nowMs;
    if (baselineSeenAtMs === null) {
      return;
    }
    const computedSeenAtMs: number = newestVisible ? Math.max(baselineSeenAtMs, newestVisible.timestamp.getTime()) : baselineSeenAtMs;
    updateLastSeen({ publicKeyHex: pk, conversationId: selectedConversationId, seenAtMs: computedSeenAtMs });
  }, [identity.state.publicKeyHex, identity.state.status, nowMs, selectedConversationId, selectedSortedMessages]);

  useEffect((): void | (() => void) => {
    if (!pendingScrollTarget || !selectedConversationView) {
      return;
    }
    if (pendingScrollTarget.conversationId !== selectedConversationView.id) {
      return;
    }
    const maxAttempts: number = 20;
    let isCanceled: boolean = false;
    let attempt: number = 0;

    const tick = (): void => {
      if (isCanceled) {
        return;
      }
      const element: HTMLElement | null = document.getElementById(`msg-${pendingScrollTarget.messageId}`);
      if (element) {
        element.scrollIntoView({ block: "center", inline: "nearest" });
        setFlashMessageId(pendingScrollTarget.messageId);
        setPendingScrollTarget(null);
        return;
      }
      attempt += 1;
      if (attempt >= maxAttempts) {
        setPendingScrollTarget(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };

    const rafId: number = window.requestAnimationFrame(tick);
    return (): void => {
      isCanceled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [pendingScrollTarget, selectedConversationView]);

  useEffect((): void | (() => void) => {
    if (!flashMessageId) {
      return;
    }
    const timeoutId: number = window.setTimeout((): void => {
      setFlashMessageId(null);
    }, 1200);
    return (): void => {
      window.clearTimeout(timeoutId);
    };
  }, [flashMessageId]);

  const formatTime = (date: Date, currentNowMs: number | null): string => {
    if (currentNowMs === null) {
      return "";
    }
    const diff: number = currentNowMs - date.getTime();
    if (diff < ONE_HOUR_MS) {
      return `${Math.floor(diff / ONE_MINUTE_MS)}m ago`;
    }
    if (diff < ONE_DAY_MS) {
      return `${Math.floor(diff / ONE_HOUR_MS)}h ago`;
    }
    return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
  };

  const chatsUnreadCount: number = useMemo((): number => {
    return Object.values(unreadByConversationId).reduce((sum: number, count: number): number => sum + count, 0);
  }, [unreadByConversationId]);

  return (
    <AppShell
      navBadgeCounts={{ "/": chatsUnreadCount }}
      sidebarContent={
        <div className="flex h-full flex-col">
          <div className="border-b border-black/10 p-3 dark:border-white/10">
            <div className="relative mb-3">
              <Input
                ref={searchInputRef}
                placeholder="Search chats"
                className="pl-9"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              />
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 dark:text-zinc-400">⌕</div>
            </div>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => setIsNewChatOpen(true)}>
                New chat
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsNewGroupOpen(true)}>
                New group
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!hasHydrated ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i: number) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/60">
                    <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                      <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredConversations.map((conversation: Conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => selectConversation(conversation)}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-black/10 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-950/60",
                      selectedConversation?.id === conversation.id && "bg-zinc-50 dark:bg-zinc-950/60"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">{conversation.displayName[0]}</div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">{conversation.displayName}</span>
                        {formatTime(conversation.lastMessageTime, nowMs) ? (
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">{formatTime(conversation.lastMessageTime, nowMs)}</span>
                        ) : null}
                      </div>
                      {conversation.kind === "dm" ? (
                        <p className="mb-1 truncate text-xs font-mono text-zinc-600 dark:text-zinc-400">{conversation.pubkey.slice(0, 20)}...</p>
                      ) : (
                        <p className="mb-1 truncate text-xs text-zinc-600 dark:text-zinc-400">{conversation.memberPubkeys.length} members</p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{conversation.lastMessage}</p>
                        {(unreadByConversationId[conversation.id] ?? conversation.unreadCount) > 0 ? (
                          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                            {unreadByConversationId[conversation.id] ?? conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
                {searchQuery.trim().length > 0 ? (
                  <div className="border-t border-black/10 p-3 text-xs dark:border-white/10">
                    <div className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">Messages</div>
                    {messageSearchResults.length === 0 ? (
                      <div className="py-8">
                        <EmptyState
                          type="search"
                          title="No messages found"
                          description="Try different keywords or check your spelling."
                          className="min-h-[200px]"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {messageSearchResults.map((result) => {
                          const conversation: Conversation | undefined = allConversations.find((c: Conversation): boolean => c.id === result.conversationId);
                          if (!conversation) {
                            return null;
                          }
                          return (
                            <button
                              key={`${result.conversationId}-${result.messageId}`}
                              type="button"
                              className="w-full rounded-xl border border-black/10 bg-zinc-50 p-2 text-left hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/60 dark:hover:bg-zinc-900/40"
                              onClick={() => {
                                selectConversation(conversation);
                                setPendingScrollTarget({ conversationId: result.conversationId, messageId: result.messageId });
                              }}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="truncate text-sm font-medium">{conversation.displayName}</div>
                                <div className="shrink-0 text-[11px] text-zinc-600 dark:text-zinc-400">{formatTime(result.timestamp, nowMs) ?? ""}</div>
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs text-zinc-700 dark:text-zinc-300">{highlightText({ text: result.preview, query: searchQuery })}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      }
    >
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-black">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold tracking-tight">Nostr Messenger</h1>
          <div className="hidden items-center gap-2 sm:flex">
            <Button
              type="button"
              variant="secondary"
              className="h-8 rounded-full border border-black/5 bg-black/5 px-3 text-xs font-medium text-zinc-600 dark:border-white/5 dark:bg-white/5 dark:text-zinc-400"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Search className="mr-2 h-3 w-3" />
              Search
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SessionChip identityUnlocked={isIdentityUnlocked} relayOpenCount={relayStatus.openCount} relayTotalCount={relayStatus.total} />
          <div className="hidden sm:block">
            <UserAvatarMenu />
          </div>
        </div>
      </header>

      {isNewChatOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card title="New chat" description="Start a conversation by pubkey." className="w-full max-w-md">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-chat-pubkey">Public key</Label>
                <Input
                  id="new-chat-pubkey"
                  value={newChatPubkey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChatPubkey(e.target.value)}
                  placeholder="npub..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-chat-name">Display name</Label>
                <Input
                  id="new-chat-name"
                  value={newChatDisplayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewChatDisplayName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeNewChat}>
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={createChat}>
                  Create
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {isNewGroupOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card title="New group" description="Create a group by entering member pubkeys." className="w-full max-w-md">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-group-name">Group name</Label>
                <Input
                  id="new-group-name"
                  value={newGroupName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGroupName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-group-members">Member pubkeys</Label>
                <Textarea
                  id="new-group-members"
                  value={newGroupMemberPubkeys}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewGroupMemberPubkeys(e.target.value)}
                  placeholder="npub...\nnpub..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setIsNewGroupOpen(false);
                    setNewGroupName("");
                    setNewGroupMemberPubkeys("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={createGroup}>
                  Create
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <main className="page-transition flex flex-1 flex-col bg-zinc-50 dark:bg-black">
          {isIdentityLocked ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="w-full max-w-md space-y-4">
                {showOnboarding ? (
                  <Card title="Getting started" description="Local identity + relays. Share your chat link with a friend." className="w-full">
                    <div className="space-y-3 text-left">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <div className={isStep1Done ? "mt-0.5 h-5 w-5 flex-none rounded-full border border-emerald-500/30 bg-emerald-500/10 text-center text-xs leading-5 text-emerald-800 dark:text-emerald-200" : "mt-0.5 h-5 w-5 flex-none rounded-full border border-black/20 bg-white text-center text-xs leading-5 dark:border-white/10 dark:bg-zinc-950/60"}>
                            {isStep1Done ? "✓" : "1"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Unlock identity</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Required to send/receive encrypted messages.</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className={isStep2Done ? "mt-0.5 h-5 w-5 flex-none rounded-full border border-emerald-500/30 bg-emerald-500/10 text-center text-xs leading-5 text-emerald-800 dark:text-emerald-200" : "mt-0.5 h-5 w-5 flex-none rounded-full border border-black/20 bg-white text-center text-xs leading-5 dark:border-white/10 dark:bg-zinc-950/60"}>
                            {isStep2Done ? "✓" : "2"}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Connect relays</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Relays deliver messages. Configure in Settings.</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 h-5 w-5 flex-none rounded-full border border-black/20 bg-white text-center text-xs leading-5 dark:border-white/10 dark:bg-zinc-950/60">3</div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Start a chat</div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400">Share your pubkey or a chat link. Friends can paste yours in Search.</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={() => router.push("/settings")}>Open Settings</Button>
                        <Button type="button" variant="secondary" onClick={dismissOnboarding}>Dismiss</Button>
                      </div>
                    </div>
                  </Card>
                ) : null}
                <Card title="Identity locked" description="Unlock your local keypair to send and receive encrypted messages." className="w-full">
                  <div className="space-y-3">
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">Your passphrase protects your private key. Messages use NIP-04.</div>
                    <IdentityCard embedded />
                  </div>
                </Card>
              </div>
            </div>
          ) : !selectedConversationView ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="w-full max-w-lg space-y-4 px-6 text-center">
                <div>
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-black/10 bg-white text-2xl dark:border-white/10 dark:bg-zinc-950/60">+</div>
                  </div>
                  <h2 className="mb-2 text-xl font-semibold">Select a conversation</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Choose a contact from the sidebar to start messaging</p>
                </div>
                {myPublicKeyHex ? (
                  <Card title="Share" description="Let a friend start a DM with you." className="w-full">
                    <div className="space-y-3">
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">Your pubkey is safe to share.</div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={handleCopyMyPubkey}>Copy pubkey</Button>
                        <Button type="button" variant="secondary" onClick={handleCopyChatLink}>Copy chat link</Button>
                      </div>
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        Relay status: {relayStatus.openCount}/{relayStatus.total} open
                      </div>
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-black">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">{selectedConversationView.displayName[0]}</div>
                  <div>
                    <h2 className="font-medium">{selectedConversationView.displayName}</h2>
                    <div className="flex items-center gap-2">
                      {selectedConversationView.kind === "dm" ? (
                        <>
                          <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{selectedConversationView.pubkey.slice(0, 16)}...</p>
                          <Button type="button" variant="secondary" className="px-2 py-1" onClick={() => handleCopyPubkey(selectedConversationView.pubkey)}>
                            Copy
                          </Button>
                        </>
                      ) : (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">{selectedConversationView.memberPubkeys.length} members</p>
                      )}
                      <Button type="button" variant="secondary" className="px-2 py-1" onClick={() => setIsMediaGalleryOpen(true)}>
                        Media
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                {!hasHydrated ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i: number) => (
                      <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                        <div className="h-10 w-56 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    ))}
                  </div>
                ) : selectedCombinedMessages.length === 0 ? (
                  <EmptyState
                    type="chats"
                    actions={[
                      {
                        label: "Write a message",
                        onClick: () => composerTextareaRef.current?.focus(),
                        variant: "primary"
                      }
                    ]}
                  />
                ) : (
                  <>
                    {hasEarlierMessages ? (
                      <div className="mb-4 flex justify-center">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (!selectedConversationView) {
                              return;
                            }
                            const conversationId: string = selectedConversationView.id;
                            setVisibleMessageCountByConversationId(
                              (prev: Readonly<Record<string, number>>): Readonly<Record<string, number>> => {
                                const current: number = prev[conversationId] ?? DEFAULT_VISIBLE_MESSAGES;
                                return { ...prev, [conversationId]: current + LOAD_EARLIER_STEP };
                              }
                            );
                          }}
                        >
                          Load earlier
                        </Button>
                      </div>
                    ) : null}
                    {visibleSelectedMessages.map((message: Message) => (
                      <div
                        key={message.id}
                        id={`msg-${message.id}`}
                        className={cn(
                          "mb-4 flex",
                          message.isOutgoing ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
                            e.preventDefault();
                            openMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                          }}
                          className={cn(
                            "relative max-w-[70%] rounded-lg px-4 py-2",
                            flashMessageId === message.id && "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-zinc-50 dark:ring-amber-400/40 dark:ring-offset-black",
                            message.isOutgoing
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "bg-white text-zinc-900 dark:bg-zinc-950/60 dark:text-zinc-100"
                          )}
                        >
                          <button
                            type="button"
                            aria-label="Message actions"
                            className={cn(
                              "absolute right-2 top-2 rounded-md px-2 py-1 text-xs",
                              message.isOutgoing
                                ? "text-white/80 hover:bg-white/10 dark:text-zinc-900/80 dark:hover:bg-black/5"
                                : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
                            )}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openMessageMenu({ messageId: message.id, x: e.clientX, y: e.clientY });
                            }}
                          >
                            ⋯
                          </button>
                          <button
                            type="button"
                            aria-label="Add reaction"
                            className={cn(
                              "absolute right-10 top-2 rounded-md px-2 py-1 text-xs",
                              message.isOutgoing
                                ? "text-white/80 hover:bg-white/10 dark:text-zinc-900/80 dark:hover:bg-black/5"
                                : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5"
                            )}
                            disabled={!isReactableMessageId(message.id)}
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              if (!isReactableMessageId(message.id)) {
                                return;
                              }
                              e.preventDefault();
                              e.stopPropagation();
                              setReactionPicker({ messageId: message.id, x: e.clientX, y: e.clientY });
                            }}
                          >
                            +
                          </button>
                          {message.deletedAt ? (
                            <div className={cn(
                              "mb-2 rounded-md border px-2 py-1 text-xs italic",
                              message.isOutgoing
                                ? "border-white/20 bg-white/10 text-white/80 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900/80"
                                : "border-black/10 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
                            )}>
                              Message deleted
                            </div>
                          ) : message.replyTo ? (
                            <div className={cn(
                              "mb-2 rounded-md border px-2 py-1 text-xs",
                              message.isOutgoing
                                ? "border-white/20 bg-white/10 text-white/80 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900/80"
                                : "border-black/10 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
                            )}
                            >
                              <div className="truncate">Replying to: {message.replyTo.previewText}</div>
                            </div>
                          ) : null}
                          {!message.deletedAt && message.reactions ? (
                            <div className="mb-2 flex flex-wrap gap-1">
                              {(Object.entries(message.reactions) as ReadonlyArray<readonly [ReactionEmoji, number]>)
                                .filter(([, count]: readonly [ReactionEmoji, number]): boolean => count > 0)
                                .map(([emoji, count]: readonly [ReactionEmoji, number]) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={cn(
                                      "rounded-full border px-2 py-0.5 text-xs",
                                      message.isOutgoing
                                        ? "border-white/20 bg-white/10 text-white/90 dark:border-black/10 dark:bg-black/5 dark:text-zinc-900"
                                        : "border-black/10 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-black/20 dark:text-zinc-200"
                                    )}
                                    onClick={() => {
                                      if (!selectedConversationView) {
                                        return;
                                      }
                                      toggleReaction({ conversationId: selectedConversationView.id, messageId: message.id, emoji });
                                    }}
                                  >
                                    {emoji} {count}
                                  </button>
                                ))}
                            </div>
                          ) : null}
                          {message.attachment ? (
                            message.attachment.kind === "image" ? (
                              <Image src={message.attachment.url} alt={message.attachment.fileName} width={640} height={480} unoptimized className="mb-2 max-h-64 w-auto rounded-lg" />
                            ) : (
                              <video src={message.attachment.url} controls className="mb-2 max-h-64 w-auto rounded-lg" />
                            )
                          ) : null}
                          <MessageContent content={message.content} isOutgoing={message.isOutgoing} />
                          {message.content ? <MessageLinkPreview content={message.content} isOutgoing={message.isOutgoing} /> : null}
                          <div
                            className={cn(
                              "mt-1 flex items-center justify-end gap-1 text-xs",
                              message.isOutgoing
                                ? "text-white/70 dark:text-zinc-900/70"
                                : "text-zinc-600 dark:text-zinc-400"
                            )}
                          >
                            {formatTime(message.timestamp, nowMs) ? (
                              <span>{formatTime(message.timestamp, nowMs)}</span>
                            ) : null}
                            {message.isOutgoing ? (
                              <div className="flex items-center gap-2">
                                <span aria-hidden="true">·</span>
                                {((): React.JSX.Element | null => {
                                  const uiByStatus: Readonly<Record<MessageStatus, StatusUi>> = {
                                    sending: {
                                      label: "Sending",
                                      icon: (iconProps: Readonly<{ className?: string }>): React.JSX.Element => (
                                        <Clock className={iconProps.className} />
                                      ),
                                    },
                                    accepted: {
                                      label: "Sent",
                                      icon: (iconProps: Readonly<{ className?: string }>): React.JSX.Element => (
                                        <Check className={iconProps.className} />
                                      ),
                                    },
                                    rejected: {
                                      label: "Failed",
                                      icon: (iconProps: Readonly<{ className?: string }>): React.JSX.Element => (
                                        <AlertTriangle className={iconProps.className} />
                                      ),
                                    },
                                    delivered: {
                                      label: "Delivered",
                                      icon: (iconProps: Readonly<{ className?: string }>): React.JSX.Element => (
                                        <CheckCheck className={iconProps.className} />
                                      ),
                                    },
                                  };
                                  const ui: StatusUi = uiByStatus[message.status];
                                  const Icon: StatusIcon = ui.icon;
                                  return (
                                    <span className="inline-flex items-center gap-1">
                                      <Icon className="h-3.5 w-3.5" />
                                      <span>{ui.label}</span>
                                    </span>
                                  );
                                })()}
                                {message.status === "rejected" ? (
                                  <button
                                    type="button"
                                    className="rounded border border-white/30 px-2 py-0.5 text-xs hover:bg-white/10"
                                    onClick={(): void => handleRetryMessage(message)}
                                  >
                                    Retry
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black">
                {replyTo ? (
                  <div className="mb-3 rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Replying to</div>
                        <div className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">{replyTo.previewText}</div>
                      </div>
                      <Button type="button" variant="secondary" onClick={() => setReplyTo(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  id="composer-attachment"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPickAttachment(e.target.files?.[0] ?? null)}
                />
                {pendingAttachment ? (
                  <div className="mb-3 rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Attachment</div>
                        <div className="mt-1 truncate text-xs font-mono text-zinc-600 dark:text-zinc-400">{pendingAttachment.name}</div>
                        {pendingAttachmentPreviewUrl ? (
                          pendingAttachment.type.startsWith("image/") ? (
                            <Image src={pendingAttachmentPreviewUrl} alt={pendingAttachment.name} width={640} height={480} unoptimized className="mt-2 max-h-40 w-auto rounded-lg" />
                          ) : (
                            <video src={pendingAttachmentPreviewUrl} controls className="mt-2 max-h-40 w-auto rounded-lg" />
                          )
                        ) : null}
                      </div>
                      <Button type="button" variant="secondary" onClick={clearPendingAttachment}>
                        Remove
                      </Button>
                    </div>
                    {attachmentError ? (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400">{attachmentError}</div>
                    ) : null}
                  </div>
                ) : attachmentError ? (
                  <div className="mb-3 rounded-xl border border-red-500/30 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300">
                    {attachmentError}
                  </div>
                ) : null}
                <div className="rounded-2xl border border-black/10 bg-white/80 p-2 shadow-sm ring-1 ring-black/3 focus-within:ring-2 focus-within:ring-zinc-400/50 dark:border-white/10 dark:bg-zinc-950/40 dark:ring-white/4 dark:shadow-black/40 dark:focus-within:ring-zinc-400/50">
                  <div className="flex items-end gap-2">
                    <label htmlFor="composer-attachment">
                      <Button type="button" variant="secondary" disabled={isUploadingAttachment}>
                        Attach
                      </Button>
                    </label>
                    <Textarea
                      placeholder="Type a message..."
                      ref={composerTextareaRef}
                      value={messageInput}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageInput(e.target.value)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-11 max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      rows={1}
                    />
                    <Button type="button" onClick={handleSendMessage} disabled={(!messageInput.trim() && !pendingAttachment) || isUploadingAttachment} className="shrink-0">
                      {isUploadingAttachment ? "Uploading..." : "Send"}
                    </Button>
                  </div>
                  <div className="mt-1 px-1 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                    Enter to send · Shift+Enter for newline
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Connected to {relayStatus.openCount}/{relayStatus.total} relays</div>
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Messages are NIP-04 encrypted. Metadata visible to relays.</p>
              </div>
              {selectedConversationView && messageMenu ? (
                <div
                  ref={messageMenuRef}
                  className="fixed z-50"
                  style={{ left: messageMenu.x, top: messageMenu.y }}
                  onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                >
                  {((): React.ReactNode => {
                    const activeMessage: Message | null = getMessageById({ conversationId: selectedConversationView.id, messageId: messageMenu.messageId });
                    if (!activeMessage) {
                      return null;
                    }
                    const canDelete: boolean = isDeletableMessageId(activeMessage.id);
                    const hasText: boolean = Boolean(activeMessage.content.trim());
                    const hasAttachment: boolean = Boolean(activeMessage.attachment);
                    return (
                      <div className="w-56 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950">
                        <button
                          type="button"
                          className={cn("w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5", !hasText ? "opacity-50" : "")}
                          disabled={!hasText}
                          onClick={() => {
                            void copyToClipboard(activeMessage.content);
                            closeMessageMenu();
                          }}
                        >
                          Copy text
                        </button>
                        <button
                          type="button"
                          className={cn("w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5", !hasAttachment ? "opacity-50" : "")}
                          disabled={!hasAttachment}
                          onClick={() => {
                            if (!activeMessage.attachment) {
                              return;
                            }
                            void copyToClipboard(toAbsoluteUrl(activeMessage.attachment.url));
                            closeMessageMenu();
                          }}
                        >
                          Copy attachment URL
                        </button>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                          onClick={() => {
                            setReplyTo({ messageId: activeMessage.id, previewText: getReplyPreviewText(activeMessage) });
                            closeMessageMenu();
                          }}
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5",
                            !canDelete ? "opacity-50" : "text-red-600 dark:text-red-400"
                          )}
                          disabled={!canDelete}
                          onClick={() => {
                            deleteMessage({ conversationId: selectedConversationView.id, messageId: activeMessage.id });
                            closeMessageMenu();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {selectedConversationView && reactionPicker ? (
                <div
                  ref={reactionPickerRef}
                  className="fixed z-50"
                  style={{ left: reactionPicker.x, top: reactionPicker.y }}
                  onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                >
                  <div className="flex gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-950">
                    {(["👍", "❤️", "😂", "🔥", "👏"] as const).map((emoji: ReactionEmoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded-lg px-2 py-1 text-lg hover:bg-black/5 dark:hover:bg-white/5"
                        onClick={() => {
                          toggleReaction({ conversationId: selectedConversationView.id, messageId: reactionPicker.messageId, emoji });
                          closeReactionPicker();
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedConversationView && isMediaGalleryOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onPointerDown={() => setIsMediaGalleryOpen(false)}>
                  <div
                    className="w-full max-w-4xl rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950"
                    onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">Media</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400">{selectedConversationView.displayName}</div>
                      </div>
                      <Button type="button" variant="secondary" onClick={() => setIsMediaGalleryOpen(false)}>
                        Close
                      </Button>
                    </div>
                    {selectedConversationMediaItems.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-black/10 bg-zinc-50 p-6 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-300">
                        No media yet.
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {selectedConversationMediaItems.map((item: MediaItem, index: number) => (
                          <button
                            key={item.messageId}
                            type="button"
                            className="group relative overflow-hidden rounded-xl border border-black/10 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/60"
                            onClick={() => setLightboxIndex(index)}
                          >
                            <div className="aspect-square">
                              {item.attachment.kind === "image" ? (
                                <Image src={item.attachment.url} alt={item.attachment.fileName} width={480} height={480} unoptimized className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-black/80 text-sm font-medium text-white">VIDEO</div>
                              )}
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-black/40 px-2 py-1 text-left text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                              <div className="truncate">{item.attachment.fileName}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
              {selectedConversationView && lightboxIndex !== null ? (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4" onPointerDown={() => setLightboxIndex(null)}>
                  <div className="relative w-full max-w-5xl" onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}>
                    <div className="absolute right-2 top-2">
                      <Button type="button" variant="secondary" onClick={() => setLightboxIndex(null)}>
                        Close
                      </Button>
                    </div>
                    {((): React.ReactNode => {
                      const item: MediaItem | undefined = selectedConversationMediaItems[lightboxIndex] as MediaItem | undefined;
                      if (!item) {
                        return null;
                      }
                      return (
                        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                          {item.attachment.kind === "image" ? (
                            <Image src={item.attachment.url} alt={item.attachment.fileName} width={1280} height={720} unoptimized className="h-auto w-full" />
                          ) : (
                            <video src={item.attachment.url} controls className="h-auto w-full" />
                          )}
                          <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-white">
                            <div className="min-w-0 flex-1 truncate">{item.attachment.fileName}</div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={lightboxIndex <= 0}
                                onClick={() => setLightboxIndex((prev: number | null): number | null => (prev === null ? null : Math.max(0, prev - 1)))}
                              >
                                Prev
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={lightboxIndex >= selectedConversationMediaItems.length - 1}
                                onClick={() => setLightboxIndex((prev: number | null): number | null => (prev === null ? null : Math.min(selectedConversationMediaItems.length - 1, prev + 1)))}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
}

export default function NostrMessenger() {
  return (
    <Suspense fallback={null}>
      <NostrMessengerContent />
    </Suspense>
  );
}
