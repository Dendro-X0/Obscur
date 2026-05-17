import { afterEach, describe, expect, it, vi } from "vitest";

import { openIdentityDb, openIdentityDbInternals } from "./open-identity-db";

describe("openIdentityDb", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects when IndexedDB open remains pending past timeout", async () => {
    vi.useFakeTimers();

    const request = {} as IDBOpenDBRequest;
    vi.spyOn(globalThis.indexedDB, "open").mockReturnValue(request);

    const pending = expect(openIdentityDb()).rejects.toThrow("Timed out opening identity database");
    await vi.advanceTimersByTimeAsync(openIdentityDbInternals.IDENTITY_DB_OPEN_TIMEOUT_MS + 1);
    await pending;
  });

  it("rejects when IndexedDB open is blocked", async () => {
    const request = {} as IDBOpenDBRequest;
    vi.spyOn(globalThis.indexedDB, "open").mockReturnValue(request);

    const pending = expect(openIdentityDb()).rejects.toThrow("Identity database open blocked");
    request.onblocked?.(new Event("blocked") as IDBVersionChangeEvent);

    await pending;
  });
});
