import { beforeEach, describe, expect, it, vi } from "vitest";

const saveSettingsMock = vi.hoisted(() => vi.fn());
const getSettingsMock = vi.hoisted(() => vi.fn(() => ({
  enableTorProxy: false,
  torProxyUrl: "socks5h://127.0.0.1:9050",
})));
const invokeNativeCommandMock = vi.hoisted(() => vi.fn(async () => ({ ok: true as const, value: undefined })));
const hasNativeRuntimeMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: getSettingsMock,
    saveSettings: saveSettingsMock,
  },
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: invokeNativeCommandMock,
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: hasNativeRuntimeMock,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getScopedStorageKey: (key: string, profileId: string) => `${key}::${profileId}`,
}));

import {
  applyActiveTransport,
  syncTransportIdFromTorPreference,
} from "./apply-active-transport";
import { readActiveTransportId, writeActiveTransportId } from "./preferences";

describe("applyActiveTransport (C1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettingsMock.mockReturnValue({
      enableTorProxy: false,
      torProxyUrl: "socks5h://127.0.0.1:9050",
    });
    hasNativeRuntimeMock.mockReturnValue(true);
    invokeNativeCommandMock.mockResolvedValue({ ok: true, value: undefined });
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("tor enables privacy preference and starts gateway", async () => {
    const result = await applyActiveTransport("tor");
    expect(result.torPreferenceOn).toBe(true);
    expect(result.nativeApplied).toBe(true);
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ enableTorProxy: true }),
    );
    expect(invokeNativeCommandMock).toHaveBeenCalledWith(
      "save_tor_settings",
      expect.objectContaining({ enableTor: true }),
    );
    expect(invokeNativeCommandMock).toHaveBeenCalledWith(
      "start_tor",
      undefined,
      expect.objectContaining({ timeoutMs: 8_000 }),
    );
    expect(readActiveTransportId()).toBe("tor");
  });

  it("clearnet disables Tor and stops gateway", async () => {
    writeActiveTransportId("tor");
    getSettingsMock.mockReturnValue({
      enableTorProxy: true,
      torProxyUrl: "socks5h://127.0.0.1:9050",
    });
    const result = await applyActiveTransport("clearnet");
    expect(result.torPreferenceOn).toBe(false);
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ enableTorProxy: false }),
    );
    expect(invokeNativeCommandMock).toHaveBeenCalledWith(
      "stop_tor",
      undefined,
      expect.objectContaining({ timeoutMs: 8_000 }),
    );
    expect(readActiveTransportId()).toBe("clearnet");
  });

  it("quiet persists without enabling Tor or uncapped Quiet", async () => {
    const result = await applyActiveTransport("quiet");
    expect(result.transportId).toBe("quiet");
    expect(result.torPreferenceOn).toBe(false);
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ enableTorProxy: false }),
    );
    expect(invokeNativeCommandMock).not.toHaveBeenCalledWith(
      "start_tor",
      expect.anything(),
      expect.anything(),
    );
    expect(readActiveTransportId()).toBe("quiet");
  });

  it("skips native IPC when not native runtime", async () => {
    hasNativeRuntimeMock.mockReturnValue(false);
    const result = await applyActiveTransport("tor");
    expect(result.nativeApplied).toBe(false);
    expect(invokeNativeCommandMock).not.toHaveBeenCalled();
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ enableTorProxy: true }),
    );
  });
});

describe("syncTransportIdFromTorPreference", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("maps enableTor on → tor", () => {
    expect(syncTransportIdFromTorPreference(true)).toBe("tor");
    expect(readActiveTransportId()).toBe("tor");
  });

  it("maps enableTor off from tor → clearnet", () => {
    writeActiveTransportId("tor");
    expect(syncTransportIdFromTorPreference(false)).toBe("clearnet");
    expect(readActiveTransportId()).toBe("clearnet");
  });

  it("preserves quiet when Tor turns off", () => {
    writeActiveTransportId("quiet");
    expect(syncTransportIdFromTorPreference(false)).toBe("quiet");
    expect(readActiveTransportId()).toBe("quiet");
  });
});
