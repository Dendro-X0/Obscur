import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyDmThreadRedaction, resetDmThreadRedactionDedupForTests } from "./apply-dm-thread-redaction";

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

vi.mock("../deletion/message-deletion-coordinator", () => ({
  ingestDmDeleteFromResolvedTargets: vi.fn(async () => ({ success: true, tombstone: { tombstoneId: "t1" } })),
}));

vi.mock("./expand-dm-delete-ids-for-thread", () => ({
  expandDmDeleteIdsForThread: vi.fn(async () => ["msg-a", "msg-b"]),
}));

const opsMocks = vi.hoisted(() => ({
  deleteDmForMe: vi.fn<
    (params: Readonly<{ replayProjection?: boolean; skipEventLogReconcile?: boolean }>) => Promise<ReadonlyArray<string>>
  >(async () => ["msg-a"]),
}));

vi.mock("./messaging-client-operations", () => ({
  messagingClientOperations: {
    deleteDmForMe: opsMocks.deleteDmForMe,
  },
}));

const myPk = "a".repeat(64);
const peerPk = "b".repeat(64);

describe("applyDmThreadRedaction", () => {
  beforeEach(() => {
    resetDmThreadRedactionDedupForTests();
  });

  it("notifies UI once and dedupes relay redelivery", async () => {
    const onApplied = vi.fn();
    const event = {
      id: "cmd-event-1",
      pubkey: peerPk,
      tags: [["p", myPk]],
    } as const;

    const first = await applyDmThreadRedaction({
      nostrEvent: event as never,
      plaintext: "__dweb_cmd__delete:{}",
      targetMessageIds: ["msg-a"],
      myPublicKeyHex: myPk as never,
      onRedactionApplied: onApplied,
    });
    const second = await applyDmThreadRedaction({
      nostrEvent: event as never,
      plaintext: "__dweb_cmd__delete:{}",
      targetMessageIds: ["msg-a"],
      myPublicKeyHex: myPk as never,
      onRedactionApplied: onApplied,
    });

    expect(first.status).toBe("complete");
    expect(second.status).toBe("duplicate_skipped");
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(onApplied.mock.calls[0]?.[0].messageIdentityIds).toEqual(["msg-a", "msg-b"]);
    expect(opsMocks.deleteDmForMe).toHaveBeenCalledTimes(1);
    expect(opsMocks.deleteDmForMe.mock.calls[0]![0]).toMatchObject({
      replayProjection: true,
      skipEventLogReconcile: false,
      redactTimelineEvents: true,
    });
  });
});
