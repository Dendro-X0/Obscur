/**
 * Repo-hosted update channel — version truth and manifests live on `main`,
 * not GitHub Releases (feature disabled on this repo).
 */

import { parseStreamingUpdateManifest, type StreamingUpdateManifest } from "./streaming-update-policy";

export const DEFAULT_OBSCUR_REPO_OWNER = "Dendro-X0";
export const DEFAULT_OBSCUR_REPO_NAME = "Obscur";
export const DEFAULT_OBSCUR_REPO_BRANCH = "main";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/g, "");

export const buildRawRepoFileUrl = (params: Readonly<{
  owner?: string;
  repo?: string;
  branch?: string;
  filePath: string;
}>): string => {
  const owner = params.owner ?? DEFAULT_OBSCUR_REPO_OWNER;
  const repo = params.repo ?? DEFAULT_OBSCUR_REPO_NAME;
  const branch = params.branch ?? DEFAULT_OBSCUR_REPO_BRANCH;
  const normalizedPath = params.filePath.replace(/^\/+/, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${normalizedPath}`;
};

export const REPO_VERSION_JSON_URL = buildRawRepoFileUrl({ filePath: "version.json" });

export const REPO_STABLE_CHANNEL_BASE_PATH = "apps/desktop/release/channel/stable";

export const REPO_STABLE_UPDATE_FEED_URL = buildRawRepoFileUrl({
  filePath: `${REPO_STABLE_CHANNEL_BASE_PATH}/latest.json`,
});

export const REPO_STABLE_UPDATE_POLICY_URL = buildRawRepoFileUrl({
  filePath: `${REPO_STABLE_CHANNEL_BASE_PATH}/streaming-update-policy.json`,
});

export const resolveStreamingUpdateFeedUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_STREAMING_UPDATE_FEED_URL?.trim();
  return explicit && explicit.length > 0 ? explicit : REPO_STABLE_UPDATE_FEED_URL;
};

export const resolveStreamingUpdatePolicyUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_STREAMING_UPDATE_POLICY_URL?.trim();
  return explicit && explicit.length > 0 ? explicit : REPO_STABLE_UPDATE_POLICY_URL;
};

export const resolveRepoVersionJsonUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_REPO_VERSION_JSON_URL?.trim();
  return explicit && explicit.length > 0 ? explicit : REPO_VERSION_JSON_URL;
};

export const shouldPreferRepoUpdateChannel = (): boolean => {
  if (process.env.NEXT_PUBLIC_PREFER_REPO_UPDATE_CHANNEL === "0") {
    return false;
  }
  return true;
};

export const shouldQueryGitHubReleasesLatest = (): boolean => {
  if (process.env.NEXT_PUBLIC_SKIP_GITHUB_RELEASE_CHECK === "1") {
    return false;
  }
  if (shouldPreferRepoUpdateChannel()) {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return false;
  }
  return true;
};

export type RepoVersionJson = Readonly<{
  version: string;
  channel?: string;
  target?: string;
}>;

export const parseRepoVersionJson = (raw: string): RepoVersionJson | null => {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const version = typeof parsed.version === "string" ? parsed.version.trim() : "";
    if (!version) {
      return null;
    }
    return {
      version: version.replace(/^v/i, ""),
      channel: typeof parsed.channel === "string" ? parsed.channel : undefined,
      target: typeof parsed.target === "string" ? parsed.target : undefined,
    };
  } catch {
    return null;
  }
};

export const fetchTextViaBrowser = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
};

export type RepoChannelDownloadAsset = Readonly<{
  name: string;
  browser_download_url: string;
  size: number;
}>;

export type RepoChannelDownloadRelease = Readonly<{
  tag_name: string;
  assets: ReadonlyArray<RepoChannelDownloadAsset>;
  body: string;
}>;

export const policyManifestToDownloadRelease = (
  manifest: StreamingUpdateManifest,
): RepoChannelDownloadRelease => {
  const assets = Object.values(manifest.artifacts).map((artifact) => ({
    name: artifact.url.split("/").pop()?.split("?")[0] ?? "download",
    browser_download_url: artifact.url,
    size: 0,
  }));
  const version = manifest.version.trim().replace(/^v/i, "");
  return {
    tag_name: `v${version}`,
    assets,
    body: manifest.releaseNotesUrl ?? "",
  };
};

/** Download page + website: read stable channel policy (works when GitHub Releases is off). */
export const fetchRepoChannelDownloadRelease = async (): Promise<RepoChannelDownloadRelease | null> => {
  const raw = await fetchTextViaBrowser(resolveStreamingUpdatePolicyUrl());
  if (!raw) {
    return null;
  }
  const parsed = parseStreamingUpdateManifest(raw);
  if (!parsed.ok) {
    return null;
  }
  return policyManifestToDownloadRelease(parsed.manifest);
};
