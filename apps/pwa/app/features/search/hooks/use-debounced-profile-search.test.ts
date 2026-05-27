import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedProfileSearch } from "./use-debounced-profile-search";

const TEST_PUBKEY = "a".repeat(64) as PublicKeyHex;

const searchMocks = vi.hoisted(() => ({
  searchByName: vi.fn(async () => [{ pubkey: "b".repeat(64), displayName: "Alice" }]),
  poolRenderSerial: 0,
}));

vi.mock("./use-profile-search-service-ref", () => ({
  useProfileSearchServiceRef: () => ({
    searchByName: searchMocks.searchByName,
  }),
}));

describe("useDebouncedProfileSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchMocks.searchByName.mockClear();
    searchMocks.poolRenderSerial = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const unstablePool = (): { connections: ReadonlyArray<unknown>; serial: number } => {
    searchMocks.poolRenderSerial += 1;
    return { connections: [], serial: searchMocks.poolRenderSerial };
  };

  it("does not restart search when only the pool object identity changes", async () => {
    const { rerender } = renderHook(
      ({ pool }) => useDebouncedProfileSearch({
        query: "alice",
        pool,
        publicKeyHex: TEST_PUBKEY,
        debounceMs: 100,
      }),
      { initialProps: { pool: unstablePool() } },
    );

    rerender({ pool: unstablePool() });
    rerender({ pool: unstablePool() });
    rerender({ pool: unstablePool() });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(searchMocks.searchByName).toHaveBeenCalledTimes(1);
  });

  it("clears results without thrashing when query drops below min length", async () => {
    const { result, rerender } = renderHook(
      ({ query }) => useDebouncedProfileSearch({
        query,
        pool: { connections: [] },
        publicKeyHex: TEST_PUBKEY,
        debounceMs: 100,
      }),
      { initialProps: { query: "alice" } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.results.length).toBe(1);

    rerender({ query: "al" });
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(searchMocks.searchByName).toHaveBeenCalledTimes(1);
  });
});
