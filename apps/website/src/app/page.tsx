import Image from "next/image";
import type { CSSProperties } from "react";
import {
  loadSiteContent,
} from "./site-content";

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
    platformCards,
    primaryLinks,
    proofLinks,
    releaseHighlights,
    verificationItems,
  } = await loadSiteContent();

  const docsHref =
    primaryLinks.find((link) => link.label.startsWith("Read"))?.href ??
    "https://github.com/Dendro-X0/Obscur/tree/main/docs";

  return (
    <main className="site-shell site-shell--home">
      <section className="hero hero-fold">
        <div className="hero-copy">
          <p className="eyebrow">Obscur official website</p>
          <h1>
            Privacy-first communication,{" "}
            <span className="hero-h1-accent">shipped with evidence</span> instead of hype.
          </h1>
          <p className="hero-summary">
            End-to-end encrypted, decentralized messaging with local ownership and auditable
            releases. This site mirrors repo truth — not a second product story.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/download">
              Download {currentVersion}
            </a>
            <a className="button button-secondary" href="/limitations">
              Known limitations
            </a>
            <a className="button button-secondary" href={docsHref} target="_blank" rel="noreferrer">
              Read the docs
            </a>
          </div>
        </div>
        <aside className="hero-panel">
          <p className="panel-label">Current public release</p>
          <a className="release-chip release-chip-link" href={currentReleaseHref} target="_blank" rel="noreferrer">
            {currentVersion}
          </a>
          <ul className="hero-points hero-points--compact">
            <li>DM, communities, media, voice — desktop and mobile runtimes.</li>
            <li>Unsigned installers with SHA-256 checksums; scope documented honestly.</li>
          </ul>
        </aside>
        <div className="hero-proof proof-strip" aria-label="Source of truth links">
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
        </div>
      </section>

      <section className="section-grid editorial-band">
        <div className="section-header">
          <p className="eyebrow">Release snapshot</p>
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

      <section className="section-grid editorial-band editorial-band--gallery">
        <div className="section-header section-header--wide">
          <p className="eyebrow">Feature evidence</p>
          <h2>Captured product surfaces from the canonical demo library</h2>
          <p className="section-lead">
            Real GIF captures from maintainer verification — not mockups. Each surface maps to a
            shipped runtime band in the repo.
          </p>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature, index) => (
            <article
              key={feature.title}
              className="feature-card"
              style={{ "--feature-index": index } as CSSProperties}
            >
              <div className="feature-media">
                <Image
                  src={feature.gifUrl}
                  alt={feature.gifAlt}
                  fill
                  sizes="(max-width: 760px) 100vw, (max-width: 1100px) 100vw, 50vw"
                  unoptimized
                />
              </div>
              <div className="feature-copy">
                <h3>{feature.title}</h3>
                <p>{feature.summary}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section editorial-band">
        <div className="section-header">
          <p className="eyebrow">Platform coverage</p>
          <h2>One product, explicit runtime boundaries</h2>
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

      <section className="split-section editorial-band editorial-band--proof">
        <div className="section-header section-header--wide">
          <p className="eyebrow">Verification status</p>
          <h2>Release truth stays tied to evidence</h2>
          <p className="section-lead">
            Maintainer matrix outcomes — verified, in progress, and accepted limitations — surfaced
            honestly instead of buried in issue trackers.
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

      <section className="split-layout editorial-band">
        <article className="docs-panel">
          <div className="section-header">
            <p className="eyebrow">Documentation</p>
            <h2>Canonical engineering entry points</h2>
          </div>
          <div className="docs-links">
            {docsLinks.map((link) => (
              <a key={link.href} className="docs-link" href={link.href} target="_blank" rel="noreferrer">
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
            release-assets/manifest.json. Android debug builds are documented as local-only sideload
            paths — no store claims.
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
    </main>
  );
}
