import { afterEach, describe, expect, it, vi } from "vitest";
import {
  alternateLoopbackCoordinationUrl,
  CoordinationFetchError,
  describeCoordinationFetchError,
  fetchCoordinationWithTimeout,
  resetCoordinationFetchImplForTests,
} from "./community-coordination-fetch";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => false,
}));

describe("community-coordination-fetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetCoordinationFetchImplForTests();
  });

  it("maps localhost to 127.0.0.1 for loopback retry", () => {
    expect(alternateLoopbackCoordinationUrl("http://localhost:8787")).toBe("http://127.0.0.1:8787");
    expect(alternateLoopbackCoordinationUrl("http://127.0.0.1:8787")).toBe("http://localhost:8787");
  });

  it("throws CoordinationFetchError instead of raw TypeError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(
      fetchCoordinationWithTimeout("http://localhost:8787/health", { method: "GET" }, { retryAlternateLoopback: false }),
    ).rejects.toBeInstanceOf(CoordinationFetchError);
  });

  it("retries with alternate loopback host after network failure", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchCoordinationWithTimeout("http://localhost:8787/health", { method: "GET" });
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("127.0.0.1");
  });

  it("describeCoordinationFetchError returns operator guidance for unreachable", () => {
    expect(describeCoordinationFetchError("coordination_unreachable")).toContain("127.0.0.1:8787/health");
  });
});
