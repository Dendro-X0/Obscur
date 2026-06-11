import { describe, expect, it } from "vitest";
import { communityRosterMaterializationOwner } from "@/app/features/groups/services/community-roster-materialization-owner";
import { dmThreadHistoryAdapter } from "@/app/features/messaging/services/thread-history/dm-adapter";

describe("ClientGateway port owners", () => {
  it("exposes community roster materialization methods", () => {
    expect(communityRosterMaterializationOwner.resolveSeedMemberPubkeysFromDirectory).toBeTypeOf("function");
    expect(communityRosterMaterializationOwner.stabilizeMemberPubkeys).toBeTypeOf("function");
    expect(communityRosterMaterializationOwner.persistHydratedGroupKnownParticipants).toBeTypeOf("function");
  });

  it("exposes thread history kernel methods on the DM adapter", () => {
    expect(dmThreadHistoryAdapter.prepareThreadSuppressionIds).toBeTypeOf("function");
    expect(dmThreadHistoryAdapter.hydrateThreadReadModel).toBeTypeOf("function");
    expect(dmThreadHistoryAdapter.applyRealtimeBufferedEvents).toBeTypeOf("function");
    expect(dmThreadHistoryAdapter.loadEarlierMessages).toBeTypeOf("function");
    expect(dmThreadHistoryAdapter.filterThreadMessagesBySuppression).toBeTypeOf("function");
    expect(dmThreadHistoryAdapter.mergeHydratedBaseWithLiveOverlay).toBeTypeOf("function");
  });
});
