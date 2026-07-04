import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AccountActiveInOtherProfileWindowError,
  assertAccountNotActiveInOtherProfileWindow,
  claimActiveSessionLease,
  findActiveSessionLeaseForAccount,
  releaseActiveSessionLease,
} from "./cross-profile-active-session-lease";

const PK_A = "a".repeat(64);
const PK_B = "b".repeat(64);

describe("cross-profile-active-session-lease", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("blocks unlock when the same account is active in another profile window", () => {
    claimActiveSessionLease({
      publicKeyHex: PK_A as any,
      profileId: "default",
      windowLabel: "main",
    });

    expect(() => assertAccountNotActiveInOtherProfileWindow({
      incomingPublicKeyHex: PK_A as any,
      currentProfileId: "profile-2",
      currentWindowLabel: "profile-profile-2-1",
    })).toThrow(AccountActiveInOtherProfileWindowError);

    expect(findActiveSessionLeaseForAccount({
      publicKeyHex: PK_A as any,
      excludeProfileId: "profile-2",
      excludeWindowLabel: "profile-profile-2-1",
    })).toMatchObject({ profileId: "default" });
  });

  it("allows unlock in the same profile window that holds the lease", () => {
    claimActiveSessionLease({
      publicKeyHex: PK_A as any,
      profileId: "profile-2",
      windowLabel: "profile-profile-2-1",
    });

    expect(() => assertAccountNotActiveInOtherProfileWindow({
      incomingPublicKeyHex: PK_A as any,
      currentProfileId: "profile-2",
      currentWindowLabel: "profile-profile-2-1",
    })).not.toThrow();
  });

  it("blocks unlock when the same account is already active in another window of the same profile", () => {
    claimActiveSessionLease({
      publicKeyHex: PK_A as any,
      profileId: "default",
      windowLabel: "profile-default-1",
    });

    expect(() => assertAccountNotActiveInOtherProfileWindow({
      incomingPublicKeyHex: PK_A as any,
      currentProfileId: "default",
      currentWindowLabel: "profile-default-2",
    })).toThrow(AccountActiveInOtherProfileWindowError);
  });

  it("releases lease on sign-out", () => {
    claimActiveSessionLease({
      publicKeyHex: PK_B as any,
      profileId: "default",
      windowLabel: "main",
    });
    releaseActiveSessionLease({ publicKeyHex: PK_B as any, profileId: "default" });

    expect(findActiveSessionLeaseForAccount({
      publicKeyHex: PK_B as any,
      excludeProfileId: "profile-2",
      excludeWindowLabel: "profile-profile-2-1",
    })).toBeNull();
  });
});
