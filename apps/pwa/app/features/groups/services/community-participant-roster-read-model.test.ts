/**
 * R2 — participant roster read model (MEM-001 UI band-aid / read owner slice)
 */

import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  advanceCommunityParticipantRosterSession,
  resolveCommunityParticipantRosterEvidence,
  resolveCommunityParticipantRosterReadModel,
} from "./community-participant-roster-read-model";

const PK_CREATOR = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;
const PK_C = "c".repeat(64) as PublicKeyHex;

describe("community-participant-roster-read-model", () => {
  it("unions directory, persisted, projection, and message authors into evidence", () => {
    const { evidencePubkeys } = resolveCommunityParticipantRosterEvidence({
      directoryParticipantPubkeys: [PK_CREATOR, PK_B],
      persistedGroupMemberPubkeys: [PK_CREATOR],
      projectionMemberPubkeys: [PK_CREATOR],
      communityMessages: [{ pubkey: PK_C }],
      localMemberPubkey: PK_CREATOR,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(evidencePubkeys).toEqual(expect.arrayContaining([PK_CREATOR, PK_B, PK_C]));
  });

  it("session does not shrink when later evidence is thinner (relay warm-up snapshot)", () => {
    const fullEvidence = [PK_CREATOR, PK_B, PK_C];
    const first = advanceCommunityParticipantRosterSession({
      sessionPubkeys: [],
      evidencePubkeys: fullEvidence,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(first.displayPubkeys).toHaveLength(3);

    const thinEvidence = [PK_CREATOR];
    const second = advanceCommunityParticipantRosterSession({
      sessionPubkeys: first.sessionPubkeys,
      evidencePubkeys: thinEvidence,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(second.displayPubkeys).toHaveLength(3);
    expect(second.displayPubkeys).toEqual(expect.arrayContaining([PK_B, PK_C]));
  });

  it("discovery session ignores relay leftMembers (MEM-001 active removal)", () => {
    const joined = advanceCommunityParticipantRosterSession({
      sessionPubkeys: [],
      evidencePubkeys: [PK_CREATOR, PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    const afterRelayLeft = advanceCommunityParticipantRosterSession({
      sessionPubkeys: joined.sessionPubkeys,
      evidencePubkeys: [PK_CREATOR],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
    });
    expect(afterRelayLeft.displayPubkeys).toEqual(expect.arrayContaining([PK_CREATOR, PK_B]));
  });

  it("removes participants only when terminal exclusions are explicitly enabled", () => {
    const joined = advanceCommunityParticipantRosterSession({
      sessionPubkeys: [],
      evidencePubkeys: [PK_CREATOR, PK_B],
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
      applyTerminalMembershipExclusions: true,
    });
    const afterLeave = advanceCommunityParticipantRosterSession({
      sessionPubkeys: joined.sessionPubkeys,
      evidencePubkeys: [PK_CREATOR, PK_B],
      leftMemberPubkeys: [PK_B],
      expelledMemberPubkeys: [],
      applyTerminalMembershipExclusions: true,
    });
    expect(afterLeave.displayPubkeys).toEqual([PK_CREATOR]);
  });

  it("unions persisted message authors even when live communityMessages are empty", () => {
    const { evidencePubkeys } = resolveCommunityParticipantRosterEvidence({
      directoryParticipantPubkeys: [PK_CREATOR],
      persistedGroupMemberPubkeys: [PK_CREATOR],
      projectionMemberPubkeys: [PK_CREATOR],
      persistedMessageAuthorPubkeys: [PK_B],
      communityMessages: [],
      localMemberPubkey: PK_CREATOR,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(evidencePubkeys).toEqual(expect.arrayContaining([PK_CREATOR, PK_B]));
  });

  it("resolveCommunityParticipantRosterReadModel preserves directory when persisted group thins", () => {
    const result = resolveCommunityParticipantRosterReadModel({
      sessionPubkeys: [PK_CREATOR, PK_B],
      directoryParticipantPubkeys: [PK_CREATOR, PK_B],
      persistedGroupMemberPubkeys: [PK_CREATOR],
      projectionMemberPubkeys: [PK_CREATOR],
      communityMessages: [],
      localMemberPubkey: PK_CREATOR,
      leftMemberPubkeys: [],
      expelledMemberPubkeys: [],
    });
    expect(result.displayPubkeys).toEqual(expect.arrayContaining([PK_CREATOR, PK_B]));
  });
});
