import type { PrivacySettings } from "./privacy-settings-service";

export type V090RolloutPolicy = Readonly<{
  stabilityModeEnabled: boolean;
  deterministicDiscoveryEnabled: boolean;
  protocolCoreEnabled: boolean;
  x3dhRatchetEnabled: boolean;
  tanstackQueryEnabled?: boolean;
}>;

export const normalizeV090Flags = (settings: PrivacySettings): PrivacySettings => {
  const normalized = { ...settings };
  if (normalized.stabilityModeV090) {
    normalized.useModernDMs = false;
    normalized.deterministicDiscoveryV090 = false;
    normalized.protocolCoreRustV090 = false;
    normalized.x3dhRatchetV090 = false;
    normalized.tanstackQueryV1 = false;
    return normalized;
  }

  if (normalized.x3dhRatchetV090) {
    normalized.protocolCoreRustV090 = true;
  }
  if (!normalized.protocolCoreRustV090) {
    normalized.useModernDMs = false;
    normalized.x3dhRatchetV090 = false;
    normalized.deterministicDiscoveryV090 = false;
  }
  return normalized;
};

export const getV090RolloutPolicy = (settings: PrivacySettings): V090RolloutPolicy => {
  const normalized = normalizeV090Flags(settings);
  return {
    stabilityModeEnabled: normalized.stabilityModeV090,
    deterministicDiscoveryEnabled: normalized.deterministicDiscoveryV090 && normalized.protocolCoreRustV090,
    protocolCoreEnabled: normalized.protocolCoreRustV090,
    x3dhRatchetEnabled: normalized.x3dhRatchetV090,
    tanstackQueryEnabled: normalized.tanstackQueryV1 === true,
  };
};
