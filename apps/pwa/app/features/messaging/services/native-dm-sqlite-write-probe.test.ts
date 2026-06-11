import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MessageRecord } from "@dweb/db";

let insertedRecord: MessageRecord | null = null;

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbInsertMessage: vi.fn(async (record: MessageRecord) => {
    insertedRecord = record;
  }),
  dbGetMessages: vi.fn(async () => (insertedRecord ? [insertedRecord] : [])),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: vi.fn(() => "default"),
}));

describe("probeNativeDmSqliteWrite", () => {
  beforeEach(async () => {
    insertedRecord = null;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns roundtrip_ok when insert and read succeed", async () => {
    const { probeNativeDmSqliteWrite } = await import("./native-dm-sqlite-write-probe");
    const result = await probeNativeDmSqliteWrite();
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("roundtrip_ok");
  });

  it("surfaces invoke failures", async () => {
    const { dbInsertMessage } = await import("@dweb/db");
    vi.mocked(dbInsertMessage).mockRejectedValueOnce(new Error("db_insert_message not allowed"));
    const { probeNativeDmSqliteWrite } = await import("./native-dm-sqlite-write-probe");
    const result = await probeNativeDmSqliteWrite();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invoke_failed");
    expect(result.errorMessage).toContain("not allowed");
  });
});
