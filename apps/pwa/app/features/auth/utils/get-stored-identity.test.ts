import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredIdentity } from "./get-stored-identity";
import { writeIdentityRecordToLocalStorage } from "./identity-persistence";

vi.mock("./identity-db-key", () => ({
  getIdentityDbKey: () => "identity::default",
}));

vi.mock("./open-identity-db", () => ({
  openIdentityDb: vi.fn(async () => ({
    transaction: () => ({
      objectStore: () => ({
        get: () => {
          const request: { result: unknown; onsuccess: null | (() => void); onerror: null | (() => void) } = {
            result: undefined,
            onsuccess: null,
            onerror: null,
          };
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
      }),
    }),
  })),
}));

describe("getStoredIdentity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns durable localStorage identity after restart simulation", async () => {
    const record = {
      encryptedPrivateKey: "cipher",
      publicKeyHex: "a".repeat(64),
      username: "Alice",
    };
    writeIdentityRecordToLocalStorage({ profileId: "default", record });

    const result = await getStoredIdentity();
    expect(result.record).toEqual(record);
  });
});
