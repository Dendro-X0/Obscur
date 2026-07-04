import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrFilter } from "@/app/features/relays/types/nostr-filter";
import type { CommunityMode } from "../types";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { roomKeyStore } from "@/app/features/crypto/room-key-store";
import { appendGroupThreadMessage } from "@/app/features/messaging/services/thread-history/group-thread-append";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  hasCommunityBindingTag,
  isScopedRelayEvent,
  toScopedRelayUrl,
} from "./sealed-community-relay-scope";
import {
  SEALED_COMMUNITY_KIND_SEALED,
  SEALED_COMMUNITY_KIND_DELETE,
} from "./sealed-community-relay-kinds";
import { resolveSealedCommunityRelaySubscribeKinds } from "./sealed-community-relay-membership-ingest-policy";
import { suppressGroupThreadMessage } from "@/app/features/messaging/services/thread-history/group-thread-suppress";

export type GroupThreadRelayIngestContext = Readonly<{
  groupId: string;
  relayUrl: string;
  conversationId: string;
  communityId?: string;
  myPublicKeyHex: PublicKeyHex;
  profileId?: string;
}>;

export type GroupThreadRelayIngestResult = Readonly<
  | { status: "persisted"; eventId: string }
  | { status: "suppressed"; eventId: string; targetEventIds: ReadonlyArray<string> }
  | { status: "ignored"; reason: string }
  | { status: "failed"; reason: string }
>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const extractDeleteTargetEventIds = (event: NostrEvent): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const targets: string[] = [];
  event.tags.forEach((tag) => {
    if (tag[0] !== "e") {
      return;
    }
    const targetId = tag[1]?.trim();
    if (!targetId || seen.has(targetId)) {
      return;
    }
    seen.add(targetId);
    targets.push(targetId);
  });
  return targets;
};

const ingestSealedCommunityDeleteEvent = async (
  event: NostrEvent,
  context: GroupThreadRelayIngestContext,
): Promise<GroupThreadRelayIngestResult> => {
  const targetEventIds = extractDeleteTargetEventIds(event);
  if (targetEventIds.length === 0) {
    return { status: "ignored", reason: "missing_delete_target" };
  }

  const profileId = context.profileId?.trim() || getResolvedProfileId()?.trim() || undefined;
  const observedAtUnixMs = event.created_at * 1000;
  const suppressedTargets: string[] = [];

  for (const targetEventId of targetEventIds) {
    const result = await suppressGroupThreadMessage({
      conversationId: context.conversationId,
      groupId: context.groupId,
      communityId: context.communityId,
      primaryMessageId: targetEventId,
      messageIdentityIds: [targetEventId],
      deletedByPublicKeyHex: event.pubkey as PublicKeyHex,
      profileId,
      observedAtUnixMs,
    });
    if (result.status === "suppressed") {
      suppressedTargets.push(targetEventId);
    }
  }

  if (suppressedTargets.length === 0) {
    return { status: "failed", reason: "suppress_suspended" };
  }

  return {
    status: "suppressed",
    eventId: event.id,
    targetEventIds: suppressedTargets,
  };
};

const isSealedControlPayload = (innerPayload: Record<string, unknown>): boolean => {
  const payloadType = innerPayload.type;
  return typeof payloadType === "string" && payloadType.trim().length > 0;
};

const decryptSealedInnerPayload = async (
  groupId: string,
  encryptedContent: string,
): Promise<Record<string, unknown> | null> => {
  const record = await roomKeyStore.getRoomKeyRecord(groupId);
  if (!record) {
    return null;
  }

  let encryptedData: unknown;
  try {
    encryptedData = JSON.parse(encryptedContent);
  } catch {
    return null;
  }

  const tryDecrypt = async (roomKeyHex: string): Promise<string | null> => {
    try {
      return await cryptoService.decryptGroupMessage(encryptedData as string, roomKeyHex);
    } catch {
      return null;
    }
  };

  let decryptedPayload = await tryDecrypt(record.roomKeyHex);
  if (!decryptedPayload && record.previousKeys) {
    for (const oldKey of record.previousKeys) {
      decryptedPayload = await tryDecrypt(oldKey);
      if (decryptedPayload) {
        break;
      }
    }
  }
  if (!decryptedPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decryptedPayload) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const buildGroupTimelineSubscriptionFilters = (
  groupId: string,
  communityMode?: CommunityMode | null,
): ReadonlyArray<NostrFilter> => ([{
  kinds: [...resolveSealedCommunityRelaySubscribeKinds(communityMode)],
  "#h": [groupId],
  limit: 100,
}]);

/**
 * Canonical relay ingest for sealed community chat rows.
 * Control/governance payloads are ignored; chat plaintext lands on appendGroupThreadMessage.
 */
export const ingestSealedCommunityRelayEvent = async (
  event: NostrEvent,
  eventRelayUrl: string,
  context: GroupThreadRelayIngestContext,
): Promise<GroupThreadRelayIngestResult> => {
  const scopedRelayUrl = toScopedRelayUrl(context.relayUrl);
  if (scopedRelayUrl && !isScopedRelayEvent({ scopedRelayUrl, eventRelayUrl })) {
    return { status: "ignored", reason: "relay_scope_mismatch" };
  }
  if (!hasCommunityBindingTag({ event, groupId: context.groupId })) {
    return { status: "ignored", reason: "community_binding_mismatch" };
  }
  if (event.kind === SEALED_COMMUNITY_KIND_DELETE) {
    return ingestSealedCommunityDeleteEvent(event, context);
  }
  if (event.kind !== SEALED_COMMUNITY_KIND_SEALED) {
    return { status: "ignored", reason: "unsupported_kind" };
  }

  const innerPayload = await decryptSealedInnerPayload(context.groupId, event.content);
  if (!innerPayload) {
    return { status: "failed", reason: "decrypt_failed" };
  }

  const actor = event.pubkey as PublicKeyHex;
  if (
    typeof innerPayload.pubkey === "string"
    && innerPayload.pubkey !== actor
  ) {
    return { status: "ignored", reason: "actor_mismatch" };
  }
  if (isSealedControlPayload(innerPayload)) {
    return { status: "ignored", reason: "control_payload" };
  }
  if (typeof innerPayload.content !== "string") {
    return { status: "ignored", reason: "missing_chat_content" };
  }

  const createdAtUnixSeconds = (
    typeof innerPayload.created_at === "number"
      ? innerPayload.created_at
      : event.created_at
  );
  const profileId = context.profileId?.trim() || getResolvedProfileId()?.trim() || undefined;
  const appendResult = await appendGroupThreadMessage({
    conversationId: context.conversationId,
    groupId: context.groupId,
    communityId: context.communityId,
    senderPublicKeyHex: actor,
    plaintext: innerPayload.content,
    eventId: event.id,
    profileId,
    createdAtUnixSeconds,
    receivedAtMs: createdAtUnixSeconds * 1000,
  });

  if (appendResult.status !== "persisted") {
    return { status: "failed", reason: "append_suspended" };
  }
  return { status: "persisted", eventId: appendResult.eventId };
};
