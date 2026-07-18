import { readFile } from "node:fs/promises";
import path from "node:path";

export type ChangelogEntry = Readonly<{
  version: string;
  /** ISO date YYYY-MM-DD when present */
  date: string | null;
  title: string | null;
  changes: readonly string[];
}>;

export type ChangelogPageResult = Readonly<{
  entries: readonly ChangelogEntry[];
  page: number;
  pageSize: number;
  totalEntries: number;
  totalPages: number;
}>;

const CHANGELOG_HEADING_REGEX =
  /^## \[([^\]]+)\](?:\s*[—–-]\s*(\d{4}-\d{2}-\d{2}))?(?:\s*\(([^)]*)\))?/gm;

const PAGE_SIZE = 8;

const normalizeVersion = (raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === "unreleased") return "Unreleased";
  if (/^v/i.test(trimmed)) return `v${trimmed.slice(1)}`;
  return `v${trimmed}`;
};

export const parseChangelogMarkdown = (markdown: string): readonly ChangelogEntry[] => {
  const matches = Array.from(markdown.matchAll(CHANGELOG_HEADING_REGEX));
  const entries: ChangelogEntry[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match) continue;
    const versionRaw = match[1]?.trim() ?? "";
    if (!versionRaw || versionRaw.toLowerCase() === "unreleased") continue;

    const date = match[2] ?? null;
    const title = match[3]?.trim() || null;
    const sectionStart = match.index ?? 0;
    const sectionEnd = matches[index + 1]?.index ?? markdown.length;
    const sectionBody = markdown.slice(sectionStart, sectionEnd);
    const changes = Array.from(sectionBody.matchAll(/^[-*] (.+)$/gm))
      .map((bullet) => bullet[1]?.trim() ?? "")
      .filter((line) => line.length > 0)
      .slice(0, 12);

    entries.push({
      version: normalizeVersion(versionRaw),
      date,
      title,
      changes,
    });
  }

  return entries;
};

export const loadChangelogPage = async (pageRaw: string | undefined): Promise<ChangelogPageResult> => {
  const changelogPath = path.join(process.cwd(), "..", "..", "CHANGELOG.md");
  const content = await readFile(changelogPath, "utf8").catch(() => "");
  const all = parseChangelogMarkdown(content);
  const totalEntries = all.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / PAGE_SIZE));
  const requested = Number.parseInt(pageRaw ?? "1", 10);
  const page = Number.isFinite(requested)
    ? Math.min(totalPages, Math.max(1, requested))
    : 1;
  const start = (page - 1) * PAGE_SIZE;

  return {
    entries: all.slice(start, start + PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    totalEntries,
    totalPages,
  };
};
