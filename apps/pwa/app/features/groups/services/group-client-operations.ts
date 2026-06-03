/**
 * R2 — Canonical client operations for community/group local visibility mutations.
 * Group network publish remains in GroupService; local hide uses this facade only.
 */

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { appendCanonicalDmRemovedEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { getResolvedClientGateway } from "@/app/features/profiles/services/resolve-client-gateway";
import type {
  CommunityParticipantRosterReadModelInput,
  CommunityParticipantRosterReadModelResult,
} from "./community-participant-roster-read-model";

export const groupClientOperations = {
  resolveParticipantRosterReadModel: (
    params: CommunityParticipantRosterReadModelInput & Readonly<{
      sessionPubkeys: ReadonlyArray<PublicKeyHex>;
      relayEvidenceConfidence?: import("./community-member-roster-projection").RelayEvidenceConfidence;
      applyTerminalMembershipExclusions?: boolean;
    }>,
  ): CommunityParticipantRosterReadModelResult => (
    getResolvedClientGateway().communityRoster.resolveParticipantRosterReadModel(params)
  ),

  hideMessageForViewer: (params: Readonly<{
    accountPublicKeyHex: PublicKeyHex;
    conversationId: string;
    primaryMessageId: string;
    messageIdentityIds: ReadonlyArray<string>;
    observedAtUnixMs: number;
  }>): void => {
    chatStateStoreService.removeMessageIdentities(
      params.accountPublicKeyHex,
      params.conversationId,
      params.messageIdentityIds,
    );
    params.messageIdentityIds.forEach((messageId) => {
      void appendCanonicalDmRemovedEvent({
        accountPublicKeyHex: params.accountPublicKeyHex,
        conversationId: params.conversationId,
        messageId,
        observedAtUnixMs: params.observedAtUnixMs,
        idempotencySuffix: `group_local_delete:${messageId}`,
        source: "legacy_bridge",
      });
    });
    messageBus.emitMessageDeleted(params.conversationId, params.primaryMessageId, {
      messageIdentityIds: params.messageIdentityIds,
    });
  },
} as const;
