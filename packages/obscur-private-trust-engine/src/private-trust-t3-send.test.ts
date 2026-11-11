import { describe, expect, it, vi } from "vitest";
import type { EngineInvokeRequest, HostEnginePort } from "@obscur/engine-contracts";
import { sendPrivateTrustT3ViaHost } from "./private-trust-t3-send";

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

describe("Cut 4.2 sendPrivateTrustT3ViaHost", () => {
  it("prepare → deliver → completeT3HomeAck returns accepted", async () => {
    const invoke = vi.fn(async (request: EngineInvokeRequest) => {
      if (request.method === "prepareT3Outbound") {
        return {
          ok: true,
          data: {
            clientMessageId: "client-1",
            conversationId: "peer-aa",
            envelope: "sealed-envelope",
            status: "sending",
          },
        };
      }
      if (request.method === "completeT3HomeAck") {
        return { ok: true };
      }
      return { ok: false, errorMessage: `unexpected ${request.method}` };
    });
    const deliverHomeEnvelope = vi.fn(async () => ({
      id: "home-99",
      status: "accepted",
      sentAtUnixMs: 1_700_000_000_000,
    }));

    const result = await sendPrivateTrustT3ViaHost({
      host: createHost(invoke),
      profileId: "lab",
      conversationId: "peer-aa",
      peerPubkey: "peer-aa",
      plaintext: "hello",
      deliverHomeEnvelope,
    });

    expect(result.messageId).toBe("home-99");
    expect(result.clientMessageId).toBe("client-1");
    expect(result.deliveryStatus).toBe("accepted");
    expect(deliverHomeEnvelope).toHaveBeenCalledWith({
      conversationId: "peer-aa",
      envelope: "sealed-envelope",
      clientMessageId: "client-1",
    });
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
