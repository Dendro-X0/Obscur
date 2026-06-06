import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { loadEnabledRelayUrlsForIdentity } from "./relay-list-enabled-urls";

const PK = "aa".repeat(32) as PublicKeyHex;

describe("loadEnabledRelayUrlsForIdentity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads v2 relay list storage key (same as use-relay-list)", () => {
    const v2Key = getScopedStorageKey(`obscur.relay_list.v2.${PK}`, "default");
    localStorage.setItem(v2Key, JSON.stringify([
      { url: "wss://relay.team.internal", enabled: true },
      { url: "wss://relay.disabled.example", enabled: false },
    ]));

    expect(loadEnabledRelayUrlsForIdentity(PK, "default")).toEqual([
      "wss://relay.team.internal",
    ]);
  });

  it("falls back to scoped v1 when v2 is absent", () => {
    const v1Key = getScopedStorageKey(`obscur.relay_list.v1.${PK}`, "default");
    localStorage.setItem(v1Key, JSON.stringify([
      { url: "wss://relay.legacy.example", enabled: true },
    ]));

    expect(loadEnabledRelayUrlsForIdentity(PK, "default")).toEqual([
      "wss://relay.legacy.example",
    ]);
  });
});
