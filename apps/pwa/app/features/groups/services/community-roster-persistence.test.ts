import { describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const upsertMock = vi.hoisted(() => vi.fn());

vi.mock("./community-known-participants-store", () => ({
  upsertCommunityKnownParticipantsEntry: upsertMock,
}));

import { persistKnownParticipantDirectoryIfWidened } from "./community-roster-persistence";

const pk = (byte: string): PublicKeyHex => (`${byte.repeat(64)}` as PublicKeyHex);

describe("persistKnownParticipantDirectoryIfWidened", () => {
  it("does not upsert when directory equals stored ∪ group ∪ local baseline", () => {
    const local = pk("a");
    const stored = pk("b");
    upsertMock.mockClear();

    const didPersist = persistKnownParticipantDirectoryIfWidened({
      publicKeyHex: local,
      profileId: "p1",
      directory: {
        conversationId: "c1",
        groupId: "g1",
        relayUrl: "wss://relay",
        participantPubkeys: [local, stored],
        participantCount: 2,
      },
      persistedGroupMemberPubkeys: [stored],
      storedEntry: {
        conversationId: "c1",
        groupId: "g1",
        relayUrl: "wss://relay",
        participantPubkeys: [stored],
        updatedAtUnixMs: 1,
      },
    });

    expect(didPersist).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("upserts when directory widens beyond baseline", () => {
    const local = pk("a");
    const extra = pk("c");
    upsertMock.mockClear();

    const didPersist = persistKnownParticipantDirectoryIfWidened({
      publicKeyHex: local,
      profileId: "p1",
      directory: {
        conversationId: "c1",
        groupId: "g1",
        relayUrl: "wss://relay",
        participantPubkeys: [local, extra],
        participantCount: 2,
      },
      storedEntry: undefined,
      persistedGroupMemberPubkeys: [],
    });

    expect(didPersist).toBe(true);
    expect(upsertMock).toHaveBeenCalledTimes(1);
  });
});
