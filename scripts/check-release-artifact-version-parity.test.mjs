import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDesktopInstallerBasename,
  collectSemversInBasename,
} from "./lib/release-artifact-version.mjs";

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
