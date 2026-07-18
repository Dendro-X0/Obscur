import type { Metadata } from "next";
import Link from "next/link";
import { ChangelogPagination } from "./changelog-pagination";
import { ChangelogTimestamp } from "./changelog-timestamp";
import { loadChangelogPage } from "./parse-changelog";

export const metadata: Metadata = {
  title: "Changelog | Obscur",
  description: "Version history and updates for Obscur messenger.",
};

type ChangelogPageProps = Readonly<{
  searchParams: Promise<{ page?: string }>;
}>;

export default async function ChangelogPage({ searchParams }: ChangelogPageProps) {
  const { page: pageRaw } = await searchParams;
  const { entries, page, pageSize, totalEntries, totalPages } = await loadChangelogPage(pageRaw);

  return (
    <main className="site-shell site-shell--changelog">
      <section className="changelog-intro">
        <p className="eyebrow">Release history</p>
        <h1>Changelog</h1>
        <p className="hero-summary">
          Version history from the repo <code>CHANGELOG.md</code> — evidence-named releases, not
          marketing blurbs. Full notes live under{" "}
          <a
            href="https://github.com/Dendro-X0/Obscur/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          .
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/download">
            Download
          </Link>
          <a
            className="button button-secondary"
            href="https://github.com/Dendro-X0/Obscur/blob/main/version.json"
            target="_blank"
            rel="noreferrer"
          >
            Current version.json
          </a>
        </div>
      </section>

      {entries.length === 0 ? (
        <section className="changelog-empty">
          <p>Changelog temporarily unavailable.</p>
          <a
            href="https://github.com/Dendro-X0/Obscur/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noreferrer"
          >
            View full changelog on GitHub
          </a>
        </section>
      ) : (
        <>
          <ChangelogPagination
            page={page}
            totalPages={totalPages}
            totalEntries={totalEntries}
            pageSize={pageSize}
          />

          <ol className="changelog-list">
            {entries.map((entry, index) => {
              const isLatest = page === 1 && index === 0;
              return (
                <li key={`${entry.version}-${entry.date ?? "nodate"}`} className="changelog-entry">
                  <header className="changelog-entry-header">
                    <div className="changelog-entry-heading">
                      <h2>{entry.version}</h2>
                      {isLatest ? <span className="changelog-latest">Latest</span> : null}
                    </div>
                    {entry.date ? (
                      <ChangelogTimestamp date={entry.date} />
                    ) : (
                      <span className="changelog-timestamp changelog-timestamp--missing">
                        Date not recorded
                      </span>
                    )}
                  </header>
                  {entry.title ? <p className="changelog-entry-title">{entry.title}</p> : null}
                  {entry.changes.length > 0 ? (
                    <ul className="changelog-entry-changes">
                      {entry.changes.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="changelog-entry-empty">No bullet summary in CHANGELOG for this cut.</p>
                  )}
                  <a
                    className="changelog-entry-notes"
                    href={`https://github.com/Dendro-X0/Obscur/blob/main/docs/releases/${entry.version}-release.md`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Release notes (docs)
                  </a>
                </li>
              );
            })}
          </ol>

          <ChangelogPagination
            page={page}
            totalPages={totalPages}
            totalEntries={totalEntries}
            pageSize={pageSize}
          />
        </>
      )}
    </main>
  );
}
