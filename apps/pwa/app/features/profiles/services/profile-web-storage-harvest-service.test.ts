import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildProfilePickerHintsFromHarvest } from "./profile-web-storage-harvest-service";

const invokeMock = vi.fn();

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => true,
}));

describe("buildProfilePickerHintsFromHarvest", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("indexes harvested identities by profile id and profile slot", async () => {
    const pubkey = "b".repeat(64);
    invokeMock.mockResolvedValue({
      ok: true,
      value: {
        scannedFileCount: 1,
        ledgers: [],
        directories: [],
        identities: [{
          profileSlot: "profile-2",
          profileId: "profile-2",
          publicKeyHex: pubkey,
          record: { username: "Tester2", publicKeyHex: pubkey },
          isPasswordless: false,
          sourcePath: "/tmp/test.ldb",
        }],
      },
    });

    const hints = await buildProfilePickerHintsFromHarvest();
    expect(hints.get("profile-2")).toMatchObject({
      username: "Tester2",
      publicKeyHex: pubkey,
    });
  });
});
