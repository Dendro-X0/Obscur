import Link from "next/link";
import { loadSiteContent } from "../site-content";
import { AlertTriangle, CheckCircle, PauseCircle } from "lucide-react";

export default async function LimitationsPage() {
  const site = await loadSiteContent();
  const fullDocHref = site.releaseManifest?.limitationsDocHref
    ?? "https://github.com/Dendro-X0/Obscur/blob/main/docs/program/obscur-v2-known-limitations.md";

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Honest product scope</p>
          <h1>Known limitations</h1>
          <p className="hero-summary">
            Obscur v2 verification closed Phase 1 product truth with explicit accepts. This page
            summarizes what demo hosts and installers should not over-promise. Full maintainer
            detail lives in the repo limitations sheet.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/download">
              Download
            </Link>
            <a
              className="button button-secondary"
              href={fullDocHref}
              target="_blank"
              rel="noreferrer"
            >
              Full limitations doc
            </a>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Verified (Phase 1 summary)</p>
          <h2>What we tested before packaging</h2>
        </div>
        <div className="status-grid">
          <article className="status-card">
            <div className="status-topline">
              <h3>Native DM + group SQLite</h3>
              <span className="status-pill status-pass">Verified</span>
            </div>
            <p>Cold-restart soaks and persistence authority gates passed on maintainer matrix.</p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>Dual-profile group send/receive</h3>
              <span className="status-pill status-pass">Verified</span>
            </div>
            <p>COM-RUN-11 invite lifecycle exercised on managed dev stack.</p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>SEC V1–V3, V5</h3>
              <span className="status-pill status-pass">Pass</span>
            </div>
            <p>Maintainer security checklist signed partial @ Phase 1D.</p>
          </article>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Accepted limitations</p>
          <h2>Do not claim these are fixed</h2>
        </div>
        <div className="status-grid">
          <article className="status-card">
            <div className="status-topline">
              <h3>ACC-01 — Delete-for-me</h3>
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <p>
              Delete-for-me may not survive account restore or web/desktop parity the same way as
              native SQLite cold restart. Prefer honest copy: hide on this device.
            </p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>ACC-02 — Roster divergence</h3>
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <p>
              Creator and joiner can show different member lists on the same community. Accepted —
              integration study band; no patch until charter completes.
            </p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>SEC-V4 — Restore leak boundary</h3>
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <p>Accepted @ REL-002. Contract drift documented in restore historical tests.</p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>Display-only symptoms</h3>
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
            </div>
            <p>
              Sidebar preview may show stale text while thread hydrate is intact. Post cold-restart
              unlock may require Import Key on some paths.
            </p>
          </article>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Paused bands</p>
          <h2>No agent patches without charter</h2>
        </div>
        <div className="platform-grid">
          <article className="platform-card">
            <div className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5" aria-hidden />
              <h3>COM-RUN-01 roster</h3>
            </div>
            <p>Integration study — do not patch roster display as low priority.</p>
          </article>
          <article className="platform-card">
            <div className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5" aria-hidden />
              <h3>COM-RUN-02</h3>
            </div>
            <p>Room-key repair cancelled — membership redesign charter supersedes.</p>
          </article>
        </div>
      </section>

      <section className="split-section">
        <div className="section-header">
          <p className="eyebrow">Demo language</p>
          <h2>Suggested presenter copy</h2>
        </div>
        <ul className="release-list" style={{ maxWidth: "48rem", padding: "0 0 0 1.25rem" }}>
          <li>Obscur is privacy-first desktop software; production web is disabled.</li>
          <li>
            Group messaging works on managed workspace + relay stacks we verify in dev — roster
            display between profiles may disagree (known, accepted).
          </li>
          <li>
            Native message history survives restart on desktop SQLite paths we tested; account
            restore and delete-for-me have documented limits.
          </li>
        </ul>
      </section>

      <section className="split-layout">
        <article className="cta-panel">
          <p className="eyebrow">Install</p>
          <h2>Ready to try Obscur?</h2>
          <p>
            Windows installer is available with published SHA-256. Android debug builds are
            local-only. Read signing policy before sideloading unsigned NSIS.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/download">
              Go to download
            </Link>
            <a
              className="button button-secondary"
              href={fullDocHref}
              target="_blank"
              rel="noreferrer"
            >
              Maintainer sheet
            </a>
          </div>
        </article>
        <article className="docs-panel">
          <div className="status-topline">
            <h3>Installer honesty</h3>
            <CheckCircle className="h-5 w-5 text-teal-700" aria-hidden />
          </div>
          <p className="mt-4">
            Unsigned Windows NSIS is expected. No Play Store or App Store claims on this website.
            Verify checksums on the download page.
          </p>
        </article>
      </section>
    </main>
  );
}
