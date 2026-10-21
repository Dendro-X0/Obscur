import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGuardedExternalLinkOpen } from "./use-guarded-external-link-open";
import { defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";

const privacyMocks = vi.hoisted(() => ({
  getSettings: vi.fn(() => ({ ...defaultPrivacySettings, linkSafetyOutboundCheckEnabled: false })),
}));

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
  openNativeExternal: vi.fn(async () => false),
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", async () => {
  const actual = await vi.importActual<typeof import("@/app/features/settings/services/privacy-settings-service")>(
    "@/app/features/settings/services/privacy-settings-service",
  );
  return {
    ...actual,
    PrivacySettingsService: {
      ...actual.PrivacySettingsService,
      getSettings: () => privacyMocks.getSettings(),
    },
  };
});

const fetchReputationMock = vi.hoisted(() =>
  vi.fn(async (url: string) => ({
    verdict: "clean" as const,
    providerLabel: "URLHaus",
    url,
    detail: "No URLHaus listing for this URL",
    queried: true,
  })),
);

vi.mock("@/app/features/security/services/link-safety-reputation-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/features/security/services/link-safety-reputation-client")
  >("@/app/features/security/services/link-safety-reputation-client");
  return {
    ...actual,
    fetchUrlReputation: (url: string) => fetchReputationMock(url),
  };
});

describe("useGuardedExternalLinkOpen", () => {
  beforeEach(() => {
    privacyMocks.getSettings.mockReturnValue({
      ...defaultPrivacySettings,
      linkSafetyOutboundCheckEnabled: false,
    });
    fetchReputationMock.mockClear();
  });

  it("opens benign links immediately when outbound check is off", () => {
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
    expect(fetchReputationMock).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("defers suspicious links until confirm when outbound is off", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useGuardedExternalLinkOpen());

    act(() => {
      result.current.requestOpenExternalLink("http://bit.ly/secure-account-reset");
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(result.current.pendingLinkUrl).toBe("http://bit.ly/secure-account-reset");
    expect(result.current.pendingLinkPhase).toBe("local_confirm");

    await act(async () => {
      await result.current.confirmPendingLink();
    });

    expect(openSpy).toHaveBeenCalledWith(
      "http://bit.ly/secure-account-reset",
      "_blank",
      "noopener,noreferrer",
    );
    expect(fetchReputationMock).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("offers labeled reputation consent for benign links when outbound is on", async () => {
    privacyMocks.getSettings.mockReturnValue({
      ...defaultPrivacySettings,
      linkSafetyOutboundCheckEnabled: true,
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const { result } = renderHook(() => useGuardedExternalLinkOpen());

    act(() => {
      result.current.requestOpenExternalLink("https://example.com/docs");
    });

    expect(openSpy).not.toHaveBeenCalled();
    expect(result.current.pendingLinkPhase).toBe("reputation_consent");

    await act(async () => {
      await result.current.confirmPendingLink();
    });

    expect(fetchReputationMock).toHaveBeenCalledWith("https://example.com/docs");
    expect(result.current.pendingLinkPhase).toBe("reputation_result");
    expect(result.current.reputationResult?.verdict).toBe("clean");

    await act(async () => {
      await result.current.confirmPendingLink();
    });

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/docs",
      "_blank",
      "noopener,noreferrer",
    );
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
