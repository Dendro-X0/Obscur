import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_DC_HTTP_ERROR,
  normalizeCanonicalConversation,
  normalizeCanonicalMessage,
  privateDcListConversations,
  privateDcSendMessage,
} from "./private-dc-client";
import type { PrivateDcSession } from "./private-dc-session";

const SESSION: PrivateDcSession = {
  baseUrl: "https://dc.example.com/api/",
  bearerToken: "tok",
};

describe("private-dc-client (P4b)", () => {
  it("normalizes conversation and message DTOs", () => {
    expect(normalizeCanonicalConversation({ id: "c1", title: "Ops" })).toEqual({
      id: "c1",
      title: "Ops",
    });
    expect(normalizeCanonicalMessage({
      id: "m1",
      conversationId: "c1",
      body: "hi",
      sentAtUnixMs: 10,
      direction: "out",
      status: "sent",
    })).toEqual({
      id: "m1",
      conversationId: "c1",
      body: "hi",
      sentAtUnixMs: 10,
      direction: "out",
      status: "sent",
    });
  });

  it("lists conversations over HTTPS JSON", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://dc.example.com/api/v1/conversations");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
      return new Response(JSON.stringify({
        conversations: [{ id: "c1", title: "Ops" }, { id: "bad" }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(privateDcListConversations(SESSION, fetchImpl)).resolves.toEqual([
      { id: "c1", title: "Ops" },
    ]);
  });

  it("sends a message and returns canonical DTO", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ body: "hello" });
      return new Response(JSON.stringify({
        message: {
          id: "m9",
          conversationId: "room-1",
          body: "hello",
          sentAtUnixMs: 42,
          direction: "out",
          status: "sent",
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(privateDcSendMessage(SESSION, {
      conversationId: "room-1",
      body: "hello",
    }, fetchImpl)).resolves.toMatchObject({
      id: "m9",
      body: "hello",
      conversationId: "room-1",
    });
  });

  it("fail-closes on HTTP errors", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: "denied",
    }), { status: 401 })) as unknown as typeof fetch;

    await expect(privateDcListConversations(SESSION, fetchImpl)).rejects.toThrow(
      new RegExp(`${PRIVATE_DC_HTTP_ERROR}_401`),
    );
  });
});
