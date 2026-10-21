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
  const primaryMobileDownload =
    detectedPlatform === "android" && androidArtifact?.href
      ? {
          href: androidArtifact.href,
          label: "Android",
          assetName: androidArtifact.fileName,
          sizeBytes: androidArtifact.sizeBytes,
        }
      : null;
  const primaryDownload = primaryMobileDownload ?? preferredDesktopDownload;
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
            {detectedPlatform === "android" && androidArtifact?.href
              ? "Android APK is available for sideload — self-signed, verify SHA-256 below."
              : `Privacy-first messaging for ${isMobile ? "mobile" : "desktop"}. Installers are ${signingPolicy} — verify SHA-256 checksums below before sideloading.`}
          </p>

          {primaryDownload ? (
            <>
              <div className="hero-actions">
                <a
                  className="button button-primary"
                  href={primaryDownload.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download for {primaryDownload.label}
                </a>
                <Link className="button button-secondary" href="/limitations">
                  Product scope
                </Link>
              </div>
              <p className="hero-meta">
                {primaryDownload.assetName} · {formatSize(primaryDownload.sizeBytes)}
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
                Product scope
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
            <li>Sovereign path: your keys, end-to-end encryption, and operator infra you choose — not a hosted landlord inbox.</li>
            <li>End-to-end encrypted messaging — NIP-17 DMs and sealed group room keys — with local-first storage.</li>
            <li>Relays carry ciphertext only; routing metadata is still visible on public relays.</li>
            <li>Desktop + Android APK in the release manifest — verify checksums before install.</li>
            <li>No cloud account required; identity stays on your device. Tor routing is optional underlay, not the product pitch.</li>
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
            Windows, macOS (Apple Silicon), and Linux AppImage for {site.currentVersion} are in
            the release manifest. Builds are unsigned. Linux is larger because the AppImage
            ships WebKit/GTK libraries; Windows and macOS use the OS webview instead.
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
          <h2>Android sideload · iOS out of scope</h2>
          <p className="section-lead">
            No Google Play or Apple Developer Program listing — builds are self-signed. Android: CI
            universal APK on this page (installable and functional; performance improved since early
            v1.9). Low-RAM phones may still feel heavy. iOS is not offered here.
          </p>
        </div>

        <div className="platform-grid platform-grid--two">
          <article className="platform-card">
            <div className="platform-card-topline">
              <h3>Android</h3>
              <span
                className={`status-pill ${androidArtifact?.href ? "status-pass" : "status-partial"}`}
              >
                {androidArtifact?.href ? "Ready" : "Local build"}
              </span>
            </div>
            {androidArtifact ? (
              <>
                <p>{androidArtifact.fileName}</p>
                <p>
                  {formatSize(androidArtifact.sizeBytes)} · universal · self-signed · not on Play
                  Store
                </p>
                <p className="platform-card-hint">
                  Allow install from this source → open the APK. Tested installable in Android Studio
                  builds; {site.currentVersion} ships from Full Release CI. Or:{" "}
                  <code className="inline-code">adb install -r &lt;apk&gt;</code>
                </p>
                <div className="platform-card-footer">
                  {androidArtifact.href ? (
                    <a
                      className="button button-primary button-compact"
                      href={androidArtifact.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  ) : (
                    <a className="text-link" href={buildGuideHref} target="_blank" rel="noreferrer">
                      Android build steps →
                    </a>
                  )}
                </div>
                <code
                  className="checksum-value checksum-value--compact"
                  data-codactrl-sha256={androidArtifact.sha256}
                >
                  {androidArtifact.sha256}
                </code>
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
              No Apple Developer Program build on this site — no App Store or TestFlight.
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
          <h2>Understand scope before you demo</h2>
          <p>
            Obscur separates network contracts from product defects: public relays are immutable,
            operator stacks enable stronger deletion, and desktop/Android are the ship surfaces. Read
            product scope so demos stay accurate.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/limitations">
              Product scope
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
