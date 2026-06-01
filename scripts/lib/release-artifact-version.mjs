import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Match semver tokens embedded in installer filenames (e.g. Obscur_1.8.12_x64-setup.exe). */
export const SEMVER_TOKEN_PATTERN = /\d+\.\d+\.\d+/g;

export const readExpectedReleaseVersion = (rootDir) => {
  const raw = readFileSync(resolve(rootDir, "package.json"), "utf8");
  const version = JSON.parse(raw).version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid root package.json version: ${String(version)}`);
  }
  return version;
};

export const collectSemversInBasename = (basename) => {
  const matches = basename.match(SEMVER_TOKEN_PATTERN) ?? [];
  return [...new Set(matches)];
};

/**
 * Desktop installers must embed exactly the expected product semver (no stale 1.8.10 on 1.8.12 tag).
 */
export const assertDesktopInstallerBasename = (basename, expectedVersion) => {
  const semvers = collectSemversInBasename(basename);
  if (semvers.length === 0) {
    return { ok: false, error: `no semver token in installer filename: ${basename}` };
  }
  const wrong = semvers.filter((entry) => entry !== expectedVersion);
  if (wrong.length > 0) {
    return {
      ok: false,
      error: `stale semver in ${basename}: found ${wrong.join(", ")} (expected ${expectedVersion})`,
    };
  }
  return { ok: true };
};

export const versionMarkerRegex = (expectedVersion) => {
  const escaped = expectedVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[._-])v?${escaped}([._-]|$)`, "i");
};
