import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertProfileSlotAllowsLogin,
  evaluateProfileSlotLoginAttempt,
  ProfileSlotAccountConflictError,
} from "./profile-slot-login-guard";

const PK_A = "a".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;
const PK_B = "b".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;

vi.mock("./profile-window-account-binding", () => ({
  getLastBoundAccountPublicKeyHex: vi.fn(),
}));

vi.mock("@/app/features/auth/utils/identity-persistence", () => ({
  readIdentityRecordFromLocalStorage: vi.fn(),
}));

import { getLastBoundAccountPublicKeyHex } from "./profile-window-account-binding";
import { readIdentityRecordFromLocalStorage } from "@/app/features/auth/utils/identity-persistence";

describe("profile-slot-login-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLastBoundAccountPublicKeyHex).mockReturnValue(null);
    vi.mocked(readIdentityRecordFromLocalStorage).mockReturnValue(undefined);
  });

  it("allows login when the profile slot is empty", () => {
    expect(evaluateProfileSlotLoginAttempt({
      profileId: "profile-2",
      incomingPublicKeyHex: PK_B,
    })).toEqual({
      status: "allowed",
      profileId: "profile-2",
      incomingPublicKeyHex: PK_B,
      occupantPublicKeyHex: null,
    });
  });

  it("allows login when the same account already owns the slot", () => {
    vi.mocked(getLastBoundAccountPublicKeyHex).mockReturnValue(PK_A);
    expect(evaluateProfileSlotLoginAttempt({
      profileId: "default",
      incomingPublicKeyHex: PK_A,
    }).status).toBe("allowed");
  });

  it("blocks login when a different account owns the slot", () => {
    vi.mocked(getLastBoundAccountPublicKeyHex).mockReturnValue(PK_A);
    const result = evaluateProfileSlotLoginAttempt({
      profileId: "default",
      incomingPublicKeyHex: PK_B,
    });
    expect(result.status).toBe("blocked_different_account");
    if (result.status === "blocked_different_account") {
      expect(result.occupantPublicKeyHex).toBe(PK_A);
      expect(result.incomingPublicKeyHex).toBe(PK_B);
    }
    expect(() => assertProfileSlotAllowsLogin({
      profileId: "default",
      incomingPublicKeyHex: PK_B,
    })).toThrow(ProfileSlotAccountConflictError);
  });
});
