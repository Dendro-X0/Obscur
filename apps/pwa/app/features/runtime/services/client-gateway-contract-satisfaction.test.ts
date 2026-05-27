import { describe, expect, it } from "vitest";
import { communityRosterMaterializationOwner } from "@/app/features/groups/services/community-roster-materialization-owner";
import { dmConversationMaterializationOwner } from "@/app/features/messaging/services/dm-conversation-materialization-owner";

describe("ClientGateway port owners", () => {
  it("exposes community roster materialization methods", () => {
    expect(communityRosterMaterializationOwner.resolveSeedMemberPubkeysFromDirectory).toBeTypeOf("function");
    expect(communityRosterMaterializationOwner.stabilizeMemberPubkeys).toBeTypeOf("function");
    expect(communityRosterMaterializationOwner.persistHydratedGroupKnownParticipants).toBeTypeOf("function");
  });

  it("exposes dm conversation materialization methods", () => {
    expect(dmConversationMaterializationOwner.prepareThreadSuppressionIds).toBeTypeOf("function");
    expect(dmConversationMaterializationOwner.hydrateThreadReadModel).toBeTypeOf("function");
    expect(dmConversationMaterializationOwner.applyRealtimeBufferedEvents).toBeTypeOf("function");
    expect(dmConversationMaterializationOwner.loadEarlierMessages).toBeTypeOf("function");
    expect(dmConversationMaterializationOwner.filterThreadMessagesBySuppression).toBeTypeOf("function");
    expect(dmConversationMaterializationOwner.mergeHydratedBaseWithLiveOverlay).toBeTypeOf("function");
  });
});
