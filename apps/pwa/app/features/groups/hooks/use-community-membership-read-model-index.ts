"use client";

import React from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  CHAT_STATE_REPLACED_EVENT,
  type ChatStateReplacedEventDetail,
} from "@/app/features/messaging/services/chat-state-store";
import {
  COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT,
} from "@/app/features/groups/services/community-membership-ledger";
import { dedupeCommunityMemberPubkeys } from "../services/community-member-roster-projection";
import {
  resolveCommunityParticipantRosterReadModel,
} from "../services/community-participant-roster-read-model";
import {
  loadCommunityParticipantRosterSession,
  saveCommunityParticipantRosterSession,
} from "../services/community-participant-roster-session-storage";
import { loadCommunityKnownParticipantsEntries } from "../services/community-known-participants-store";
import { loadCommunityMembershipLedger } from "../services/community-membership-ledger";
import {
  COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT,
  loadCommunityTerminalMembershipCache,
} from "../services/community-terminal-membership-cache";

export type CommunityMembershipReadModelIndexGroupInput = Readonly<{
  conversationId: string;
  groupId?: string;
  relayUrl?: string;
  directoryParticipantPubkeys?: ReadonlyArray<PublicKeyHex>;
  persistedGroupMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  projectionMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  rosterSeedPubkeys?: ReadonlyArray<PublicKeyHex>;
  localMemberPubkey?: PublicKeyHex | null;
  leftMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys?: ReadonlyArray<PublicKeyHex>;
  applyTerminalMembershipExclusions?: boolean;
}>;

export type CommunityMembershipReadModelIndexEntry = Readonly<{
  displayPubkeys: ReadonlyArray<PublicKeyHex>;
  memberCount: number;
}>;

/**
 * CommunityMembershipReadModel (index form).
 * Computes monotonic participant display for many conversations without per-row hooks.
 *
 * Owner: `community-participant-roster-read-model` (R2 widen-only session).
 */
export const useCommunityMembershipReadModelIndex = (params: Readonly<{
  ownerPubkey: PublicKeyHex | null;
  groups: ReadonlyArray<CommunityMembershipReadModelIndexGroupInput>;
}>): Readonly<Record<string, CommunityMembershipReadModelIndexEntry>> => {
  const [revision, setRevision] = React.useState(0);
  const [index, setIndex] = React.useState<Readonly<Record<string, CommunityMembershipReadModelIndexEntry>>>({});

  React.useEffect(() => {
    if (!params.ownerPubkey || typeof window === "undefined") {
      return;
    }
    const ownerPubkey = params.ownerPubkey;
    const resolvedProfileId = getResolvedProfileId();
    const matchesProfileScope = (eventProfileId: string | undefined): boolean => (
      typeof eventProfileId === "string"
      && eventProfileId.length > 0
      && eventProfileId === resolvedProfileId
    );
    const onChatStateReplaced = (event: Event) => {
      const detail = (event as CustomEvent<ChatStateReplacedEventDetail>).detail;
      if (detail?.publicKeyHex !== ownerPubkey) {
        return;
      }
      if (!matchesProfileScope(detail.profileId)) {
        return;
      }
      setRevision((value) => value + 1);
    };
    const onLedgerUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ publicKeyHex?: string; profileId?: string }>).detail;
      if (detail?.publicKeyHex && detail.publicKeyHex !== ownerPubkey) {
        return;
      }
      if (!matchesProfileScope(detail?.profileId)) {
        return;
      }
      setRevision((value) => value + 1);
    };
    const onTerminalUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ profileId?: string }>).detail;
      if (!matchesProfileScope(detail?.profileId)) {
        return;
      }
      setRevision((value) => value + 1);
    };
    window.addEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
    window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, onLedgerUpdated);
    window.addEventListener(COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT, onTerminalUpdated);
    return () => {
      window.removeEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
      window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, onLedgerUpdated);
      window.removeEventListener(COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT, onTerminalUpdated);
    };
  }, [params.ownerPubkey]);

  React.useEffect(() => {
    const ownerPubkey = params.ownerPubkey;
    if (!ownerPubkey || typeof window === "undefined") {
      setIndex({});
      return;
    }
    const profileId = getResolvedProfileId();

    const knownParticipantsByConversationId = new Map<string, ReadonlyArray<PublicKeyHex>>();
    loadCommunityKnownParticipantsEntries(ownerPubkey, profileId).forEach((entry) => {
      knownParticipantsByConversationId.set(
        entry.conversationId,
        (entry.participantPubkeys ?? []) as ReadonlyArray<PublicKeyHex>,
      );
    });

    const ledgerByGroupIdAndRelay = new Map<string, ReadonlyArray<PublicKeyHex>>();
    loadCommunityMembershipLedger(ownerPubkey, { profileId }).forEach((entry) => {
      const key = `${entry.groupId}:${entry.relayUrl ?? ""}`;
      ledgerByGroupIdAndRelay.set(key, (entry.memberPubkeys ?? []) as ReadonlyArray<PublicKeyHex>);
    });

    const next: Record<string, CommunityMembershipReadModelIndexEntry> = {};
    params.groups.forEach((group) => {
      const conversationId = group.conversationId.trim();
      if (!conversationId) {
        return;
      }
      const session = loadCommunityParticipantRosterSession(conversationId, profileId);
      const known = knownParticipantsByConversationId.get(conversationId) ?? [];
      const ledgerKey = group.groupId
        ? `${group.groupId}:${group.relayUrl ?? ""}`
        : "";
      const ledgerMembers = ledgerKey ? (ledgerByGroupIdAndRelay.get(ledgerKey) ?? []) : [];

      const terminalCache = group.groupId && group.relayUrl
        ? loadCommunityTerminalMembershipCache({
            groupId: group.groupId,
            relayUrl: group.relayUrl,
            profileId,
          })
        : null;
      const leftMemberPubkeys = dedupeCommunityMemberPubkeys([
        ...(group.leftMemberPubkeys ?? []),
        ...(terminalCache?.leftMemberPubkeys ?? []),
      ] as ReadonlyArray<PublicKeyHex>);
      const expelledMemberPubkeys = dedupeCommunityMemberPubkeys([
        ...(group.expelledMemberPubkeys ?? []),
        ...(terminalCache?.expelledMemberPubkeys ?? []),
      ] as ReadonlyArray<PublicKeyHex>);
      const applyTerminalMembershipExclusions = group.applyTerminalMembershipExclusions !== false
        && Boolean(group.groupId?.trim() && group.relayUrl?.trim());

      const directoryParticipantPubkeys = dedupeCommunityMemberPubkeys([
        ...(group.directoryParticipantPubkeys ?? []),
        ...known,
        ...ledgerMembers,
      ]);

      const result = resolveCommunityParticipantRosterReadModel({
        directoryParticipantPubkeys,
        persistedGroupMemberPubkeys: group.persistedGroupMemberPubkeys ?? [],
        projectionMemberPubkeys: group.projectionMemberPubkeys,
        rosterSeedPubkeys: group.rosterSeedPubkeys,
        persistedMessageAuthorPubkeys: [],
        communityMessages: [],
        localMemberPubkey: group.localMemberPubkey ?? null,
        leftMemberPubkeys,
        expelledMemberPubkeys,
        sessionPubkeys: session,
        applyTerminalMembershipExclusions,
      });

      saveCommunityParticipantRosterSession(conversationId, profileId, result.sessionPubkeys);

      const displayPubkeys = result.displayPubkeys;
      next[conversationId] = {
        displayPubkeys,
        memberCount: Math.max(1, displayPubkeys.length),
      };
    });

    setIndex((previous) => {
      const prevKeys = Object.keys(previous);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) {
        return next;
      }
      for (const key of nextKeys) {
        const a = previous[key];
        const b = next[key];
        if (!a || a.memberCount !== b.memberCount || a.displayPubkeys.join(",") !== b.displayPubkeys.join(",")) {
          return next;
        }
      }
      return previous;
    });
  }, [params.groups, params.ownerPubkey, revision]);

  return index;
};

