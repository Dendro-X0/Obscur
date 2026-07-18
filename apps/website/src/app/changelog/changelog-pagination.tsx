import Link from "next/link";

type ChangelogPaginationProps = Readonly<{
  page: number;
  totalPages: number;
  totalEntries: number;
  pageSize: number;
}>;

function pageHref(page: number): string {
  return page <= 1 ? "/changelog" : `/changelog?page=${page}`;
}

/** Prev / next + page indicator for changelog index. */
export function ChangelogPagination({
  page,
  totalPages,
  totalEntries,
  pageSize,
}: ChangelogPaginationProps) {
  if (totalEntries === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalEntries);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="changelog-pagination" aria-label="Changelog pages">
      <p className="changelog-pagination-meta">
        Showing {start}–{end} of {totalEntries} releases
      </p>
      <div className="changelog-pagination-controls">
        {hasPrev ? (
          <Link className="changelog-pagination-link" href={pageHref(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className="changelog-pagination-link is-disabled" aria-disabled="true">
            Previous
          </span>
        )}
        <p className="changelog-pagination-status" aria-current="page">
          Page {page} of {totalPages}
        </p>
        {hasNext ? (
          <Link className="changelog-pagination-link" href={pageHref(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className="changelog-pagination-link is-disabled" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
