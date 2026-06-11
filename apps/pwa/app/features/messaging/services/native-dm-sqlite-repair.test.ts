import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbGetConversations: vi.fn(),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "profile-a"),
}));

const countDirectionsMock = vi.hoisted(() => vi.fn());

vi.mock("./native-dm-sqlite-integrity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./native-dm-sqlite-integrity")>();
  return {
    ...actual,
    countNativeDmSqliteDirections: countDirectionsMock,
  };
});

import { dbGetConversations } from "@dweb/db";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  isOneSidedNativeDmSqliteDirections,
  maybeScheduleNativeDmRelayBackfillRepair,
  NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT,
  resetNativeDmRelayBackfillRepairCooldownForTests,
  runNativeDmSqliteProfileRepairScan,
  scanNativeDmOneSidedConversations,
  summarizeNativeDmPeerMessageDirections,
  toOneSidedConversation,
} from "./native-dm-sqlite-repair";

const myPk = "aa".repeat(32) as PublicKeyHex;
const peerPk = "bb".repeat(32);

describe("native-dm-sqlite-repair", () => {
  beforeEach(() => {
    vi.mocked(dbGetConversations).mockReset();
    countDirectionsMock.mockReset();
    resetNativeDmRelayBackfillRepairCooldownForTests();
  });

  it("summarizes bidirectional peer message directions", () => {
    const summary = summarizeNativeDmPeerMessageDirections([
      { isOutgoing: true },
      { isOutgoing: false },
    ]);
    expect(summary.isBidirectional).toBe(true);
    expect(summary.isOneSided).toBe(false);
    expect(summary.outgoing).toBe(1);
    expect(summary.incoming).toBe(1);
  });

  it("detects one-sided sqlite direction counts", () => {
    expect(isOneSidedNativeDmSqliteDirections({ outgoing: 2, incoming: 0, total: 2 })).toBe(true);
    expect(isOneSidedNativeDmSqliteDirections({ outgoing: 1, incoming: 1, total: 2 })).toBe(false);
    expect(isOneSidedNativeDmSqliteDirections({ outgoing: 0, incoming: 0, total: 0 })).toBe(false);
  });

  it("maps one-sided counts to missing direction", () => {
    const entry = toOneSidedConversation({
      conversationId: `${myPk}:${peerPk}`,
      peerPublicKeyHex: peerPk,
      counts: { outgoing: 3, incoming: 0, total: 3 },
    });
    expect(entry?.missingDirection).toBe("incoming");
  });

  it("scans conversations and returns one-sided threads only", async () => {
    const peerPk2 = "cc".repeat(32);
    vi.mocked(dbGetConversations).mockResolvedValue([
      {
        id: [myPk, peerPk].sort().join(":"),
        profile_id: "profile-a",
        peer_pubkey: peerPk,
        last_event_id: null,
        last_message_at: 1,
        last_plaintext_preview: "hi",
        unread_count: 0,
      },
      {
        id: [myPk, peerPk2].sort().join(":"),
        profile_id: "profile-a",
        peer_pubkey: peerPk2,
        last_event_id: null,
        last_message_at: 2,
        last_plaintext_preview: "ok",
        unread_count: 0,
      },
    ]);
    countDirectionsMock
      .mockResolvedValueOnce({ outgoing: 2, incoming: 0, total: 2 })
      .mockResolvedValueOnce({ outgoing: 1, incoming: 1, total: 2 });

    const oneSided = await scanNativeDmOneSidedConversations({
      profileId: "profile-a",
      myPublicKeyHex: myPk,
    });
    expect(oneSided).toHaveLength(1);
    expect(oneSided[0]?.missingDirection).toBe("incoming");
  });

  it("dispatches relay backfill repair event with cooldown", () => {
    const handler = vi.fn();
    window.addEventListener(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, handler);
    const first = maybeScheduleNativeDmRelayBackfillRepair({
      profileId: "profile-a",
      reason: "hydrate_one_sided",
      conversationId: `${myPk}:${peerPk}`,
      trigger: "conversation_hydrate",
    });
    const second = maybeScheduleNativeDmRelayBackfillRepair({
      profileId: "profile-a",
      reason: "hydrate_one_sided",
      conversationId: `${myPk}:${peerPk}`,
      trigger: "conversation_hydrate",
    });
    window.removeEventListener(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, handler);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs profile repair scan and requests backfill when one-sided threads exist", async () => {
    vi.mocked(dbGetConversations).mockResolvedValue([
      {
        id: `${myPk}:${peerPk}`,
        profile_id: "profile-a",
        peer_pubkey: peerPk,
        last_event_id: null,
        last_message_at: 1,
        last_plaintext_preview: "hi",
        unread_count: 0,
      },
    ]);
    countDirectionsMock.mockResolvedValue({ outgoing: 0, incoming: 4, total: 4 });
    const handler = vi.fn();
    window.addEventListener(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, handler);

    const report = await runNativeDmSqliteProfileRepairScan({
      myPublicKeyHex: myPk,
      trigger: "dev_lab_scan",
    });

    window.removeEventListener(NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT, handler);
    expect(report.oneSidedConversations).toHaveLength(1);
    expect(report.repairRequested).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
