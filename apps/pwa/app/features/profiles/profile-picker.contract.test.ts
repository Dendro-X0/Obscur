import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROFILE_SIGN_IN_ROUTE,
  resolveLockedDesktopEntryRedirect,
  resolveUnlockedDesktopStartupPickerRedirect,
  shouldDeferUnlockedMessagingShellForStartupPicker,
  shouldRedirectLockedDesktopToProfilePicker,
} from "./services/auth-public-routes";
import {
  readRegisteredDesktopProfileCountFromStorage,
  readShowProfilePickerOnStartup,
} from "./services/profile-picker-startup-policy";
import {
  ACTIVE_SESSION_LEASE_HEARTBEAT_MS,
  ACTIVE_SESSION_LEASE_TTL_MS,
} from "./services/cross-profile-active-session-lease";

const readFeature = (relativePath: string): string => (
  readFileSync(join(__dirname, relativePath), "utf8")
);

describe("profile-picker contract", () => {
  it("keeps public profile routes on the light shell even when unlocked (N1/PL1)", () => {
    const source = readFeature("components/app-session-shell.tsx");
    expect(source).toContain("isPublicProfileRoute");
    expect(source).toContain("ProfileManagementShell");
    expect(source).toContain("isDesktopShellProduct");
    expect(source).not.toMatch(/isPublicProfileRoute\s*&&\s*!isUnlocked/);
    expect(source).toMatch(/if\s*\(\s*isPublicProfileRoute\s*\)/);
    expect(source).toMatch(/isDesktopShellProduct\(\)\s*\|\|\s*hasNativeRuntime\(\)/);
  });

  it("caches picker web-storage harvest (N1b / E20)", () => {
    const source = readFeature("services/profile-web-storage-harvest-service.ts");
    expect(source).toContain("HARVEST_CACHE_TTL_MS");
    expect(source).toContain("harvestCache");
    expect(source).toContain("invalidateProfileWebStorageHarvestCache");
  });

  it("keeps lease heartbeat at half TTL for N1 IPC budget", () => {
    expect(ACTIVE_SESSION_LEASE_TTL_MS).toBe(60_000);
    expect(ACTIVE_SESSION_LEASE_HEARTBEAT_MS).toBe(30_000);
    expect(ACTIVE_SESSION_LEASE_HEARTBEAT_MS * 2).toBeLessThanOrEqual(ACTIVE_SESSION_LEASE_TTL_MS);
  });

  it("exposes sync registry count helper for N1d cold-start gates", () => {
    expect(typeof readRegisteredDesktopProfileCountFromStorage).toBe("function");
    expect(readRegisteredDesktopProfileCountFromStorage()).toBeGreaterThanOrEqual(0);
  });

  it("defers unlocked messaging shell by sending startup picker preference to /profiles (N1c)", () => {
    expect(resolveUnlockedDesktopStartupPickerRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 2,
    })).toBe("/profiles");
    expect(shouldDeferUnlockedMessagingShellForStartupPicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 2,
    })).toBe(true);
    expect(resolveUnlockedDesktopStartupPickerRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 1,
    })).toBeNull();
    expect(resolveUnlockedDesktopStartupPickerRedirect({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 2,
    })).toBeNull();
  });

  it("does not bounce unlocked home to /profiles after the user picks a profile (N1e)", () => {
    expect(resolveUnlockedDesktopStartupPickerRedirect({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 2,
      pickerEntryConsumed: true,
    })).toBeNull();
    expect(shouldDeferUnlockedMessagingShellForStartupPicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: true,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 2,
      pickerEntryConsumed: true,
    })).toBe(false);
  });

  it("consumes picker entry on profile launch and honors consume in AuthGateway (N1e lock)", () => {
    const profilesPage = readFileSync(join(__dirname, "../../profiles/page.tsx"), "utf8");
    expect(profilesPage).toContain("markDesktopProfilePickerEntryConsumed");
    const gateway = readFileSync(
      join(__dirname, "../auth/components/auth-gateway.tsx"),
      "utf8",
    );
    expect(gateway).toContain("hasDesktopProfilePickerEntryBeenConsumed");
    expect(gateway).toContain("pickerEntryConsumed");
    expect(gateway).toContain("readRegisteredDesktopProfileCountFromStorage");
  });

  it("keeps UnlockedAppRuntimeShell free of always-on Dev Lab bridges (shell quarantine)", () => {
    const source = readFileSync(
      join(__dirname, "../runtime/components/unlocked-app-runtime-shell.tsx"),
      "utf8",
    );
    expect(source).toContain("ActiveSessionLeaseOwner");
    expect(source).not.toContain("features/dev-lab");
  });

  it("keeps public profile routes and startup preference aligned", () => {
    expect(readShowProfilePickerOnStartup()).toBe(true);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/profiles",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: true,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: false,
      registeredProfileCount: 2,
    })).toBe(false);
    expect(shouldRedirectLockedDesktopToProfilePicker({
      pathname: "/",
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 1,
    })).toBe(false);
    expect(resolveLockedDesktopEntryRedirect({
      pathname: PROFILE_SIGN_IN_ROUTE,
      isDesktopNative: true,
      isUnlocked: false,
      showProfilePickerOnStartup: true,
      registeredProfileCount: 2,
    })).toBeNull();
  });
});
