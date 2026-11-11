import { describe, expect, it, vi } from "vitest";
import type { EngineInvokeRequest, HostEnginePort } from "@obscur/engine-contracts";
import {
  listPrivateTrustConversationsViaHost,
  listPrivateTrustMessagesViaHost,
  mapRelationshipEdgeToConversationSummary,
} from "./private-trust-home-list";

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

describe("Cut 4.2 private-trust home list", () => {
  it("drops removed edges and maps trusted peers", () => {
    const kept = mapRelationshipEdgeToConversationSummary({
      profile_id: "lab",
      peer_pubkey: "a".repeat(64),
      state: "trusted",
      trust_tier: null,
      updated_at: 100,
    });
    const dropped = mapRelationshipEdgeToConversationSummary({
      profile_id: "lab",
      peer_pubkey: "b".repeat(64),
      state: "removed",
      trust_tier: null,
      updated_at: 200,
    });
    expect(kept?.id).toBe("a".repeat(64));
    expect(dropped).toBeNull();
  });

  it("lists conversations via HostEnginePort relationship edges", async () => {
    const invoke = vi.fn(async (request: EngineInvokeRequest) => {
      expect(request.engine).toBe("privateTrust");
      expect(request.method).toBe("listRelationshipEdges");
      return {
        ok: true,
        data: [
          {
            profile_id: "lab",
            peer_pubkey: "c".repeat(64),
            state: "trusted",
            trust_tier: null,
            updated_at: 50,
          },
          {
            profile_id: "lab",
            peer_pubkey: "d".repeat(64),
            state: "removed",
            trust_tier: null,
            updated_at: 90,
          },
        ],
      };
    });
    const rows = await listPrivateTrustConversationsViaHost({
      host: createHost(invoke),
      profileId: "lab",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("c".repeat(64));
  });

  it("lists messages via dm.getThread", async () => {
    const invoke = vi.fn(async (request: EngineInvokeRequest) => {
      expect(request.engine).toBe("dm");
      expect(request.method).toBe("getThread");
      return {
        ok: true,
        data: [
          {
            event_id: "evt-1",
            plaintext: "hi",
            is_outgoing: true,
            received_at: 42,
          },
        ],
      };
    });
    const rows = await listPrivateTrustMessagesViaHost({
      host: createHost(invoke),
      profileId: "lab",
      conversationId: "peer-1",
    });
    expect(rows).toEqual([
      {
        id: "evt-1",
        conversationId: "peer-1",
        body: "hi",
        direction: "out",
        sentAtUnixMs: 42,
        deliveryStatus: "accepted",
      },
    ]);
  });
});
