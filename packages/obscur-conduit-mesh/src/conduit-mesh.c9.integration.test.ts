import { describe, expect, it } from "vitest";

import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";

const torRequiredHttpConduit = (): ConduitDescriptor => ({
  conduitId: "team-tor-http",
  dialect: "team_relay",
  endpoints: ["http://127.0.0.1:8788"],
  capabilities: ["publish"],
  networkPolicy: "tor_required",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

describe("conduit-mesh C9 tor host integration", () => {
  it("relay pool runtime forwards getTorState to mesh snapshot", async () => {
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c9-tor",
      getTorState: async () => ({
        configured: true,
        ready: false,
        proxyUrl: "socks5h://127.0.0.1:9050",
      }),
      now: () => 1_700_001_100_000,
    });

    await runtime.mesh.configureConduits([torRequiredHttpConduit()]);
    const snapshot = await runtime.mesh.getSnapshot({ profileId: "c9-tor" });

    expect(snapshot.torConfigured).toBe(true);
    expect(snapshot.torReady).toBe(false);
    expect(snapshot.blockedConduitIds).toContain("team-tor-http");
  });

  it("fail-closed publish when tor_required and Tor down", async () => {
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c9-tor-fail",
      getTorState: async () => ({ configured: true, ready: false }),
      now: () => 1_700_001_200_000,
    });

    await runtime.mesh.configureConduits([torRequiredHttpConduit()]);
    const outcome = await runtime.mesh.publishEnvelope({
      envelopeId: "env-c9",
      scope: { profileId: "c9-tor-fail" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: "aa" },
      ciphertext: new Uint8Array([1]),
      evidenceClass: "at_least_one_conduit_accept",
      createdAtUnixMs: 1_700_001_200_000,
    });

    expect(outcome.accepted).toBe(false);
    expect(outcome.errorMessage).toBe("tor_unreachable");
  });
});
