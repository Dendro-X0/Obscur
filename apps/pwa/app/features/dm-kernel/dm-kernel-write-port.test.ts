import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MessageRecord } from "@dweb/db";

vi.mock("@/app/features/dm-kernel/dm-kernel-policy", () => ({
  isDmKernelAuthority: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbInsertMessage: vi.fn(async () => undefined),
  dbUpsertConversation: vi.fn(async () => undefined),
  dbGetMessages: vi.fn(async () => []),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { dbInsertMessage } from "@dweb/db";
import { logAppEvent } from "@/app/shared/log-app-event";
import { writeDmKernelMessage } from "./dm-kernel-write-port";

describe("writeDmKernelMessage", () => {
  beforeEach(() => {
    vi.mocked(dbInsertMessage).mockReset();
    vi.mocked(dbInsertMessage).mockResolvedValue(undefined);
    vi.mocked(logAppEvent).mockReset();
  });

  it("returns ok on successful insert", async () => {
    const record = {
      event_id: "evt-1",
      profile_id: "default",
      conversation_id: "dm:a:b",
      sender_pubkey: "a".repeat(64),
      recipient_pubkey: "b".repeat(64),
      plaintext: "hi",
      kind: 4,
      created_at: 1,
      received_at: 1,
      is_outgoing: true,
      reply_to_event_id: null,
      has_attachment: false,
    } satisfies MessageRecord;

    const result = await writeDmKernelMessage(record);
    expect(result.ok).toBe(true);
    expect(dbInsertMessage).toHaveBeenCalledWith(record);
  });

  it("fail-loud when invoke rejects", async () => {
    vi.mocked(dbInsertMessage).mockRejectedValueOnce(new Error("db_insert_message not allowed"));

    const result = await writeDmKernelMessage({
      event_id: "evt-2",
      profile_id: "default",
      conversation_id: "dm:a:b",
      sender_pubkey: "a".repeat(64),
      recipient_pubkey: "b".repeat(64),
      plaintext: "hi",
      kind: 4,
      created_at: 1,
      received_at: 1,
      is_outgoing: true,
      reply_to_event_id: null,
      has_attachment: false,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invoke_failed");
    expect(result.errorMessage).toContain("not allowed");
    expect(logAppEvent).toHaveBeenCalledWith(
      expect.objectContaining({ name: "dm_kernel.sqlite_write_failed", level: "error" }),
    );
  });
});
