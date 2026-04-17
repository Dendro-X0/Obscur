import {
  classifyReleaseAssetFamily,
  type ReleaseAsset,
} from "@dweb/core/release-download-targets";
import {
  loadSiteContent,
  resolvePreferredDesktopDownload,
} from "../site-content";

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

const formatSize = (sizeBytes: number): string =>
  `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;

export default async function DownloadPage() {
  const site = await loadSiteContent();
  const preferredDesktopDownload = resolvePreferredDesktopDownload(
    site.latestRelease,
    "Mozilla/5.0",
  );
  const release = site.latestRelease;

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Downloads</p>
          <h1>Get the current Obscur release without digging through assets.</h1>
          <p className="hero-summary">
            This page mirrors the latest GitHub release metadata when it is available. When the
            release API is unavailable, it falls back to the canonical release page for the current
            tagged version.
          </p>
          <div className="hero-actions">
            {preferredDesktopDownload ? (
              <a
                className="button button-primary"
                href={preferredDesktopDownload.href}
                target="_blank"
                rel="noreferrer"
              >
                Download {preferredDesktopDownload.label}
              </a>
            ) : null}
            <a
              className="button button-secondary"
              href={site.currentReleaseHref}
              target="_blank"
              rel="noreferrer"
            >
              Open Release Page
            </a>
          </div>
        </div>
        <aside className="hero-panel">
          <p className="panel-label">Release target</p>
          <a className="release-chip release-chip-link" href={site.currentReleaseHref} target="_blank" rel="noreferrer">
            {site.currentReleaseTag}
          </a>
          <ul className="hero-points">
            <li>Desktop updater feed is still missing `latest.json` on the live release channel.</li>
            <li>This page is the intended human fallback when in-app streaming install is unavailable.</li>
            <li>Platform-specific links below come from release metadata when GitHub responds.</li>
          </ul>
        </aside>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Desktop</p>
          <h2>Direct install targets</h2>
        </div>
        <div className="status-grid">
          {([
            release?.preferredDesktopDownload.windows,
            release?.preferredDesktopDownload.macos,
            release?.preferredDesktopDownload.linux,
          ]).map((target, index) => (
            <article key={target?.assetName ?? `fallback-${index}`} className="status-card">
              <div className="status-topline">
                <h3>{target?.label ?? "Unavailable"}</h3>
                <span className={`status-pill ${target ? "status-pass" : "status-pending"}`}>
                  {target ? "Ready" : "Pending"}
                </span>
              </div>
              <p>
                {target
                  ? `${target.assetName} · ${formatSize(target.sizeBytes)}`
                  : "No release asset resolved for this platform from the latest metadata."}
              </p>
              {target ? (
                <div className="hero-actions">
                  <a className="button button-secondary" href={target.href} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">All assets</p>
          <h2>Latest published files</h2>
        </div>
        <div className="asset-list">
          {release?.downloadableAssets.length ? release.downloadableAssets.map((asset) => (
            <article key={asset.name} className="asset-row">
              <div>
                <p className="asset-title">{asset.name}</p>
                <p className="asset-meta">{familyLabel(asset)} · {formatSize(asset.size)}</p>
              </div>
              <a className="button button-secondary" href={asset.browser_download_url} target="_blank" rel="noreferrer">
                Download
              </a>
            </article>
          )) : (
            <article className="asset-row">
              <div>
                <p className="asset-title">Release metadata unavailable</p>
                <p className="asset-meta">Open the canonical release page for the current tag instead.</p>
              </div>
              <a className="button button-secondary" href={site.currentReleaseHref} target="_blank" rel="noreferrer">
                Open release
              </a>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
