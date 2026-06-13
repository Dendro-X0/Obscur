import { describe, expect, it, vi } from "vitest";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { resolveActivePrivateKeyHex } from "./resolve-active-private-key-hex";

const TEST_PRIVATE_KEY_HEX = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884" as const;
const TEST_PUBLIC_KEY_HEX = "e07f67dc8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0b8c0" as const;

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: vi.fn(async () => ({ ok: true, value: null })),
}));

describe("resolveActivePrivateKeyHex", () => {
  it("returns hex key when session holds real private key hex", async () => {
    await expect(resolveActivePrivateKeyHex({
      privateKeyHex: TEST_PRIVATE_KEY_HEX,
    })).resolves.toBe(TEST_PRIVATE_KEY_HEX);
  });

  it("uses setupPrivateKeyHex before native sentinel", async () => {
    await expect(resolveActivePrivateKeyHex({
      privateKeyHex: NATIVE_KEY_SENTINEL,
      setupPrivateKeyHex: TEST_PRIVATE_KEY_HEX,
    })).resolves.toBe(TEST_PRIVATE_KEY_HEX);
  });
});
