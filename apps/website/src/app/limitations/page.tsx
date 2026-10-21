import Link from "next/link";
import { loadSiteContent } from "../site-content";
import { CheckCircle, Globe, Server, Smartphone } from "lucide-react";

export default async function LimitationsPage() {
  const site = await loadSiteContent();
  const fullDocHref = site.releaseManifest?.limitationsDocHref
    ?? "https://github.com/Dendro-X0/Obscur/blob/main/docs/program/obscur-v2-known-limitations.md";
  const deletionDocHref =
    "https://github.com/Dendro-X0/Obscur/blob/main/docs/messaging/deletion-roster-limitations.md";
  const managedDeletionHref =
    "https://github.com/Dendro-X0/Obscur/blob/main/docs/messaging/managed-workspace-relay-deletion.md";

  return (
    <main className="site-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Honest product scope</p>
          <h1>Product scope and network boundaries</h1>
          <p className="hero-summary">
            Obscur is a sovereign communications stack — not a hosted messenger. This page
            separates <strong>what the network allows</strong>, <strong>what operators control</strong>,
            and <strong>what we verify in each release</strong>. Maintainer detail stays in the repo.
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
              Maintainer sheet
            </a>
          </div>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Verified @ {site.currentVersion}</p>
          <h2>What we package and test</h2>
        </div>
        <div className="status-grid">
          <article className="status-card">
            <div className="status-topline">
              <h3>Native desktop + SQLite</h3>
              <span className="status-pill status-pass">Verified</span>
            </div>
            <p>
              DM and group messaging on desktop with cold-restart persistence authority — the
              production path installers target.
            </p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>Android APK (sideload)</h3>
              <span className="status-pill status-pass">Ready</span>
            </div>
            <p>
              Universal release APK in release-assets — self-signed, not on Play Store. Installable
              and functional; performance improved since early v1.9 builds.
            </p>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>Managed workspace groups</h3>
              <span className="status-pill status-pass">Verified</span>
            </div>
            <p>
              Invite lifecycle and encrypted group send/receive on operator-managed relay +
              coordination stacks we exercise in dev.
            </p>
          </article>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Network contracts</p>
          <h2>Protocol boundaries — not Obscur bugs</h2>
        </div>
        <div className="status-grid">
          <article className="status-card">
            <div className="status-topline">
              <h3>Public relay immutability</h3>
              <Globe className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <p>
              Events published to <strong>public Nostr-style relays</strong> cannot be erased from
              the network after fan-out — the same constraint every federated client inherits. Obscur
              can hide locally and publish delete commands; it cannot recall ciphertext already
              replicated on strangers&apos; relays.
            </p>
            <a className="text-link" href={deletionDocHref} target="_blank" rel="noreferrer">
              Deletion model →
            </a>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>Private relay + operator deletion</h3>
              <Server className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <p>
              On <strong>managed workspace</strong> stacks with relays you control, Obscur implements
              relay-scoped removal and cooperative delete semantics that public infrastructure cannot
              offer. This is the operator path — VPS, homelab, or datacenter metal you trust.
            </p>
            <a className="text-link" href={managedDeletionHref} target="_blank" rel="noreferrer">
              Managed-workspace deletion →
            </a>
          </article>
          <article className="status-card">
            <div className="status-topline">
              <h3>Membership propagation delay</h3>
              <Globe className="h-5 w-5 text-teal-700" aria-hidden />
            </div>
            <p>
              Join and leave events propagate across distributed peers with relay latency — typically
              seconds, not instant global sync. The redesigned community system converges; expecting
              zero-delay roster parity on relay-backed networks is a distributed-systems mistake, not
              a missing feature.
            </p>
          </article>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Platform scope</p>
          <h2>Where Obscur ships today</h2>
        </div>
        <div className="platform-grid">
          <article className="platform-card">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-teal-700" aria-hidden />
              <h3>Desktop — production</h3>
            </div>
            <p>
              Windows, macOS, and Linux installers are the verified ship path. Native SQLite owns
              durable state.
            </p>
          </article>
          <article className="platform-card">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-teal-700" aria-hidden />
              <h3>Android — sideload</h3>
            </div>
            <p>
              CI-built universal APK on /download. Self-signed install expected. Low-RAM devices (e.g.
              4 GB) may still feel heavy — performance work continues; CodaCtrl Studio can profile
              further regressions.
            </p>
          </article>
          <article className="platform-card">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-amber-600" aria-hidden />
              <h3>Production web — intentionally off</h3>
            </div>
            <p>
              Early MVP used IndexedDB for speed; dual authority against SQLite caused desync. We
              disabled production web rather than ship a surface that lied about persistence.
            </p>
          </article>
        </div>
      </section>

      <section className="section-grid">
        <div className="section-header">
          <p className="eyebrow">Presenter copy</p>
          <h2>How to describe Obscur in demos</h2>
        </div>
        <ul className="release-list" style={{ maxWidth: "48rem", padding: "0 0 0 1.25rem" }}>
          <li>
            Obscur is a <strong>sovereign</strong> encrypted stack — local keys, end-to-end encryption,
            and relays or coordination you can point at infrastructure you control.
          </li>
          <li>
            Sell <strong>clearnet private-trust</strong> (cell VPS · your keys · group live). Tor is an
            optional routing underlay, not the product identity — leave it off for clearnet demos.
          </li>
          <li>
            Do <strong>not</strong> brand Obscur as a dark-web messenger, gray-market hub, or
            onion-first GTM. Illicit spaces can appear on any powerful host; response is raise
            security for legitimate users, not that framing.
          </li>
          <li>
            Attack-surface warnings (ASE) run <strong>on-device</strong> — they are not a cloud content
            police or silent message-body upload.
          </li>
          <li>
            Voice notes and 1:1 <strong>audio</strong> calls exist today. Video conferencing is not
            shipped — do not demo a camera call.
          </li>
          <li>
            Public relays carry immutable ciphertext; private operator stacks unlock stronger removal
            semantics. Say <strong>hide on this device</strong> for local delete on public threads —
            not &quot;deleted from the internet.&quot;
          </li>
          <li>
            Desktop and Android installers ship with published SHA-256; verify before sideloading
            unsigned builds.
          </li>
        </ul>
      </section>

      <section className="split-layout">
        <article className="cta-panel">
          <p className="eyebrow">Install</p>
          <h2>Ready to try Obscur?</h2>
          <p>
            Desktop and Android builds for {site.currentVersion} are on /download with SHA-256
            checksums. No Play Store or App Store listing — sideload and verify.
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
            Unsigned Windows NSIS and self-signed Android APK are expected. SmartScreen and
            &quot;unknown app&quot; warnings are normal — verify checksums on the download page.
          </p>
        </article>
      </section>
    </main>
  );
}
