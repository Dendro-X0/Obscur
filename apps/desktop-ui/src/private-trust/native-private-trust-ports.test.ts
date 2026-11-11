import { describe, expect, it, vi } from "vitest";
import type { EngineInvokeRequest, HostEnginePort } from "@obscur/engine-contracts";
import { PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED } from "@obscur/private-trust-engine";
import { createNativePrivateTrustHomePorts } from "./native-private-trust-ports";

const createHost = (
  invoke: (request: EngineInvokeRequest) => Promise<{ ok: boolean; data?: unknown; errorMessage?: string }>,
): HostEnginePort => ({
  invoke: async (request) => invoke(request),
  getSnapshot: async (engine, scope) => ({
    engine,
    scope,
    phase: "ready",
    revision: 1,
  }),
  subscribe: () => () => undefined,
});

describe("Cut 4.2 native PrivateTrustHomePorts", () => {
  it("lists via HostEnginePort and refuses silent Nostr", async () => {
    const invoke = vi.fn(async (request: EngineInvokeRequest) => {
      if (request.method === "listRelationshipEdges") {
        return {
          ok: true,
          data: [
            {
              profile_id: "lab",
              peer_pubkey: "e".repeat(64),
              state: "trusted",
              trust_tier: null,
              updated_at: 10,
            },
          ],
        };
      }
      return { ok: false, errorMessage: `unexpected ${request.method}` };
    });
    const ports = createNativePrivateTrustHomePorts({
      host: createHost(invoke),
      profileId: "lab",
      preferPrivateDc: true,
      deliverHomeEnvelope: async () => ({ id: "unused" }),
    });

    expect(ports.resolveProtocolId()).toBe("private_dc");
    const conversations = await ports.listConversations();
    expect(conversations).toHaveLength(1);

    const refused = await ports.sendDm({
      conversationId: conversations[0]!.id,
      body: "no silent fallback",
      carrier: "nostr",
    });
    expect(refused.ok).toBe(false);
    expect(refused.reasonCode).toBe(PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED);
  });

  it("sends private_dc via prepareT3Outbound + injectable home deliver + ACK", async () => {
    const invoke = vi.fn(async (request: EngineInvokeRequest) => {
      if (request.method === "prepareT3Outbound") {
        return {
          ok: true,
          data: {
            clientMessageId: "c1",
            conversationId: "peer-1",
            envelope: "env-1",
            status: "sending",
          },
        };
      }
      if (request.method === "completeT3HomeAck") {
        expect(request.payload).toMatchObject({
          clientMessageId: "c1",
          homeMessageId: "h1",
        });
        return { ok: true };
      }
      return { ok: false, errorMessage: `unexpected ${request.method}` };
    });
    const deliverHomeEnvelope = vi.fn(async () => ({
      id: "h1",
      status: "accepted",
      sentAtUnixMs: 99,
    }));

    const ports = createNativePrivateTrustHomePorts({
      host: createHost(invoke),
      profileId: "lab",
      preferPrivateDc: true,
      deliverHomeEnvelope,
    });

    const sent = await ports.sendDm({
      conversationId: "peer-1",
      body: "sealed hello",
      carrier: "private_dc",
    });
    expect(sent.ok).toBe(true);
    expect(sent.messageId).toBe("h1");
    expect(sent.deliveryStatus).toBe("accepted");
    expect(deliverHomeEnvelope).toHaveBeenCalledOnce();
  });
});
