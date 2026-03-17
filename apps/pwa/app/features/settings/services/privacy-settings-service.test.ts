import { describe, expect, it, beforeEach } from "vitest";
import { PrivacySettingsService, defaultPrivacySettings } from "./privacy-settings-service";

describe("privacy-settings-service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults chatUxV083 to false", () => {
    const settings = PrivacySettingsService.getSettings();
    expect(settings.chatUxV083).toBe(false);
  });

  it("persists chatUxV083 flag", () => {
    const next = { ...defaultPrivacySettings, chatUxV083: true };
    PrivacySettingsService.saveSettings(next);
    const loaded = PrivacySettingsService.getSettings();
    expect(loaded.chatUxV083).toBe(true);
  });

  it("defaults reliabilityCoreV087 to true", () => {
    const settings = PrivacySettingsService.getSettings();
    expect(settings.reliabilityCoreV087).toBe(true);
  });

  it("defaults v0.9 rollout flags to safe values", () => {
    const settings = PrivacySettingsService.getSettings();
    expect(settings.useModernDMs).toBe(false);
    expect(settings.stabilityModeV090).toBe(true);
    expect(settings.deterministicDiscoveryV090).toBe(false);
    expect(settings.protocolCoreRustV090).toBe(false);
    expect(settings.x3dhRatchetV090).toBe(false);
    expect(settings.tanstackQueryV1).toBe(false);
  });

  it("persists v0.9 recovery flags", () => {
    const next = {
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      deterministicDiscoveryV090: true,
      protocolCoreRustV090: true,
      x3dhRatchetV090: true,
      tanstackQueryV1: true,
    };
    PrivacySettingsService.saveSettings(next);
    const loaded = PrivacySettingsService.getSettings();
    expect(loaded.stabilityModeV090).toBe(false);
    expect(loaded.deterministicDiscoveryV090).toBe(true);
    expect(loaded.protocolCoreRustV090).toBe(true);
    expect(loaded.x3dhRatchetV090).toBe(true);
    expect(loaded.tanstackQueryV1).toBe(true);
  });

  it("defaults discovery feature flags to rollout baseline values", () => {
    const settings = PrivacySettingsService.getSettings();
    expect(settings.discoveryInviteCodeV1).toBe(false);
    expect(settings.discoveryDeepLinkV1).toBe(true);
    expect(settings.discoverySuggestionsV1).toBe(true);
    expect(PrivacySettingsService.getDiscoveryFeatureFlags(settings)).toEqual({
      inviteCodeV1: false,
      deepLinkV1: true,
      suggestionsV1: true,
    });
  });

  it("persists Phase-0 discovery feature flags", () => {
    const next = {
      ...defaultPrivacySettings,
      discoveryInviteCodeV1: true,
      discoveryDeepLinkV1: true,
      discoverySuggestionsV1: false,
    };
    PrivacySettingsService.saveSettings(next);
    const loaded = PrivacySettingsService.getSettings();
    expect(PrivacySettingsService.getDiscoveryFeatureFlags(loaded)).toEqual({
      inviteCodeV1: true,
      deepLinkV1: true,
      suggestionsV1: false,
    });
  });
});
