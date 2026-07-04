import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { clearClipboardForAppLockBestEffort, lockAppSession } from "./lock-app-session";

describe("lockAppSession", () => {
  beforeEach(() => {
    PrivacySettingsService.saveSettings({
      ...PrivacySettingsService.getSettings(),
      clearClipboardOnLock: true,
    });
    vi.restoreAllMocks();
  });

  it("locks the bound profile through runtime supervisor", async () => {
    const lockBoundProfile = vi.fn();
    await lockAppSession({ lockBoundProfile });
    expect(lockBoundProfile).toHaveBeenCalledTimes(1);
  });

  it("clears clipboard when privacy setting is enabled", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    await clearClipboardForAppLockBestEffort();
    expect(writeText).toHaveBeenCalledWith("");
  });

  it("skips clipboard clear when privacy setting is disabled", async () => {
    PrivacySettingsService.saveSettings({
      ...PrivacySettingsService.getSettings(),
      clearClipboardOnLock: false,
    });
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
    await clearClipboardForAppLockBestEffort();
    expect(writeText).not.toHaveBeenCalled();
  });
});
