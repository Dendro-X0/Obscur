import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "..", "..");

const mobileAdapterFiles = {
  androidBackgroundSync: "apps/desktop/src-tauri/gen/android/app/src/main/java/app/obscur/desktop/BackgroundSyncWorker.kt",
  androidPush: "apps/desktop/src-tauri/gen/android/app/src/main/java/app/obscur/desktop/ObscurFirebaseMessagingService.kt",
  iosBackgroundSync: "apps/desktop/src-tauri/gen/apple/ObscurIOS/BackgroundSyncTask.swift",
  iosPush: "apps/desktop/src-tauri/gen/apple/NotificationServiceExtension/NotificationService.swift",
} as const;

const load = (relativePath: string): string => {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
};

describe("mobile native boundary drift guards", () => {
  it("removes placeholder and simulation markers from mobile adapters", () => {
    const disallowedPatterns = [
      /placeholder/i,
      /simulation for skeleton/i,
      /assuming uniffi-generated bindings/i,
    ];

    for (const path of Object.values(mobileAdapterFiles)) {
      const content = load(path);
      for (const pattern of disallowedPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("prevents direct secret reads in mobile adapter layers", () => {
    const disallowedPatterns = [
      /active_secret_key/,
      /getSharedPreferences\(/,
      /UserDefaults\(suiteName:/,
    ];

    for (const path of Object.values(mobileAdapterFiles)) {
      const content = load(path);
      for (const pattern of disallowedPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it("keeps Android and iOS adapters aligned on key-scoped rust contracts", () => {
    const androidBackground = load(mobileAdapterFiles.androidBackgroundSync);
    const androidPush = load(mobileAdapterFiles.androidPush);
    const iosBackground = load(mobileAdapterFiles.iosBackgroundSync);
    const iosPush = load(mobileAdapterFiles.iosPush);

    expect(androidBackground).toContain("backgroundSyncForKey");
    expect(androidPush).toContain("decryptPushPayloadForKey");
    expect(iosBackground).toContain("backgroundSyncForKey");
    expect(iosPush).toContain("decryptPushPayloadForKey");

    expect(androidBackground).toContain("mobile::default::nsec");
    expect(androidPush).toContain("mobile::default::nsec");
    expect(iosBackground).toContain("mobile::default::nsec");
    expect(iosPush).toContain("mobile::default::nsec");
  });
});
