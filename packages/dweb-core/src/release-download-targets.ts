export type ReleaseAsset = Readonly<{
  name: string;
  browser_download_url: string;
  size: number;
}>;

export type DesktopPlatform = "windows" | "macos" | "linux" | "unknown";

/** CPU / bundle arch inferred from Tauri-style asset names. */
export type DesktopArch = "x64" | "arm64" | "universal" | "unknown";

export type ReleaseDownloadTarget = Readonly<{
  label: string;
  href: string;
  assetName: string;
  sizeBytes: number;
  arch?: DesktopArch;
}>;

const WINDOWS_MATCHERS = [".exe", ".msi"];
const MACOS_MATCHERS = [".dmg"];
const LINUX_MATCHERS = [".appimage", ".deb"];
const ANDROID_MATCHERS = [".apk", ".aab"];
const WEB_MATCHERS = [".tar.gz"];

const normalizeAssetName = (value: string): string => value.trim().toLowerCase();

export const inferDesktopPlatformFromUserAgent = (userAgent: string): DesktopPlatform => {
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("win")) return "windows";
  if (normalized.includes("mac")) return "macos";
  if (normalized.includes("linux")) return "linux";
  return "unknown";
};

export const isReleaseAssetDownloadable = (asset: ReleaseAsset): boolean => {
  const name = normalizeAssetName(asset.name);
  return (
    WINDOWS_MATCHERS.some((ext) => name.endsWith(ext))
    || MACOS_MATCHERS.some((ext) => name.endsWith(ext))
    || LINUX_MATCHERS.some((ext) => name.endsWith(ext))
    || ANDROID_MATCHERS.some((ext) => name.endsWith(ext))
    || WEB_MATCHERS.some((ext) => name.endsWith(ext))
  );
};

export const classifyReleaseAssetFamily = (
  asset: ReleaseAsset,
): "windows" | "macos" | "linux" | "android" | "web" | "other" => {
  const name = normalizeAssetName(asset.name);
  if (WINDOWS_MATCHERS.some((ext) => name.endsWith(ext))) return "windows";
  if (MACOS_MATCHERS.some((ext) => name.endsWith(ext))) return "macos";
  if (LINUX_MATCHERS.some((ext) => name.endsWith(ext))) return "linux";
  if (ANDROID_MATCHERS.some((ext) => name.endsWith(ext))) return "android";
  if (WEB_MATCHERS.some((ext) => name.endsWith(ext))) return "web";
  return "other";
};

/** Infer arch from Obscur/Tauri installer filenames (x64, aarch64, amd64, universal, …). */
export const classifyDesktopArch = (assetName: string): DesktopArch => {
  const name = normalizeAssetName(assetName);
  if (name.includes("universal")) return "universal";
  if (
    name.includes("aarch64")
    || name.includes("arm64")
    || /(?:^|[_\-.])arm(?:[_\-.]|$)/.test(name)
  ) {
    return "arm64";
  }
  if (
    name.includes("x64")
    || name.includes("amd64")
    || name.includes("x86_64")
    || name.includes("intel")
  ) {
    return "x64";
  }
  return "unknown";
};

const ARCH_SHORT_LABEL: Readonly<Record<DesktopArch, string>> = {
  x64: "x64",
  arm64: "ARM64",
  universal: "Universal",
  unknown: "Installer",
};

const platformDisplayName = (platform: DesktopPlatform): string => {
  switch (platform) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return "Desktop";
  }
};

const pickAssetByMatchers = (
  assets: readonly ReleaseAsset[],
  preferredMatchers: readonly string[],
): ReleaseAsset | null => {
  const matchingAssets = assets.filter((asset) => {
    const name = normalizeAssetName(asset.name);
    return preferredMatchers.some((matcher) => name.endsWith(matcher));
  });
  if (matchingAssets.length === 0) {
    return null;
  }
  return matchingAssets.sort((left, right) => left.name.localeCompare(right.name))[0] ?? null;
};

export const pickPreferredDesktopAsset = (
  assets: readonly ReleaseAsset[],
  platform: DesktopPlatform,
): ReleaseAsset | null => {
  if (platform === "windows") {
    const setupExe = assets.find((asset) => normalizeAssetName(asset.name).endsWith("_x64-setup.exe"));
    if (setupExe) return setupExe;
    return pickAssetByMatchers(assets, WINDOWS_MATCHERS);
  }
  if (platform === "macos") {
    const armDmg = assets.find((asset) => normalizeAssetName(asset.name).includes("aarch64.dmg"));
    if (armDmg) return armDmg;
    return pickAssetByMatchers(assets, MACOS_MATCHERS);
  }
  if (platform === "linux") {
    const amd64AppImage = assets.find((asset) => {
      const name = normalizeAssetName(asset.name);
      return name.endsWith(".appimage") && (name.includes("amd64") || name.includes("x86_64") || name.includes("_x64"));
    });
    if (amd64AppImage) return amd64AppImage;
    const appImage = assets.find((asset) => normalizeAssetName(asset.name).endsWith(".appimage"));
    if (appImage) return appImage;
    return pickAssetByMatchers(assets, LINUX_MATCHERS);
  }
  return null;
};

export const toReleaseDownloadTarget = (
  asset: ReleaseAsset | null,
  label: string,
): ReleaseDownloadTarget | null => {
  if (!asset) {
    return null;
  }
  return {
    label,
    href: asset.browser_download_url,
    assetName: asset.name,
    sizeBytes: asset.size,
    arch: classifyDesktopArch(asset.name),
  };
};

/**
 * All downloadable installers for one desktop OS, preferred first.
 * Ready for multi-arch Releases (x64 + ARM64, etc.) when CI publishes them.
 */
export const listDesktopDownloadVariants = (
  assets: readonly ReleaseAsset[],
  platform: DesktopPlatform,
): readonly ReleaseDownloadTarget[] => {
  if (platform === "unknown") {
    return [];
  }
  const matched = assets.filter((asset) => classifyReleaseAssetFamily(asset) === platform);
  if (matched.length === 0) {
    return [];
  }
  const preferred = pickPreferredDesktopAsset(matched, platform);
  const ordered = [...matched].sort((left, right) => {
    if (preferred) {
      if (left.name === preferred.name) return -1;
      if (right.name === preferred.name) return 1;
    }
    return left.name.localeCompare(right.name);
  });
  const osName = platformDisplayName(platform);
  return ordered.map((asset) => {
    const arch = classifyDesktopArch(asset.name);
    return {
      label: `${osName} (${ARCH_SHORT_LABEL[arch]})`,
      href: asset.browser_download_url,
      assetName: asset.name,
      sizeBytes: asset.size,
      arch,
    };
  });
};

export const filterDownloadableReleaseAssets = (
  assets: readonly ReleaseAsset[],
): readonly ReleaseAsset[] => assets.filter(isReleaseAssetDownloadable);
