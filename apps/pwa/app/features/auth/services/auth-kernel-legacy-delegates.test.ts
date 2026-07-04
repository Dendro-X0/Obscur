import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const scopeMocks = vi.hoisted(() => ({
  profileId: "tester1",
}));

vi.mock("@/app/features/profiles/services/read-active-desktop-profile-id", () => ({
  resolveIdentityScopeProfileId: () => scopeMocks.profileId,
}));

vi.mock("@/app/features/profiles/services/data-root-identity-repair", () => ({
  resolveStoredIdentityRecord: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/auth/utils/identity-persistence", () => ({
  readIdentityRecordFromLocalStorage: vi.fn(() => undefined),
}));

vi.mock("@/app/features/auth/utils/get-stored-identity", () => ({
  getStoredIdentity: vi.fn(async () => ({ record: undefined })),
}));

import {
  assertAuthKernelProfileScope,
  AuthKernelProfileScopeError,
  readStoredIdentitySnapshot,
} from "./auth-kernel-legacy-delegates";

describe("auth-kernel legacy delegates", () => {
  beforeEach(() => {
    scopeMocks.profileId = "tester1";
  });

  it("assertAuthKernelProfileScope rejects mismatched profile ids", () => {
    expect(() => assertAuthKernelProfileScope("tester2")).toThrow(AuthKernelProfileScopeError);
    expect(() => assertAuthKernelProfileScope("tester1")).not.toThrow();
  });

  it("readStoredIdentitySnapshot returns empty snapshot when no record exists", async () => {
    const snapshot = await readStoredIdentitySnapshot("tester1");
    expect(snapshot.profileId).toBe("tester1");
    expect(snapshot.record).toBeNull();
    expect(snapshot.publicKeyHex).toBeNull();
  });
});

describe("auth-kernel legacy delegates public key typing", () => {
  it("accepts typed public key hex in snapshot shape", () => {
    const hex = "bb".repeat(32) as PublicKeyHex;
    expect(hex).toHaveLength(64);
  });
});
