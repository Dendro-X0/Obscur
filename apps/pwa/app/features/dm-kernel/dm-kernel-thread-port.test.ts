import { describe, expect, it, vi, beforeEach } from "vitest";
import { dbGetMessages } from "@dweb/db";
import { loadDmKernelThread } from "./dm-kernel-thread-port";
import { evaluateDmKernelThreadOpenBudget, resetDmKernelInvokeAuditForTests } from "./dm-kernel-invoke-audit";
import { clearDmKernelThreadSessionCacheForTests } from "./dm-kernel-thread-session-cache";

vi.mock("@dweb/db", () => ({
  dbGetMessages: vi.fn(),
}));

const profileId = "default";
const conversationId = "dm:aa:bb";
const myPublicKeyHex = "aa".repeat(32);

describe("loadDmKernelThread", () => {
  beforeEach(() => {
    vi.mocked(dbGetMessages).mockReset();
    resetDmKernelInvokeAuditForTests();
    clearDmKernelThreadSessionCacheForTests();
  });

  it("maps sqlite rows to display messages sorted ascending", async () => {
    vi.mocked(dbGetMessages).mockResolvedValue([
      {
        event_id: "evt-2",
        profile_id: profileId,
        conversation_id: conversationId,
        sender_pubkey: "bb".repeat(32),
        recipient_pubkey: myPublicKeyHex,
        plaintext: "later",
        kind: 1,
        created_at: 2000,
        received_at: 2000,
        is_outgoing: false,
        reply_to_event_id: null,
        has_attachment: false,
      },
      {
        event_id: "evt-1",
        profile_id: profileId,
        conversation_id: conversationId,
        sender_pubkey: myPublicKeyHex,
        recipient_pubkey: "bb".repeat(32),
        plaintext: "earlier",
        kind: 1,
        created_at: 1000,
        received_at: 1000,
        is_outgoing: true,
        reply_to_event_id: null,
        has_attachment: false,
      },
    ]);

    const messages = await loadDmKernelThread({
      profileId,
      conversationId,
      myPublicKeyHex,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe("earlier");
    expect(messages[1]?.content).toBe("later");
    expect(dbGetMessages).toHaveBeenCalled();
    expect(dbGetMessages).toHaveBeenCalledWith(profileId, conversationId, 200, undefined);
    expect(evaluateDmKernelThreadOpenBudget(profileId, conversationId).pass).toBe(true);
  });

  it("reuses session cache on second initial open without another sqlite invoke", async () => {
    vi.mocked(dbGetMessages).mockResolvedValue([
      {
        event_id: "evt-1",
        profile_id: profileId,
        conversation_id: conversationId,
        sender_pubkey: myPublicKeyHex,
        recipient_pubkey: "bb".repeat(32),
        plaintext: "cached",
        kind: 1,
        created_at: 1000,
        received_at: 1000,
        is_outgoing: true,
        reply_to_event_id: null,
        has_attachment: false,
      },
    ]);

    await loadDmKernelThread({ profileId, conversationId, myPublicKeyHex });
    await loadDmKernelThread({ profileId, conversationId, myPublicKeyHex });

    expect(dbGetMessages).toHaveBeenCalledTimes(1);
    expect(evaluateDmKernelThreadOpenBudget(profileId, conversationId).pass).toBe(true);
  });

  it("still invokes sqlite for pagination", async () => {
    vi.mocked(dbGetMessages).mockResolvedValue([]);
    await loadDmKernelThread({ profileId, conversationId, myPublicKeyHex });
    await loadDmKernelThread({
      profileId,
      conversationId,
      myPublicKeyHex,
      beforeReceivedAt: 500,
    });
    expect(dbGetMessages).toHaveBeenCalledTimes(2);
  });
});
