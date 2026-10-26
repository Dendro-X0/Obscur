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

/**
 * Card label — clean unsigned/debug noise only.
 * Do not rewrite package semver (2.0.0) into marketing tags (2.0.0-beta.N):
 * GitHub assets embed package tree version; rewriting made the list look like
 * beta.2 while the hero already showed beta.3.
 */
const displayArtifactName = (fileName: string): string =>
  fileName
    .replace(/[-_]unsigned(?=\.|$)/gi, "")
    .replace(/[-_]debug(?=\.|$)/gi, "")
    .replace(/_{2,}/g, "_")
    .replace(/-{2,}/g, "-");

const PLATFORM_INSTALL_HINTS = {
  windows:
    "SmartScreen may say “Windows protected your PC.” Open More info → Run anyway after you downloaded from this site.",
  macos:
    "Gatekeeper may block the first open. Right-click (or Control-click) the app → Open, or allow it under System Settings → Privacy & Security.",
  linux:
    "Make the AppImage executable (`chmod +x`), then run it. Your desktop may still warn about an untrusted binary — that is expected.",
  android:
    "Enable install from this source when prompted. The APK is self-signed sideload — not Play Store verified.",
  ios: "No App Store or TestFlight build is published here.",
} as const;

function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("windows")) return "windows";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "web";
}

const RELEASE_MANIFEST_PATH = "release-assets/manifest.json";
const MANIFEST_HREF = `https://github.com/Dendro-X0/Obscur/blob/main/${RELEASE_MANIFEST_PATH}`;

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
  // Prefer version.json / site identity over a stale checked-in manifest.releaseTag
  // (hero already uses site.currentVersion — keep the platform list in lockstep).
  const releaseTag = site.currentVersion.replace(/^v/i, "");
  const packageVersion = manifest?.version
    ?? (releaseTag.includes("-") ? releaseTag.slice(0, releaseTag.indexOf("-")) : releaseTag);
  const artifactLabel = (fileName: string) => displayArtifactName(fileName);

  const desktopTargets = [
    { label: "Windows", target: release?.preferredDesktopDownload.windows },
    { label: "macOS", target: release?.preferredDesktopDownload.macos },
    { label: "Linux", target: release?.preferredDesktopDownload.linux },
  ] as const;

  const primaryPlatformHint =
    detectedPlatform === "android"
      ? "Android"
      : detectedPlatform === "ios"
        ? null
        : detectedPlatform === "windows"
          ? "Windows"
          : detectedPlatform === "macos"
            ? "macOS"
            : detectedPlatform === "linux"
              ? "Linux"
              : null;

  return (
    <main className="site-shell site-shell--download">
      <section className="download-hero">
        <div className="download-hero-copy">
          <p className="eyebrow">Get the app</p>
          <h1>Download Obscur</h1>
          <p className="hero-summary">
            {detectedPlatform === "ios"
              ? "iOS isn’t offered here. Use a desktop installer or Android sideload below."
              : primaryDownload
                ? `One click for ${primaryDownload.label} — then pick another platform if you need it.`
                : "Choose your platform below, or build from source."}
          </p>

          {primaryDownload ? (
            <div className="download-hero-cta">
              <a
                className="button button-primary button-download-lg"
                href={primaryDownload.href}
                target="_blank"
                rel="noreferrer"
              >
                Download for {primaryDownload.label}
              </a>
              <p className="download-hero-meta">
                {site.currentVersion}
                {primaryPlatformHint ? ` · suggested for your device` : null}
                {" · "}
                {formatSize(primaryDownload.sizeBytes)}
              </p>
            </div>
          ) : (
            <div className="download-hero-cta">
              <a
                className="button button-primary button-download-lg"
                href={buildGuideHref}
                target="_blank"
                rel="noreferrer"
              >
                Build from source
              </a>
            </div>
          )}

          <ul className="download-hero-points">
            <li>Private messaging — identity stays on your device</li>
            <li>No account signup · no store listing required</li>
            <li>
              Installers are self-signed / unsigned — each OS may warn; that is expected without
              Apple / Microsoft / Play developer programs
            </li>
          </ul>
        </div>

        <aside className="download-hero-aside" aria-label="Release">
          <p className="panel-label">Current release</p>
          <p className="download-hero-version">{site.currentVersion}</p>
          <a
            className="text-link"
            href={site.currentReleaseHref}
            target="_blank"
            rel="noreferrer"
          >
            Release notes
          </a>
          <div className="download-hero-aside-links">
            <Link href="/limitations">Product scope</Link>
            <Link href="/guide">User guide</Link>
            {signingPolicyHref ? (
              <a href={signingPolicyHref} target="_blank" rel="noreferrer">
                Signing policy
              </a>
            ) : null}
          </div>
        </aside>
      </section>

      {signingPolicy === "unsigned" && (
        <section
          className="callout-warning callout-warning--compact download-trust"
          aria-label="Self-signed installer notice"
        >
          <AlertTriangle className="callout-warning-icon" aria-hidden />
          <div>
            <p className="callout-warning-title">OS warnings are expected</p>
            <p>
              Obscur ships installers without Apple Developer, Microsoft Authenticode, or Google
              Play enrollment — builds are self-signed / unsigned. Your OS will treat that as
              “unknown publisher.” Trust this page’s checksums (below), not a store badge.
              {signingPolicyHref ? (
                <>
                  {" "}
                  <a className="callout-warning-link" href={signingPolicyHref} target="_blank" rel="noreferrer">
                    Signing policy
                  </a>
                </>
              ) : null}
            </p>
            <ul className="download-trust-list">
              <li>
                <strong>Windows</strong> — {PLATFORM_INSTALL_HINTS.windows}
              </li>
              <li>
                <strong>macOS</strong> — {PLATFORM_INSTALL_HINTS.macos}
              </li>
              <li>
                <strong>Linux</strong> — {PLATFORM_INSTALL_HINTS.linux}
              </li>
              <li>
                <strong>Android</strong> — {PLATFORM_INSTALL_HINTS.android}
              </li>
            </ul>
          </div>
        </section>
      )}

      <section className="download-platforms" aria-labelledby="download-platforms-title">
        <div className="section-header section-header--wide">
          <p className="eyebrow">All platforms</p>
          <h2 id="download-platforms-title">Pick your installer</h2>
          <p className="section-lead">
            Release <strong>v{releaseTag}</strong>
            {packageVersion !== releaseTag ? (
              <>
                {" "}
                (package tree {packageVersion})
              </>
            ) : null}
            . Desktop is the primary surface. Android is sideload-only. iOS is not available. Every
            offered installer follows the same self-signed policy.
          </p>
        </div>

        <div className="download-pick-grid">
          {desktopTargets.map(({ label, target }) => {
            const isSuggested = primaryPlatformHint === label;
            const hintKey =
              label === "Windows" ? "windows" : label === "macOS" ? "macos" : "linux";
            return (
              <article
                key={label}
                className={`download-pick${isSuggested ? " download-pick--suggested" : ""}`}
              >
                <div className="download-pick-head">
                  <h3>{label}</h3>
                  {isSuggested ? <span className="download-pick-badge">For you</span> : null}
                </div>
                {target ? (
                  <>
                    <p className="download-pick-size">{formatSize(target.sizeBytes)}</p>
                    <p className="download-pick-file" title={target.assetName}>
                      {artifactLabel(target.assetName)}
                    </p>
                    <p className="download-pick-hint">{PLATFORM_INSTALL_HINTS[hintKey]}</p>
                    <a
                      className="button button-primary"
                      href={target.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </>
                ) : (
                  <>
                    <p className="download-pick-size">Build locally</p>
                    <p className="download-pick-hint">{PLATFORM_INSTALL_HINTS[hintKey]}</p>
                    <a className="button button-secondary" href={buildGuideHref} target="_blank" rel="noreferrer">
                      Build guide
                    </a>
                  </>
                )}
              </article>
            );
          })}

          <article
            className={`download-pick${primaryPlatformHint === "Android" ? " download-pick--suggested" : ""}`}
          >
            <div className="download-pick-head">
              <h3>Android</h3>
              {primaryPlatformHint === "Android" ? (
                <span className="download-pick-badge">For you</span>
              ) : null}
            </div>
            {androidArtifact?.href ? (
              <>
                <p className="download-pick-size">
                  {formatSize(androidArtifact.sizeBytes)} · APK sideload
                </p>
                <p className="download-pick-file" title={androidArtifact.fileName}>
                  {artifactLabel(androidArtifact.fileName)}
                </p>
                <p className="download-pick-hint">{PLATFORM_INSTALL_HINTS.android}</p>
                <a
                  className="button button-primary"
                  href={androidArtifact.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download APK
                </a>
              </>
            ) : (
              <>
                <p className="download-pick-size">Not in this manifest</p>
                <p className="download-pick-hint">{PLATFORM_INSTALL_HINTS.android}</p>
                <a className="button button-secondary" href={buildGuideHref} target="_blank" rel="noreferrer">
                  Build guide
                </a>
              </>
            )}
          </article>

          <article className="download-pick download-pick--muted">
            <div className="download-pick-head">
              <h3>iOS</h3>
            </div>
            <p className="download-pick-size">Not offered</p>
            <p className="download-pick-hint">{PLATFORM_INSTALL_HINTS.ios}</p>
          </article>
        </div>
      </section>

      {manifest && manifest.artifacts.length > 0 ? (
        <details
          className="download-verify"
          data-codactrl-surface="download-checksums"
        >
          <summary className="download-verify-summary">
            <span className="download-verify-title">Optional: verify file integrity</span>
            <span className="download-verify-hint">
              For advanced users — SHA-256 checksums (v{releaseTag}
              {packageVersion !== releaseTag ? ` · package ${packageVersion}` : ""})
            </span>
          </summary>
          <div className="download-verify-body">
            <p className="download-verify-lead">
              After downloading, you can confirm the file wasn’t altered by comparing its hash to{" "}
              <a href={MANIFEST_HREF} target="_blank" rel="noreferrer">
                manifest.json
              </a>
              . Most people can skip this.
            </p>
            <div className="checksum-list">
              {manifest.artifacts.map((artifact) => (
                <article key={artifact.path} className="checksum-row">
                  <div className="checksum-row-head">
                    <div>
                      <p className="checksum-filename">
                        {familyLabel(artifact.platform, artifact.kind)}
                      </p>
                      <p className="checksum-meta" title={artifact.fileName}>
                        {artifactLabel(artifact.fileName)} · {formatSize(artifact.sizeBytes)}
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
                      <span className="status-pill status-pending">Local only</span>
                    )}
                  </div>
                  <code className="checksum-value" data-codactrl-sha256={artifact.sha256}>
                    {artifact.sha256}
                  </code>
                </article>
              ))}
            </div>
          </div>
        </details>
      ) : null}

      <section className="download-next">
        <p className="eyebrow">Next</p>
        <h2>After you install</h2>
        <div className="download-next-actions">
          <Link className="button button-secondary" href="/guide">
            Open the user guide
          </Link>
          <Link className="button button-secondary" href="/limitations">
            Read product scope
          </Link>
          <Link className="button button-secondary" href="/">
            Back to product
          </Link>
        </div>
      </section>
    </main>
  );
}
