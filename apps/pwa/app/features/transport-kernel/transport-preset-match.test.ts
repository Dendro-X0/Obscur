import { describe, expect, it } from "vitest";

import { DEFAULT_STABLE_PRESET, HYBRID_PUBLIC_HTTP_PRESET } from "./transport-preset-catalog";
import {
  matchTransportPreset,
  resolveActiveTransportPresetId,
  resolveActiveTransportMix,
  resolveTransportPresetMatches,
} from "./transport-preset-match";
import { classifyRelayEndpointAdapter } from "./relay-endpoint-adapter";

describe("transport-preset-match", () => {
  it("marks preset active when enabled URLs and mode match exactly", () => {
    const relays = DEFAULT_STABLE_PRESET.relays.map((url) => ({ url, enabled: true }));
    expect(matchTransportPreset(relays, "redundancy", DEFAULT_STABLE_PRESET)).toBe("active");
  });

  it("marks preset partial when extra enabled URLs exist", () => {
    const relays = [
      ...DEFAULT_STABLE_PRESET.relays.map((url) => ({ url, enabled: true })),
      { url: "ws://localhost:7000", enabled: true },
    ];
    expect(matchTransportPreset(relays, "redundancy", DEFAULT_STABLE_PRESET)).toBe("partial");
  });

  it("marks preset available when no overlap", () => {
    const relays = [{ url: "ws://localhost:7000", enabled: true }];
    expect(matchTransportPreset(relays, "redundancy", DEFAULT_STABLE_PRESET)).toBe("available");
  });

  it("resolves active preset id from match map", () => {
    const relays = DEFAULT_STABLE_PRESET.relays.map((url) => ({ url, enabled: true }));
    const matches = resolveTransportPresetMatches(relays, "redundancy");
    expect(resolveActiveTransportPresetId(matches)).toBe("default_stable");
  });

  it("resolves hybrid pack active when user applies mixed adapters (not boot default)", () => {
    const relays = [
      { url: "wss://relay.damus.io", enabled: true },
      { url: "wss://nos.lol", enabled: true },
      { url: "wss://relay.primal.net", enabled: true },
      { url: "http://127.0.0.1:8788", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
    ];
    const matches = resolveTransportPresetMatches(relays, "redundancy");
    expect(matches.hybrid_public_http).toBe("active");
    expect(resolveActiveTransportPresetId(matches)).toBe("hybrid_public_http");
  });

  it("resolves local_dev_mesh active when user applies that optional pack", () => {
    const relays = [{ url: "ws://localhost:7000", enabled: true }];
    const matches = resolveTransportPresetMatches(relays, "basic");
    expect(matches.local_dev_mesh).toBe("active");
    expect(resolveActiveTransportPresetId(matches)).toBe("local_dev_mesh");
  });

  it("resolves hybrid_public_http active for Mixed adapters product boot defaults", () => {
    const relays = HYBRID_PUBLIC_HTTP_PRESET.relays.map((url) => ({ url, enabled: true }));
    const matches = resolveTransportPresetMatches(relays, "redundancy");
    expect(matches.hybrid_public_http).toBe("active");
    expect(resolveActiveTransportPresetId(matches)).toBe("hybrid_public_http");
  });

  it("resolves default_stable active when only public Default Stable URLs are enabled", () => {
    const relays = DEFAULT_STABLE_PRESET.relays.map((url) => ({ url, enabled: true }));
    const matches = resolveTransportPresetMatches(relays, "redundancy");
    expect(matches.default_stable).toBe("active");
    expect(resolveActiveTransportPresetId(matches)).toBe("default_stable");
  });

  it("summarizes active transport mix by adapter kind", () => {
    const mix = resolveActiveTransportMix(
      [
        { url: "wss://relay.damus.io", enabled: true },
        { url: "http://127.0.0.1:8788", enabled: true },
        { url: "ws://localhost:7000", enabled: false },
      ],
      "redundancy",
      classifyRelayEndpointAdapter,
    );
    expect(mix.publicNostr).toBe(1);
    expect(mix.privateMesh).toBe(1);
    expect(mix.tor).toBe(0);
    expect(mix.totalEnabled).toBe(2);
    expect(mix.redundancyMode).toBe(true);
  });
});
