import { describe, expect, it, beforeEach } from "vitest";

import type { ConduitDescriptor, MeshEnvelope } from "@obscur/conduit-mesh-contracts";
import {
  NOSTR_WS_CONDUIT_WIRE_V1,
  buildNostrWsWirePayload,
} from "@obscur/conduit-mesh-contracts";

import { createConduitMesh } from "./create-conduit-mesh";
import { createConduitDriverFromDescriptor } from "./create-conduit-driver";
import { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";
import { createInMemoryNostrWsWire } from "./nostr-ws-wire-port";
import { resetNostrWsConduitDriverCounters } from "./nostr-ws-conduit-driver";
import { resolveTeamRelayHttpBaseUrl } from "./team-relay-conduit-driver";
import { resetCustomHttpConduitDriverCounters } from "./custom-http-conduit-driver";

const FIXED_NOW = 1_700_000_400_000;
const COORDINATION_BASE = "http://127.0.0.1:8787";
const TEAM_WSS = "wss://127.0.0.1:8788";
const TEAM_HTTP = resolveTeamRelayHttpBaseUrl(TEAM_WSS);
const NOSTR_WSS = "wss://relay.nostr.example";

const teamDescriptor = (): ConduitDescriptor => ({
  conduitId: "team-primary",
  dialect: "team_relay",
  endpoints: [TEAM_WSS],
  capabilities: ["publish", "subscribe"],
  networkPolicy: "clearnet",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

const nostrDescriptor = (): ConduitDescriptor => ({
  conduitId: "nostr-fallback",
  dialect: "nostr_ws",
  endpoints: [NOSTR_WSS],
  capabilities: ["publish", "subscribe"],
  networkPolicy: "clearnet",
  trustTier: "public_untrusted",
  enabled: true,
  priority: 1,
});

const dmEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-c6-dm",
  scope: { profileId: "profile-a" },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "abc" },
  ciphertext: new Uint8Array([4, 5, 6]),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: FIXED_NOW,
});

describe("conduit-mesh — C6 nostr_ws driver", () => {
  beforeEach(() => {
    resetNostrWsConduitDriverCounters();
    resetCustomHttpConduitDriverCounters();
  });

  it("publishes DM via nostr_ws wire and records stored_proof with event id", async () => {
    const wire = createInMemoryNostrWsWire();
    const driver = createConduitDriverFromDescriptor(nostrDescriptor(), {
      nostrWire: wire,
      now: () => FIXED_NOW,
    });

    const outcome = await driver.publish(dmEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.conduitId === "nostr-fallback"
      && e.kind === "stored_proof"
      && typeof e.externalRef === "string"
      && e.externalRef.length > 0
    ))).toBe(true);
  });

  it("wire payload carries mesh contract tag", async () => {
    const captured: string[] = [];
    const wire = createInMemoryNostrWsWire();
    const capturingWire = {
      ...wire,
      publish: async (relayUrl: string, wirePayload: string) => {
        captured.push(wirePayload);
        return wire.publish(relayUrl, wirePayload);
      },
    };

    const driver = createConduitDriverFromDescriptor(nostrDescriptor(), {
      nostrWire: capturingWire,
      now: () => FIXED_NOW,
    });

    await driver.publish(dmEnvelope());

    const payload = captured[0] ?? "";
    const parsed = JSON.parse(payload) as [string, { tags: string[][] }];
    expect(parsed[0]).toBe("EVENT");
    expect(parsed[1].tags).toContainEqual(["mesh", NOSTR_WS_CONDUIT_WIRE_V1]);
    expect(payload).toBe(buildNostrWsWirePayload(dmEnvelope()));
  });

  it("promotes from failing team_relay to nostr_ws on lane switch", async () => {
    const fetchRouter = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: COORDINATION_BASE,
      teamRelayBaseUrl: TEAM_HTTP,
      teamPublishFails: true,
    });
    const nostrWire = createInMemoryNostrWsWire();

    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      createDriver: (descriptor) => createConduitDriverFromDescriptor(descriptor, {
        fetch: fetchRouter,
        nostrWire,
        now: () => FIXED_NOW,
      }),
    });

    await mesh.configureConduits([teamDescriptor(), nostrDescriptor()]);
    const outcome = await mesh.publishEnvelope(dmEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.conduitId === "team-primary" && e.kind === "publish_failed"
    ))).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.conduitId === "nostr-fallback" && e.kind === "stored_proof"
    ))).toBe(true);
  });

  it("probe reports offline when in-memory wire marks relay offline", async () => {
    const wire = createInMemoryNostrWsWire({
      offlineRelayUrls: new Set([NOSTR_WSS]),
    });
    const driver = createConduitDriverFromDescriptor(nostrDescriptor(), {
      nostrWire: wire,
      now: () => FIXED_NOW,
    });

    const probe = await driver.probe();
    expect(probe.health).toBe("degraded");
    expect(probe.detail).toBe("relay_offline");
  });
});
