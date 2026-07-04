import { describe, expect, it } from "vitest";
import { PASSWORDLESS_NATIVE_ONLY_SENTINEL } from "@/app/features/auth/services/passwordless-native-only-identity";
import {
  listIdentityRecordCandidatesFromLocalStorage,
  readIdentityRecordFromLocalStorage,
} from "./identity-persistence";

const PUBLIC_KEY = "a".repeat(64);
const ENCRYPTED = "{\"v\":1,\"alg\":\"PBKDF2-SHA256/AES-256-GCM\"}";

describe("identity-persistence password-protected preference", () => {
  it("prefers password-protected identity across alias keys", () => {
    window.localStorage.setItem(
      "obscur.identity.record::default",
      JSON.stringify({
        publicKeyHex: PUBLIC_KEY,
        encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL,
        username: "Tester1",
      }),
    );
    window.localStorage.setItem(
      "identity::default",
      JSON.stringify({
        publicKeyHex: PUBLIC_KEY,
        encryptedPrivateKey: ENCRYPTED,
        username: "Tester1",
      }),
    );

    const record = readIdentityRecordFromLocalStorage("default");
    expect(record?.encryptedPrivateKey).toBe(ENCRYPTED);
    expect(listIdentityRecordCandidatesFromLocalStorage("default")).toHaveLength(2);
  });
});
