import type { CommunityControlEvent } from "@dweb/core/community-control-event-contracts";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityMembershipPort,
  CommunityMembershipScope,
  MembershipControlApplyResult,
  MembershipControlEventInput,
  MembershipStateSnapshot,
} from "@dweb/client-gateway/community-membership";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import { normalizeRelayUrl } from "@dweb/nostr/relay-utils";
import { transitionMembershipStatus } from "@/app/features/messaging/state-machines/community-membership-machine";
import { shouldSuppressStaleCommunityMemberRemoval } from "../utils/community-membership-participation-evidence";
import {
  clearCommunityTerminalMembershipCache,
  saveCommunityTerminalMembershipCache,
} from "./community-terminal-membership-cache";

export const COMMUNITY_MEMBERSHIP_PORT_OWNER_ID = "community-membership-port-owner" as const;

const normalizeRelayScope = (relayUrl: string): string => (
  normalizeRelayUrl(relayUrl)
);

const createMembershipControlEvent = (
  scope: CommunityMembershipScope,
  input: MembershipControlEventInput,
): Extract<CommunityControlEvent, Readonly<{ eventFamily: "membership" }>> => ({
  eventFamily: "membership",
  eventType: input.eventType,
  logicalEventId: input.logicalEventId,
  idempotencyKey: `${input.eventType}:${scope.groupId}:${input.logicalEventId}`,
  communityId: scope.communityId,
  groupId: scope.groupId,
  relayScope: normalizeRelayScope(scope.relayUrl),
  actorPublicKeyHex: scope.myPublicKeyHex ?? ("unknown" as PublicKeyHex),
  createdAtUnixMs: input.createdAtUnixMs,
  source: "relay_live",
  membershipVersion: 1,
  subjectPublicKeyHex: input.subjectPublicKeyHex,
});

const applyMembershipControlEvent = (params: Readonly<{
  event: Extract<CommunityControlEvent, Readonly<{ eventFamily: "membership" }>>;
  prev: MembershipStateSnapshot;
  myPublicKeyHex: PublicKeyHex | null;
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null; created_at?: number }>>;
  disbandedAtUnixMs?: number;
}>): MembershipControlApplyResult => {
  const { event, prev, myPublicKeyHex } = params;

  switch (event.eventType) {
    case "COMMUNITY_MEMBER_JOINED": {
      if (params.disbandedAtUnixMs !== undefined) {
        return { suppressed: true };
      }
      const leftMembers = prev.leftMembers.filter((pk) => pk !== event.subjectPublicKeyHex);
      const expelledMembers = prev.expelledMembers.filter((pk) => pk !== event.subjectPublicKeyHex);
      const isSelf = Boolean(myPublicKeyHex && event.subjectPublicKeyHex === myPublicKeyHex);
      return {
        suppressed: false,
        crdtAddMember: event.subjectPublicKeyHex,
        statePatch: {
          leftMembers,
          expelledMembers,
          ...(isSelf
            ? {
                membershipStatus: transitionMembershipStatus(prev.membershipStatus, { type: "JOIN_SUCCESS" }),
              }
            : {}),
        },
      };
    }
    case "COMMUNITY_MEMBER_LEFT": {
      if (shouldSuppressStaleCommunityMemberRemoval({
        subjectPubkey: event.subjectPublicKeyHex,
        removalAtUnixMs: event.createdAtUnixMs,
        communityMessages: params.communityMessages,
      })) {
        return { suppressed: true };
      }
      const leftMembers = prev.leftMembers.includes(event.subjectPublicKeyHex)
        ? prev.leftMembers
        : [...prev.leftMembers, event.subjectPublicKeyHex];
      const isSelf = Boolean(myPublicKeyHex && event.subjectPublicKeyHex === myPublicKeyHex);
      return {
        suppressed: false,
        crdtRemoveMember: event.subjectPublicKeyHex,
        statePatch: {
          leftMembers,
          ...(isSelf
            ? {
                membershipStatus: transitionMembershipStatus(prev.membershipStatus, { type: "LEAVE" }),
              }
            : {}),
        },
      };
    }
    case "COMMUNITY_MEMBER_EXPELLED": {
      if (shouldSuppressStaleCommunityMemberRemoval({
        subjectPubkey: event.subjectPublicKeyHex,
        removalAtUnixMs: event.createdAtUnixMs,
        communityMessages: params.communityMessages,
      })) {
        return { suppressed: true };
      }
      const expelledMembers = prev.expelledMembers.includes(event.subjectPublicKeyHex)
        ? prev.expelledMembers
        : [...prev.expelledMembers, event.subjectPublicKeyHex];
      const isSelf = Boolean(myPublicKeyHex && event.subjectPublicKeyHex === myPublicKeyHex);
      return {
        suppressed: false,
        crdtRemoveMember: event.subjectPublicKeyHex,
        statePatch: {
          expelledMembers,
          ...(isSelf
            ? {
                membershipStatus: transitionMembershipStatus(prev.membershipStatus, { type: "EXPELLED" }),
              }
            : {}),
        },
      };
    }
    default:
      return { suppressed: true };
  }
};

const applyDisbandedControlEvent = (params: Readonly<{
  createdAtUnixMs: number;
}>): Readonly<{ crdtRemoveAllMembers: true; statePatch: Readonly<{ disbandedAtUnixMs: number }> }> => ({
  crdtRemoveAllMembers: true,
  statePatch: { disbandedAtUnixMs: params.createdAtUnixMs },
});

const applySemanticMemberEvent = (params: Readonly<{
  semantic: SemanticCommunityMemberEvent;
  scope: CommunityMembershipScope;
  prev: MembershipStateSnapshot;
  myPublicKeyHex: PublicKeyHex | null;
  communityMessages: ReadonlyArray<Readonly<{ pubkey?: string | null; created_at?: number }>>;
  disbandedAtUnixMs?: number;
}>) => {
  const event = createMembershipControlEvent(params.scope, {
    eventType: params.semantic.type,
    logicalEventId: params.semantic.logicalEventId,
    createdAtUnixMs: params.semantic.createdAtUnixMs,
    subjectPublicKeyHex: params.semantic.subjectPublicKeyHex as PublicKeyHex,
  });

  const apply = applyMembershipControlEvent({
    event,
    prev: params.prev,
    myPublicKeyHex: params.myPublicKeyHex,
    communityMessages: params.communityMessages,
    disbandedAtUnixMs: params.disbandedAtUnixMs,
  });

  const deferKey = params.semantic.type === "COMMUNITY_MEMBER_LEFT"
    ? `leave:${params.semantic.logicalEventId}`
    : params.semantic.logicalEventId.startsWith("restate:")
      ? `restate:${params.semantic.logicalEventId.replace(/^restate:/, "")}`
      : `join:${params.semantic.logicalEventId}`;

  return {
    suppressed: apply.suppressed,
    event: apply.suppressed ? null : event,
    deferKey: apply.suppressed ? null : deferKey,
    apply,
  };
};

const persistTerminalMembershipSnapshot = (params: Readonly<{
  scope: CommunityMembershipScope;
  leftMembers: ReadonlyArray<PublicKeyHex>;
  expelledMembers: ReadonlyArray<PublicKeyHex>;
  disbandedAtUnixMs?: number | null;
}>): void => {
  saveCommunityTerminalMembershipCache({
    groupId: params.scope.groupId,
    relayUrl: params.scope.relayUrl,
    leftMemberPubkeys: params.leftMembers,
    expelledMemberPubkeys: params.expelledMembers,
    disbandedAtUnixMs: params.disbandedAtUnixMs ?? null,
    profileId: params.scope.profileId,
  });
};

const clearTerminalMembershipSnapshot = (scope: CommunityMembershipScope): void => {
  clearCommunityTerminalMembershipCache({
    groupId: scope.groupId,
    relayUrl: scope.relayUrl,
    profileId: scope.profileId,
  });
};

export const communityMembershipPortOwner: CommunityMembershipPort = {
  ownerId: COMMUNITY_MEMBERSHIP_PORT_OWNER_ID,
  createMembershipControlEvent,
  applyMembershipControlEvent,
  applyDisbandedControlEvent,
  applySemanticMemberEvent,
  persistTerminalMembershipSnapshot,
  clearTerminalMembershipSnapshot,
};
