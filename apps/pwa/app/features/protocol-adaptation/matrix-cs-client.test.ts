import { describe, expect, it, vi } from "vitest";
import {
  matrixListRoomMessages,
  matrixLoginPassword,
  matrixRoomIdToSyntheticPubkey,
  matrixSendRoomText,
  matrixSyncRooms,
  matrixWhoami,
} from "./matrix-cs-client";

describe("matrix-cs-client (C2)", () => {
  it("logs in with password and returns session", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      access_token: "tok",
      user_id: "@alice:matrix.org",
      device_id: "DEVICE",
    }), { status: 200 }));

    const session = await matrixLoginPassword({
      homeserverUrl: "https://matrix.org/",
      userId: "@alice:matrix.org",
      password: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(session).toEqual({
      homeserverUrl: "https://matrix.org",
      userId: "@alice:matrix.org",
      accessToken: "tok",
      deviceId: "DEVICE",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://matrix.org/_matrix/client/v3/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("validates access token via whoami", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      user_id: "@alice:matrix.org",
      device_id: "DEVICE",
    }), { status: 200 }));

    const whoami = await matrixWhoami({
      homeserverUrl: "https://matrix.org/",
      accessToken: "tok",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(whoami).toEqual({
      userId: "@alice:matrix.org",
      deviceId: "DEVICE",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://matrix.org/_matrix/client/v3/account/whoami",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok");
  });

  it("rejects whoami without access token", async () => {
    await expect(matrixWhoami({
      homeserverUrl: "https://matrix.org",
      accessToken: "   ",
    })).rejects.toThrow(/missing access_token/);
  });

  it("syncs joined rooms into summaries", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      rooms: {
        join: {
          "!room:matrix.org": {
            state: {
              events: [
                { type: "m.room.name", content: { name: "Lobby" } },
              ],
            },
            timeline: {
              events: [
                {
                  type: "m.room.message",
                  content: { body: "hello" },
                  origin_server_ts: 1_700_000_000_000,
                },
              ],
            },
          },
        },
      },
    }), { status: 200 }));

    const rooms = await matrixSyncRooms({
      homeserverUrl: "https://matrix.org",
      userId: "@alice:matrix.org",
      accessToken: "tok",
    }, { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(rooms).toEqual([
      {
        roomId: "!room:matrix.org",
        title: "Lobby",
        lastMessagePreview: "hello",
        lastMessageAtUnixMs: 1_700_000_000_000,
      },
    ]);
  });

  it("lists and sends room text", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/messages")) {
        return new Response(JSON.stringify({
          chunk: [
            {
              type: "m.room.message",
              event_id: "$evt1",
              sender: "@bob:matrix.org",
              content: { body: "hi" },
              origin_server_ts: 100,
            },
          ],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ event_id: "$sent" }), { status: 200 });
    });

    const session = {
      homeserverUrl: "https://matrix.org",
      userId: "@alice:matrix.org",
      accessToken: "tok",
    };

    const messages = await matrixListRoomMessages(session, "!room:matrix.org", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).toBe("hi");

    const sent = await matrixSendRoomText(session, {
      roomId: "!room:matrix.org",
      body: "ping",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(sent.eventId).toBe("$sent");
  });

  it("fingerprints room ids to 64-hex", () => {
    const hex = matrixRoomIdToSyntheticPubkey("!abc:matrix.org");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });
});
