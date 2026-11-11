import { describe, expect, it, vi } from "vitest";
import {
  fetchLatestPrivateDcContinuityBackup,
  listPrivateDcHomeConversations,
  listPrivateDcHomeMessageEnvelopesDetailed,
  normalizePrivateDcHomeEnvelopeAck,
  putPrivateDcContinuityBackup,
  sendPrivateDcHomeEnvelope,
} from "./private-dc-home-client";

describe("Cut 4.4 private-dc-home-client", () => {
  it("normalizes home ACK without claiming delivered", () => {
    const ack = normalizePrivateDcHomeEnvelopeAck(
      {
        id: "home-1",
        conversationId: "peer",
        envelope: "sealed",
        status: "accepted",
        sentAtUnixMs: 10,
      },
      "peer",
      "sealed",
      "c1",
    );
    expect(ack?.status).toBe("accepted");
    expect(ack?.id).toBe("home-1");
  });

  it("POSTs envelope and returns accepted ACK", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        message: {
          id: "h-9",
          conversationId: "peer-aa",
          envelope: "env",
          clientMessageId: "c-9",
          sentAtUnixMs: 42,
          status: "accepted",
        },
      }),
    })) as unknown as typeof fetch;

    const ack = await sendPrivateDcHomeEnvelope(
      { baseUrl: "http://127.0.0.1:8787/" },
      {
        conversationId: "peer-aa",
        envelope: "env",
        clientMessageId: "c-9",
      },
      fetchImpl,
    );
    expect(ack.id).toBe("h-9");
    expect(ack.status).toBe("accepted");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects plaintext-only home responses", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        message: {
          id: "h-plain",
          conversationId: "peer",
          body: "plaintext",
        },
      }),
    })) as unknown as typeof fetch;

    await expect(sendPrivateDcHomeEnvelope(
      { baseUrl: "http://127.0.0.1:8787" },
      {
        conversationId: "peer",
        envelope: "env",
        clientMessageId: "c1",
      },
      fetchImpl,
    )).rejects.toThrow(/plaintext_rejected/);
  });
});

describe("Cut 9.1 Continuity M2 home backup client", () => {
  it("PUTs opaque Continuity backup and returns accepted ACK", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({
        backup: {
          id: "cb-1",
          publicKeyHexHint: "aa",
          acceptedAtUnixMs: 99,
          status: "accepted",
        },
      }),
    })) as unknown as typeof fetch;

    const ack = await putPrivateDcContinuityBackup(
      { baseUrl: "http://127.0.0.1:8787" },
      {
        publicKeyHexHint: "AA",
        sealedEnvelopeJson: "{\"format\":\"obscur.continuity_m1.sealed.v1\"}",
        clientBackupId: "c-1",
      },
      fetchImpl,
    );
    expect(ack.id).toBe("cb-1");
    expect(ack.status).toBe("accepted");
    expect(ack.publicKeyHexHint.toLowerCase()).toBe("aa");
  });

  it("fetches latest Continuity backup or null", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ backup: null }),
    })) as unknown as typeof fetch;

    const empty = await fetchLatestPrivateDcContinuityBackup(
      { baseUrl: "http://127.0.0.1:8787" },
      { publicKeyHexHint: "aa" },
      fetchImpl,
    );
    expect(empty).toBeNull();
  });
});

describe("Cut 13.1 Continuity M6 home list helpers", () => {
  it("lists conversations and drops plaintext message rows", async () => {
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
