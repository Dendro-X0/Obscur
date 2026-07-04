import { describe, expect, it } from "vitest";

import {
  CUSTOM_CONDUIT_HTTP_PATHS,
  CUSTOM_CONDUIT_HTTP_V1,
  resolveCandidateConduits,
  satisfiesEvidenceClass,
  validateMeshEnvelope,
} from "./index";
import type { ConduitDescriptor, MeshEnvelope, MeshEvidenceRecord } from "./index";

const baseEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-1",
  scope: { profileId: "profile-a" },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "abc123" },
  ciphertext: new Uint8Array([1, 2, 3]),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: 1_700_000_000_000,
});

const teamConduit = (): ConduitDescriptor => ({
  conduitId: "team-primary",
  dialect: "team_relay",
  endpoints: ["wss://relay.internal.example"],
  capabilities: ["publish", "subscribe"],
  networkPolicy: "clearnet",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

const customConduit = (): ConduitDescriptor => ({
  conduitId: "custom-home",
  dialect: "custom",
  endpoints: ["https://mesh.example.internal"],
  capabilities: ["publish", "pull"],
  networkPolicy: "clearnet",
  trustTier: "user_configured",
  enabled: true,
  priority: 1,
});

describe("conduit-mesh-contracts — envelope validation", () => {
  it("accepts a minimal valid DM envelope", () => {
    expect(validateMeshEnvelope(baseEnvelope())).toEqual({ ok: true });
  });

  it("rejects empty ciphertext", () => {
    expect(validateMeshEnvelope({
      ...baseEnvelope(),
      ciphertext: new Uint8Array(),
    })).toEqual({ ok: false, reason: "ciphertext_required" });
  });

  it("rejects audience mismatch for workspace scope", () => {
    expect(validateMeshEnvelope({
      ...baseEnvelope(),
      messageScope: "workspace",
      audience: { kind: "dm", recipientPublicKeyHex: "abc" },
    })).toEqual({ ok: false, reason: "workspace_audience_invalid" });
  });
});

describe("conduit-mesh-contracts — conduit policy", () => {
  it("selects enabled publish-capable conduits by priority", () => {
    const candidates = resolveCandidateConduits(
      [customConduit(), teamConduit()],
      baseEnvelope(),
    );
    expect(candidates.map((c) => c.conduitId)).toEqual(["team-primary", "custom-home"]);
  });

  it("respects allowedConduitIds", () => {
    const candidates = resolveCandidateConduits(
      [customConduit(), teamConduit()],
      { ...baseEnvelope(), allowedConduitIds: ["custom-home"] },
    );
    expect(candidates.map((c) => c.conduitId)).toEqual(["custom-home"]);
  });

  it("excludes forbidden conduits", () => {
    const candidates = resolveCandidateConduits(
      [customConduit(), teamConduit()],
      { ...baseEnvelope(), forbiddenConduitIds: ["team-primary"] },
    );
    expect(candidates.map((c) => c.conduitId)).toEqual(["custom-home"]);
  });

  it("works with zero nostr conduits — no ecosystem dependency", () => {
    const candidates = resolveCandidateConduits(
      [teamConduit(), customConduit()],
      baseEnvelope(),
    );
    expect(candidates.every((c) => c.dialect !== "nostr_ws")).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });
});

describe("conduit-mesh-contracts — evidence class", () => {
  const acceptRecord: MeshEvidenceRecord = {
    evidenceId: "ev-1",
    envelopeId: "env-1",
    kind: "accepted_by_operator",
    atUnixMs: 1,
    conduitId: "team-primary",
  };

  it("satisfies at_least_one_conduit_accept on operator accept", () => {
    expect(satisfiesEvidenceClass("at_least_one_conduit_accept", [acceptRecord])).toBe(true);
  });

  it("does not satisfy recipient_ack without inbound evidence", () => {
    expect(satisfiesEvidenceClass("recipient_ack", [acceptRecord])).toBe(false);
  });
});

describe("conduit-mesh-contracts — custom gateway HTTP v1", () => {
  it("pins contract version and paths", () => {
    expect(CUSTOM_CONDUIT_HTTP_V1).toBe("custom_conduit_http_v1");
    expect(CUSTOM_CONDUIT_HTTP_PATHS.publish).toBe("/mesh/v1/envelopes");
    expect(CUSTOM_CONDUIT_HTTP_PATHS.health).toBe("/mesh/v1/health");
  });
});
