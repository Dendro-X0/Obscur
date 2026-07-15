import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGuardedExternalLinkOpen } from "./use-guarded-external-link-open";

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
  openNativeExternal: vi.fn(async () => false),
}));

describe("useGuardedExternalLinkOpen", () => {
  it("opens benign links immediately", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useGuardedExternalLinkOpen());

    act(() => {
      result.current.requestOpenExternalLink("https://example.com/docs");
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/docs",
      "_blank",
      "noopener,noreferrer",
    );
    expect(result.current.pendingLinkUrl).toBeNull();
    openSpy.mockRestore();
  });

  it("defers suspicious links until confirm", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useGuardedExternalLinkOpen());

    act(() => {
      result.current.requestOpenExternalLink("http://bit.ly/secure-account-reset");
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(result.current.pendingLinkUrl).toBe("http://bit.ly/secure-account-reset");

    act(() => {
      result.current.confirmPendingLink();
    });

    expect(openSpy).toHaveBeenCalledWith(
      "http://bit.ly/secure-account-reset",
      "_blank",
      "noopener,noreferrer",
    );
    expect(result.current.pendingLinkUrl).toBeNull();
    openSpy.mockRestore();
  });

  it("defers suspicious native-fallback links until confirm", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useGuardedExternalLinkOpen());

    await act(async () => {
      await result.current.requestOpenExternalLinkPreferNative("http://bit.ly/secure-account-reset");
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(result.current.pendingLinkUrl).toBe("http://bit.ly/secure-account-reset");
    openSpy.mockRestore();
  });
});
