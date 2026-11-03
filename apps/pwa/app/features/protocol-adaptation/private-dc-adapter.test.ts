import { afterEach, describe, expect, it, vi } from "vitest";
import {
  privateDcAdapter,
  resetPrivateDcFetchImplForTests,
  setPrivateDcFetchImplForTests,
} from "./private-dc-adapter";
import { clearPrivateDcSession, writePrivateDcSession } from "./private-dc-session";

describe("private-dc-adapter (P4b HTTP wire)", () => {
  afterEach(() => {
    clearPrivateDcSession();
    clearPrivateDcSession("profile-a");
    clearPrivateDcSession("profile-b");
    resetPrivateDcFetchImplForTests();
  });

  it("refuses connect without session", async () => {
    await expect(privateDcAdapter.connect("clearnet")).rejects.toThrow(/no session/i);
  });

  it("refuses connect when profile has no session (P4f)", async () => {
    writePrivateDcSession({ baseUrl: "https://dc.example.com" }, "profile-a");
    await expect(privateDcAdapter.connect("clearnet", "profile-b")).rejects.toThrow(/no session/i);
    await expect(privateDcAdapter.connect("clearnet", "profile-a")).resolves.toBeUndefined();
  });

  it("lists conversations via HTTP client", async () => {
    writePrivateDcSession({ baseUrl: "https://dc.example.com" });
    setPrivateDcFetchImplForTests(vi.fn(async () => new Response(JSON.stringify({
      conversations: [{ id: "c1", title: "Ops" }],
    }), { status: 200 })) as unknown as typeof fetch);

    await expect(privateDcAdapter.listConversations("default")).resolves.toEqual([
      { id: "c1", title: "Ops" },
    ]);
  });

  it("sends messages via HTTP client", async () => {
    writePrivateDcSession({ baseUrl: "https://dc.example.com", bearerToken: "x" }, "profile-a");
    setPrivateDcFetchImplForTests(vi.fn(async () => new Response(JSON.stringify({
      message: {
        id: "m1",
        conversationId: "peer-1",
        body: "hello",
        sentAtUnixMs: 1,
        direction: "out",
        status: "sent",
      },
    }), { status: 200 })) as unknown as typeof fetch);

    await expect(privateDcAdapter.sendMessage({
      profileId: "profile-a",
      conversationId: "peer-1",
      body: "hello",
    })).resolves.toMatchObject({ id: "m1", body: "hello" });
  });

  it("refuses send when profile has no session (P4e)", async () => {
    writePrivateDcSession({ baseUrl: "https://dc.example.com" }, "profile-a");
    setPrivateDcFetchImplForTests(vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);

    await expect(privateDcAdapter.sendMessage({
      profileId: "profile-b",
      conversationId: "peer-1",
      body: "hello",
    })).rejects.toThrow(/no session/i);
  });

  it("surfaces HTTP failures without falling back to Nostr", async () => {
    writePrivateDcSession({ baseUrl: "https://dc.example.com" }, "profile-a");
    setPrivateDcFetchImplForTests(vi.fn(async () => new Response("nope", {
      status: 500,
    })) as unknown as typeof fetch);

    await expect(privateDcAdapter.sendMessage({
      profileId: "profile-a",
      conversationId: "peer-1",
      body: "hello",
    })).rejects.toThrow(/private_dc_http/);
  });

  it("maps canonical rows to rich DmConversation / Message (P4g)", async () => {
    writePrivateDcSession({ baseUrl: "https://dc.example.com" }, "profile-a");
    setPrivateDcFetchImplForTests(vi.fn(async (input: RequestInfo) => {
      const url = String(input);
      if (url.endsWith("/v1/conversations")) {
        return new Response(JSON.stringify({
          conversations: [{ id: "ops", title: "Ops" }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        messages: [{
          id: "m1",
          conversationId: "ops",
          body: "hi",
          sentAtUnixMs: 42,
          direction: "in",
          status: "delivered",
        }],
      }), { status: 200 });
    }) as unknown as typeof fetch);

    await expect(privateDcAdapter.listDmConversations("profile-a")).resolves.toEqual([
      expect.objectContaining({
        kind: "dm",
        id: "ops",
        displayName: "Ops",
        pubkey: "ops",
      }),
    ]);
    await expect(privateDcAdapter.listDmMessages({
      profileId: "profile-a",
      conversationId: "ops",
      myPublicKeyHex: "a".repeat(64),
    })).resolves.toEqual([
      expect.objectContaining({
        id: "m1",
        content: "hi",
        isOutgoing: false,
        conversationId: "ops",
      }),
    ]);
  });
});
