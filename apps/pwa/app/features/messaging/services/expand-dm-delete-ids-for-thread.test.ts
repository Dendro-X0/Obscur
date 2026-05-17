import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";

const gatherMocks = vi.hoisted(() => ({
  gatherDmThreadMessagesForDelete: vi.fn((): ReadonlyArray<Message> => []),
}));

const resolveMocks = vi.hoisted(() => ({
  resolveDmRemoteDeleteIdentityIds: vi.fn((params: Readonly<{ targetMessageIds: ReadonlyArray<string> }>) => (
    [...params.targetMessageIds]
  )),
}));

vi.mock("./gather-dm-thread-messages-for-delete", () => ({
  gatherDmThreadMessagesForDelete: gatherMocks.gatherDmThreadMessagesForDelete,
}));

vi.mock("./resolve-dm-remote-delete-identity-ids", () => ({
  resolveDmRemoteDeleteIdentityIds: resolveMocks.resolveDmRemoteDeleteIdentityIds,
}));

vi.mock("@/app/features/account-sync/services/account-projection-runtime", () => ({
  accountProjectionRuntime: {
    getSnapshot: () => ({ projection: null }),
  },
}));

import { expandDmDeleteIdsForThread } from "./expand-dm-delete-ids-for-thread";

const myPk = "a".repeat(64);
const peerPk = "b".repeat(64);
const conversationId = [myPk, peerPk].sort().join(":");

describe("expandDmDeleteIdsForThread", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("expands alias ids from thread messages that intersect targets", async () => {
    const threadMessage: Message = {
      id: "display-id",
      kind: "user",
      content: "hi",
      timestamp: new Date(1_000),
      isOutgoing: false,
      status: "delivered",
      eventId: "event-id",
      senderPubkey: peerPk,
    };
    gatherMocks.gatherDmThreadMessagesForDelete.mockReturnValue([threadMessage]);

    const expanded = await expandDmDeleteIdsForThread({
      conversationId,
      myPublicKeyHex: myPk as never,
      targetMessageIds: ["event-id"],
    });

    expect(expanded).toContain("display-id");
    expect(expanded).toContain("event-id");
  });
});
