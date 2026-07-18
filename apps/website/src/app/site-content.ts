import { existsSync } from "node:fs";
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
  /** @deprecated use media */
  gifUrl?: string;
  gifAlt: string;
  media: GuideMedia;
  guideHref: string;
  /** Alternating media/copy for cinematic stages */
  stageLayout: "left" | "right";
}>;

/**
 * Landing hero stage. Drop narrated demo at `public/hero-media/showcase.mp4`
 * (+ `.poster.jpg`) — resolver prefers it and sets `hasAudio: true`.
 */
export type HeroShowcase = Readonly<{
  media: GuideMedia;
  /** When true: controls + user play only; never autoplay with sound */
  hasAudio: boolean;
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

export type GuideMedia = Readonly<{
  kind: "mp4" | "gif";
  url: string;
  posterUrl: string | null;
  alt: string;
  stem: string;
}>;

export type GuideSection = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  callout: string | null;
  /** Primary + supporting demos for this how-to step */
  demos: readonly GuideMedia[];
}>;

export type SiteContent = Readonly<{
  currentVersion: string;
  currentReleaseHref: string;
  currentReleaseTag: string;
  primaryLinks: readonly SiteLink[];
  proofLinks: readonly SiteLink[];
  heroShowcase: HeroShowcase | null;
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
const gifWebDir = path.join(repoRoot, "docs", "assets", "gifs", "web");
const websiteGuideMediaDir = path.join(process.cwd(), "public", "guide-media");
const websiteHeroMediaDir = path.join(process.cwd(), "public", "hero-media");
const HERO_FALLBACK_STEM = "auth_unlock_1";
const HERO_FALLBACK_ALT = "Obscur profile unlock — product surface from the demo library";

/** Prefer local public guide-media (post-compress copy), else raw GitHub web/, never embed huge archive GIFs on site. */
const resolveDemoMedia = (stem: string, alt: string): GuideMedia | null => {
  const localMp4 = path.join(websiteGuideMediaDir, `${stem}.mp4`);
  const localPoster = path.join(websiteGuideMediaDir, `${stem}.poster.jpg`);
  if (existsSync(localMp4)) {
    return {
      kind: "mp4",
      url: `/guide-media/${stem}.mp4`,
      posterUrl: existsSync(localPoster) ? `/guide-media/${stem}.poster.jpg` : null,
      alt,
      stem,
    };
  }

  const webMp4 = path.join(gifWebDir, `${stem}.mp4`);
  const webPoster = path.join(gifWebDir, `${stem}.poster.jpg`);
  if (existsSync(webMp4)) {
    return {
      kind: "mp4",
      url: `${RAW_GITHUB_BASE}/docs/assets/gifs/web/${stem}.mp4`,
      posterUrl: existsSync(webPoster)
        ? `${RAW_GITHUB_BASE}/docs/assets/gifs/web/${stem}.poster.jpg`
        : null,
      alt,
      stem,
    };
  }

  return null;
};

/**
 * Hero stage resolver — prefers maintainer showcase with audio controls;
 * otherwise muted ambient from guide-media (never claims a trailer exists).
 */
export const resolveHeroShowcase = (): HeroShowcase | null => {
  const showcaseMp4 = path.join(websiteHeroMediaDir, "showcase.mp4");
  const showcasePoster = path.join(websiteHeroMediaDir, "showcase.poster.jpg");
  if (existsSync(showcaseMp4)) {
    return {
      hasAudio: true,
      media: {
        kind: "mp4",
        url: "/hero-media/showcase.mp4",
        posterUrl: existsSync(showcasePoster) ? "/hero-media/showcase.poster.jpg" : null,
        alt: "Obscur product demonstration",
        stem: "showcase",
      },
    };
  }

  const fallback = resolveDemoMedia(HERO_FALLBACK_STEM, HERO_FALLBACK_ALT);
  if (!fallback) return null;
  return { hasAudio: false, media: fallback };
};

const resolveDemos = (
  items: readonly Readonly<{ stem: string; alt: string }>[],
): readonly GuideMedia[] =>
  items
    .map((item) => resolveDemoMedia(item.stem, item.alt))
    .filter((media): media is GuideMedia => Boolean(media));

export const loadGuideSections = async (): Promise<readonly GuideSection[]> => {
  const sections: readonly {
    id: string;
    eyebrow: string;
    title: string;
    summary: string;
    callout: string | null;
    demos: readonly Readonly<{ stem: string; alt: string }>[];
  }[] = [
    {
      id: "unlock",
      eyebrow: "1 · Identity",
      title: "Create and unlock a profile",
      summary:
        "Obscur identity lives on your device. Create a profile with a passphrase, unlock when you return, and keep recovery material offline if you export it.",
      callout: null,
      demos: [
        { stem: "auth_create_1", alt: "Creating a new Obscur profile" },
        { stem: "auth_unlock_1", alt: "Unlocking an Obscur profile with a passphrase" },
        { stem: "auth_unlock_2", alt: "Alternate unlock take" },
      ],
    },
    {
      id: "relays",
      eyebrow: "2 · Connectivity",
      title: "Choose relays and transport",
      summary:
        "Relays and mesh endpoints only carry encrypted traffic. Pick a transport pack or add your own URLs under Settings → Transport & connectivity.",
      callout:
        "Adapters are not the product — encryption stays on the client. See Limitations if a public relay fails closed.",
      demos: [
        { stem: "relay_overview_1", alt: "Relay overview in Settings" },
        { stem: "relay_enable_disable_1", alt: "Enabling and disabling relays" },
      ],
    },
    {
      id: "contacts",
      eyebrow: "3 · Network",
      title: "Send and accept contact requests",
      summary:
        "Add someone by pubkey or request flow, then accept on the other profile before expecting a durable DM thread.",
      callout: null,
      demos: [
        { stem: "send_a_contact_request_1", alt: "Sending a contact request" },
        { stem: "accept_a_contact_request_1", alt: "Accepting a contact request" },
      ],
    },
    {
      id: "dm",
      eyebrow: "4 · Messaging",
      title: "Send encrypted direct messages",
      summary:
        "Open a contact thread, send text, use emoji, and search history when the thread grows.",
      callout: null,
      demos: [
        { stem: "e2e-dm-base_1", alt: "Direct message conversation in Obscur" },
        { stem: "emoji_icons_1", alt: "Emoji picker in the composer" },
        { stem: "search_message_history_1", alt: "Searching message history" },
      ],
    },
    {
      id: "groups",
      eyebrow: "5 · Groups",
      title: "Create a group and invite members",
      summary:
        "Managed workspaces support invites and encrypted group chat. Member lists may still disagree between profiles (accepted limitation).",
      callout: "ACC-02 — roster display may diverge; do not demo perfect parity.",
      demos: [
        { stem: "group_create_managed_workspace_1", alt: "Creating a managed group workspace" },
        { stem: "group_invite_member_1", alt: "Inviting a member to a group" },
        { stem: "community_group_send_receive_1", alt: "Group send and receive" },
        { stem: "group_participants_settings_1", alt: "Group participants settings" },
      ],
    },
    {
      id: "media",
      eyebrow: "6 · Media",
      title: "Share and preview files",
      summary:
        "Attach images and files in a thread, watch transfer progress, then open previews in the lightbox.",
      callout: null,
      demos: [
        {
          stem: "multimedia_files_upload_and_transfer_1",
          alt: "Uploading and transferring multimedia files",
        },
        { stem: "preview_files_1", alt: "Previewing files in chat" },
      ],
    },
    {
      id: "voice",
      eyebrow: "7 · Voice",
      title: "Voice notes and calls",
      summary:
        "Record a voice note in the composer, or start a voice call when both sides are online.",
      callout: null,
      demos: [
        { stem: "send_voice_note_1", alt: "Sending a voice note" },
        { stem: "start_a_voice_call_1", alt: "Starting a voice call" },
      ],
    },
    {
      id: "profiles",
      eyebrow: "8 · Multi-profile",
      title: "Export, import, and isolate profiles",
      summary:
        "Export a profile for backup or another window. Import restores local state — treat exports like secret keys. Separate windows keep profiles isolated.",
      callout: null,
      demos: [
        { stem: "export_local_profile_1", alt: "Exporting a local Obscur profile" },
        {
          stem: "Import_local_profile_and_sync_account_data_1",
          alt: "Importing a profile and syncing local data",
        },
        {
          stem: "delete_profile_window_isolation_1",
          alt: "Profile delete and window isolation",
        },
      ],
    },
    {
      id: "settings",
      eyebrow: "9 · Settings",
      title: "Privacy, trust, and preferences",
      summary:
        "Use Settings for profile details, privacy/trust surfaces, and security preferences without leaving the desktop shell.",
      callout: null,
      demos: [{ stem: "settings_panel_1", alt: "Settings panel overview" }],
    },
  ];

  return sections.map((section) => ({
    id: section.id,
    eyebrow: section.eyebrow,
    title: section.title,
    summary: section.summary,
    callout: section.callout,
    demos: resolveDemos(section.demos),
  }));
};

export const getGuideSection = async (id: string): Promise<GuideSection | null> => {
  const sections = await loadGuideSections();
  return sections.find((section) => section.id === id) ?? null;
};

export const getGuideSectionNeighbors = async (
  id: string,
): Promise<Readonly<{ prev: GuideSection | null; next: GuideSection | null; index: number; total: number }>> => {
  const sections = await loadGuideSections();
  const index = sections.findIndex((section) => section.id === id);
  if (index < 0) {
    return { prev: null, next: null, index: -1, total: sections.length };
  }
  return {
    prev: sections[index - 1] ?? null,
    next: sections[index + 1] ?? null,
    index,
    total: sections.length,
  };
};

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
      label: "User guide",
      href: "/guide",
    },
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

  const landingHighlights = [
    {
      title: "Auth And Onboarding",
      summary:
        "Local-first account creation and unlock grounded in explicit identity ownership.",
      gifAlt: "Obscur profile unlock flow",
      stem: "auth_unlock_1",
      guideHref: "/guide/unlock",
    },
    {
      title: "Direct Messaging",
      summary: "Encrypted chat with conversation ownership and delivery diagnostics.",
      gifAlt: "Obscur direct messaging interface",
      stem: "e2e-dm-base_1",
      guideHref: "/guide/dm",
    },
    {
      title: "Contacts",
      summary: "Send and accept contact requests before opening a durable DM thread.",
      gifAlt: "Sending a contact request",
      stem: "send_a_contact_request_1",
      guideHref: "/guide/contacts",
    },
    {
      title: "Communities",
      summary: "Managed workspace creation, invites, and encrypted group chat.",
      gifAlt: "Obscur community group chat demo",
      stem: "community_group_send_receive_1",
      guideHref: "/guide/groups",
    },
    {
      title: "Relays And Transport",
      summary: "Choose which networks carry ciphertext — encryption stays on the client.",
      gifAlt: "Obscur relay and settings surfaces",
      stem: "relay_overview_1",
      guideHref: "/guide/relays",
    },
    {
      title: "Media Transfer",
      summary: "Attach files in-thread with transfer progress and local preview.",
      gifAlt: "Multimedia upload and transfer",
      stem: "multimedia_files_upload_and_transfer_1",
      guideHref: "/guide/media",
    },
    {
      title: "Voice",
      summary: "Voice notes in the composer and voice calls when both sides are online.",
      gifAlt: "Sending a voice note",
      stem: "send_voice_note_1",
      guideHref: "/guide/voice",
    },
    {
      title: "Multi-Profile",
      summary: "Export, import, and window isolation for multiple identities on one machine.",
      gifAlt: "Obscur multi-profile export demo",
      stem: "export_local_profile_1",
      guideHref: "/guide/profiles",
    },
    {
      title: "Message Search",
      summary: "Search message history and jump to results inside an active thread.",
      gifAlt: "Obscur message search and jump demo",
      stem: "search_message_history_1",
      guideHref: "/guide/dm",
    },
    {
      title: "Settings",
      summary: "Profile, privacy/trust, and security preferences in the desktop shell.",
      gifAlt: "Settings panel overview",
      stem: "settings_panel_1",
      guideHref: "/guide/settings",
    },
  ] as const;

  const featureCards: FeatureCard[] = [];
  for (const [index, card] of landingHighlights.entries()) {
    const media = resolveDemoMedia(card.stem, card.gifAlt);
    if (!media) continue;
    featureCards.push({
      title: card.title,
      summary: card.summary,
      gifAlt: card.gifAlt,
      gifUrl: media.url,
      media,
      guideHref: card.guideHref,
      stageLayout: index % 2 === 0 ? "left" : "right",
    });
  }

  const heroShowcase = resolveHeroShowcase();

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
    heroShowcase,
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
