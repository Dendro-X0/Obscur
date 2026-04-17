import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  filterDownloadableReleaseAssets,
  inferDesktopPlatformFromUserAgent,
  pickPreferredDesktopAsset,
  toReleaseDownloadTarget,
  type DesktopPlatform,
  type ReleaseAsset,
  type ReleaseDownloadTarget,
} from "@dweb/core/release-download-targets";

export type SiteLink = Readonly<{
  label: string;
  href: string;
}>;

export type FeatureCard = Readonly<{
  title: string;
  summary: string;
  gifUrl: string;
  gifAlt: string;
}>;

export type ReleaseHighlight = Readonly<{
  version: string;
  releasedOn: string;
  highlights: readonly string[];
}>;

export type VerificationItem = Readonly<{
  label: string;
  status: "pass" | "partial" | "pending";
  note: string;
}>;

export type SiteContent = Readonly<{
  currentVersion: string;
  currentReleaseHref: string;
  currentReleaseTag: string;
  primaryLinks: readonly SiteLink[];
  proofLinks: readonly SiteLink[];
  featureCards: readonly FeatureCard[];
  releaseHighlights: readonly ReleaseHighlight[];
  platformCards: readonly {
    name: string;
    summary: string;
    path: string;
  }[];
  verificationItems: readonly VerificationItem[];
  docsLinks: readonly SiteLink[];
  latestRelease: ReleaseSnapshot | null;
}>;

export type ReleaseSnapshot = Readonly<{
  tag: string;
  htmlUrl: string;
  downloadableAssets: readonly ReleaseAsset[];
  preferredDesktopDownload: Readonly<Record<DesktopPlatform, ReleaseDownloadTarget | null>>;
}>;

const RAW_GITHUB_BASE =
  "https://raw.githubusercontent.com/Dendro-X0/Obscur/main";
const REPO_GITHUB_BASE = "https://github.com/Dendro-X0/Obscur";
const GITHUB_RELEASE_API =
  "https://api.github.com/repos/Dendro-X0/Obscur/releases/latest";
const RELEASE_SECTION_REGEX = /^## \[(v[^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm;

const repoRoot = path.resolve(process.cwd(), "..", "..");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const toReleaseHref = (version: string): string =>
  `${REPO_GITHUB_BASE}/releases/tag/${version}`;

const toHumanDate = (isoDate: string): string => {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return dateFormatter.format(parsed);
};

const parseReleaseHighlights = (markdown: string): readonly ReleaseHighlight[] => {
  const matches = Array.from(markdown.matchAll(RELEASE_SECTION_REGEX));
  return matches.slice(0, 3).map((match, index) => {
    const version = match[1] ?? "unknown";
    const releasedOn = match[2] ?? "";
    const sectionStart = match.index ?? 0;
    const nextSectionStart = matches[index + 1]?.index ?? markdown.length;
    const sectionBody = markdown.slice(sectionStart, nextSectionStart);
    const bulletMatches = Array.from(sectionBody.matchAll(/^- (.+)$/gm))
      .map((bulletMatch) => bulletMatch[1]?.trim() ?? "")
      .filter((line) => line.length > 0)
      .slice(0, 3);

    return {
      version,
      releasedOn: toHumanDate(releasedOn),
      highlights: bulletMatches,
    };
  });
};

const readCanonicalVersion = async (): Promise<string> => {
  const versionJsonPath = path.join(repoRoot, "version.json");
  const packageJsonPath = path.join(repoRoot, "package.json");

  try {
    const raw = await readFile(versionJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
      return parsed.version.trim();
    }
  } catch {
    // Fall through to package.json.
  }

  const rawPackageJson = await readFile(packageJsonPath, "utf8");
  const parsedPackageJson = JSON.parse(rawPackageJson) as { version?: unknown };
  if (typeof parsedPackageJson.version === "string" && parsedPackageJson.version.trim().length > 0) {
    return parsedPackageJson.version.trim();
  }
  return "0.0.0";
};

const readReleaseHighlights = async (): Promise<readonly ReleaseHighlight[]> => {
  const changelogPath = path.join(repoRoot, "CHANGELOG.md");
  const changelog = await readFile(changelogPath, "utf8");
  return parseReleaseHighlights(changelog);
};

const readLatestReleaseSnapshot = async (): Promise<ReleaseSnapshot | null> => {
  try {
    const response = await fetch(GITHUB_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 900 },
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json() as {
      tag_name?: unknown;
      html_url?: unknown;
      assets?: unknown;
    };
    const tag = typeof payload.tag_name === "string" && payload.tag_name.trim().length > 0
      ? payload.tag_name.trim()
      : null;
    const htmlUrl = typeof payload.html_url === "string" && payload.html_url.trim().length > 0
      ? payload.html_url.trim()
      : null;
    if (!tag || !htmlUrl) {
      return null;
    }

    const assets = Array.isArray(payload.assets)
      ? payload.assets
        .map((asset): ReleaseAsset | null => {
          if (!asset || typeof asset !== "object") {
            return null;
          }
          const candidate = asset as {
            name?: unknown;
            browser_download_url?: unknown;
            size?: unknown;
          };
          if (
            typeof candidate.name !== "string"
            || typeof candidate.browser_download_url !== "string"
            || typeof candidate.size !== "number"
          ) {
            return null;
          }
          return {
            name: candidate.name,
            browser_download_url: candidate.browser_download_url,
            size: candidate.size,
          };
        })
        .filter((asset): asset is ReleaseAsset => asset !== null)
      : [];

    const downloadableAssets = filterDownloadableReleaseAssets(assets);

    return {
      tag,
      htmlUrl,
      downloadableAssets,
      preferredDesktopDownload: {
        windows: toReleaseDownloadTarget(
          pickPreferredDesktopAsset(downloadableAssets, "windows"),
          "Windows installer",
        ),
        macos: toReleaseDownloadTarget(
          pickPreferredDesktopAsset(downloadableAssets, "macos"),
          "macOS installer",
        ),
        linux: toReleaseDownloadTarget(
          pickPreferredDesktopAsset(downloadableAssets, "linux"),
          "Linux package",
        ),
        unknown: null,
      },
    };
  } catch {
    return null;
  }
};

export const loadSiteContent = async (): Promise<SiteContent> => {
  const currentVersion = await readCanonicalVersion();
  const currentTag = currentVersion.startsWith("v") ? currentVersion : `v${currentVersion}`;
  const [releaseHighlights, latestRelease] = await Promise.all([
    readReleaseHighlights(),
    readLatestReleaseSnapshot(),
  ]);

  const resolvedReleaseHref = latestRelease?.htmlUrl ?? toReleaseHref(currentTag);

  const primaryLinks: readonly SiteLink[] = [
    {
      label: `Download ${currentTag}`,
      href: "/download",
    },
    {
      label: "All Releases",
      href: `${REPO_GITHUB_BASE}/releases`,
    },
    {
      label: "Read The Docs",
      href: `${REPO_GITHUB_BASE}/tree/main/docs`,
    },
  ];

  const proofLinks: readonly SiteLink[] = [
    {
      label: "Changelog",
      href: `${REPO_GITHUB_BASE}/blob/main/CHANGELOG.md`,
    },
    {
      label: "Release Flow",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/07-operations-and-release-flow.md`,
    },
    {
      label: "Maintainer Playbook",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/08-maintainer-playbook.md`,
    },
    {
      label: "Docs Index",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/README.md`,
    },
  ];

  const featureCards: readonly FeatureCard[] = [
    {
      title: "Auth And Onboarding",
      summary:
        "Local-first account creation, unlock, and recovery flows grounded in explicit identity ownership.",
      gifUrl: `${RAW_GITHUB_BASE}/docs/assets/gifs/obscur_login_1.gif`,
      gifAlt: "Obscur login and onboarding flow",
    },
    {
      title: "Direct Messaging",
      summary:
        "Encrypted chat UI with conversation ownership, delivery diagnostics, and deterministic history recovery work.",
      gifUrl: `${RAW_GITHUB_BASE}/docs/assets/gifs/obscur_chat_ui_1.gif`,
      gifAlt: "Obscur direct messaging interface",
    },
    {
      title: "Settings And Profiles",
      summary:
        "Security controls, relay/runtime settings, and profile-scoped configuration for multi-persona use.",
      gifUrl: `${RAW_GITHUB_BASE}/docs/assets/gifs/obscur_settings_panel_1.gif`,
      gifAlt: "Obscur settings and configuration surfaces",
    },
    {
      title: "Multi-Profile Workflows",
      summary:
        "Window/profile isolation and account-bound state recovery for people managing multiple identities.",
      gifUrl: `${RAW_GITHUB_BASE}/docs/assets/gifs/multi_profile_management_1.gif`,
      gifAlt: "Obscur multi-profile management demo",
    },
    {
      title: "Media Transfer",
      summary:
        "Image, video, audio, and file messaging with Vault aggregation and guarded upload behavior.",
      gifUrl: `${RAW_GITHUB_BASE}/docs/assets/gifs/multimedia_files_upload_and_transfer_1.gif`,
      gifAlt: "Obscur multimedia upload and transfer demo",
    },
    {
      title: "Voice Notes And Calls",
      summary:
        "Voice-note messaging and realtime voice call flows with runtime diagnostics and timeout hardening.",
      gifUrl: `${RAW_GITHUB_BASE}/docs/assets/gifs/voice_notes_and_calls_1.gif`,
      gifAlt: "Obscur voice notes and calls demo",
    },
  ];

  const platformCards = [
    {
      name: "Web / PWA",
      summary:
        "Primary cross-platform runtime with local-first shell ownership, relay transport, and recovery tooling.",
      path: "apps/pwa",
    },
    {
      name: "Desktop",
      summary:
        "Tauri runtime with native storage, updater, and installer flows validated against release contracts.",
      path: "apps/desktop",
    },
    {
      name: "Shared Packages",
      summary:
        "Reusable crypto, storage, nostr, and UI primitives under typed package boundaries.",
      path: "packages/dweb-*",
    },
  ] as const;

  const verificationItems: readonly VerificationItem[] = [
    {
      label: "Docs Contract",
      status: "pass",
      note: "Canonical docs are checked with `pnpm docs:check`.",
    },
    {
      label: "Offline PWA Replay",
      status: "pass",
      note: "The current evidence packet records offline control and reconnect success in production mode.",
    },
    {
      label: "Desktop Offline Replay",
      status: "pending",
      note: "Manual desktop degraded/offline replay remains open in the v1.3.8 packet.",
    },
    {
      label: "Updater Verification",
      status: "pending",
      note: "Success, failure, rollout-block, and min-safe updater replays are still pending.",
    },
    {
      label: "Cross-Device DM Restore",
      status: "partial",
      note: "Focused suites are green, but live two-user replay is still required for the active recovery lane.",
    },
  ];

  const docsLinks: readonly SiteLink[] = [
    {
      label: "Project Overview",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/01-project-overview.md`,
    },
    {
      label: "Runtime Architecture",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/03-runtime-architecture.md`,
    },
    {
      label: "Messaging And Groups",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/04-messaging-and-groups.md`,
    },
    {
      label: "Testing And Quality Gates",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/06-testing-and-quality-gates.md`,
    },
    {
      label: "Current Roadmap",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/roadmap/current-roadmap.md`,
    },
    {
      label: "Release Evidence Packet",
      href: `${REPO_GITHUB_BASE}/tree/main/docs/assets/demo/v1.3.8`,
    },
  ];

  return {
    currentVersion: currentTag,
    currentReleaseHref: resolvedReleaseHref,
    currentReleaseTag: latestRelease?.tag ?? currentTag,
    primaryLinks,
    proofLinks,
    featureCards,
    releaseHighlights,
    platformCards,
    verificationItems,
    docsLinks,
    latestRelease,
  };
};

export const resolvePreferredDesktopDownload = (
  release: ReleaseSnapshot | null,
  userAgent: string,
): ReleaseDownloadTarget | null => {
  const platform = inferDesktopPlatformFromUserAgent(userAgent);
  return release?.preferredDesktopDownload[platform] ?? null;
};
