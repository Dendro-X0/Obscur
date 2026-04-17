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

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Obscur official website</p>
          <h1>Privacy-first communication, shipped with evidence instead of hype.</h1>
          <p className="hero-summary">
            Obscur is a cross-platform, decentralized, end-to-end encrypted communication app
            built around local ownership, explicit runtime contracts, and auditable release
            artifacts. This website mirrors canonical repo truth rather than inventing a second
            product story.
          </p>
          <div className="hero-actions">
            {primaryLinks.map((link) => (
              <a
                key={link.href}
                className={link.label.startsWith("Download") ? "button button-primary" : "button button-secondary"}
                href={link.href}
                {...(link.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <aside className="hero-panel">
          <p className="panel-label">Current public release</p>
          <a className="release-chip release-chip-link" href={currentReleaseHref} target="_blank" rel="noreferrer">
            {currentVersion}
          </a>
          <ul className="hero-points">
            <li>Direct messaging, communities, media transfer, voice notes, and realtime call flow.</li>
            <li>Public source, auditable changelog, and GitHub release distribution.</li>
            <li>Active recovery lane still focused on cross-device messaging truth, not marketing polish.</li>
          </ul>
        </aside>
      </section>

      <section className="proof-strip" aria-label="Source of truth links">
        {proofLinks.map((link) => (
          <a key={link.href} className="proof-link" href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </section>

      <section className="section-grid">
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

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Feature evidence</p>
          <h2>Captured product surfaces from the canonical demo library</h2>
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

      <section className="split-section">
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

      <section className="split-section">
        <div className="section-header">
          <p className="eyebrow">Verification status</p>
          <h2>Release truth stays tied to evidence</h2>
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

      <section className="split-layout">
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
          <h2>GitHub Releases remains the live channel today.</h2>
          <p>
            The website is now ready to act as the public release surface, but it still points back
            to the canonical release artifacts and evidence packets rather than claiming its own
            publication workflow.
          </p>
          <div className="hero-actions">
            <a
              className="button button-primary"
              href={currentReleaseHref}
              target="_blank"
              rel="noreferrer"
            >
              Open {currentVersion}
            </a>
            <a
              className="button button-secondary"
              href="https://github.com/Dendro-X0/Obscur/tree/main/docs/assets/demo/v1.3.8"
              target="_blank"
              rel="noreferrer"
            >
              Open Evidence Packet
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}
