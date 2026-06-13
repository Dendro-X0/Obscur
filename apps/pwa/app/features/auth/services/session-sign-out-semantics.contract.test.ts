import { describe, expect, it } from "vitest";
import {
  clearInMemoryNativeSessionBestEffort,
  endNativeDeviceSignInBestEffort,
} from "./native-device-session-lifecycle";

/**
 * Slice C contract — lock preserves keychain; sign-out ends device session.
 * Runtime wiring is in title-bar-profile-switcher + use-identity.lockIdentity.
 */
describe("session sign-out semantics contract", () => {
  it("exports distinct lock vs sign-out lifecycle owners", () => {
    expect(typeof clearInMemoryNativeSessionBestEffort).toBe("function");
    expect(typeof endNativeDeviceSignInBestEffort).toBe("function");
    expect(clearInMemoryNativeSessionBestEffort).not.toBe(endNativeDeviceSignInBestEffort);
  });
});
