import { describe, expect, it } from "vitest";
import {
  isIdentityUnlockedForAppShell,
  resolveAuthShellReady,
} from "./auth-shell-ready-gate";

const unlockedHex = "a".repeat(64);

describe("auth-shell-ready-gate", () => {
  it("mirrors identity unlock evidence", () => {
    expect(isIdentityUnlockedForAppShell({
      identityStatus: "unlocked",
      publicKeyHex: unlockedHex,
      runtimePhase: "auth_required",
    })).toBe(true);

    expect(isIdentityUnlockedForAppShell({
      identityStatus: "locked",
      publicKeyHex: undefined,
      runtimePhase: "ready",
    })).toBe(false);

    expect(isIdentityUnlockedForAppShell({
      identityStatus: "unlocked",
      publicKeyHex: unlockedHex,
      runtimePhase: "fatal",
    })).toBe(false);
  });

  it("unlock → shell-ready only when device-password bind is clear", () => {
    expect(resolveAuthShellReady({
      identityStatus: "unlocked",
      publicKeyHex: unlockedHex,
      runtimePhase: "auth_required",
      devicePasswordBindPending: true,
    })).toBe(false);

    expect(resolveAuthShellReady({
      identityStatus: "unlocked",
      publicKeyHex: unlockedHex,
      runtimePhase: "auth_required",
      devicePasswordBindPending: false,
    })).toBe(true);
  });
});
