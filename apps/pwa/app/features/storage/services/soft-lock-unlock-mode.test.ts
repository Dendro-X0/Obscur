import { describe, expect, it } from "vitest";
import { resolveSoftLockUnlockMode } from "./soft-lock-unlock-mode";

describe("resolveSoftLockUnlockMode (soft-lock slice 3)", () => {
  it("uses storage_only when identity unlocked but SQLite blocked", () => {
    expect(
      resolveSoftLockUnlockMode({
        identityStatus: "unlocked",
        nativeSqliteWriteBlocked: true,
      }),
    ).toBe("storage_only");
  });

  it("uses identity unlock otherwise", () => {
    expect(
      resolveSoftLockUnlockMode({
        identityStatus: "locked",
        nativeSqliteWriteBlocked: true,
      }),
    ).toBe("identity");
    expect(
      resolveSoftLockUnlockMode({
        identityStatus: "unlocked",
        nativeSqliteWriteBlocked: false,
      }),
    ).toBe("identity");
    expect(
      resolveSoftLockUnlockMode({
        identityStatus: "locked",
        nativeSqliteWriteBlocked: false,
      }),
    ).toBe("identity");
  });
});
