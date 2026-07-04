import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";

export const clearClipboardForAppLockBestEffort = async (): Promise<void> => {
  const settings = PrivacySettingsService.getSettings();
  if (!settings.clearClipboardOnLock) {
    return;
  }
  try {
    await navigator.clipboard.writeText("");
  } catch {
    // Clipboard may be unavailable without a user gesture.
  }
};

export type LockAppSessionDeps = Readonly<{
  lockBoundProfile: () => void;
}>;

export const lockAppSession = async (deps: LockAppSessionDeps): Promise<void> => {
  await clearClipboardForAppLockBestEffort();
  deps.lockBoundProfile();
};
