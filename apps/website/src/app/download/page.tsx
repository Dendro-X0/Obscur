import {
  classifyReleaseAssetFamily,
  type ReleaseAsset,
} from "@dweb/core/release-download-targets";
import {
  loadSiteContent,
  resolvePreferredDesktopDownload,
} from "../site-content";

import { headers } from "next/headers";
import {
  Smartphone,
  Monitor,
  Globe,
  Shield,
  CheckCircle,
  Download,
} from "lucide-react";

const familyLabel = (asset: ReleaseAsset): string => {
  switch (classifyReleaseAssetFamily(asset)) {
    case "windows":
      return "Windows";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    case "android":
      return "Android";
    case "web":
      return "Web / PWA";
    default:
      return "Other";
  }
};

const getPlatformIcon = (family: string) => {
  switch (family) {
    case "windows":
    case "macos":
    case "linux":
      return Monitor;
    case "android":
    case "ios":
      return Smartphone;
    default:
      return Globe;
  }
};

const formatSize = (sizeBytes: number): string =>
  `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "web";
}

export default async function DownloadPage() {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const detectedPlatform = detectPlatform(userAgent);
  
  const site = await loadSiteContent();
  const preferredDesktopDownload = resolvePreferredDesktopDownload(
    site.latestRelease,
    userAgent,
  );
  const release = site.latestRelease;

  const mobileAssets = release?.downloadableAssets.filter(
    (asset) => classifyReleaseAssetFamily(asset) === "android" || 
              asset.name.endsWith(".apk") || 
              asset.name.endsWith(".aab")
  ) || [];

  const isMobile = detectedPlatform === "android" || detectedPlatform === "ios";

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center justify-center rounded-2xl bg-blue-500/10 p-4">
              <Download className="h-12 w-12 text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Download Obscur
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              Privacy-first messaging for {isMobile ? "mobile" : "desktop"}.
              No account required. No data collection. Just secure communication.
            </p>
            
            {preferredDesktopDownload && (
              <div className="mt-10">
                <a
                  href={preferredDesktopDownload.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-x-2 rounded-full bg-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-blue-500 transition-all hover:shadow-blue-500/25"
                >
                  <Download className="h-5 w-5" />
                  Download for {preferredDesktopDownload.label}
                </a>
                <p className="mt-3 text-sm text-zinc-400">
                  {preferredDesktopDownload.assetName} · {formatSize(preferredDesktopDownload.sizeBytes)}
                </p>
              </div>
            )}

            {/* Trust Indicators */}
            <div className="mt-12 flex items-center justify-center gap-x-8 text-sm text-zinc-400">
              <div className="flex items-center gap-x-2">
                <Shield className="h-4 w-4 text-green-400" />
                <span>E2EE Encrypted</span>
              </div>
              <div className="flex items-center gap-x-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span>Open Source</span>
              </div>
              <div className="flex items-center gap-x-2">
                <Globe className="h-4 w-4 text-green-400" />
                <span>No Account Required</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop Section */}
      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12">
            <div className="flex items-center gap-x-3 mb-4">
              <Monitor className="h-6 w-6 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">Desktop</h2>
            </div>
            <p className="text-zinc-400 max-w-2xl">
              Native desktop applications with full feature parity. Supports Windows, macOS, and Linux.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {([
              release?.preferredDesktopDownload.windows,
              release?.preferredDesktopDownload.macos,
              release?.preferredDesktopDownload.linux,
            ]).map((target, index) => {
              const Icon = getPlatformIcon(target ? classifyReleaseAssetFamily(target) : "");
              return (
                <div
                  key={target?.assetName ?? `fallback-${index}`}
                  className="group relative rounded-2xl bg-zinc-900/50 p-6 ring-1 ring-white/10 transition-all hover:bg-zinc-900/80"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-x-3">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <Icon className="h-5 w-5 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {target?.label ?? "Unavailable"}
                      </h3>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      target 
                        ? "bg-green-500/10 text-green-400" 
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}>
                      {target ? "Ready" : "Pending"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    {target
                      ? target.assetName
                      : "No release asset available."}
                  </p>
                  {target && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-500">{formatSize(target.sizeBytes)}</span>
                      <a
                        href={target.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mobile Section */}
      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12">
            <div className="flex items-center gap-x-3 mb-4">
              <Smartphone className="h-6 w-6 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">Mobile</h2>
            </div>
            <p className="text-zinc-400 max-w-2xl">
              Coming soon. Mobile applications for Android and iOS are in active development for v1.4.8.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Android */}
            <div className="group relative rounded-2xl bg-zinc-900/30 p-6 ring-1 ring-white/10">
              <div className="flex items-center gap-x-3 mb-4">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Smartphone className="h-5 w-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Android</h3>
              </div>
              {mobileAssets.length > 0 ? (
                mobileAssets.map((asset) => (
                  <div key={asset.name} className="flex items-center justify-between py-2">
                    <span className="text-sm text-zinc-400">{asset.name}</span>
                    <div className="flex items-center gap-x-4">
                      <span className="text-sm text-zinc-500">{formatSize(asset.size)}</span>
                      <a
                        href={asset.browser_download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-x-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4">
                  <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
                    Coming in v1.4.8
                  </span>
                  <p className="mt-2 text-sm text-zinc-500">
                    APK and Play Store builds are in progress.
                  </p>
                </div>
              )}
            </div>

            {/* iOS */}
            <div className="group relative rounded-2xl bg-zinc-900/30 p-6 ring-1 ring-white/10">
              <div className="flex items-center gap-x-3 mb-4">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">iOS</h3>
              </div>
              <div className="py-4">
                <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-400">
                  Coming in v1.4.8
                </span>
                <p className="mt-2 text-sm text-zinc-500">
                  TestFlight and App Store builds are in progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Web Section */}
      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-8 ring-1 ring-blue-500/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-x-3 mb-2">
                  <Globe className="h-6 w-6 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white">Web / PWA</h3>
                </div>
                <p className="text-zinc-400 max-w-lg">
                  Use Obscur directly in your browser. Install as a PWA for a native-like experience without downloading.
                </p>
              </div>
              <div className="flex items-center gap-x-4">
                {release?.downloadableAssets.find((a) => a.name.includes("pwa-static")) ? (
                  <a
                    href="https://app.obscur.app"
                    className="inline-flex items-center gap-x-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    Open Web App
                  </a>
                ) : (
                  <span className="text-sm text-zinc-500">Available after v1.4.8 release</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* All Assets */}
      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">All Release Assets</h2>
            <p className="text-zinc-400 mt-2">
              Complete list of files for {site.currentReleaseTag}
            </p>
          </div>
          
          <div className="rounded-2xl bg-zinc-900/30 ring-1 ring-white/10 overflow-hidden">
            {release?.downloadableAssets.length ? (
              <div className="divide-y divide-white/10">
                {release.downloadableAssets.map((asset) => (
                  <div
                    key={asset.name}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-x-4">
                      <div className="rounded-lg bg-zinc-800 p-2">
                        {(() => {
                          const Icon = getPlatformIcon(classifyReleaseAssetFamily(asset));
                          return <Icon className="h-4 w-4 text-zinc-400" />;
                        })()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{asset.name}</p>
                        <p className="text-xs text-zinc-500">
                          {familyLabel(asset)} · {formatSize(asset.size)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={asset.browser_download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-zinc-400">Release metadata temporarily unavailable</p>
                <a
                  href={site.currentReleaseHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-x-2 text-blue-400 hover:text-blue-300"
                >
                  View on GitHub →
                </a>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
