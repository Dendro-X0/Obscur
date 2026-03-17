import { beforeEach, describe, expect, it, vi } from "vitest";
import { protocolCoreAdapter } from "./protocol-core-adapter";
import { invokeNativeCommand } from "./native-adapters";
import { PrivacySettingsService, defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";

vi.mock("./native-adapters", () => ({
  invokeNativeCommand: vi.fn(),
}));

describe("protocol-core-adapter", () => {
  beforeEach(() => {
    vi.mocked(invokeNativeCommand).mockReset();
    localStorage.clear();
    PrivacySettingsService.saveSettings({
      ...defaultPrivacySettings,
      stabilityModeV090: false,
      protocolCoreRustV090: true,
      deterministicDiscoveryV090: true,
      x3dhRatchetV090: true,
    });
  });

  it("unwraps protocol command result payload", async () => {
    vi.mocked(invokeNativeCommand).mockResolvedValue({
      ok: true,
      value: {
        ok: true,
        value: {
          rootPublicKeyHex: "abc",
          createdAtUnixMs: 1,
          revision: 1,
          status: "available",
        },
      },
    });

    const result = await protocolCoreAdapter.getIdentityRootState();
    expect(result.ok).toBe(true);
    expect(vi.mocked(invokeNativeCommand)).toHaveBeenCalledWith("protocol_get_identity_root_state", undefined);
  });

  it("passes snake_case parameters for verification command", async () => {
    vi.mocked(invokeNativeCommand).mockResolvedValue({
      ok: true,
      value: {
        ok: false,
        error: { reason: "failed", message: "bad envelope", retryable: false },
      },
    });

    await protocolCoreAdapter.verifyMessageEnvelope({
      sessionId: "session-a",
      messageId: "msg-1",
      envelope: "ciphertext",
    });

    expect(vi.mocked(invokeNativeCommand)).toHaveBeenCalledWith("protocol_verify_message_envelope", {
      session_id: "session-a",
      message_id: "msg-1",
      envelope: "ciphertext",
      counter: undefined,
      envelope_version: "v090_x3dr",
      x3dh_enabled: true,
    });
  });

  it("returns unsupported when protocol core flag is disabled", async () => {
    PrivacySettingsService.saveSettings({
      ...defaultPrivacySettings,
      stabilityModeV090: true,
      protocolCoreRustV090: false,
      x3dhRatchetV090: false,
    });
    const result = await protocolCoreAdapter.getSessionState("session-a");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupported");
    }
    expect(vi.mocked(invokeNativeCommand)).not.toHaveBeenCalled();
  });
});
