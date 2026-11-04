import { describe, expect, it } from "vitest";
import {
  classifyDesktopArch,
  inferDesktopPlatformFromUserAgent,
  listDesktopDownloadVariants,
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

const multiArchWindows: readonly ReleaseAsset[] = [
  ...assets,
  {
    name: "Obscur_1.3.15_arm64-setup.exe",
    browser_download_url: "https://example.com/Obscur_1.3.15_arm64-setup.exe",
    size: 9_100_000,
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
      arch: "x64",
    });
  });

  it("classifies arch from installer names", () => {
    expect(classifyDesktopArch("Obscur_2.0.0_x64-setup.exe")).toBe("x64");
    expect(classifyDesktopArch("Obscur_2.0.0_aarch64.dmg")).toBe("arm64");
    expect(classifyDesktopArch("Obscur_2.0.0_amd64.AppImage")).toBe("x64");
    expect(classifyDesktopArch("Obscur_2.0.0_universal.dmg")).toBe("universal");
  });

  it("lists multi-arch windows variants with preferred first", () => {
    const variants = listDesktopDownloadVariants(multiArchWindows, "windows");
    expect(variants.map((v) => v.assetName)).toEqual([
      "Obscur_1.3.15_x64-setup.exe",
      "Obscur_1.3.15_arm64-setup.exe",
    ]);
    expect(variants[0]?.label).toBe("Windows (x64)");
    expect(variants[1]?.label).toBe("Windows (ARM64)");
  });

  it("prefers linux amd64 AppImage when aarch64 is also present", () => {
    const linuxPair: readonly ReleaseAsset[] = [
      {
        name: "Obscur_2.0.0_aarch64.AppImage",
        browser_download_url: "https://example.com/Obscur_2.0.0_aarch64.AppImage",
        size: 80_000_000,
      },
      {
        name: "Obscur_2.0.0_amd64.AppImage",
        browser_download_url: "https://example.com/Obscur_2.0.0_amd64.AppImage",
        size: 85_000_000,
      },
    ];
    expect(pickPreferredDesktopAsset(linuxPair, "linux")?.name).toBe("Obscur_2.0.0_amd64.AppImage");
    const variants = listDesktopDownloadVariants(linuxPair, "linux");
    expect(variants[0]?.assetName).toBe("Obscur_2.0.0_amd64.AppImage");
    expect(variants).toHaveLength(2);
  });

  it("falls back to linux .deb when no AppImage is published (beta.4 CI shape)", () => {
    const debOnly: readonly ReleaseAsset[] = [
      {
        name: "Obscur_2.0.0_amd64.deb",
        browser_download_url: "https://example.com/Obscur_2.0.0_amd64.deb",
        size: 11_000_000,
      },
    ];
    expect(pickPreferredDesktopAsset(debOnly, "linux")?.name).toBe("Obscur_2.0.0_amd64.deb");
    expect(listDesktopDownloadVariants(debOnly, "linux").map((v) => v.label)).toEqual([
      "Linux (x64)",
    ]);
  });

  it("lists macOS aarch64 + x64 variants with Apple Silicon preferred", () => {
    const dualMac: readonly ReleaseAsset[] = [
      {
        name: "Obscur_2.0.0_x64.dmg",
        browser_download_url: "https://example.com/Obscur_2.0.0_x64.dmg",
        size: 11_000_000,
      },
      {
        name: "Obscur_2.0.0_aarch64.dmg",
        browser_download_url: "https://example.com/Obscur_2.0.0_aarch64.dmg",
        size: 10_000_000,
      },
    ];
    expect(pickPreferredDesktopAsset(dualMac, "macos")?.name).toBe("Obscur_2.0.0_aarch64.dmg");
    expect(listDesktopDownloadVariants(dualMac, "macos").map((v) => v.assetName)).toEqual([
      "Obscur_2.0.0_aarch64.dmg",
      "Obscur_2.0.0_x64.dmg",
    ]);
  });
});
