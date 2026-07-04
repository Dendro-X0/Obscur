import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  localSaveOccupancyIsBlocked,
  resolveLocalSaveAccountOccupancy,
} from "./local-save-account-occupancy";
import {
  claimActiveSessionLease,
  releaseActiveSessionLease,
} from "./cross-profile-active-session-lease";
import {
  clearLastBoundAccountPublicKeyHex,
  setLastBoundAccountPublicKeyHex,
} from "./profile-window-account-binding";

const PK_A = "a".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;
const PK_B = "b".repeat(64) as import("@dweb/crypto/public-key-hex").PublicKeyHex;

describe("local-save-account-occupancy", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("detects matching occupant in current profile slot", () => {
    setLastBoundAccountPublicKeyHex("slot-a", PK_A);
    expect(resolveLocalSaveAccountOccupancy({
      publicKeyHex: PK_A,
      currentProfileId: "slot-a",
      profiles: [{ profileId: "slot-a", label: "Main", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 }],
    })).toEqual({ kind: "this_slot_match" });
  });

  it("detects conflict when current slot has a different account", () => {
    setLastBoundAccountPublicKeyHex("slot-a", PK_A);
    expect(resolveLocalSaveAccountOccupancy({
      publicKeyHex: PK_B,
      currentProfileId: "slot-a",
      profiles: [{ profileId: "slot-a", label: "Main", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 }],
    })).toEqual({ kind: "this_slot_conflict", occupantPublicKeyHex: PK_A });
    expect(localSaveOccupancyIsBlocked({
      kind: "this_slot_conflict",
      occupantPublicKeyHex: PK_A,
    })).toBe(true);
  });

  it("detects account active in another profile slot", () => {
    clearLastBoundAccountPublicKeyHex("slot-a");
    setLastBoundAccountPublicKeyHex("slot-b", PK_A);
    expect(resolveLocalSaveAccountOccupancy({
      publicKeyHex: PK_A,
      currentProfileId: "slot-a",
      profiles: [
        { profileId: "slot-a", label: "Window 1", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 },
        { profileId: "slot-b", label: "Window 2", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 },
      ],
    })).toEqual({
      kind: "other_slot",
      profileId: "slot-b",
      profileLabel: "Window 2",
    });
    expect(localSaveOccupancyIsBlocked({
      kind: "other_slot",
      profileId: "slot-b",
      profileLabel: "Window 2",
    })).toBe(true);
  });

  it("detects live unlock in another profile window via session lease", () => {
    claimActiveSessionLease({
      publicKeyHex: PK_A,
      profileId: "slot-b",
      windowLabel: "profile-slot-b-1",
    });
    expect(resolveLocalSaveAccountOccupancy({
      publicKeyHex: PK_A,
      currentProfileId: "slot-a",
      profiles: [
        { profileId: "slot-a", label: "Window 3", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 },
        { profileId: "slot-b", label: "Window 1", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 },
      ],
    })).toEqual({
      kind: "active_in_other_window",
      profileId: "slot-b",
      profileLabel: "slot-b",
      windowLabel: "profile-slot-b-1",
    });
    expect(localSaveOccupancyIsBlocked({
      kind: "active_in_other_window",
      profileId: "slot-b",
      profileLabel: "Window 1",
      windowLabel: "profile-slot-b-1",
    })).toBe(true);
    releaseActiveSessionLease({ publicKeyHex: PK_A, profileId: "slot-b" });
  });

  it("finds bound account even when profile list is incomplete", () => {
    setLastBoundAccountPublicKeyHex("slot-b", PK_A);
    expect(resolveLocalSaveAccountOccupancy({
      publicKeyHex: PK_A,
      currentProfileId: "slot-a",
      profiles: [{ profileId: "slot-a", label: "Window 3", createdAtUnixMs: 0, lastUsedAtUnixMs: 0 }],
    })).toEqual({
      kind: "other_slot",
      profileId: "slot-b",
      profileLabel: "slot-b",
    });
  });
});
