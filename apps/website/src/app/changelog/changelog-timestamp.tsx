type ChangelogTimestampProps = Readonly<{
  /** ISO calendar date `YYYY-MM-DD` */
  date: string;
  className?: string;
}>;

const absoluteFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

const formatRelative = (isoDate: string, now: Date): string => {
  const target = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return isoDate;

  const diffMs = now.getTime() - target.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.round(diffMs / dayMs);

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 45) {
    const weeks = Math.max(1, Math.round(days / 7));
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return years === 1 ? "1 year ago" : `${years} years ago`;
};

/** Semantic release timestamp: absolute date + relative label. */
export function ChangelogTimestamp({ date, className }: ChangelogTimestampProps) {
  const absolute = absoluteFormatter.format(new Date(`${date}T00:00:00Z`));
  const relative = formatRelative(date, new Date());

  return (
    <time className={["changelog-timestamp", className].filter(Boolean).join(" ")} dateTime={date}>
      <span className="changelog-timestamp-absolute">{absolute}</span>
      <span className="changelog-timestamp-relative" aria-hidden="true">
        {relative}
      </span>
      <span className="sr-only"> ({relative})</span>
    </time>
  );
}
