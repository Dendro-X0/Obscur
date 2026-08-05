import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MessageRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";

vi.mock("@/app/features/dm-kernel/dm-kernel-policy", () => ({
  isDmKernelAuthority: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("@obscur/dm-engine", () => ({
  fetchDmThreadRows: vi.fn(async () => []),
}));

vi.mock("@obscur/engine-host/tauri", () => ({
  createTauriEngineHost: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { isTauri } from "@dweb/db";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  dmKernelWritePortInternals,
  writeDmKernelMessage,
} from "./dm-kernel-write-port";

describe("writeDmKernelMessage", () => {
  const invoke = vi.fn(async (): Promise<
    | { ok: true; data: { inserted: boolean } }
    | { ok: false; errorCode: string; errorMessage: string }
  > => ({ ok: true, data: { inserted: true } }));

  beforeEach(() => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(logAppEvent).mockReset();
    invoke.mockReset();
    invoke.mockResolvedValue({ ok: true, data: { inserted: true } });
    dmKernelWritePortInternals.setEngineHostForTests({
      invoke,
      getSnapshot: vi.fn(),
      subscribe: vi.fn(() => () => {}),
    } as unknown as HostEnginePort);
  });

  it("returns ok on successful engine_invoke insertMessage", async () => {
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
    expect(invoke).toHaveBeenCalledWith({
      engine: "dm",
      method: "insertMessage",
      scope: { profileId: "default" },
      payload: record,
    });
  });

  it("fail-loud when engine_invoke rejects", async () => {
    invoke.mockRejectedValueOnce(new Error("engine_invoke not allowed"));

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

  it("fail-loud when engine returns ok:false", async () => {
    invoke.mockResolvedValueOnce({
      ok: false,
      errorCode: "invalid_scope",
      errorMessage: "message.profile_id must match scope.profileId",
    });

    const result = await writeDmKernelMessage({
      event_id: "evt-2b",
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
    expect(result.errorMessage).toContain("must match");
  });

  it("returns not_tauri when outside native runtime", async () => {
    vi.mocked(isTauri).mockReturnValueOnce(false);

    const result = await writeDmKernelMessage({
      event_id: "evt-3",
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
    expect(result.reason).toBe("not_tauri");
    expect(invoke).not.toHaveBeenCalled();
  });
});
