import Link from "next/link";
import {
  loadSiteContent,
  resolvePreferredDesktopDownload,
} from "../site-content";
import { headers } from "next/headers";
import { AlertTriangle } from "lucide-react";

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

const formatSize = (sizeBytes: number): string =>
  sizeBytes > 0 ? `${(sizeBytes / 1024 / 1024).toFixed(1)} MB` : "—";

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
  const buildGuideHref = manifest?.buildFromSourceDocHref ?? "#";
  const signingPolicyHref = manifest?.signingPolicyDocHref;

  const desktopTargets = [
    release?.preferredDesktopDownload.windows,
    release?.preferredDesktopDownload.macos,
    release?.preferredDesktopDownload.linux,
  ];
  const desktopLabels = ["Windows", "macOS", "Linux"];

  return (
    <main className="site-shell site-shell--download">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Install surface</p>
          <h1>Download Obscur</h1>
          <p className="hero-summary">
            Privacy-first messaging for {isMobile ? "mobile" : "desktop"}. Installers are{" "}
            {signingPolicy} — verify SHA-256 checksums below before sideloading.
          </p>

          {preferredDesktopDownload ? (
            <>
              <div className="hero-actions">
                <a
                  className="button button-primary"
                  href={preferredDesktopDownload.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download for {preferredDesktopDownload.label}
                </a>
                <Link className="button button-secondary" href="/limitations">
                  Known limitations
                </Link>
              </div>
              <p className="hero-meta">
                {preferredDesktopDownload.assetName} · {formatSize(preferredDesktopDownload.sizeBytes)}
              </p>
            </>
          ) : (
            <div className="hero-actions">
              <a
                className="button button-primary"
                href={buildGuideHref}
                target="_blank"
                rel="noreferrer"
              >
                Build from source
              </a>
              <Link className="button button-secondary" href="/limitations">
                Known limitations
              </Link>
            </div>
          )}

          <div className="proof-strip download-proof-strip">
            <a className="proof-link" href={buildGuideHref} target="_blank" rel="noreferrer">
              Build from source
            </a>
            {signingPolicyHref && (
              <a className="proof-link" href={signingPolicyHref} target="_blank" rel="noreferrer">
                Signing policy
              </a>
            )}
            <a
              className="proof-link"
              href={`https://github.com/Dendro-X0/Obscur/blob/main/${RELEASE_MANIFEST_PATH}`}
              target="_blank"
              rel="noreferrer"
            >
              release-assets/manifest.json
            </a>
          </div>
        </div>

        <aside className="hero-panel">
          <p className="panel-label">Release {site.currentVersion}</p>
          <a
            className="release-chip release-chip-link"
            href={site.currentReleaseHref}
            target="_blank"
            rel="noreferrer"
          >
            {site.currentVersion}
          </a>
          <ul className="hero-points hero-points--compact">
            <li>End-to-end encrypted messaging with local-first storage.</li>
            <li>Open source — verify checksums before running unsigned installers.</li>
            <li>No account required to download; identity stays on your device.</li>
          </ul>
        </aside>
      </section>

      {signingPolicy === "unsigned" && (
        <section className="callout-warning" aria-label="Unsigned installer notice">
          <AlertTriangle className="callout-warning-icon" aria-hidden />
          <div>
            <p className="callout-warning-title">Unsigned installer (expected)</p>
            <p>
              Windows SmartScreen may warn about an unknown publisher. Verify the SHA-256 checksum
              before running. Signing is deferred per maintainer policy.
            </p>
            {signingPolicyHref && (
              <a className="callout-warning-link" href={signingPolicyHref} target="_blank" rel="noreferrer">
                Read signing policy →
              </a>
            )}
          </div>
        </section>
      )}

      <section className="section-grid">
        <div className="section-header section-header--wide">
          <p className="eyebrow">Desktop</p>
          <h2>Platform installers</h2>
          <p className="section-lead">
            Windows installer available for {site.currentVersion}. macOS and Linux builds are
            build-from-source until packaged artifacts land in the manifest.
          </p>
        </div>

        <div className="platform-grid">
          {desktopTargets.map((target, index) => (
            <article key={target?.assetName ?? `fallback-${index}`} className="platform-card">
              <div className="platform-card-topline">
                <h3>{target?.label ?? desktopLabels[index]}</h3>
                <span
                  className={`status-pill ${target ? "status-pass" : "status-partial"}`}
                >
                  {target ? "Ready" : "Build locally"}
                </span>
              </div>
              <p>
                {target
                  ? target.assetName
                  : "See install/build guide for platform commands."}
              </p>
              {target ? (
                <div className="platform-card-footer">
                  <span className="platform-card-size">{formatSize(target.sizeBytes)}</span>
                  <a
                    className="button button-primary button-compact"
                    href={target.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                </div>
              ) : (
                <a
                  className="text-link"
                  href={buildGuideHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Build guide →
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header section-header--wide">
          <p className="eyebrow">Mobile</p>
          <h2>Android debug · iOS out of scope</h2>
          <p className="section-lead">
            Android debug APK is produced locally — not distributed via Play Store. iOS is not in
            the v2 installer scope.
          </p>
        </div>

        <div className="platform-grid platform-grid--two">
          <article className="platform-card">
            <div className="platform-card-topline">
              <h3>Android (debug)</h3>
              <span className="status-pill status-partial">Local build</span>
            </div>
            {androidArtifact ? (
              <>
                <p>
                  Build:{" "}
                  <code className="inline-code">
                    {androidArtifact.buildCommand ?? "pnpm build:android:debug:emulator"}
                  </code>
                </p>
                <p>{formatSize(androidArtifact.sizeBytes)} universal debug · sideload after local build</p>
                {androidArtifact.installHint && (
                  <p className="platform-card-hint">{androidArtifact.installHint}</p>
                )}
                <code
                  className="checksum-value checksum-value--compact"
                  data-codactrl-sha256={androidArtifact.sha256}
                >
                  {androidArtifact.sha256}
                </code>
                <a className="text-link" href={buildGuideHref} target="_blank" rel="noreferrer">
                  Android build steps →
                </a>
              </>
            ) : (
              <p>No Android artifact recorded in manifest.</p>
            )}
          </article>

          <article className="platform-card">
            <div className="platform-card-topline">
              <h3>iOS</h3>
              <span className="status-pill status-pending">Not in scope</span>
            </div>
            <p>
              Not in v2.0.0 installer scope. No App Store or TestFlight claim on this site.
            </p>
          </article>
        </div>
      </section>

      {manifest && manifest.artifacts.length > 0 && (
        <section
          className="section-grid editorial-band"
          data-codactrl-surface="download-checksums"
        >
          <div className="section-header section-header--wide">
            <p className="eyebrow">Verification</p>
            <h2>Checksums ({manifest.version})</h2>
            <p className="section-lead">
              Verify downloads against{" "}
              <a
                className="text-link"
                href={`https://github.com/Dendro-X0/Obscur/blob/main/${RELEASE_MANIFEST_PATH}`}
                target="_blank"
                rel="noreferrer"
              >
                release-assets/manifest.json
              </a>
              . Copy the full SHA-256 before running any installer.
            </p>
          </div>

          <div className="checksum-list">
            {manifest.artifacts.map((artifact) => (
              <article key={artifact.path} className="checksum-row">
                <div className="checksum-row-head">
                  <div>
                    <p className="checksum-filename">{artifact.fileName}</p>
                    <p className="checksum-meta">
                      {familyLabel(artifact.platform, artifact.kind)} · {formatSize(artifact.sizeBytes)}
                      {artifact.href ? " · hosted in repo" : " · local build output"}
                    </p>
                  </div>
                  {artifact.href ? (
                    <a
                      className="button button-secondary button-compact"
                      href={artifact.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="status-pill status-pending">Build output</span>
                  )}
                </div>
                <code className="checksum-value" data-codactrl-sha256={artifact.sha256}>
                  {artifact.sha256}
                </code>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="split-section">
        <article className="cta-panel">
          <p className="eyebrow">Before you install</p>
          <h2>Read limitations so demos stay honest</h2>
          <p>
            Obscur is privacy-first desktop software with verified Phase 1 paths and documented
            gaps. Read the limitations sheet so demo hosts do not over-promise roster sync,
            restore, or delete-for-me behavior.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/limitations">
              Known limitations
            </Link>
            <Link className="button button-secondary" href="/">
              Back to product
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}

const RELEASE_MANIFEST_PATH = "release-assets/manifest.json";
