import type { Metadata } from "next";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ArrowDown, ArrowRight, Calendar, Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog | Obscur",
  description: "Version history and updates for Obscur messenger.",
};

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

async function parseChangelog(): Promise<ChangelogEntry[]> {
  const changelogPath = path.join(process.cwd(), "..", "..", "CHANGELOG.md");
  const content = await readFile(changelogPath, "utf8").catch(() => "");
  
  const entries: ChangelogEntry[] = [];
  const regex = /^## \[(v[^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const version = match[1];
    const date = match[2];
    const startIndex = match.index;
    const nextMatch = regex.exec(content);
    const endIndex = nextMatch ? nextMatch.index : content.length;
    regex.lastIndex = startIndex + 1; // Reset for next iteration
    
    const section = content.slice(startIndex, endIndex);
    const changeLines = section
      .split("\n")
      .filter((line) => line.trim().startsWith("- ") || line.trim().startsWith("* "))
      .map((line) => line.trim().replace(/^[-*]\s*/, ""));
    
    entries.push({
      version,
      date,
      changes: changeLines.slice(0, 10), // Limit to 10 changes per version
    });
  }
  
  return entries.slice(0, 10); // Last 10 versions
}

function getVersionHighlight(version: string): string {
  const highlights: Record<string, string> = {
    "v1.4.7": "Community Modes, Security Integration, Mobile Prep",
    "v1.4.6": "Security Services, CAS Media Recovery",
    "v1.4.5": "Profile Isolation, Ghost Call Fix",
    "v1.4.4": "Relay Resilience, Voice Improvements",
    "v1.4.3": "Account Sync, Restore Convergence",
    "v1.4.2": "Community Ledger, Membership Recovery",
    "v1.4.1": "DM Reliability, Message Ordering",
    "v1.4.0": "In-Place Rewrite, Community System",
    "v1.3.16": "Streaming Updates, Desktop Improvements",
    "v1.3.15": "Voice Calls Beta, Mobile Optimizations",
  };
  return highlights[version] || "Performance and stability improvements";
}

export default async function ChangelogPage() {
  const entries = await parseChangelog();

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-8 inline-flex items-center justify-center rounded-2xl bg-blue-500/10 p-4">
              <Tag className="h-12 w-12 text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              Changelog
            </h1>
            <p className="mt-6 text-lg leading-8 text-zinc-300">
              Track the evolution of Obscur. See what's new, what's improved, and what's fixed.
            </p>
            <div className="mt-8 flex items-center justify-center gap-x-4">
              <a
                href="https://github.com/Dendro-X0/Obscur/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-x-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                <ArrowDown className="h-4 w-4" />
                View on GitHub
              </a>
              <a
                href="/download"
                className="inline-flex items-center gap-x-2 rounded-full bg-zinc-800 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                Get the Latest
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Changelog Entries */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <div className="space-y-16">
            {entries.length === 0 ? (
              <div className="text-center py-24">
                <p className="text-zinc-400">Changelog temporarily unavailable.</p>
                <a
                  href="https://github.com/Dendro-X0/Obscur/releases"
                  className="mt-4 inline-block text-blue-400 hover:text-blue-300"
                >
                  View releases on GitHub →
                </a>
              </div>
            ) : (
              entries.map((entry, index) => (
                <div
                  key={entry.version}
                  className={`relative ${index !== entries.length - 1 ? "pb-16 border-b border-white/10" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-x-3">
                        <h2 className="text-3xl font-bold text-white">
                          {entry.version}
                        </h2>
                        {index === 0 && (
                          <span className="inline-flex items-center rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-lg text-blue-400 font-medium">
                        {getVersionHighlight(entry.version)}
                      </p>
                    </div>
                    <div className="flex items-center gap-x-2 text-zinc-400">
                      <Calendar className="h-4 w-4" />
                      <time dateTime={entry.date}>
                        {new Date(entry.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                  </div>

                  <div className="prose prose-invert max-w-none">
                    <ul className="space-y-3">
                      {entry.changes.map((change, changeIndex) => (
                        <li
                          key={changeIndex}
                          className="flex items-start gap-x-3 text-zinc-300"
                        >
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6">
                    <a
                      href={`https://github.com/Dendro-X0/Obscur/releases/tag/${entry.version}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-x-2 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      View full release notes
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Subscribe Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-16 text-center shadow-2xl sm:px-16">
            <h2 className="mx-auto max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Stay Updated
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-blue-100">
              Follow us on GitHub to get notified about new releases and updates.
            </p>
            <div className="mt-8">
              <a
                href="https://github.com/Dendro-X0/Obscur"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-x-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-blue-600 shadow-sm hover:bg-blue-50 transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
