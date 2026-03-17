import { describe, expect, it } from "vitest";
import { defaultPrivacySettings } from "./privacy-settings-service";
import { getV090RolloutPolicy, normalizeV090Flags } from "./v090-rollout-policy";

describe("v090-rollout-policy", () => {
  it("forces deterministic/protocol/x3dh off in stability mode", () => {
    const normalized = normalizeV090Flags({
      ...defaultPrivacySettings,
      useModernDMs: true,
      stabilityModeV090: true,
      deterministicDiscoveryV090: true,
      protocolCoreRustV090: true,
      x3dhRatchetV090: true,
      tanstackQueryV1: true,
    });
    expect(normalized.useModernDMs).toBe(false);
    expect(normalized.stabilityModeV090).toBe(true);
    expect(normalized.deterministicDiscoveryV090).toBe(false);
    expect(normalized.protocolCoreRustV090).toBe(false);
    expect(normalized.x3dhRatchetV090).toBe(false);
    expect(normalized.tanstackQueryV1).toBe(false);
  });

  it("auto-enables protocol core when x3dh is enabled", () => {
    const normalized = normalizeV090Flags({
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      protocolCoreRustV090: false,
      x3dhRatchetV090: true,
    });
    expect(normalized.protocolCoreRustV090).toBe(true);
    expect(normalized.x3dhRatchetV090).toBe(true);
  });

  it("requires protocol core before deterministic discovery is active", () => {
    const normalizedWithoutProtocol = normalizeV090Flags({
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      deterministicDiscoveryV090: true,
      protocolCoreRustV090: false,
    });
    expect(normalizedWithoutProtocol.deterministicDiscoveryV090).toBe(false);

    const withoutProtocol = getV090RolloutPolicy({
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      deterministicDiscoveryV090: true,
      protocolCoreRustV090: false,
    });
    expect(withoutProtocol.deterministicDiscoveryEnabled).toBe(false);

    const withProtocol = getV090RolloutPolicy({
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      deterministicDiscoveryV090: true,
      protocolCoreRustV090: true,
      tanstackQueryV1: true,
    });
    expect(withProtocol.deterministicDiscoveryEnabled).toBe(true);
    expect(withProtocol.tanstackQueryEnabled).toBe(true);
  });

  it("forces legacy DMs when protocol core is disabled", () => {
    const normalized = normalizeV090Flags({
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      useModernDMs: true,
      protocolCoreRustV090: false,
    });

    expect(normalized.useModernDMs).toBe(false);
  });
});
