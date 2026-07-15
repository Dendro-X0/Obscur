import { describe, expect, it, vi } from "vitest";

import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

import { createConduitMeshRelayPoolRuntime } from "./conduit-mesh-relay-pool-runtime";
import { resolveRelayPoolConduitDescriptors } from "./resolve-relay-pool-conduit-descriptors";

const torRequiredHttp: ConduitDescriptor = {
  conduitId: "team-tor-http",
  dialect: "team_relay",
  endpoints: ["http://abcdef123.onion:8788"],
  capabilities: ["publish", "subscribe"],
  networkPolicy: "tor_required",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
};

describe("conduit-mesh C13 Tor SOCKS routing", () => {
  it("maps onion HTTP URLs to tor_required descriptors", () => {
    const descriptors = resolveRelayPoolConduitDescriptors([
      "http://abcdef123.onion:8788",
      "http://127.0.0.1:8788",
    ]);
    expect(descriptors[0]?.networkPolicy).toBe("tor_required");
    expect(descriptors[1]?.networkPolicy).toBe("clearnet");
  });

  it("routes tor_required HTTP publish through socksFetch with proxyUrl", async () => {
    const socksCalls: Array<{ proxyUrl: string; url: string }> = [];
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c13-socks",
      getTorState: async () => ({
        configured: true,
        ready: true,
        proxyUrl: "socks5h://127.0.0.1:9050",
      }),
      fetch: async () => new Response("should-not-use-direct", { status: 500 }),
      socksFetch: async (proxyUrl, input) => {
        socksCalls.push({ proxyUrl, url: String(input) });
        return Response.json({ accepted: true, storedRef: "socks-ref" });
      },
      now: () => 1_700_005_000_000,
    });

    await runtime.mesh.configureConduits([torRequiredHttp]);
    const outcome = await runtime.mesh.publishEnvelope({
      envelopeId: "c13-env",
      scope: { profileId: "c13-socks" },
      messageScope: "dm",
      audience: { kind: "dm", recipientPublicKeyHex: "aa".repeat(32) },
      ciphertext: new TextEncoder().encode("opaque"),
      evidenceClass: "at_least_one_conduit_accept",
      createdAtUnixMs: 1_700_005_000,
    });

    expect(outcome.accepted).toBe(true);
    expect(socksCalls.length).toBeGreaterThan(0);
    expect(socksCalls.every((call) => call.proxyUrl === "socks5h://127.0.0.1:9050")).toBe(true);
    expect(socksCalls.some((call) => call.url.includes("/mesh/v1/envelopes"))).toBe(true);
  });

  it("does not call socksFetch for clearnet HTTP", async () => {
    const socksFetch = vi.fn(async () => Response.json({ accepted: true }));
    const directFetch = vi.fn(async () => Response.json({ accepted: true, storedRef: "direct" }));
    const runtime = createConduitMeshRelayPoolRuntime({
      profileId: "c13-clear",
      getTorState: async () => ({
        configured: true,
        ready: true,
        proxyUrl: "socks5h://127.0.0.1:9050",
      }),
      fetch: directFetch,
      socksFetch,
      now: () => 1_700_005_100_000,
    });

    await runtime.configureUrls(["http://127.0.0.1:8788"]);
    const result = await runtime.publishToUrls(
      ["http://127.0.0.1:8788"],
      "opaque-clearnet",
      { quorumRequired: 1 },
    );

    expect(result.metQuorum).toBe(true);
    expect(directFetch).toHaveBeenCalled();
    expect(socksFetch).not.toHaveBeenCalled();
  });
});
