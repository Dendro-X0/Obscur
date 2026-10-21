import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { readActiveTransportId, writeActiveTransportId } from "./preferences";
import type { TransportId } from "./types";

export type ApplyActiveTransportResult = Readonly<{
  transportId: TransportId;
  torPreferenceOn: boolean;
  nativeApplied: boolean;
  errorMessage?: string;
}>;

/**
 * Apply Tor preference via privacy settings + existing gateway IPC.
 * Does not spawn tor.exe — start_tor/stop_tor proxy the gateway (R4).
 */
export const applyTorGatewayPreference = async (
  enableTor: boolean,
): Promise<Readonly<{ nativeApplied: boolean; errorMessage?: string }>> => {
  const current = PrivacySettingsService.getSettings();
  const updated = {
    ...current,
    enableTorProxy: enableTor,
  };
  PrivacySettingsService.saveSettings(updated);

  if (!hasNativeRuntime()) {
    return { nativeApplied: false };
  }

  const persisted = await invokeNativeCommand("save_tor_settings", {
    enableTor,
    proxyUrl: updated.torProxyUrl,
  });
  if (!persisted.ok) {
    return {
      nativeApplied: false,
      errorMessage: persisted.message || "save_tor_settings failed",
    };
  }

  if (enableTor) {
    const started = await invokeNativeCommand<string>("start_tor", undefined, {
      timeoutMs: 8_000,
    });
    if (!started.ok) {
      return {
        nativeApplied: true,
        errorMessage:
          started.message
          || "Tor gateway unreachable — run `pnpm dev:tor-gateway`.",
      };
    }
  } else {
    await invokeNativeCommand("stop_tor", undefined, { timeoutMs: 8_000 });
  }

  return { nativeApplied: true };
};

/**
 * Persist transport plane + apply Clearnet/Tor to the existing Tor gateway.
 * Quiet: preference only — Tor off; does not reopen uncapped Quiet.
 */
export const applyActiveTransport = async (
  transportId: TransportId,
  profileId?: string,
): Promise<ApplyActiveTransportResult> => {
  writeActiveTransportId(transportId, profileId);

  if (transportId === "tor") {
    const tor = await applyTorGatewayPreference(true);
    return {
      transportId,
      torPreferenceOn: true,
      nativeApplied: tor.nativeApplied,
      errorMessage: tor.errorMessage,
    };
  }

  // clearnet + quiet: Tor preference off. Quiet does not reopen uncapped Quiet (dial caps stay).
  const tor = await applyTorGatewayPreference(false);
  return {
    transportId,
    torPreferenceOn: false,
    nativeApplied: tor.nativeApplied,
    errorMessage: tor.errorMessage,
  };
};

/**
 * Keep transport id honest with Security-panel Tor toggle.
 * Turning Tor on → tor. Turning Tor off while transport was tor → clearnet.
 * Quiet is preserved when Tor is turned off while Quiet was selected.
 */
export const syncTransportIdFromTorPreference = (
  enableTorProxy: boolean,
  profileId?: string,
): TransportId => {
  if (enableTorProxy) {
    writeActiveTransportId("tor", profileId);
    return "tor";
  }
  const current = readActiveTransportId(profileId);
  if (current === "quiet") {
    return "quiet";
  }
  writeActiveTransportId("clearnet", profileId);
  return "clearnet";
};
