import { describe, expect, it } from "vitest";
import {
  inferDesktopPlatformFromUserAgent,
  pickPreferredDesktopAsset,
  toReleaseDownloadTarget,
  type ReleaseAsset,
} from "@dweb/core/release-download-targets";

const assets: readonly ReleaseAsset[] = [
  {
    name: "Obscur_1.3.15_x64-setup.exe",
    browser_download_url: "https://example.com/Obscur_1.3.15_x64-setup.exe",
    size: 9_220_000,
  },
  {
    name: "Obscur_1.3.15_aarch64.dmg",
    browser_download_url: "https://example.com/Obscur_1.3.15_aarch64.dmg",
    size: 6_710_000,
  },
  {
    name: "Obscur_1.3.15_amd64.AppImage",
    browser_download_url: "https://example.com/Obscur_1.3.15_amd64.AppImage",
    size: 84_500_000,
  },
];

describe("release-download-targets", () => {
  it("infers desktop platform from user agent", () => {
    expect(inferDesktopPlatformFromUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(inferDesktopPlatformFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("macos");
    expect(inferDesktopPlatformFromUserAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(inferDesktopPlatformFromUserAgent("Mozilla/5.0")).toBe("unknown");
  });

  it("selects the preferred desktop asset for each platform", () => {
    expect(pickPreferredDesktopAsset(assets, "windows")?.name).toBe("Obscur_1.3.15_x64-setup.exe");
    expect(pickPreferredDesktopAsset(assets, "macos")?.name).toBe("Obscur_1.3.15_aarch64.dmg");
    expect(pickPreferredDesktopAsset(assets, "linux")?.name).toBe("Obscur_1.3.15_amd64.AppImage");
    expect(pickPreferredDesktopAsset(assets, "unknown")).toBeNull();
  });

  it("builds a release download target from the selected asset", () => {
    const target = toReleaseDownloadTarget(assets[0], "Windows installer");
    expect(target).toEqual({
      label: "Windows installer",
      href: "https://example.com/Obscur_1.3.15_x64-setup.exe",
      assetName: "Obscur_1.3.15_x64-setup.exe",
      sizeBytes: 9_220_000,
    });
  });
});
