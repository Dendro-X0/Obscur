import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  assertDesktopInstallerBasename,
  collectSemversInBasename,
} from "./lib/release-artifact-version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const runParityCheck = (assetsDir) => {
  const script = join(__dirname, "check-release-artifact-version-parity.mjs");
  return spawnSync(process.execPath, [script, "--assets-dir", assetsDir, "--expected-version", "1.8.12"], {
    cwd: rootDir,
    encoding: "utf8",
  });
};

const writeFixture = (baseDir) => {
  const assetsRoot = join(baseDir, "release-assets");
  mkdirSync(join(assetsRoot, "windows"), { recursive: true });
  writeFileSync(join(assetsRoot, "windows", "Obscur_1.8.12_x64-setup.exe"), "");
  mkdirSync(join(assetsRoot, "macos"), { recursive: true });
  writeFileSync(join(assetsRoot, "macos", "Obscur_1.8.12_aarch64.dmg"), "");
  mkdirSync(join(assetsRoot, "linux"), { recursive: true });
  writeFileSync(join(assetsRoot, "linux", "Obscur_1.8.12_amd64.AppImage"), "");

  const apkMetaDir = join(assetsRoot, "android", "apk", "universal", "release");
  mkdirSync(apkMetaDir, { recursive: true });
  writeFileSync(join(apkMetaDir, "output-metadata.json"), JSON.stringify({
    versionName: "1.8.12",
    elements: [{ outputFile: "app-universal-release.apk", versionName: "1.8.12" }],
  }));
  writeFileSync(join(apkMetaDir, "app-universal-release.apk"), "apk");

  const bundleDir = join(assetsRoot, "android", "bundle", "universalRelease");
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, "app-universal-release.aab"), "aab");

  return join(assetsRoot);
};

describe("release-artifact-version", () => {
  it("collects semver tokens from Obscur installer names", () => {
    assert.deepEqual(
      collectSemversInBasename("Obscur_1.8.10_x64-setup.exe"),
      ["1.8.10"],
    );
    assert.deepEqual(
      collectSemversInBasename("Obscur_1.8.12_amd64.AppImage"),
      ["1.8.12"],
    );
  });

  it("rejects stale desktop semver on expected tag version", () => {
    const result = assertDesktopInstallerBasename("Obscur_1.8.10_aarch64.dmg", "1.8.12");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /stale semver/i);
  });

  it("accepts matching desktop semver", () => {
    const result = assertDesktopInstallerBasename("Obscur_1.8.12_x64-setup.exe", "1.8.12");
    assert.equal(result.ok, true);
  });
});

describe("check-release-artifact-version-parity", () => {
  it("passes when AAB binary exists but bundle metadata has no AAB rows", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "parity-"));
    try {
      const assetsDir = writeFixture(tempDir);
      const result = runParityCheck(assetsDir);
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(result.stdout ?? "", /aab_metadata=0/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when AAB binary is missing", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "parity-"));
    try {
      const assetsDir = writeFixture(tempDir);
      const aabPath = join(assetsDir, "android", "bundle", "universalRelease", "app-universal-release.aab");
      rmSync(aabPath);
      const result = runParityCheck(assetsDir);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr ?? result.stdout ?? "", /No Android AAB binaries/i);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
