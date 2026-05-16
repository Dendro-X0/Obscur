"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  CHAT_STATE_REPLACED_EVENT,
  type ChatStateReplacedEventDetail,
  chatStateStoreService,
} from "@/app/features/messaging/services/chat-state-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, loadCommunityMembershipLedger } from "../services/community-membership-ledger";
import { collectGroupMessageAuthorPubkeys } from "../services/community-message-author-evidence";
import { loadCommunityKnownParticipantsEntries } from "../services/community-known-participants-store";
import { dedupeCommunityMemberPubkeys } from "../services/community-member-roster-projection";
import type { RelayEvidenceConfidence } from "../services/community-member-roster-projection";
import {
  resolveCommunityParticipantRosterReadModel,
  type CommunityParticipantRosterReadModelInput,
} from "../services/community-participant-roster-read-model";
import {
  loadCommunityParticipantRosterSession,
  saveCommunityParticipantRosterSession,
} from "../services/community-participant-roster-session-storage";

/**
 * R2 — monotonic participant roster session for community UI surfaces.
 * Discovery list: widen-only OR-set; relay `leftMembers` must not evict peers from the list.
 */
export const useCommunityParticipantRosterReadModel = (
  params: CommunityParticipantRosterReadModelInput & Readonly<{
    conversationId: string;
    relayEvidenceConfidence?: RelayEvidenceConfidence;
    /** Re-read persisted `groupMessages` authors each tick (group home often has empty live messages). */
    persistedEvidenceOwnerPubkey?: PublicKeyHex | null;
    ledgerGroupId?: string;
    ledgerRelayUrl?: string;
    applyTerminalMembershipExclusions?: boolean;
  }>,
): Readonly<{
  displayPubkeys: ReadonlyArray<PublicKeyHex>;
  authorEvidencePubkeys: ReadonlyArray<PublicKeyHex>;
}> => {
  const sessionRef = useRef<ReadonlyArray<PublicKeyHex>>([]);
  const conversationIdRef = useRef<string>("");
  const [displayPubkeys, setDisplayPubkeys] = useState<ReadonlyArray<PublicKeyHex>>([]);
  const [authorEvidencePubkeys, setAuthorEvidencePubkeys] = useState<ReadonlyArray<PublicKeyHex>>([]);
  const [persistedEvidenceRevision, setPersistedEvidenceRevision] = useState(0);

  useEffect(() => {
    if (!params.persistedEvidenceOwnerPubkey || typeof window === "undefined") {
      return;
    }
    const ownerPubkey = params.persistedEvidenceOwnerPubkey;
    const onChatStateReplaced = (event: Event) => {
      const detail = (event as CustomEvent<ChatStateReplacedEventDetail>).detail;
      if (detail?.publicKeyHex !== ownerPubkey) {
        return;
      }
      setPersistedEvidenceRevision((revision) => revision + 1);
    };
    const onLedgerUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ publicKeyHex?: string }>).detail;
      if (detail?.publicKeyHex && detail.publicKeyHex !== ownerPubkey) {
        return;
      }
      setPersistedEvidenceRevision((revision) => revision + 1);
    };
    window.addEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
    window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, onLedgerUpdated);
    return () => {
      window.removeEventListener(CHAT_STATE_REPLACED_EVENT, onChatStateReplaced);
      window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, onLedgerUpdated);
    };
  }, [params.persistedEvidenceOwnerPubkey]);

  useEffect(() => {
    const profileId = getResolvedProfileId();
    if (conversationIdRef.current !== params.conversationId) {
      conversationIdRef.current = params.conversationId;
      sessionRef.current = params.conversationId
        ? loadCommunityParticipantRosterSession(params.conversationId, profileId)
        : [];
    }

    const persistedMessageAuthorPubkeys = params.persistedEvidenceOwnerPubkey
      ? collectGroupMessageAuthorPubkeys({
        chatState: chatStateStoreService.load(params.persistedEvidenceOwnerPubkey),
        conversationId: params.conversationId,
      })
      : (params.persistedMessageAuthorPubkeys ?? []);

    const storedKnownParticipantPubkeys = params.persistedEvidenceOwnerPubkey && params.conversationId
      ? (
        loadCommunityKnownParticipantsEntries(params.persistedEvidenceOwnerPubkey, profileId)
          .find((entry) => entry.conversationId === params.conversationId)
          ?.participantPubkeys ?? []
      )
      : [];

    const ledgerMemberPubkeys = params.persistedEvidenceOwnerPubkey && params.ledgerGroupId
      ? (
        loadCommunityMembershipLedger(params.persistedEvidenceOwnerPubkey, { profileId })
          .find((entry) => (
            entry.groupId === params.ledgerGroupId
            && (!params.ledgerRelayUrl || entry.relayUrl === params.ledgerRelayUrl)
          ))
          ?.memberPubkeys ?? []
      ) as ReadonlyArray<PublicKeyHex>
      : [];

    const directoryParticipantPubkeys = dedupeCommunityMemberPubkeys([
      ...params.directoryParticipantPubkeys,
      ...storedKnownParticipantPubkeys,
      ...ledgerMemberPubkeys,
    ]);

    const result = resolveCommunityParticipantRosterReadModel({
      ...params,
      directoryParticipantPubkeys,
      persistedMessageAuthorPubkeys,
      sessionPubkeys: sessionRef.current,
      applyTerminalMembershipExclusions: params.applyTerminalMembershipExclusions ?? false,
    });
    sessionRef.current = result.sessionPubkeys;
    if (params.conversationId) {
      saveCommunityParticipantRosterSession(params.conversationId, profileId, result.sessionPubkeys);
    }
    setDisplayPubkeys((previous) => (
      previous.join(",") === result.displayPubkeys.join(",")
        ? previous
        : result.displayPubkeys
    ));
    setAuthorEvidencePubkeys((previous) => (
      previous.join(",") === result.authorEvidencePubkeys.join(",")
        ? previous
        : result.authorEvidencePubkeys
    ));
  }, [
    params.applyTerminalMembershipExclusions,
    params.communityMessages,
    params.conversationId,
    params.directoryParticipantPubkeys,
    params.expelledMemberPubkeys,
    params.leftMemberPubkeys,
    params.ledgerGroupId,
    params.ledgerRelayUrl,
    params.localMemberPubkey,
    params.persistedGroupMemberPubkeys,
    params.persistedEvidenceOwnerPubkey,
    params.persistedMessageAuthorPubkeys,
    params.projectionMemberPubkeys,
    params.relayEvidenceConfidence,
    params.rosterSeedPubkeys,
    persistedEvidenceRevision,
  ]);

  return { displayPubkeys, authorEvidencePubkeys };
};
