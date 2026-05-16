/**
 * DM redaction — **display gate** (cooperative UI hide).
 *
 * Single subtractive owner for "should this row render in ChatView?"
 * Not network truth. Not delivery proof. Display-only.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { Message } from "../types";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { collectMessageIdentityAliases } from "./message-identity-alias-contract";
import { isMessageIdentityInSuppressedIdSet } from "./conversation-message-visibility";
import { buildDmSiblingConversationIds } from "../utils/dm-conversation-sibling-ids";
import { expandDmDeleteIdsForThread } from "./expand-dm-delete-ids-for-thread";
import { gatherDmThreadMessagesForDelete } from "./gather-dm-thread-messages-for-delete";
import { buildDeleteTargetIdsForDm } from "./dm-delete-target-derivation";

const STORAGE_BASE = "dweb.dm.redaction_display_gate.v1";
export const DM_REDACTION_DISPLAY_GATE_CHANGED = "obscur:dm-redaction-display-gate-changed";

type GateBlob = Readonly<Record<string, ReadonlyArray<string>>>;

const memoryByProfile = new Map<string, Set<string>>();

const normalizeIds = (ids: ReadonlyArray<string>): ReadonlyArray<string> => (
  ids.map((id) => id.trim()).filter((id) => id.length > 0)
);

const storageKeyForProfile = (profileId: string): string => (
  getScopedStorageKey(STORAGE_BASE, profileId)
);

const loadGateSet = (profileId: string): Set<string> => {
  const cached = memoryByProfile.get(profileId);
  if (cached) {
    return cached;
  }
  const next = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(storageKeyForProfile(profileId));
      if (raw) {
        const parsed = JSON.parse(raw) as GateBlob;
        Object.values(parsed).forEach((ids) => {
          normalizeIds(ids ?? []).forEach((id) => next.add(id));
        });
      }
    } catch {
      // non-fatal
    }
  }
  memoryByProfile.set(profileId, next);
  return next;
};

const persistGateSet = (profileId: string, set: Set<string>, conversationIds: ReadonlyArray<string>): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const blob: Record<string, string[]> = {};
    for (const conversationId of conversationIds) {
      const trimmed = conversationId.trim();
      if (trimmed.length === 0) {
        continue;
      }
      blob[trimmed] = Array.from(set);
    }
    window.localStorage.setItem(storageKeyForProfile(profileId), JSON.stringify(blob));
  } catch {
    // quota / private mode
  }
};

const emitGateChanged = (profileId: string, conversationId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(DM_REDACTION_DISPLAY_GATE_CHANGED, {
    detail: { profileId, conversationId },
  }));
};

const resolveExpandedRedactionIds = async (params: Readonly<{
  conversationId: string;
  identityIds: ReadonlyArray<string>;
  myPublicKeyHex: PublicKeyHex;
  deleteAuthorPubkey?: PublicKeyHex;
}>): Promise<ReadonlyArray<string>> => {
  const resolved = new Set<string>(normalizeIds(params.identityIds));
  const expanded = await expandDmDeleteIdsForThread({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
    targetMessageIds: Array.from(resolved),
    deleteAuthorPubkey: params.deleteAuthorPubkey,
  });
  expanded.forEach((id) => resolved.add(id));

  const targetSet = new Set(resolved);
  const author = params.deleteAuthorPubkey?.trim().toLowerCase();
  const threadMessages = gatherDmThreadMessagesForDelete({
    conversationId: params.conversationId,
    myPublicKeyHex: params.myPublicKeyHex,
  });

  for (const message of threadMessages) {
    const aliases = collectMessageIdentityAliases(message);
    let derived: ReadonlyArray<string> = [];
    if (params.deleteAuthorPubkey && author) {
      const sender = message.senderPubkey?.trim().toLowerCase();
      if (sender === author) {
        const recipient = message.isOutgoing
          ? message.recipientPubkey
          : params.myPublicKeyHex;
        if (recipient) {
          derived = await buildDeleteTargetIdsForDm({
            message,
            senderPubkey: params.deleteAuthorPubkey,
            recipientPubkey: recipient,
          });
        }
      }
    }
    const intersects = (
      aliases.some((alias) => targetSet.has(alias))
      || derived.some((id) => targetSet.has(id))
    );
    if (!intersects) {
      continue;
    }
    aliases.forEach((alias) => resolved.add(alias));
    derived.forEach((id) => resolved.add(id));
  }

  return Array.from(resolved);
};

/**
 * Record ids that must not render for this DM thread (and sibling conversation ids).
 */
export const applyDmRedactionDisplayGate = (params: Readonly<{
  profileId: string;
  conversationId: string;
  identityIds: ReadonlyArray<string>;
  myPublicKeyHex?: PublicKeyHex;
  deleteAuthorPubkey?: PublicKeyHex;
}>): void => {
  void applyDmRedactionDisplayGateAsync(params);
};

export const applyDmRedactionDisplayGateAsync = async (params: Readonly<{
  profileId: string;
  conversationId: string;
  identityIds: ReadonlyArray<string>;
  myPublicKeyHex?: PublicKeyHex;
  deleteAuthorPubkey?: PublicKeyHex;
}>): Promise<ReadonlyArray<string>> => {
  const profileId = params.profileId.trim();
  if (!profileId) {
    return [];
  }

  const ids = params.myPublicKeyHex
    ? await resolveExpandedRedactionIds({
      conversationId: params.conversationId,
      identityIds: params.identityIds,
      myPublicKeyHex: params.myPublicKeyHex,
      deleteAuthorPubkey: params.deleteAuthorPubkey,
    })
    : normalizeIds(params.identityIds);

  if (ids.length === 0) {
    return [];
  }

  const conversationIds = params.myPublicKeyHex
    ? buildDmSiblingConversationIds({
      conversationId: params.conversationId,
      myPublicKeyHex: params.myPublicKeyHex,
    })
    : [params.conversationId];

  const gate = loadGateSet(profileId);
  let added = 0;
  for (const id of ids) {
    if (!gate.has(id)) {
      gate.add(id);
      added += 1;
    }
  }
  if (added > 0) {
    persistGateSet(profileId, gate, conversationIds);
    emitGateChanged(profileId, params.conversationId);
  }
  return ids;
};

export const getDmRedactionDisplayGateIds = (profileId: string | undefined): ReadonlySet<string> => {
  if (!profileId?.trim()) {
    return new Set();
  }
  return loadGateSet(profileId.trim());
};

export const filterMessagesThroughDmRedactionDisplayGate = (
  messages: ReadonlyArray<Message>,
  profileId: string | undefined,
): ReadonlyArray<Message> => {
  const gate = getDmRedactionDisplayGateIds(profileId);
  if (gate.size === 0) {
    return messages;
  }
  return messages.filter((message) => !isMessageIdentityInSuppressedIdSet(message, gate));
};

export const subscribeDmRedactionDisplayGateChanged = (
  listener: (detail: Readonly<{ profileId: string; conversationId: string }>) => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const handler = (event: Event): void => {
    const custom = event as CustomEvent<Readonly<{ profileId: string; conversationId: string }>>;
    if (!custom.detail?.profileId) {
      return;
    }
    listener(custom.detail);
  };
  window.addEventListener(DM_REDACTION_DISPLAY_GATE_CHANGED, handler);
  return () => window.removeEventListener(DM_REDACTION_DISPLAY_GATE_CHANGED, handler);
};

/** Test-only */
export const resetDmRedactionDisplayGateForTests = (): void => {
  memoryByProfile.clear();
};

/** Test-only */
export const messageMatchesDmRedactionDisplayGate = (
  message: Message,
  profileId: string,
): boolean => {
  const gate = getDmRedactionDisplayGateIds(profileId);
  return collectMessageIdentityAliases(message).some((alias) => gate.has(alias));
};
