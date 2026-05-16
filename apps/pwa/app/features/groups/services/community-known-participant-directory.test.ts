import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { mergeKnownParticipantSeedPubkeys } from "./community-known-participant-directory";

const pk = (s: string): PublicKeyHex => s as PublicKeyHex;

describe("mergeKnownParticipantSeedPubkeys", () => {
  it("unions directory participants with persisted group members (deduped)", () => {
    const merged = mergeKnownParticipantSeedPubkeys({
      directory: {
        conversationId: "community:x:y",
        groupId: "g",
        relayUrl: "wss://r",
        participantPubkeys: [pk("aa"), pk("bb")],
        participantCount: 2,
      },
      persistedGroupMemberPubkeys: [pk("bb"), pk("cc")],
    });
    expect(merged).toEqual([pk("aa"), pk("bb"), pk("cc")]);
  });

  it("uses persisted group members when directory is absent", () => {
    const merged = mergeKnownParticipantSeedPubkeys({
      directory: null,
      persistedGroupMemberPubkeys: [pk("dd")],
    });
    expect(merged).toEqual([pk("dd")]);
  });

  it("returns directory only when persisted list is empty", () => {
    const merged = mergeKnownParticipantSeedPubkeys({
      directory: {
        conversationId: "community:x:y",
        groupId: "g",
        relayUrl: "wss://r",
        participantPubkeys: [pk("ee")],
        participantCount: 1,
      },
      persistedGroupMemberPubkeys: [],
    });
    expect(merged).toEqual([pk("ee")]);
  });
});
