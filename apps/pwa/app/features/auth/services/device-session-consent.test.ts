import { afterEach, describe, expect, it } from "vitest";
import {
  isDeviceSessionRestoreAllowed,
  readDeviceSessionConsent,
  resolveStaySignedIn,
} from "./device-session-consent";
import { getRememberMeStorageKey } from "@/app/features/auth/utils/auth-storage-keys";

describe("device-session-consent", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("defaults stay signed in to true when unset", () => {
    expect(readDeviceSessionConsent("default")).toBe(true);
    expect(isDeviceSessionRestoreAllowed("default")).toBe(true);
  });

  it("respects explicit opt-out", () => {
    localStorage.setItem(getRememberMeStorageKey("default"), "false");
    expect(readDeviceSessionConsent("default")).toBe(false);
    expect(isDeviceSessionRestoreAllowed("default")).toBe(false);
  });

  it("resolveStaySignedIn treats undefined as true", () => {
    expect(resolveStaySignedIn()).toBe(true);
    expect(resolveStaySignedIn({ staySignedIn: false })).toBe(false);
  });
});
