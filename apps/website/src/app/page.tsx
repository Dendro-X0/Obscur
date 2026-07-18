import { AmbientDemoVideo } from "./ambient-demo-video";
import { HeroStage } from "./hero-stage";
import { ObscurLogo } from "./obscur-logo";
import { RevealScope } from "./reveal-on-view";
import { loadSiteContent } from "./site-content";

const statusLabelByKind = {
  pass: "Verified",
  partial: "In Progress",
  pending: "Pending",
} as const;

const statusClassNameByKind = {
  pass: "status-pass",
  partial: "status-partial",
  pending: "status-pending",
} as const;

export default async function Home() {
  const {
    currentReleaseHref,
    currentVersion,
    docsLinks,
    featureCards,
    heroShowcase,
    platformCards,
    proofLinks,
    releaseHighlights,
    verificationItems,
  } = await loadSiteContent();

  return (
    <RevealScope className="theater-root">
      <section className="hero-theater" aria-label="Obscur">
        {heroShowcase ? (
          <HeroStage media={heroShowcase.media} hasAudio={heroShowcase.hasAudio} />
        ) : (
          <div className="hero-theater-media hero-theater-media--empty" aria-hidden="true" />
        )}
        <div className="hero-theater-veil" aria-hidden="true" />
        <div className="hero-theater-overlay">
          <div className="hero-theater-brand" data-reveal data-reveal-delay="0">
            <ObscurLogo size={56} priority className="hero-theater-logo" />
            <p className="hero-theater-wordmark">Obscur</p>
          </div>
          <h1 className="hero-theater-title" data-reveal data-reveal-delay="1">
            Privacy kept close —{" "}
            <span className="hero-h1-accent">releases you can verify</span>
          </h1>
          <p className="hero-theater-summary" data-reveal data-reveal-delay="2">
            End-to-end encrypted messaging with local ownership. This site mirrors repo truth —
            not a second product story.
          </p>
          <div className="hero-theater-actions" data-reveal data-reveal-delay="3">
            <a className="button button-primary" href="/download">
              Download {currentVersion}
            </a>
            <a className="button button-secondary" href="/guide">
              User guide
            </a>
          </div>
          <p className="hero-theater-release" data-reveal data-reveal-delay="4">
            Current public release{" "}
            <a href={currentReleaseHref} target="_blank" rel="noreferrer">
              {currentVersion}
            </a>
          </p>
        </div>
      </section>

      <div className="site-shell site-shell--home site-shell--theater">
        <nav className="proof-strip proof-strip--quiet" aria-label="Source of truth links">
          {proofLinks.map((link) => (
            <a
              key={link.href}
              className="proof-link"
              href={link.href}
              {...(link.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <section className="theater-chapter" data-reveal>
          <div className="section-header theater-chapter-header">
            <p className="eyebrow">Chapter I · Release</p>
            <h2>What is actually shipping right now</h2>
          </div>
          <div className="release-grid">
            {releaseHighlights.map((release) => (
              <article key={release.version} className="release-card">
                <div className="release-meta">
                  <span>{release.version}</span>
                  <span>{release.releasedOn}</span>
                </div>
                <ul className="release-list">
                  {release.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="theater-chapter theater-chapter--stages">
          <div className="section-header theater-chapter-header section-header--wide" data-reveal>
            <p className="eyebrow">Chapter II · Surfaces</p>
            <h2>Captured product stages from the demo library</h2>
            <p className="section-lead">
              Web-compressed captures — not mockups. Open the <a href="/guide">user guide</a> for
              every how-to.
            </p>
          </div>

          <div className="feature-stages">
            {featureCards.map((feature) => (
              <article
                key={feature.title}
                className={`feature-stage feature-stage--${feature.stageLayout}`}
                data-reveal
              >
                <div className="feature-stage-media">
                  {feature.media.kind === "mp4" ? (
                    <AmbientDemoVideo media={feature.media} className="feature-stage-video" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- rare GIF fallback
                    <img src={feature.media.url} alt={feature.gifAlt} className="feature-stage-video" />
                  )}
                </div>
                <div className="feature-stage-copy">
                  <h3>{feature.title}</h3>
                  <p>{feature.summary}</p>
                  <a className="feature-guide-link" href={feature.guideHref}>
                    Open in guide
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="theater-chapter" data-reveal>
          <div className="section-header theater-chapter-header">
            <p className="eyebrow">Chapter III · Runtimes</p>
            <h2>One product, explicit platform boundaries</h2>
          </div>
          <div className="platform-grid">
            {platformCards.map((platform) => (
              <article key={platform.name} className="platform-card">
                <h3>{platform.name}</h3>
                <p>{platform.summary}</p>
                <span className="path-chip">{platform.path}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="theater-chapter theater-chapter--proof" data-reveal>
          <div className="section-header theater-chapter-header section-header--wide">
            <p className="eyebrow">Chapter IV · Evidence</p>
            <h2>Release truth stays tied to verification</h2>
            <p className="section-lead">
              Maintainer matrix outcomes — verified, in progress, and accepted limitations —
              surfaced honestly.
            </p>
          </div>
          <div className="status-grid">
            {verificationItems.map((item) => (
              <article key={item.label} className="status-card">
                <div className="status-topline">
                  <h3>{item.label}</h3>
                  <span className={`status-pill ${statusClassNameByKind[item.status]}`}>
                    {statusLabelByKind[item.status]}
                  </span>
                </div>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="split-layout theater-chapter theater-chapter--close" data-reveal>
          <article className="docs-panel">
            <div className="section-header">
              <p className="eyebrow">Documentation</p>
              <h2>Canonical engineering entry points</h2>
            </div>
            <div className="docs-links">
              {docsLinks.map((link) => (
                <a
                  key={link.href}
                  className="docs-link"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </article>
          <article className="cta-panel">
            <p className="eyebrow">Distribution</p>
            <h2>Install from the download page — checksums included.</h2>
            <p>
              Windows NSIS @ {currentVersion} is linked from /download with SHA-256 from
              release-assets/manifest.json. Android debug builds are documented as local-only
              sideload paths — no store claims.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="/download">
                Download {currentVersion}
              </a>
              <a className="button button-secondary" href="/limitations">
                Known limitations
              </a>
            </div>
          </article>
        </section>
      </div>
    </RevealScope>
  );
}
