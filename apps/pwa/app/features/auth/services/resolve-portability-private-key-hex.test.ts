import { describe, expect, it, vi, beforeEach } from "vitest";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { resolvePortabilityPrivateKeyHex } from "./resolve-portability-private-key-hex";

const TEST_PRIVATE_KEY_HEX = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884" as PrivateKeyHex;
const TEST_PUBLIC_KEY_HEX = derivePublicKeyHex(TEST_PRIVATE_KEY_HEX);

const invokeNativeCommand = vi.fn();

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: (...args: unknown[]) => invokeNativeCommand(...args),
}));

describe("resolvePortabilityPrivateKeyHex", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no active public key", async () => {
    await expect(resolvePortabilityPrivateKeyHex({
      publicKeyHex: null,
      privateKeyHex: TEST_PRIVATE_KEY_HEX,
    })).resolves.toBeNull();
  });

  it("returns in-memory hex keys", async () => {
    await expect(resolvePortabilityPrivateKeyHex({
      publicKeyHex: TEST_PUBLIC_KEY_HEX,
      privateKeyHex: TEST_PRIVATE_KEY_HEX,
    })).resolves.toBe(TEST_PRIVATE_KEY_HEX);
  });

  it("resolves native sentinel through get_session_nsec", async () => {
    invokeNativeCommand.mockResolvedValueOnce({ ok: true, value: TEST_PRIVATE_KEY_HEX });

    await expect(resolvePortabilityPrivateKeyHex({
      publicKeyHex: TEST_PUBLIC_KEY_HEX,
      privateKeyHex: NATIVE_KEY_SENTINEL,
    })).resolves.toBe(TEST_PRIVATE_KEY_HEX);
    expect(invokeNativeCommand).toHaveBeenCalledWith("get_session_nsec");
  });
});
