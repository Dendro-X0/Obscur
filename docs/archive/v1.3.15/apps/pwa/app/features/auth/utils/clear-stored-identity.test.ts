import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoredIdentity } from "./clear-stored-identity";

const mocks = vi.hoisted(() => {
  let entries: Array<{ key: string; value: { publicKeyHex?: string } }> = [];
  const setEntries = (next: Array<{ key: string; value: { publicKeyHex?: string } }>) => {
    entries = next;
  };
  const deletedKeys: string[] = [];

  const openIdentityDb = vi.fn(async () => ({
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => {
          const request: { result?: unknown; onsuccess: null | (() => void); onerror: null | (() => void); error?: Error } = {
            onsuccess: null,
            onerror: null,
          };
          queueMicrotask(() => {
            request.result = entries.find((entry) => entry.key === key)?.value;
            request.onsuccess?.();
          });
          return request;
        },
        openCursor: () => {
          const request: { result: any; onsuccess: null | (() => void); onerror: null | (() => void); error?: Error } = {
            result: null,
            onsuccess: null,
            onerror: null,
          };
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
      }),
    }),
  }));

  return { openIdentityDb, setEntries, deletedKeys };
});

vi.mock("./open-identity-db", () => ({
  openIdentityDb: mocks.openIdentityDb,
}));

vi.mock("./identity-db-key", () => ({
  getIdentityDbKey: () => "identity::pk-owner",
}));

describe("clearStoredIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setEntries([]);
    mocks.deletedKeys.length = 0;
  });

  it("clears all duplicate bindings for the current pubkey", async () => {
    mocks.setEntries([
      { key: "identity::pk-owner", value: { publicKeyHex: "a".repeat(64) } },
      { key: "identity::default", value: { publicKeyHex: "a".repeat(64) } },
      { key: "identity::other", value: { publicKeyHex: "b".repeat(64) } },
    ]);

    await clearStoredIdentity();

    expect(mocks.deletedKeys).toContain("identity::pk-owner");
    expect(mocks.deletedKeys).toContain("identity::default");
    expect(mocks.deletedKeys).not.toContain("identity::other");
  });
});
