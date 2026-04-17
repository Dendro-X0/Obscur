export type ReleaseAsset = Readonly<{
  name: string;
  browser_download_url: string;
  size: number;
}>;

export type DesktopPlatform = "windows" | "macos" | "linux" | "unknown";

export type ReleaseDownloadTarget = Readonly<{
  label: string;
  href: string;
  assetName: string;
  sizeBytes: number;
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
  };
};

export const filterDownloadableReleaseAssets = (
  assets: readonly ReleaseAsset[],
): readonly ReleaseAsset[] => assets.filter(isReleaseAssetDownloadable);
