"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GuideMedia, GuideSection } from "../site-content";

function DemoPlayer({ media }: { media: GuideMedia }) {
  if (media.kind === "mp4") {
    return (
      <figure className="guide-media" id={`demo-${media.stem}`}>
        <video
          className="guide-video"
          controls
          muted
          loop
          playsInline
          preload="metadata"
          poster={media.posterUrl ?? undefined}
          aria-label={media.alt}
        >
          <source src={media.url} type="video/mp4" />
        </video>
        <figcaption className="guide-media-caption">{media.alt}</figcaption>
      </figure>
    );
  }

  return (
    <figure className="guide-media" id={`demo-${media.stem}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- rare GIF fallback */}
      <img className="guide-gif" src={media.url} alt={media.alt} loading="lazy" />
      <figcaption className="guide-media-caption">{media.alt}</figcaption>
    </figure>
  );
}

function GuideSidebar({
  sections,
  activeId,
  navOpen,
  onClose,
}: Readonly<{
  sections: readonly GuideSection[];
  activeId: string | null;
  navOpen: boolean;
  onClose: () => void;
}>) {
  return (
    <aside className={`guide-sidebar${navOpen ? " is-open" : ""}`} aria-label="Guide navigation">
      <div className="guide-sidebar-brand">
        <p className="eyebrow">User guide</p>
        <Link href="/guide" className="guide-sidebar-title" onClick={onClose}>
          How to use Obscur
        </Link>
      </div>

      <p className="guide-nav-label">Features</p>
      <nav className="guide-sidebar-nav">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={`/guide/${section.id}`}
            className={`guide-nav-link${activeId === section.id ? " is-active" : ""}`}
            onClick={onClose}
          >
            <span className="guide-nav-index">{section.eyebrow.split("·")[0]?.trim()}</span>
            <span>{section.title}</span>
          </Link>
        ))}
      </nav>

      <div className="guide-sidebar-resources">
        <p className="guide-nav-label">Resources</p>
        <Link href="/download" className="guide-nav-link" onClick={onClose}>
          Download
        </Link>
        <Link href="/limitations" className="guide-nav-link" onClick={onClose}>
          Known limitations
        </Link>
        <Link href="/" className="guide-nav-link" onClick={onClose}>
          Product home
        </Link>
      </div>
    </aside>
  );
}

type GuideIndexShellProps = Readonly<{
  sections: readonly GuideSection[];
}>;

export function GuideIndexShell({ sections }: GuideIndexShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="guide-docs" data-codactrl-surface="guide-index">
      <div className="guide-docs-frame guide-docs-frame--index">
        <GuideSidebar
          sections={sections}
          activeId={null}
          navOpen={navOpen}
          onClose={() => setNavOpen(false)}
        />
        {navOpen ? (
          <button
            type="button"
            className="guide-nav-backdrop"
            aria-label="Close sections"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <div className="guide-main-column">
          <div className="guide-mobile-bar">
            <button
              type="button"
              className="guide-mobile-toggle"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              Features
            </button>
          </div>

          <article className="guide-article">
            <header className="guide-intro">
              <p className="eyebrow">User documentation</p>
              <h1>How to use Obscur</h1>
              <p className="guide-lede">
                One feature per page — pick a step below for explanation and demo captures.
                Networks carry ciphertext; Obscur encrypts on the client.
              </p>
            </header>

            <ol className="guide-index-list">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link href={`/guide/${section.id}`} className="guide-index-card">
                    <span className="guide-index-eyebrow">{section.eyebrow}</span>
                    <span className="guide-index-title">{section.title}</span>
                    <span className="guide-index-summary">{section.summary}</span>
                    <span className="guide-index-meta">
                      {section.demos.length} demo{section.demos.length === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </div>
    </div>
  );
}

type GuideFeatureShellProps = Readonly<{
  sections: readonly GuideSection[];
  section: GuideSection;
  prev: GuideSection | null;
  next: GuideSection | null;
  pageIndex: number;
  pageTotal: number;
}>;

export function GuideFeatureShell({
  sections,
  section,
  prev,
  next,
  pageIndex,
  pageTotal,
}: GuideFeatureShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [section.id]);

  const chapterProgress = (pageIndex + 1) / pageTotal;

  return (
    <div className="guide-docs" data-codactrl-surface={`guide-${section.id}`}>
      <div
        className="guide-progress"
        role="progressbar"
        aria-label="Page reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="guide-progress-bar" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className="guide-docs-frame">
        <GuideSidebar
          sections={sections}
          activeId={section.id}
          navOpen={navOpen}
          onClose={() => setNavOpen(false)}
        />
        {navOpen ? (
          <button
            type="button"
            className="guide-nav-backdrop"
            aria-label="Close sections"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <div className="guide-main-column">
          <div className="guide-mobile-bar">
            <button
              type="button"
              className="guide-mobile-toggle"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((open) => !open)}
            >
              Features
            </button>
            <span className="guide-mobile-active">{section.title}</span>
          </div>

          <article className="guide-article">
            <p className="guide-breadcrumb">
              <Link href="/guide">Guide</Link>
              <span aria-hidden="true"> / </span>
              <span>{section.title}</span>
            </p>

            <header className="guide-feature-header" id="overview">
              <p className="eyebrow">{section.eyebrow}</p>
              <h1>{section.title}</h1>
              <p className="guide-lede">{section.summary}</p>
              {section.callout ? (
                <p className="guide-callout" role="note">
                  {section.callout}
                </p>
              ) : null}
              <p className="guide-chapter-meter" aria-label={`Feature ${pageIndex + 1} of ${pageTotal}`}>
                Feature {pageIndex + 1} of {pageTotal}
                <span
                  className="guide-chapter-meter-bar"
                  style={{ transform: `scaleX(${chapterProgress})` }}
                />
              </p>
            </header>

            {section.demos.length === 0 ? (
              <p className="guide-media-pending">Demo media missing — run compress script.</p>
            ) : (
              <div className="guide-demo-stack">
                {section.demos.map((demo) => (
                  <DemoPlayer key={demo.stem} media={demo} />
                ))}
              </div>
            )}

            <nav className="guide-pager" aria-label="Guide pagination">
              {prev ? (
                <Link href={`/guide/${prev.id}`} className="guide-pager-link guide-pager-link--prev">
                  <span className="guide-pager-label">Previous</span>
                  <span className="guide-pager-title">{prev.title}</span>
                </Link>
              ) : (
                <span className="guide-pager-link is-disabled" />
              )}
              {next ? (
                <Link href={`/guide/${next.id}`} className="guide-pager-link guide-pager-link--next">
                  <span className="guide-pager-label">Next</span>
                  <span className="guide-pager-title">{next.title}</span>
                </Link>
              ) : (
                <Link href="/download" className="guide-pager-link guide-pager-link--next">
                  <span className="guide-pager-label">Done</span>
                  <span className="guide-pager-title">Download Obscur</span>
                </Link>
              )}
            </nav>
          </article>
        </div>

        <aside className="guide-rail" aria-label="On this feature">
          <p className="guide-nav-label">On this page</p>
          <nav className="guide-rail-nav">
            <a href="#overview" className="guide-rail-link is-active">
              Overview
            </a>
            {section.demos.map((demo, index) => (
              <a key={demo.stem} href={`#demo-${demo.stem}`} className="guide-rail-link">
                Demo {index + 1}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
