import { FeatureStageTheater } from "./feature-stage-theater";
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

  const [platformLead, ...platformRest] = platformCards;

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
            <ObscurLogo size={64} priority className="hero-theater-logo" />
            <p className="hero-theater-wordmark">Obscur</p>
          </div>
          <h1 className="hero-theater-title" data-reveal data-reveal-delay="1">
            Privacy kept close —{" "}
            <span className="hero-h1-accent">releases you can verify</span>
          </h1>
          <p className="hero-theater-summary" data-reveal data-reveal-delay="2">
            End-to-end encrypted messaging with local ownership — actively maintained, open to
            feedback, and backed by a living demo guide. This site mirrors repo truth.
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

        <section className="theater-chapter theater-chapter--release" data-reveal>
          <div className="section-header theater-chapter-header">
            <p className="eyebrow">Chapter I · Release</p>
            <h2>What is actually shipping right now</h2>
            <p className="section-lead">
              Browse the full release history in the <a href="/changelog">changelog</a>.
            </p>
          </div>
          <div className="release-rail">
            {releaseHighlights.map((release) => (
              <article key={release.version} className="release-rail-item">
                <div className="release-rail-meta">
                  <span className="release-rail-version">{release.version}</span>
                  <span className="release-rail-date">{release.releasedOn}</span>
                </div>
                <ul className="release-rail-list">
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
            <h2>A short tour — twenty silent how-tos, not a long film</h2>
            <p className="section-lead">
              Real captures from the product demo library (v1.9.16 shell; beta builds the same
              face). Browse stages here or open the <a href="/guide">user guide</a> for step-by-step
              walkthroughs — no narrated mega-video required.
            </p>
          </div>

          <FeatureStageTheater features={featureCards} />
        </section>

        <section className="theater-chapter theater-chapter--platforms" data-reveal>
          <div className="section-header theater-chapter-header">
            <p className="eyebrow">Chapter III · Runtimes</p>
            <h2>One product, explicit platform boundaries</h2>
          </div>
          <div className="platform-ledger">
            {platformLead ? (
              <article className="platform-ledger-lead">
                <div className="platform-ledger-topline">
                  <h3>{platformLead.name}</h3>
                  <span className="path-chip">{platformLead.path}</span>
                </div>
                <p>{platformLead.summary}</p>
              </article>
            ) : null}
            {platformRest.length > 0 ? (
              <div className="platform-ledger-rest">
                {platformRest.map((platform) => (
                  <article key={platform.name} className="platform-ledger-row">
                    <div className="platform-ledger-topline">
                      <h3>{platform.name}</h3>
                      <span className="path-chip">{platform.path}</span>
                    </div>
                    <p>{platform.summary}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="theater-chapter theater-chapter--proof" data-reveal>
          <div className="section-header theater-chapter-header section-header--wide">
            <p className="eyebrow">Chapter IV · Evidence</p>
            <h2>Release truth stays tied to verification</h2>
            <p className="section-lead">
              Maintainer matrix outcomes — verified ship paths, platform boundaries, and network
              contracts surfaced honestly.
            </p>
          </div>
          <div className="evidence-rows">
            {verificationItems.map((item) => (
              <article key={item.label} className="evidence-row">
                <div className="evidence-row-label">
                  <h3>{item.label}</h3>
                  <span className={`status-pill ${statusClassNameByKind[item.status]}`}>
                    {statusLabelByKind[item.status]}
                  </span>
                </div>
                <p className="evidence-row-note">{item.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="theater-chapter theater-chapter--close" data-reveal>
          <div className="close-band">
            <div className="close-band-main">
              <p className="eyebrow">Distribution · Continuity</p>
              <h2>Install, try the guide, stay in the loop.</h2>
              <p>
                Windows NSIS, macOS, Linux AppImage, and Android APK @ {currentVersion} — linked from
                /download with SHA-256 from release-assets/manifest.json. Self-signed sideload; no
                store claims. The project keeps shipping improvements; send feedback on GitHub, or
                ask about customized private-trust work via the maintainer studio.
              </p>
              <div className="close-band-actions">
                <a className="button button-primary" href="/download">
                  Download {currentVersion}
                </a>
                <a className="button button-secondary" href="/guide">
                  Demo guide
                </a>
                <a className="button button-secondary" href="/limitations">
                  Product scope
                </a>
              </div>
            </div>
            <aside className="close-band-docs" aria-label="Documentation">
              <p className="eyebrow">Documentation</p>
              <ul className="close-band-doc-list">
                {docsLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>
      </div>
    </RevealScope>
  );
}
