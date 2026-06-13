import { describe, expect, it } from "vitest";
import {
  PASSWORDLESS_NATIVE_ONLY_SENTINEL,
  isPasswordlessNativeOnlyIdentity,
} from "./passwordless-native-only-identity";

describe("isPasswordlessNativeOnlyIdentity", () => {
  it("returns true for the native-only sentinel", () => {
    expect(isPasswordlessNativeOnlyIdentity({ encryptedPrivateKey: PASSWORDLESS_NATIVE_ONLY_SENTINEL })).toBe(true);
  });

  it("returns false for encrypted key material", () => {
    expect(isPasswordlessNativeOnlyIdentity({ encryptedPrivateKey: "encrypted:abc" })).toBe(false);
  });

  it("returns false when record is missing", () => {
    expect(isPasswordlessNativeOnlyIdentity(null)).toBe(false);
    expect(isPasswordlessNativeOnlyIdentity(undefined)).toBe(false);
  });
});
