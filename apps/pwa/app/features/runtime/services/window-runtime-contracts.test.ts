import { describe, expect, it } from "vitest";
import {
  isProfileWindowUnlockedForAppShell,
  isUnlockedRuntimePhase,
} from "./window-runtime-contracts";

describe("window-runtime-contracts / app shell unlock gate", () => {
  it("treats ready phase with locked identity as locked (manual lock)", () => {
    expect(isProfileWindowUnlockedForAppShell({
      identityStatus: "locked",
      publicKeyHex: undefined,
      runtimePhase: "ready",
    })).toBe(false);
  });

  it("treats ready phase with unlocked identity as unlocked", () => {
    expect(isProfileWindowUnlockedForAppShell({
      identityStatus: "unlocked",
      publicKeyHex: "a".repeat(64),
      runtimePhase: "ready",
    })).toBe(true);
  });

  it("allows password unlock before runtime activates", () => {
    expect(isUnlockedRuntimePhase("auth_required")).toBe(false);
    expect(isProfileWindowUnlockedForAppShell({
      identityStatus: "unlocked",
      publicKeyHex: "a".repeat(64),
      runtimePhase: "auth_required",
    })).toBe(true);
  });

  it("never unlocks shell on fatal phase", () => {
    expect(isProfileWindowUnlockedForAppShell({
      identityStatus: "unlocked",
      publicKeyHex: "a".repeat(64),
      runtimePhase: "fatal",
    })).toBe(false);
  });
});
