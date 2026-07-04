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
  releaseManifest: ReleaseManifestSnapshot | null;
}>;

export type ReleaseSnapshot = Readonly<{
  tag: string;
  htmlUrl: string;
  downloadableAssets: readonly ReleaseAsset[];
  preferredDesktopDownload: Readonly<Record<DesktopPlatform, ReleaseDownloadTarget | null>>;
}>;

export type ManifestArtifact = Readonly<{
  platform: string;
  kind: string;
  fileName: string;
  path: string;
  sizeBytes: number;
  sha256: string;
  href: string | null;
  buildCommand?: string;
  installHint?: string;
}>;

export type ReleaseManifestSnapshot = Readonly<{
  version: string;
  signingPolicy: string;
  signingPolicyDocHref: string;
  buildFromSourceDocHref: string;
  limitationsDocHref: string;
  artifacts: readonly ManifestArtifact[];
}>;

const RAW_GITHUB_BASE =
  "https://raw.githubusercontent.com/Dendro-X0/Obscur/main";
const REPO_GITHUB_BASE = "https://github.com/Dendro-X0/Obscur";
const REPO_STABLE_POLICY_PATH =
  "apps/desktop/release/channel/stable/streaming-update-policy.json";
const REPO_STABLE_POLICY_URL = `${RAW_GITHUB_BASE}/${REPO_STABLE_POLICY_PATH}`;
const REPO_VERSION_JSON_URL = `${RAW_GITHUB_BASE}/version.json`;
const RELEASE_MANIFEST_PATH = "release-assets/manifest.json";
const LIMITATIONS_DOC_HREF = `${REPO_GITHUB_BASE}/blob/main/docs/program/obscur-v2-known-limitations.md`;
const INSTALL_BUILD_GUIDE_HREF = `${REPO_GITHUB_BASE}/blob/main/docs/program/obscur-v2-install-build-guide.md`;
const SIGNING_POLICY_HREF = `${REPO_GITHUB_BASE}/blob/main/docs/program/obscur-v2-phase3-signing-policy.md`;
const RELEASE_SECTION_REGEX = /^## \[(v[^\]]+)\] - (\d{4}-\d{2}-\d{2})$/gm;

const repoRoot = path.resolve(process.cwd(), "..", "..");

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

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

const readLocalStablePolicy = async (): Promise<Record<string, unknown> | null> => {
  try {
    const policyPath = path.join(
      repoRoot,
      "apps/desktop/release/channel/stable/streaming-update-policy.json",
    );
    const raw = await readFile(policyPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const policyArtifactsToReleaseAssets = (
  artifacts: unknown,
): readonly ReleaseAsset[] => {
  if (!artifacts || typeof artifacts !== "object") {
    return [];
  }
  const out: ReleaseAsset[] = [];
  for (const artifact of Object.values(artifacts as Record<string, unknown>)) {
    if (!artifact || typeof artifact !== "object") {
      continue;
    }
    const url = (artifact as { url?: unknown }).url;
    if (typeof url !== "string" || !url.startsWith("https://")) {
      continue;
    }
    const name = url.split("/").pop()?.split("?")[0] ?? "download";
    out.push({
      name,
      browser_download_url: url,
      size: 0,
    });
  }
  return out;
};

type RawManifestArtifact = {
  platform?: unknown;
  kind?: unknown;
  path?: unknown;
  fileName?: unknown;
  sizeBytes?: unknown;
  sha256?: unknown;
  buildCommand?: unknown;
  installHint?: unknown;
};

type RawReleaseManifest = {
  version?: unknown;
  signingPolicy?: unknown;
  signingPolicyDoc?: unknown;
  artifacts?: unknown;
};

const manifestArtifactHref = (repoRelativePath: string): string | null => {
  if (repoRelativePath.startsWith("release-assets/")) {
    return `${RAW_GITHUB_BASE}/${repoRelativePath}`;
  }
  return null;
};

const readReleaseAssetsManifest = async (): Promise<ReleaseManifestSnapshot | null> => {
  try {
    const manifestPath = path.join(repoRoot, RELEASE_MANIFEST_PATH);
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as RawReleaseManifest;
    const versionRaw = parsed.version;
    const version = typeof versionRaw === "string" && versionRaw.trim().length > 0
      ? versionRaw.trim()
      : null;
    if (!version || !Array.isArray(parsed.artifacts)) {
      return null;
    }

    const artifacts: ManifestArtifact[] = [];
    for (const entry of parsed.artifacts) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const artifact = entry as RawManifestArtifact;
      const fileName = typeof artifact.fileName === "string" ? artifact.fileName : "";
      const repoPath = typeof artifact.path === "string" ? artifact.path : "";
      const sha256 = typeof artifact.sha256 === "string" ? artifact.sha256 : "";
      const sizeBytes = typeof artifact.sizeBytes === "number" ? artifact.sizeBytes : 0;
      if (!fileName || !repoPath || !sha256) {
        continue;
      }
      artifacts.push({
        platform: typeof artifact.platform === "string" ? artifact.platform : "unknown",
        kind: typeof artifact.kind === "string" ? artifact.kind : "artifact",
        fileName,
        path: repoPath,
        sizeBytes,
        sha256,
        href: manifestArtifactHref(repoPath),
        buildCommand: typeof artifact.buildCommand === "string" ? artifact.buildCommand : undefined,
        installHint: typeof artifact.installHint === "string" ? artifact.installHint : undefined,
      });
    }

    if (artifacts.length === 0) {
      return null;
    }

    return {
      version,
      signingPolicy: typeof parsed.signingPolicy === "string" ? parsed.signingPolicy : "unsigned",
      signingPolicyDocHref: SIGNING_POLICY_HREF,
      buildFromSourceDocHref: INSTALL_BUILD_GUIDE_HREF,
      limitationsDocHref: LIMITATIONS_DOC_HREF,
      artifacts,
    };
  } catch {
    return null;
  }
};

const manifestToReleaseSnapshot = (
  manifest: ReleaseManifestSnapshot,
): ReleaseSnapshot | null => {
  const downloadableAssets = filterDownloadableReleaseAssets(
    manifest.artifacts
      .filter((artifact) => artifact.href !== null)
      .map((artifact) => ({
        name: artifact.fileName,
        browser_download_url: artifact.href as string,
        size: artifact.sizeBytes,
      })),
  );

  if (downloadableAssets.length === 0) {
    return null;
  }

  const tag = manifest.version.startsWith("v") ? manifest.version : `v${manifest.version}`;
  return {
    tag,
    htmlUrl: `${REPO_GITHUB_BASE}/blob/main/CHANGELOG.md`,
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
};

const readUnifiedReleaseSnapshot = async (): Promise<ReleaseSnapshot | null> => {
  try {
    const manifest = await readReleaseAssetsManifest();
    if (manifest) {
      const fromManifest = manifestToReleaseSnapshot(manifest);
      if (fromManifest) {
        return fromManifest;
      }
    }

    let policy = await readLocalStablePolicy();
    if (!policy) {
      const response = await fetch(REPO_STABLE_POLICY_URL, {
        next: { revalidate: 300 },
      });
      if (!response.ok) {
        return null;
      }
      policy = (await response.json()) as Record<string, unknown>;
    }

    const versionRaw = policy.version;
    const version = typeof versionRaw === "string" && versionRaw.trim().length > 0
      ? versionRaw.trim().replace(/^v/i, "")
      : await readCanonicalVersion();
    const tag = version.startsWith("v") ? version : `v${version}`;
    const releaseNotesUrl = typeof policy.releaseNotesUrl === "string"
      ? policy.releaseNotesUrl
      : `${REPO_GITHUB_BASE}/blob/main/CHANGELOG.md`;
    const downloadableAssets = filterDownloadableReleaseAssets(
      policyArtifactsToReleaseAssets(policy.artifacts),
    );

    if (downloadableAssets.length === 0) {
      return null;
    }

    return {
      tag,
      htmlUrl: releaseNotesUrl,
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
  const [releaseHighlights, latestRelease, releaseManifest] = await Promise.all([
    readReleaseHighlights(),
    readUnifiedReleaseSnapshot(),
    readReleaseAssetsManifest(),
  ]);

  const resolvedReleaseHref = latestRelease?.htmlUrl ?? `${REPO_GITHUB_BASE}/blob/main/CHANGELOG.md`;

  const primaryLinks: readonly SiteLink[] = [
    {
      label: `Download ${currentTag}`,
      href: "/download",
    },
    {
      label: "Changelog",
      href: `${REPO_GITHUB_BASE}/blob/main/CHANGELOG.md`,
    },
    {
      label: "Version source",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/program/unified-version-source.md`,
    },
    {
      label: "Read The Docs",
      href: `${REPO_GITHUB_BASE}/tree/main/docs`,
    },
  ];

  const proofLinks: readonly SiteLink[] = [
    {
      label: "Known limitations",
      href: "/limitations",
    },
    {
      label: "Changelog",
      href: `${REPO_GITHUB_BASE}/blob/main/CHANGELOG.md`,
    },
    {
      label: "Install / build guide",
      href: INSTALL_BUILD_GUIDE_HREF,
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
      label: "Phase 1 product truth",
      status: "pass",
      note: "DM, group send/receive, and SQLite cold-restart soaks verified in maintainer matrix (2026-07-04).",
    },
    {
      label: "Docs contract",
      status: "pass",
      note: "Canonical docs checked with `pnpm docs:check`.",
    },
    {
      label: "Desktop installer",
      status: "pass",
      note: "Windows NSIS packaged @ v1.9.10 with SHA-256 in release-assets/manifest.json.",
    },
    {
      label: "Android debug APK",
      status: "partial",
      note: "Debug build documented; sideload via local build — not a Play Store claim.",
    },
    {
      label: "Accepted limitations",
      status: "partial",
      note: "Roster divergence (ACC-02) and restore boundaries documented — see /limitations.",
    },
  ];

  const docsLinks: readonly SiteLink[] = [
    {
      label: "Project Overview",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/encyclopedia/01-project-overview.md`,
    },
    {
      label: "Runtime Architecture",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/encyclopedia/03-runtime-architecture.md`,
    },
    {
      label: "Messaging And Groups",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/encyclopedia/04-messaging-and-groups.md`,
    },
    {
      label: "Testing And Quality Gates",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/encyclopedia/06-testing-and-quality-gates.md`,
    },
    {
      label: "Program Overview",
      href: `${REPO_GITHUB_BASE}/blob/main/docs/program/PROGRAM.md`,
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
    releaseManifest,
  };
};

export const resolvePreferredDesktopDownload = (
  release: ReleaseSnapshot | null,
  userAgent: string,
): ReleaseDownloadTarget | null => {
  const platform = inferDesktopPlatformFromUserAgent(userAgent);
  return release?.preferredDesktopDownload[platform] ?? null;
};
