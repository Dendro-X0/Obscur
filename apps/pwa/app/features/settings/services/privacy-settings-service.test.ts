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
});

