import { describe, expect, it } from "vitest";
import { queryKeyFactory } from "./query-key-factory";
import { ANONYMOUS_QUERY_SCOPE, createQueryScope } from "./query-scope";

describe("query-key-factory", () => {
  it("builds deterministic scoped keys for discovery search", () => {
    const scope = createQueryScope({
      profileId: "alice",
      publicKeyHex: "a".repeat(64) as any,
    });
    const first = queryKeyFactory.discoverySearch({
      scope,
      query: "bob",
      intent: "add_friend",
    });
    const second = queryKeyFactory.discoverySearch({
      scope,
      query: "bob",
      intent: "add_friend",
    });

    expect(first).toEqual(second);
    expect(first[2]).toEqual(scope);
    expect(first[3]).toEqual({
      query: "bob",
      intent: "add_friend",
    });
  });

  it("includes explicit anonymous marker when no public key is available", () => {
    const scope = createQueryScope({
      profileId: "guest",
      publicKeyHex: null,
    });
    const key = queryKeyFactory.accountSyncSnapshot({ scope });

    expect(scope.publicKeyHex).toBe(ANONYMOUS_QUERY_SCOPE);
    expect(key[2]).toEqual({
      profileId: "guest",
      publicKeyHex: "anonymous",
    });
  });

  it("uses canonical namespaces per phase-1 slice", () => {
    const scope = createQueryScope({
      profileId: "default",
      publicKeyHex: "b".repeat(64) as any,
    });
    const discoveryKey = queryKeyFactory.discoverySearch({
      scope,
      query: "hello",
      intent: "search_people",
    });
    const identityKey = queryKeyFactory.identityResolution({
      scope,
      query: "hello",
      allowLegacyInviteCode: true,
    });
    const relayKey = queryKeyFactory.relayDiagnosticsProbeSnapshot({ scope });
    const accountSyncKey = queryKeyFactory.accountSyncSnapshot({ scope });

    expect(discoveryKey[1]).toBe("discovery_search");
    expect(identityKey[1]).toBe("identity_resolution");
    expect(relayKey[1]).toBe("relay_diagnostics_probe_snapshot");
    expect(accountSyncKey[1]).toBe("account_sync_snapshot");
  });
});

