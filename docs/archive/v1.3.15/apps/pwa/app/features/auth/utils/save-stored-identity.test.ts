import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityRecord } from "@dweb/core/identity-record";
import { saveStoredIdentity } from "./save-stored-identity";

const mocks = vi.hoisted(() => {
  let entries: Array<{ key: string; value: IdentityRecord }> = [];
  const setEntries = (next: Array<{ key: string; value: IdentityRecord }>) => {
    entries = next;
  };

  const deletedKeys: string[] = [];
  const puts: Array<{ key: string; value: IdentityRecord }> = [];

  const openIdentityDb = vi.fn(async () => ({
    transaction: () => ({
      objectStore: () => ({
        openCursor: () => {
          const request: {
            result: any;
            onsuccess: null | (() => void);
            onerror: null | (() => void);
            error?: Error;
          } = { result: null, onsuccess: null, onerror: null };

          queueMicrotask(() => {
            let index = 0;
            const advance = () => {
              if (index >= entries.length) {
                request.result = null;
                request.onsuccess?.();
                return;
              }
              const current = entries[index]!;
              request.result = {
                key: current.key,
                value: current.value,
                continue: () => {
                  index += 1;
                  advance();
                },
              };
              request.onsuccess?.();
            };
            advance();
          });

          return request;
        },
        delete: (key: string) => {
          deletedKeys.push(key);
          return {};
        },
        put: (value: IdentityRecord, key: string) => {
          puts.push({ key, value });
          const request: { onsuccess: null | (() => void); onerror: null | (() => void); error?: Error } = {
            onsuccess: null,
            onerror: null,
          };
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
      }),
    }),
  }));

  return { openIdentityDb, setEntries, deletedKeys, puts };
});

vi.mock("./open-identity-db", () => ({
  openIdentityDb: mocks.openIdentityDb,
}));

vi.mock("./identity-db-key", () => ({
  getIdentityDbKey: () => "identity::pk-owner",
}));

describe("saveStoredIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setEntries([]);
    mocks.deletedKeys.length = 0;
    mocks.puts.length = 0;
  });

  it("removes duplicate identity bindings for the same pubkey before persisting", async () => {
    const record: IdentityRecord = {
      encryptedPrivateKey: "cipher-next",
      publicKeyHex: "a".repeat(64),
      username: "Alice",
    };

    mocks.setEntries([
      { key: "identity::default", value: { encryptedPrivateKey: "cipher-old", publicKeyHex: record.publicKeyHex, username: "Alice old" } },
      { key: "identity::pk-owner", value: { encryptedPrivateKey: "cipher-current", publicKeyHex: record.publicKeyHex, username: "Alice current" } },
      { key: "identity::other", value: { encryptedPrivateKey: "cipher-other", publicKeyHex: "b".repeat(64), username: "Bob" } },
    ]);

    await saveStoredIdentity({ record });

    expect(mocks.deletedKeys).toContain("identity::default");
    expect(mocks.deletedKeys).not.toContain("identity::other");
    expect(mocks.puts).toEqual([{ key: "identity::pk-owner", value: record }]);
  });
});
