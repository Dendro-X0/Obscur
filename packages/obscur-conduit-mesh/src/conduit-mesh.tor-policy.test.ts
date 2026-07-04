import { describe, expect, it, beforeEach } from "vitest";

import type { ConduitDescriptor, MeshEnvelope } from "@obscur/conduit-mesh-contracts";

import { createConduitMesh } from "./create-conduit-mesh";
import { mapTorStatusSnapshotToMeshTorState } from "./map-tor-status-snapshot";
import { createMockConduitDriver, resetMockConduitDriverCounters } from "./mock-conduit-driver";

const FIXED_NOW = 1_700_000_000_000;

const torRequiredTeam = (): ConduitDescriptor => ({
  conduitId: "team-tor",
  dialect: "team_relay",
  endpoints: ["wss://relay.onion.internal"],
  capabilities: ["publish", "subscribe"],
  networkPolicy: "tor_required",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

const clearnetCustom = (): ConduitDescriptor => ({
  conduitId: "custom-clearnet",
  dialect: "custom",
  endpoints: ["https://mesh.example.internal"],
  capabilities: ["publish", "pull"],
  networkPolicy: "clearnet",
  trustTier: "user_configured",
  enabled: true,
  priority: 1,
});

const sampleEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-tor-1",
  scope: { profileId: "profile-a" },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "cafe" },
  ciphertext: new Uint8Array([1, 2, 3]),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: FIXED_NOW,
});

describe("conduit-mesh — C3 tor policy", () => {
  beforeEach(() => {
    resetMockConduitDriverCounters();
  });

  it("fail-closed when only tor_required conduit and Tor is down", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      getTorState: () => ({ configured: true, ready: false, proxyUrl: "socks5h://127.0.0.1:9050" }),
    });

    await mesh.configureConduits([torRequiredTeam()]);
    const outcome = await mesh.publishEnvelope(sampleEnvelope());
    const snapshot = await mesh.getSnapshot({ profileId: "profile-a" });

    expect(outcome.accepted).toBe(false);
    expect(outcome.errorMessage).toBe("tor_unreachable");
    expect(snapshot.recoveryReasonCode).toBe("tor_unreachable");
    expect(snapshot.torReady).toBe(false);
    expect(snapshot.torConfigured).toBe(true);
    expect(snapshot.blockedConduitIds).toContain("team-tor");
  });

  it("falls back to clearnet conduit when tor_required is blocked", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      getTorState: () => ({ configured: true, ready: false }),
    });

    await mesh.configureConduits([torRequiredTeam(), clearnetCustom()]);
    const outcome = await mesh.publishEnvelope(sampleEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => e.conduitId === "custom-clearnet")).toBe(true);
  });

  it("publishes via tor_required when Tor is ready", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      getTorState: () => ({ configured: true, ready: true, proxyUrl: "socks5h://127.0.0.1:9050" }),
    });

    await mesh.configureConduits([torRequiredTeam()]);
    const outcome = await mesh.publishEnvelope(sampleEnvelope());
    const snapshot = await mesh.getSnapshot({ profileId: "profile-a" });

    expect(outcome.accepted).toBe(true);
    expect(snapshot.torReady).toBe(true);
    expect(snapshot.effectiveNetworkPolicy).toBe("tor_required");
  });

  it("maps desktop TorStatusSnapshot shape to mesh state", () => {
    expect(mapTorStatusSnapshotToMeshTorState({
      configured: true,
      ready: true,
      proxyUrl: "socks5h://127.0.0.1:9050",
    })).toEqual({
      configured: true,
      ready: true,
      proxyUrl: "socks5h://127.0.0.1:9050",
    });
  });
});
