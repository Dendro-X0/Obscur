import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readContinuityM6BackfillReport,
  runContinuityM6HomeBackfill,
} from "./continuity-m6-backfill";

describe("continuity-m6-backfill (Cut 13.2)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  it("pulls opaque envelopes and persists report without CRM invent", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/conversations")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({
            conversations: [{ id: "ops" }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({
          messages: [
            { id: "e1", conversationId: "ops", envelope: "sealed-a", sentAtUnixMs: 50 },
            { id: "p1", conversationId: "ops", body: "plain", sentAtUnixMs: 51 },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    const result = await runContinuityM6HomeBackfill({
      profileId: "default",
      session: { baseUrl: "http://127.0.0.1:8787" },
      nowUnixMs: 100,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    expect(result.report?.envelopeCount).toBe(1);
    expect(result.report?.droppedPlaintextCount).toBe(1);
    expect(result.report?.honestyNote).toBe("opaque_envelopes_only");
    expect(result.report?.cursorUnixMs).toBe(50);
    expect(readContinuityM6BackfillReport("default")?.envelopeIds).toEqual(["e1"]);
  });
});
