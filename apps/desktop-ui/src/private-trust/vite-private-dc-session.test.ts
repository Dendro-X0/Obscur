import { describe, expect, it, vi } from "vitest";
import { sendPrivateDcHomeEnvelope } from "@obscur/private-trust-engine";
import {
  clearVitePrivateDcSession,
  createViteHomeEnvelopeDeliver,
  readVitePrivateDcSession,
  writeVitePrivateDcSession,
} from "./vite-private-dc-session";

describe("Cut 4.4 vite private-dc session", () => {
  it("reads session from env override", () => {
    const session = readVitePrivateDcSession("lab", {
      baseUrl: "http://127.0.0.1:8787/",
      bearerToken: "tok",
    });
    expect(session).toEqual({
      baseUrl: "http://127.0.0.1:8787",
      bearerToken: "tok",
    });
  });

  it("fail-closes deliver when session missing", async () => {
    const deliver = createViteHomeEnvelopeDeliver({
      profileId: `missing-${Date.now()}`,
    });
    await expect(deliver({
      conversationId: "peer",
      envelope: "e",
      clientMessageId: "c",
    })).rejects.toThrow(/session missing/i);
  });

  it("writes and clears private home session (Cut 11.3)", () => {
    const profileId = `home-${Date.now()}`;
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
    const saved = writeVitePrivateDcSession(profileId, {
      baseUrl: "http://127.0.0.1:8791/",
      bearerToken: " tok ",
    });
    expect(saved.baseUrl).toBe("http://127.0.0.1:8791");
    expect(saved.bearerToken).toBe("tok");
    expect(readVitePrivateDcSession(profileId, {})).toEqual(saved);
    clearVitePrivateDcSession(profileId);
    expect(readVitePrivateDcSession(profileId, {})).toBeNull();
  });

  it("package home client returns accepted ACK for Vite deliver shape", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        id: "home-ack",
        status: "accepted",
        sentAtUnixMs: 7,
      }),
    })) as unknown as typeof fetch;

    const ack = await sendPrivateDcHomeEnvelope(
      { baseUrl: "http://127.0.0.1:8787" },
      {
        conversationId: "peer",
        envelope: "sealed",
        clientMessageId: "c1",
      },
      fetchImpl,
    );
    expect(ack.id).toBe("home-ack");
    expect(ack.status).toBe("accepted");
  });
});
