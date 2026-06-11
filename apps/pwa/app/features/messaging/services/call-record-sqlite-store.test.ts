import type { CallRecord } from "@dweb/db";
import { describe, expect, it, vi } from "vitest";
import {
  buildTerminalCallRecord,
  loadSqliteCallRecords,
  mapCallRecordToVoiceCallRoomSummary,
  mapTerminalCallStatusToSqliteStatus,
  mergeVoiceCallRoomSummaries,
  persistTerminalCallRecordFromStatus,
  upsertTerminalCallRecord,
} from "./call-record-sqlite-store";
import type { CallStatus } from "./call-state-crdt";

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  dbInsertCallRecord: vi.fn(async () => undefined),
  dbUpdateCallRecord: vi.fn(async () => undefined),
  dbGetCallRecords: vi.fn(async (): Promise<CallRecord[]> => []),
}));

vi.mock("@dweb/db", () => ({
  isTauri: dbMocks.isTauri,
  dbInsertCallRecord: dbMocks.dbInsertCallRecord,
  dbUpdateCallRecord: dbMocks.dbUpdateCallRecord,
  dbGetCallRecords: dbMocks.dbGetCallRecords,
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

const ACCOUNT = "a".repeat(64);
const PEER = "b".repeat(64);

const terminalStatus = (overrides?: Partial<CallStatus>): CallStatus => ({
  callId: "call-1",
  state: "ended",
  participants: [ACCOUNT, PEER],
  initiatedBy: ACCOUNT,
  startedAt: 1_000,
  endedAt: 5_000,
  isExpired: false,
  activeCount: 0,
  endedCount: 2,
  ...overrides,
});

describe("call-record-sqlite-store (ACC-04)", () => {
  it("maps answered terminal calls with duration", () => {
    const record = buildTerminalCallRecord({
      profileId: "default",
      status: terminalStatus(),
      accountPublicKeyHex: ACCOUNT,
    });
    expect(record).toEqual({
      call_id: "call-1",
      profile_id: "default",
      peer_pubkey: PEER,
      initiated_by: ACCOUNT,
      status: "answered",
      started_at: 1_000,
      ended_at: 5_000,
      duration_ms: 4_000,
    });
  });

  it("maps declined and timeout terminal hints", () => {
    expect(mapTerminalCallStatusToSqliteStatus(terminalStatus(), "declined")).toBe("declined");
    expect(mapTerminalCallStatusToSqliteStatus(terminalStatus({ isExpired: true, state: "expired" }), "timeout")).toBe("timeout");
  });

  it("upserts terminal records on native", async () => {
    await upsertTerminalCallRecord({
      call_id: "call-1",
      profile_id: "default",
      peer_pubkey: PEER,
      initiated_by: ACCOUNT,
      status: "ended",
      started_at: 1,
      ended_at: 2,
      duration_ms: 1,
    });
    expect(dbMocks.dbInsertCallRecord).toHaveBeenCalledTimes(1);
    expect(dbMocks.dbUpdateCallRecord).toHaveBeenCalledTimes(1);
  });

  it("persists from terminal call status", async () => {
    const persisted = await persistTerminalCallRecordFromStatus({
      profileId: "default",
      status: terminalStatus(),
      accountPublicKeyHex: ACCOUNT,
    });
    expect(persisted).toBe(true);
    expect(dbMocks.dbInsertCallRecord).toHaveBeenCalled();
  });

  it("maps sqlite call records into voice-call invite card summaries", () => {
    const summary = mapCallRecordToVoiceCallRoomSummary({
      call_id: "room-1",
      profile_id: "default",
      peer_pubkey: PEER,
      initiated_by: ACCOUNT,
      status: "answered",
      started_at: 1_000,
      ended_at: 9_000,
      duration_ms: 8_000,
    });
    expect(summary).toEqual({
      roomId: "room-1",
      invitedAtUnixMs: 1_000,
      expiresAtUnixMs: null,
      connectedAtUnixMs: 1_000,
      endedAtUnixMs: 9_000,
      endedNormally: true,
      durationSeconds: 8,
    });
  });

  it("prefers sqlite terminal end time when DM timeline is incomplete", () => {
    const merged = mergeVoiceCallRoomSummaries(
      {
        roomId: "room-1",
        invitedAtUnixMs: 1_000,
        expiresAtUnixMs: 5_000,
        connectedAtUnixMs: null,
        endedAtUnixMs: null,
        endedNormally: false,
        durationSeconds: null,
      },
      {
        roomId: "room-1",
        invitedAtUnixMs: 1_000,
        expiresAtUnixMs: null,
        connectedAtUnixMs: 2_000,
        endedAtUnixMs: 10_000,
        endedNormally: true,
        durationSeconds: 8,
      },
    );
    expect(merged?.endedAtUnixMs).toBe(10_000);
    expect(merged?.endedNormally).toBe(true);
    expect(merged?.durationSeconds).toBe(8);
  });

  it("loads sqlite call records on native", async () => {
    dbMocks.dbGetCallRecords.mockResolvedValueOnce([{
      call_id: "call-1",
      profile_id: "default",
      peer_pubkey: PEER,
      initiated_by: ACCOUNT,
      status: "ended",
      started_at: 1,
      ended_at: 2,
      duration_ms: 1,
    }]);
    await expect(loadSqliteCallRecords("default")).resolves.toHaveLength(1);
  });
});
