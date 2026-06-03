import { describe, expect, it } from "vitest";
import {
  buildRawRepoFileUrl,
  parseRepoVersionJson,
  policyManifestToDownloadRelease,
  REPO_STABLE_UPDATE_FEED_URL,
  REPO_STABLE_UPDATE_POLICY_URL,
  REPO_VERSION_JSON_URL,
  shouldPreferRepoUpdateChannel,
  shouldQueryGitHubReleasesLatest,
} from "./repo-update-channel";

describe("repo-update-channel", () => {
  it("builds raw github URLs for stable channel manifests", () => {
    expect(REPO_VERSION_JSON_URL).toContain("raw.githubusercontent.com");
    expect(REPO_VERSION_JSON_URL.endsWith("/version.json")).toBe(true);
    expect(REPO_STABLE_UPDATE_FEED_URL).toContain("/apps/desktop/release/channel/stable/latest.json");
    expect(REPO_STABLE_UPDATE_POLICY_URL).toContain("streaming-update-policy.json");
  });

  it("parses version.json payload", () => {
    expect(parseRepoVersionJson('{"version":"1.8.14","channel":"stable"}')).toEqual({
      version: "1.8.14",
      channel: "stable",
      target: undefined,
    });
    expect(parseRepoVersionJson("{}")).toBeNull();
  });

  it("prefers repo channel over GitHub releases/latest by default", () => {
    expect(shouldPreferRepoUpdateChannel()).toBe(true);
    expect(shouldQueryGitHubReleasesLatest()).toBe(false);
  });

  it("builds download release from policy manifest", () => {
    const release = policyManifestToDownloadRelease({
      version: "1.8.14",
      channel: "stable",
      rolloutPercentage: 100,
      killSwitch: false,
      artifacts: {
        "windows-x86_64": {
          url: "https://example.com/Obscur_1.8.14_x64-setup.exe",
          signature: "sig",
          checksumSha256: "0".repeat(64),
        },
      },
    });
    expect(release.tag_name).toBe("v1.8.14");
    expect(release.assets[0]?.name).toBe("Obscur_1.8.14_x64-setup.exe");
  });
});
