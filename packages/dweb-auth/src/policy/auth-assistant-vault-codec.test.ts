import { describe, expect, it } from "vitest";
import { AUTH_ASSISTANT_PAYLOAD_VERSION } from "../contracts/auth-assistant-entry";
import {
  decodeAuthAssistantVaultPayload,
  encodeAuthAssistantVaultPayload,
} from "./auth-assistant-vault-codec";

describe("auth assistant vault codec", () => {
  it("round-trips passphrase payloads", () => {
    const payload = {
      version: AUTH_ASSISTANT_PAYLOAD_VERSION,
      username: "tester1",
      passphrase: "secret-passphrase",
    };
    const encoded = encodeAuthAssistantVaultPayload(payload);
    expect(decodeAuthAssistantVaultPayload(encoded)).toEqual(payload);
  });

  it("rejects invalid versions and empty passphrases", () => {
    expect(decodeAuthAssistantVaultPayload(JSON.stringify({
      version: 2,
      username: "tester1",
      passphrase: "secret",
    }))).toBeNull();
    expect(decodeAuthAssistantVaultPayload(JSON.stringify({
      version: AUTH_ASSISTANT_PAYLOAD_VERSION,
      username: "tester1",
      passphrase: "   ",
    }))).toBeNull();
    expect(decodeAuthAssistantVaultPayload("not-json")).toBeNull();
  });
});
