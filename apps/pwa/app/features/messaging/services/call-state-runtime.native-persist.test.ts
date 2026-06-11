import type { CallRecord } from "@dweb/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  dbInsertCallRecord: vi.fn(async (_record: CallRecord) => undefined),
  dbUpdateCallRecord: vi.fn(async () => undefined),
  dbGetCallRecords: vi.fn(async () => []),
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

import {
  clearCallStateForProfile,
  endCall,
  initiateCall,
  processCallSignal,
} from "./call-state-runtime";

const PROFILE_ID = "default";
const ACCOUNT = "a".repeat(64);
const PEER = "b".repeat(64);

describe("call-state-runtime native persist (ACC-04)", () => {
  beforeEach(() => {
    clearCallStateForProfile(PROFILE_ID);
    vi.clearAllMocks();
    dbMocks.isTauri.mockReturnValue(true);
  });

  it("persists terminal call record when endCall runs", async () => {
    initiateCall(PROFILE_ID, "call-1", PEER, "voice", 1_000);
    endCall(PROFILE_ID, "call-1", 5_000, { accountPublicKeyHex: ACCOUNT });
    await vi.waitFor(() => {
      expect(dbMocks.dbInsertCallRecord).toHaveBeenCalled();
    });
    const record = dbMocks.dbInsertCallRecord.mock.calls[0]?.[0] as { call_id?: string } | undefined;
    expect(record?.call_id).toBe("call-1");
  });

  it("persists declined records for call-reject signals", async () => {
    processCallSignal(PROFILE_ID, {
      kind: 2501,
      pubkey: PEER,
      created_at: 1,
      tags: [["p", ACCOUNT]],
      content: JSON.stringify({ callId: "call-reject", type: "call-start" }),
      id: "evt-start",
      sig: "sig",
    } as never, 1_000, { accountPublicKeyHex: ACCOUNT });

    processCallSignal(PROFILE_ID, {
      kind: 2501,
      pubkey: PEER,
      created_at: 5,
      tags: [["p", ACCOUNT]],
      content: JSON.stringify({ callId: "call-reject", type: "call-reject" }),
      id: "evt-1",
      sig: "sig",
    } as never, 5_000, { accountPublicKeyHex: ACCOUNT });

    await vi.waitFor(() => {
      expect(dbMocks.dbInsertCallRecord).toHaveBeenCalled();
    });
    const record = dbMocks.dbInsertCallRecord.mock.calls[0]?.[0] as { status?: string } | undefined;
    expect(record?.status).toBe("declined");
  });
});
