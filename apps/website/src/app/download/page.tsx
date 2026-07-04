import Link from "next/link";
import {
  classifyReleaseAssetFamily,
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
  AlertTriangle,
  FileCode,
} from "lucide-react";

const familyLabel = (platform: string, kind: string): string => {
  switch (platform) {
    case "windows":
      return "Windows";
    case "android":
      return "Android";
    case "macos":
      return "macOS";
    case "linux":
      return "Linux";
    default:
      return kind;
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
  sizeBytes > 0 ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB` : "—";

const shortSha = (sha256: string): string =>
  sha256.length >= 16 ? `${sha256.slice(0, 16)}…` : sha256;

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
  const manifest = site.releaseManifest;

  const androidArtifact = manifest?.artifacts.find((a) => a.platform === "android") ?? null;

  const isMobile = detectedPlatform === "android" || detectedPlatform === "ios";
  const signingPolicy = manifest?.signingPolicy ?? "unsigned";

  return (
    <main className="min-h-screen bg-black text-white">
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
              Installers are {signingPolicy} — verify SHA-256 below before sideloading.
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

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
              <Link href="/limitations" className="text-amber-400 hover:text-amber-300">
                Read known limitations →
              </Link>
              <a
                href={manifest?.buildFromSourceDocHref ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                Build from source
              </a>
            </div>

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

      {signingPolicy === "unsigned" && (
        <section className="border-t border-white/10 py-12">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div className="flex gap-4 rounded-2xl bg-amber-500/10 p-6 ring-1 ring-amber-500/20">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400" />
              <div className="text-sm text-zinc-300">
                <p className="font-semibold text-amber-200">Unsigned installer (expected)</p>
                <p className="mt-2">
                  Windows SmartScreen may warn about an unknown publisher. Verify the SHA-256
                  checksum before running. Signing is deferred per maintainer policy.
                </p>
                <a
                  href={manifest?.signingPolicyDocHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-amber-400 hover:text-amber-300"
                >
                  Signing policy →
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12">
            <div className="flex items-center gap-x-3 mb-4">
              <Monitor className="h-6 w-6 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">Desktop</h2>
            </div>
            <p className="text-zinc-400 max-w-2xl">
              Windows installer available for {site.currentVersion}. macOS and Linux builds are
              build-from-source until packaged artifacts land in the manifest.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {([
              release?.preferredDesktopDownload.windows,
              release?.preferredDesktopDownload.macos,
              release?.preferredDesktopDownload.linux,
            ]).map((target, index) => {
              const labels = ["Windows", "macOS", "Linux"];
              const Icon = getPlatformIcon(
                target ? classifyReleaseAssetFamily({ name: target.assetName, browser_download_url: target.href, size: target.sizeBytes }) : labels[index].toLowerCase(),
              );
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
                        {target?.label ?? labels[index]}
                      </h3>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      target
                        ? "bg-green-500/10 text-green-400"
                        : "bg-yellow-500/10 text-yellow-400"
                    }`}>
                      {target ? "Ready" : "Build locally"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    {target
                      ? target.assetName
                      : "See install/build guide for platform commands."}
                  </p>
                  {target ? (
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
                  ) : (
                    <a
                      href={manifest?.buildFromSourceDocHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-x-2 text-sm text-blue-400 hover:text-blue-300"
                    >
                      <FileCode className="h-4 w-4" />
                      Build guide
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12">
            <div className="flex items-center gap-x-3 mb-4">
              <Smartphone className="h-6 w-6 text-blue-400" />
              <h2 className="text-3xl font-bold text-white">Mobile</h2>
            </div>
            <p className="text-zinc-400 max-w-2xl">
              Android debug APK is produced locally — not distributed via Play Store. iOS is not in
              the v2 installer scope.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-zinc-900/30 p-6 ring-1 ring-white/10">
              <div className="flex items-center gap-x-3 mb-4">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Smartphone className="h-5 w-5 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Android (debug)</h3>
              </div>
              {androidArtifact ? (
                <div className="space-y-4 text-sm text-zinc-400">
                  <p>
                    Build: <code className="text-zinc-300">{androidArtifact.buildCommand ?? "pnpm build:android:debug:emulator"}</code>
                  </p>
                  <p className="font-mono text-xs break-all text-zinc-500">
                    SHA-256: {androidArtifact.sha256}
                  </p>
                  <p>{formatSize(androidArtifact.sizeBytes)} universal debug · sideload after local build</p>
                  {androidArtifact.installHint && (
                    <p className="font-mono text-xs text-zinc-500">{androidArtifact.installHint}</p>
                  )}
                  <a
                    href={manifest?.buildFromSourceDocHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-x-2 text-blue-400 hover:text-blue-300"
                  >
                    <FileCode className="h-4 w-4" />
                    Android build steps
                  </a>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No Android artifact recorded in manifest.</p>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-900/30 p-6 ring-1 ring-white/10">
              <div className="flex items-center gap-x-3 mb-4">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">iOS</h3>
              </div>
              <p className="text-sm text-zinc-500">
                Not in v2.0.0 installer scope. No App Store or TestFlight claim on this site.
              </p>
            </div>
          </div>
        </div>
      </section>

      {manifest && manifest.artifacts.length > 0 && (
        <section className="py-24 sm:py-32 border-t border-white/10">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white">Checksums ({manifest.version})</h2>
              <p className="text-zinc-400 mt-2">
                Verify downloads against{" "}
                <a
                  href={`https://github.com/Dendro-X0/Obscur/blob/main/${RELEASE_MANIFEST_PATH}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  release-assets/manifest.json
                </a>
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900/30 ring-1 ring-white/10 overflow-hidden">
              <div className="divide-y divide-white/10">
                {manifest.artifacts.map((artifact) => (
                  <div key={artifact.path} className="px-6 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">{artifact.fileName}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          {familyLabel(artifact.platform, artifact.kind)} · {formatSize(artifact.sizeBytes)}
                          {artifact.href ? " · hosted in repo" : " · local build output"}
                        </p>
                        <p className="mt-2 font-mono text-xs text-zinc-400 break-all">
                          {artifact.sha256}
                        </p>
                      </div>
                      {artifact.href ? (
                        <a
                          href={artifact.href}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-sm text-blue-400 hover:text-blue-300"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-zinc-500">{shortSha(artifact.sha256)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-24 sm:py-32 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative rounded-2xl bg-gradient-to-r from-zinc-800/40 to-zinc-900/40 p-8 ring-1 ring-white/10">
            <h3 className="text-xl font-semibold text-white">Before you install</h3>
            <p className="mt-3 text-zinc-400 max-w-2xl">
              Obscur is privacy-first desktop software with verified Phase 1 paths and documented
              gaps. Read the limitations sheet so demo hosts do not over-promise roster sync,
              restore, or delete-for-me behavior.
            </p>
            <Link
              href="/limitations"
              className="mt-6 inline-flex items-center gap-x-2 rounded-lg bg-zinc-700 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-600 transition-colors"
            >
              Known limitations
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const RELEASE_MANIFEST_PATH = "release-assets/manifest.json";
