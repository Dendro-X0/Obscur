import { describe, expect, it, vi, beforeEach } from "vitest";
import { dbGetMessages } from "@dweb/db";
import { fetchDmThreadRows } from "@obscur/dm-engine";
import { loadDmKernelThread } from "./dm-kernel-thread-port";
import { evaluateDmKernelThreadOpenBudget, resetDmKernelInvokeAuditForTests } from "./dm-kernel-invoke-audit";
import { clearDmKernelThreadSessionCacheForTests } from "./dm-kernel-thread-session-cache";

vi.mock("@obscur/dm-engine", () => ({
  fetchDmThreadRows: vi.fn(),
}));

vi.mock("@dweb/db", () => ({
  dbGetMessages: vi.fn(),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/profiles/services/profile-registry-service", () => ({
  ProfileRegistryService: {
    getState: vi.fn(() => ({
      activeProfileId: "default",
      profiles: [
        { profileId: "default", label: "Default", createdAtUnixMs: 0, lastUsedAtUnixMs: 0, status: "active" },
        { profileId: "profile-secondary", label: "Secondary", createdAtUnixMs: 0, lastUsedAtUnixMs: 0, status: "inactive" },
      ],
    })),
  },
}));

vi.mock("@/app/engine-lab/engine-lab-policy", () => ({
  isEngineLabStrictMode: vi.fn(() => false),
}));

const profileId = "default";
const conversationId = "dm:aa:bb";
const myPublicKeyHex = "aa".repeat(32);

describe("loadDmKernelThread", () => {
  beforeEach(() => {
    vi.mocked(fetchDmThreadRows).mockReset();
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
    expect(evaluateDmKernelThreadOpenBudget(profileId, conversationId).pass).toBe(true);
  });

  it("merges rows from every account profile slot", async () => {
    vi.mocked(dbGetMessages).mockImplementation(async (slotProfileId) => {
      if (slotProfileId === "default") {
        return [{
          event_id: "evt-old",
          profile_id: "default",
          conversation_id: conversationId,
          sender_pubkey: myPublicKeyHex,
          recipient_pubkey: "bb".repeat(32),
          plaintext: "from-default-slot",
          kind: 1,
          created_at: 1000,
          received_at: 1000,
          is_outgoing: true,
          reply_to_event_id: null,
          has_attachment: false,
        }];
      }
      return [{
        event_id: "evt-new",
        profile_id: "profile-secondary",
        conversation_id: conversationId,
        sender_pubkey: "bb".repeat(32),
        recipient_pubkey: myPublicKeyHex,
        plaintext: "from-active-slot",
        kind: 1,
        created_at: 2000,
        received_at: 2000,
        is_outgoing: false,
        reply_to_event_id: null,
        has_attachment: false,
      }];
    });

    const messages = await loadDmKernelThread({
      profileId: "profile-secondary",
      conversationId,
      myPublicKeyHex,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe("from-default-slot");
    expect(messages[1]?.content).toBe("from-active-slot");
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
    const callsAfterFirst = vi.mocked(dbGetMessages).mock.calls.length;
    await loadDmKernelThread({ profileId, conversationId, myPublicKeyHex });

    expect(vi.mocked(dbGetMessages).mock.calls.length).toBe(callsAfterFirst);
  });

  it("does not cache empty initial loads", async () => {
    vi.mocked(dbGetMessages).mockResolvedValue([]);
    await loadDmKernelThread({ profileId, conversationId, myPublicKeyHex });
    await loadDmKernelThread({ profileId, conversationId, myPublicKeyHex });
    expect(dbGetMessages.mock.calls.length).toBeGreaterThan(1);
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
    expect(dbGetMessages.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
