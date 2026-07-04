import { describe, expect, it } from "vitest";

import {
  NOSTR_WS_CONDUIT_WIRE_V1,
  OBSCUR_MESH_NOSTR_EVENT_KIND,
  buildNostrWsWirePayload,
  deriveHeadlessNostrEventId,
  parseNostrWsOkMessage,
} from "./nostr-ws-wire-contract";
import type { MeshEnvelope } from "./envelope";

const baseEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-nostr-1",
  scope: { profileId: "profile-nostr" },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "recipient-abc" },
  ciphertext: new Uint8Array([9, 8, 7]),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: 1_700_000_300_000,
});

describe("nostr-ws-wire-contract", () => {
  it("pins wire version and event kind", () => {
    expect(NOSTR_WS_CONDUIT_WIRE_V1).toBe("nostr_ws_conduit_wire_v1");
    expect(OBSCUR_MESH_NOSTR_EVENT_KIND).toBe(31990);
  });

  it("builds EVENT wire payload with mesh tags and base64 ciphertext", () => {
    const payload = buildNostrWsWirePayload(baseEnvelope());
    const parsed = JSON.parse(payload) as unknown;

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toBe("EVENT");

    const event = parsed[1] as {
      kind: number;
      tags: string[][];
      content: string;
      id: string;
    };

    expect(event.kind).toBe(OBSCUR_MESH_NOSTR_EVENT_KIND);
    expect(event.tags).toContainEqual(["mesh", NOSTR_WS_CONDUIT_WIRE_V1]);
    expect(event.tags).toContainEqual(["d", "env-nostr-1"]);
    expect(event.id).toBe(deriveHeadlessNostrEventId("env-nostr-1"));
    expect(event.content).toBe("CQgH");
  });

  it("parses NIP-20 OK messages", () => {
    expect(parseNostrWsOkMessage('["OK","abc",true,""]')).toEqual({
      ok: true,
      eventId: "abc",
      errorMessage: undefined,
    });
    expect(parseNostrWsOkMessage('["OK","abc",false,"duplicate"]')).toEqual({
      ok: false,
      eventId: "abc",
      errorMessage: "duplicate",
    });
  });
});
