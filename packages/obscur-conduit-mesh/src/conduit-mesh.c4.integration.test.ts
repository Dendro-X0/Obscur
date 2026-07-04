import { describe, expect, it, beforeEach } from "vitest";

import type { ConduitDescriptor, MeshEnvelope } from "@obscur/conduit-mesh-contracts";

import { createConduitMesh } from "./create-conduit-mesh";
import { createConduitDriverFromDescriptor } from "./create-conduit-driver";
import {
  resetCoordinationHttpConduitDriverCounters,
} from "./coordination-http-conduit-driver";
import { resetCustomHttpConduitDriverCounters } from "./custom-http-conduit-driver";
import { createInMemoryConduitFetchRouter } from "./in-memory-conduit-fetch-router";
import { resolveTeamRelayHttpBaseUrl } from "./team-relay-conduit-driver";
import { resetMockConduitDriverCounters } from "./mock-conduit-driver";

const FIXED_NOW = 1_700_000_100_000;
const COORDINATION_BASE = "http://127.0.0.1:8787";
const TEAM_WSS = "wss://127.0.0.1:8788";
const TEAM_HTTP = resolveTeamRelayHttpBaseUrl(TEAM_WSS);
const CUSTOM_BASE = "http://127.0.0.1:8789";

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

const customDescriptor = (): ConduitDescriptor => ({
  conduitId: "custom-fallback",
  dialect: "custom",
  endpoints: [CUSTOM_BASE],
  capabilities: ["publish"],
  networkPolicy: "clearnet",
  trustTier: "user_configured",
  enabled: true,
  priority: 1,
});

const coordinationDescriptor = (): ConduitDescriptor => ({
  conduitId: "coord-directory",
  dialect: "coordination_http",
  endpoints: [COORDINATION_BASE],
  capabilities: ["publish", "pull"],
  networkPolicy: "clearnet",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

const dmEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-c4-dm",
  scope: { profileId: "profile-a" },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "abc" },
  ciphertext: new Uint8Array([4, 5, 6]),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: FIXED_NOW,
});

const workspaceHeadEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-c4-head",
  scope: { profileId: "profile-a" },
  messageScope: "workspace",
  audience: { kind: "workspace", communityId: "community-c4" },
  ciphertext: new Uint8Array([1]),
  evidenceClass: "coordination_head",
  createdAtUnixMs: FIXED_NOW,
});

const createTestMesh = (fetchRouter: ReturnType<typeof createInMemoryConduitFetchRouter>) => (
  createConduitMesh({
    scope: { profileId: "profile-a" },
    now: () => FIXED_NOW,
    createDriver: (descriptor) => createConduitDriverFromDescriptor(descriptor, {
      fetch: fetchRouter,
      now: () => FIXED_NOW,
    }),
  })
);

describe("conduit-mesh — C4 adapter wiring", () => {
  beforeEach(() => {
    resetMockConduitDriverCounters();
    resetCustomHttpConduitDriverCounters();
    resetCoordinationHttpConduitDriverCounters();
  });

  it("publishes DM via team_relay HTTP mesh gateway against in-memory router", async () => {
    const fetchRouter = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: COORDINATION_BASE,
      teamRelayBaseUrl: TEAM_HTTP,
    });
    const mesh = createTestMesh(fetchRouter);

    await mesh.configureConduits([teamDescriptor()]);
    const outcome = await mesh.publishEnvelope(dmEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.conduitId === "team-primary" && e.kind === "accepted_by_operator"
    ))).toBe(true);
  });

  it("fetches coordination membership head for coordination_head evidence", async () => {
    const fetchRouter = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: COORDINATION_BASE,
      teamRelayBaseUrl: TEAM_HTTP,
      membershipHeadSeq: 7,
    });
    const mesh = createTestMesh(fetchRouter);

    await mesh.configureConduits([coordinationDescriptor()]);
    const outcome = await mesh.publishEnvelope(workspaceHeadEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.kind === "coordination_head_seq" && e.coordinationHeadSeq === 7
    ))).toBe(true);
  });

  it("promotes from failing team_relay to custom HTTP gateway", async () => {
    const fetchRouter = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: COORDINATION_BASE,
      teamRelayBaseUrl: TEAM_HTTP,
      teamPublishFails: true,
    });

    const customFetch: typeof fetchRouter = async (input, init) => {
      const url = new URL(input, CUSTOM_BASE);
      if (url.origin === new URL(CUSTOM_BASE).origin) {
        return fetchRouter(input, init);
      }
      return fetchRouter(input, init);
    };

    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      createDriver: (descriptor) => {
        const baseFetch = descriptor.conduitId === "custom-fallback"
          ? createInMemoryConduitFetchRouter({
            coordinationBaseUrl: COORDINATION_BASE,
            teamRelayBaseUrl: CUSTOM_BASE,
            teamPublishFails: false,
          })
          : fetchRouter;
        return createConduitDriverFromDescriptor(descriptor, {
          fetch: baseFetch,
          now: () => FIXED_NOW,
        });
      },
    });

    await mesh.configureConduits([teamDescriptor(), customDescriptor()]);
    const outcome = await mesh.publishEnvelope(dmEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.conduitId === "team-primary" && e.kind === "publish_failed"
    ))).toBe(true);
    expect(outcome.evidence.some((e) => (
      e.conduitId === "custom-fallback" && e.kind === "accepted_by_operator"
    ))).toBe(true);
  });

  it("probes coordination /health and team mesh /mesh/v1/health", async () => {
    const fetchRouter = createInMemoryConduitFetchRouter({
      coordinationBaseUrl: COORDINATION_BASE,
      teamRelayBaseUrl: TEAM_HTTP,
    });

    const coordDriver = createConduitDriverFromDescriptor(coordinationDescriptor(), {
      fetch: fetchRouter,
    });
    const teamDriver = createConduitDriverFromDescriptor(teamDescriptor(), {
      fetch: fetchRouter,
    });

    expect(await coordDriver.probe()).toEqual({ health: "healthy" });
    expect(await teamDriver.probe()).toEqual({ health: "healthy" });
  });
});
