import { describe, expect, it, vi } from "vitest";
import {
  PRIVATE_DC_HTTP_ERROR,
  PRIVATE_DC_WIRE_V01,
  normalizeCipherEnvelope,
  privateDcHealth,
  privateDcListMessageEnvelopes,
  privateDcSendEnvelope,
} from "./private-dc-client";
import type { PrivateDcSession } from "./private-dc-session";

const SESSION: PrivateDcSession = {
  baseUrl: "https://home.example.com/",
  bearerToken: "tok",
};

describe("private-dc H-dc v0.1 (Cut 0.6)", () => {
  it("normalizes cipher envelopes and drops plaintext-only rows", () => {
    expect(normalizeCipherEnvelope({
      id: "m1",
      conversationId: "c1",
      envelope: "cipher-blob",
      sentAtUnixMs: 10,
      direction: "in",
      status: "accepted",
    })).toEqual({
      id: "m1",
      conversationId: "c1",
      envelope: "cipher-blob",
      clientMessageId: undefined,
      sentAtUnixMs: 10,
      direction: "in",
      status: "accepted",
    });

    expect(normalizeCipherEnvelope({
      id: "m2",
      conversationId: "c1",
      body: "plaintext",
      sentAtUnixMs: 10,
      direction: "in",
    })).toBeNull();

    // Home "delivered" / "sent" ACK maps to accepted (Cut 0 status law)
    expect(normalizeCipherEnvelope({
      id: "m3",
      conversationId: "c1",
      envelope: "x",
      sentAtUnixMs: 1,
      status: "delivered",
    })?.status).toBe("accepted");
  });

  it("probes /v1/health", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://home.example.com/v1/health");
      return new Response(JSON.stringify({ ok: true, wire: PRIVATE_DC_WIRE_V01 }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(privateDcHealth(SESSION, fetchImpl)).resolves.toEqual({
      ok: true,
      wire: PRIVATE_DC_WIRE_V01,
    });
  });

  it("polls envelopes with since= and drops plaintext rows", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        "https://home.example.com/v1/conversations/ops/messages?since=100&limit=5",
      );
      return new Response(JSON.stringify({
        messages: [
          {
            id: "m1",
            conversationId: "ops",
            envelope: "e1",
            sentAtUnixMs: 200,
            direction: "in",
            status: "accepted",
          },
          {
            id: "m2",
            conversationId: "ops",
            body: "lab seed",
            sentAtUnixMs: 150,
            direction: "in",
          },
        ],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const rows = await privateDcListMessageEnvelopes(SESSION, {
      conversationId: "ops",
      since: 100,
      limit: 5,
    }, fetchImpl);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.envelope).toBe("e1");
  });

  it("sends opaque envelope and maps home ACK to accepted", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        envelope: "sealed",
        clientMessageId: "cmid-1",
      });
      return new Response(JSON.stringify({
        message: {
          id: "home-9",
          conversationId: "ops",
          envelope: "sealed",
          clientMessageId: "cmid-1",
          sentAtUnixMs: 42,
          direction: "out",
          status: "accepted",
        },
      }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(privateDcSendEnvelope(SESSION, {
      conversationId: "ops",
      envelope: "sealed",
      clientMessageId: "cmid-1",
    }, fetchImpl)).resolves.toMatchObject({
      id: "home-9",
      envelope: "sealed",
      status: "accepted",
    });
  });

  it("rejects empty envelope / clientMessageId before fetch", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(privateDcSendEnvelope(SESSION, {
      conversationId: "ops",
      envelope: "  ",
      clientMessageId: "c1",
    }, fetchImpl)).rejects.toThrow(new RegExp(`${PRIVATE_DC_HTTP_ERROR}_envelope_required`));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fail-closes when home echoes plaintext-only ACK for envelope send", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      message: {
        id: "m9",
        conversationId: "ops",
        body: "leaked",
        sentAtUnixMs: 1,
        direction: "out",
        status: "sent",
      },
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(privateDcSendEnvelope(SESSION, {
      conversationId: "ops",
      envelope: "sealed",
      clientMessageId: "c1",
    }, fetchImpl)).rejects.toThrow(new RegExp(`${PRIVATE_DC_HTTP_ERROR}_plaintext_rejected`));
  });
});
