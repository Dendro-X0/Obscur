export type StreamingUpdateChannel = "stable" | "beta" | "canary";

export type StreamingUpdateArtifact = Readonly<{
  url: string;
  signature: string;
  checksumSha256: string;
}>;

export type StreamingUpdateManifest = Readonly<{
  version: string;
  channel: StreamingUpdateChannel;
  rolloutPercentage: number;
  killSwitch: boolean;
  minSafeVersion?: string;
  releaseNotesUrl?: string;
  artifacts: Readonly<Record<string, StreamingUpdateArtifact>>;
}>;

type ParseManifestResult = Readonly<{
  ok: true;
  manifest: StreamingUpdateManifest;
}> | Readonly<{
  ok: false;
  reason: string;
}>;

export type StreamingUpdateBlockReason =
  | "kill_switch_active"
  | "channel_mismatch"
  | "rollout_holdback"
  | "manifest_invalid";

export type StreamingUpdateDecision = Readonly<{
  eligible: boolean;
  reasonCode?: StreamingUpdateBlockReason;
  forceUpdateRequired: boolean;
  rolloutBucket: number;
  rollbackBehavior: "preserve_current_version";
}>;

export type StreamingUpdateInstallFailureReason =
  | "verification_failed"
  | "download_failed"
  | "install_failed"
  | "no_update_available"
  | "unknown_failure";

export type StreamingUpdateInstallFailure = Readonly<{
  reasonCode: StreamingUpdateInstallFailureReason;
  preserveCurrentVersion: true;
  userMessage: string;
}>;

const HASH_INIT = 2166136261;
const HASH_PRIME = 16777619;

const normalizeVersion = (value: string): string => value.trim().replace(/^v/i, "");

const parseSemver = (value: string): number[] | null => {
  const normalized = normalizeVersion(value).split("-")[0];
  if (!/^\d+(\.\d+){1,3}$/.test(normalized)) {
    return null;
  }
  return normalized.split(".").map((segment) => Number.parseInt(segment, 10) || 0);
};

export const compareVersions = (current: string, next: string): number | null => {
  const currentParts = parseSemver(current);
  const nextParts = parseSemver(next);
  if (!currentParts || !nextParts) {
    return null;
  }
  const maxLength = Math.max(currentParts.length, nextParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const left = currentParts[index] ?? 0;
    const right = nextParts[index] ?? 0;
    if (left !== right) {
      return left < right ? -1 : 1;
    }
  }
  return 0;
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseChannel = (value: unknown): StreamingUpdateChannel | null => {
  if (value === "stable" || value === "beta" || value === "canary") {
    return value;
  }
  return null;
};

const parseArtifact = (value: unknown): StreamingUpdateArtifact | null => {
  if (!isObjectRecord(value)) {
    return null;
  }
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const signature = typeof value.signature === "string" ? value.signature.trim() : "";
  const checksumSha256 = typeof value.checksumSha256 === "string"
    ? value.checksumSha256.trim().toLowerCase()
    : "";
  if (!url.startsWith("https://")) {
    return null;
  }
  if (signature.length === 0) {
    return null;
  }
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) {
    return null;
  }
  return {
    url,
    signature,
    checksumSha256,
  };
};

export const parseStreamingUpdateManifest = (value: unknown): ParseManifestResult => {
  if (!isObjectRecord(value)) {
    return { ok: false, reason: "manifest must be an object" };
  }
  const version = typeof value.version === "string" ? normalizeVersion(value.version) : "";
  if (!parseSemver(version)) {
    return { ok: false, reason: "version must be semver-like" };
  }
  const channel = parseChannel(value.channel);
  if (!channel) {
    return { ok: false, reason: "channel must be stable|beta|canary" };
  }
  const rolloutPercentage = typeof value.rolloutPercentage === "number"
    ? Math.floor(value.rolloutPercentage)
    : Number.NaN;
  if (!Number.isFinite(rolloutPercentage) || rolloutPercentage < 0 || rolloutPercentage > 100) {
    return { ok: false, reason: "rolloutPercentage must be 0..100" };
  }
  const killSwitch = typeof value.killSwitch === "boolean" ? value.killSwitch : false;
  const minSafeVersionRaw = typeof value.minSafeVersion === "string"
    ? normalizeVersion(value.minSafeVersion)
    : undefined;
  if (minSafeVersionRaw && !parseSemver(minSafeVersionRaw)) {
    return { ok: false, reason: "minSafeVersion must be semver-like when present" };
  }
  const releaseNotesUrl = typeof value.releaseNotesUrl === "string"
    ? value.releaseNotesUrl.trim()
    : undefined;
  if (releaseNotesUrl && !/^https?:\/\//.test(releaseNotesUrl)) {
    return { ok: false, reason: "releaseNotesUrl must be http(s) when present" };
  }
  if (!isObjectRecord(value.artifacts)) {
    return { ok: false, reason: "artifacts must be a non-empty object" };
  }
  const artifactEntries = Object.entries(value.artifacts);
  if (artifactEntries.length === 0) {
    return { ok: false, reason: "artifacts must be a non-empty object" };
  }
  const parsedArtifacts: Record<string, StreamingUpdateArtifact> = {};
  for (const [platform, artifactValue] of artifactEntries) {
    const artifact = parseArtifact(artifactValue);
    if (!artifact) {
      return { ok: false, reason: `artifact contract invalid for platform ${platform}` };
    }
    parsedArtifacts[platform] = artifact;
  }

  return {
    ok: true,
    manifest: {
      version,
      channel,
      rolloutPercentage,
      killSwitch,
      minSafeVersion: minSafeVersionRaw,
      releaseNotesUrl,
      artifacts: parsedArtifacts,
    },
  };
};

export const computeRolloutBucket = (seed: string): number => {
  const normalizedSeed = seed.trim().length > 0 ? seed.trim() : "obscur-default-rollout-seed";
  let hash = HASH_INIT;
  for (let index = 0; index < normalizedSeed.length; index += 1) {
    hash ^= normalizedSeed.charCodeAt(index);
    hash = Math.imul(hash, HASH_PRIME);
  }
  const unsigned = hash >>> 0;
  return unsigned % 100;
};

export const evaluateStreamingUpdateDecision = (params: Readonly<{
  manifest: StreamingUpdateManifest;
  currentVersion: string;
  channel: StreamingUpdateChannel;
  rolloutSeed: string;
}>): StreamingUpdateDecision => {
  const bucket = computeRolloutBucket(params.rolloutSeed);
  const minSafeVersion = params.manifest.minSafeVersion;
  const forceUpdateRequired = Boolean(
    minSafeVersion && compareVersions(params.currentVersion, minSafeVersion) === -1
  );
  if (params.manifest.channel !== params.channel) {
    return {
      eligible: false,
      reasonCode: "channel_mismatch",
      forceUpdateRequired,
      rolloutBucket: bucket,
      rollbackBehavior: "preserve_current_version",
    };
  }
  if (params.manifest.killSwitch) {
    return {
      eligible: false,
      reasonCode: "kill_switch_active",
      forceUpdateRequired,
      rolloutBucket: bucket,
      rollbackBehavior: "preserve_current_version",
    };
  }
  if (bucket >= params.manifest.rolloutPercentage) {
    return {
      eligible: false,
      reasonCode: "rollout_holdback",
      forceUpdateRequired,
      rolloutBucket: bucket,
      rollbackBehavior: "preserve_current_version",
    };
  }
  return {
    eligible: true,
    forceUpdateRequired,
    rolloutBucket: bucket,
    rollbackBehavior: "preserve_current_version",
  };
};

export const classifyStreamingUpdateInstallFailure = (message: string): StreamingUpdateInstallFailure => {
  const normalized = message.toLowerCase();
  if (normalized.includes("no updates available")) {
    return {
      reasonCode: "no_update_available",
      preserveCurrentVersion: true,
      userMessage: "No update is currently available for this device.",
    };
  }
  if (
    normalized.includes("signature")
    || normalized.includes("checksum")
    || normalized.includes("hash mismatch")
    || normalized.includes("integrity")
  ) {
    return {
      reasonCode: "verification_failed",
      preserveCurrentVersion: true,
      userMessage: "Update verification failed. Your current version is preserved for safety.",
    };
  }
  if (normalized.includes("download")) {
    return {
      reasonCode: "download_failed",
      preserveCurrentVersion: true,
      userMessage: "Update download failed. Your current version is unchanged.",
    };
  }
  if (normalized.includes("install")) {
    return {
      reasonCode: "install_failed",
      preserveCurrentVersion: true,
      userMessage: "Update installation failed. Your current version is unchanged.",
    };
  }
  return {
    reasonCode: "unknown_failure",
    preserveCurrentVersion: true,
    userMessage: "Update failed. Your current version is unchanged.",
  };
};
