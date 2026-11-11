import { describe, expect, it, vi } from "vitest";
import {
  listPrivateDcHomeConversations,
  listPrivateDcHomeMessageEnvelopesDetailed,
} from "@obscur/private-trust-engine";

describe("Cut 13.1 Continuity M6 home list helpers (via engine)", () => {
  it("lists conversations and drops plaintext envelopes", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/v1/conversations")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({
            conversations: [{ id: "ops", title: "Ops" }],
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({
          messages: [
            { id: "e1", conversationId: "ops", envelope: "sealed", sentAtUnixMs: 9 },
            { id: "p1", conversationId: "ops", body: "plain", sentAtUnixMs: 10 },
          ],
        }),
      };
    }) as unknown as typeof fetch;

    const conversations = await listPrivateDcHomeConversations(
      { baseUrl: "http://127.0.0.1:8787" },
      fetchImpl,
    );
    expect(conversations).toEqual([{ id: "ops", title: "Ops" }]);

    const listed = await listPrivateDcHomeMessageEnvelopesDetailed(
      { baseUrl: "http://127.0.0.1:8787" },
      { conversationId: "ops", since: 1 },
      fetchImpl,
    );
    expect(listed.envelopes).toHaveLength(1);
    expect(listed.droppedPlaintextCount).toBe(1);
  });
});
