#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const defaultAssetsDir = resolve(repoRoot, "release-assets");
const defaultOutputPath = resolve(defaultAssetsDir, "streaming-update-policy.json");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const maybeValue = process.argv[index + 1];
  if (!maybeValue || maybeValue.startsWith("--")) {
    args.set(key, "true");
    continue;
  }
  args.set(key, maybeValue);
  index += 1;
}

const getArg = (key, fallback = null) => args.get(key) ?? fallback;
const hasFlag = (key) => args.get(key) === "true";

const isSemverLike = (value) => /^\d+(\.\d+){1,3}(-[A-Za-z0-9.-]+)?$/.test(value);

const walk = async (root) => {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
};

const toPosix = (value) => value.replace(/\\/g, "/");

const hashFileSha256 = async (filePath) => {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
};

const readOptionalSignature = async (artifactPath) => {
  const candidates = [`${artifactPath}.sig`, `${artifactPath}.minisig`];
  for (const candidate of candidates) {
    try {
      const content = (await readFile(candidate, "utf8")).trim();
      if (content.length > 0) {
        return content;
      }
    } catch {
      // best effort
    }
  }
  return null;
};

const pickArtifact = (files, allowedExtensions) => {
  const matching = files.filter((file) => allowedExtensions.has(extname(file).toLowerCase()));
  if (matching.length === 0) {
    return null;
  }
  matching.sort((left, right) => left.localeCompare(right));
  return matching[0];
};

const resolveVersion = async () => {
  const explicit = getArg("--version");
  if (explicit) {
    const normalized = String(explicit).trim().replace(/^v/i, "");
    if (!isSemverLike(normalized)) {
      throw new Error(`--version must be semver-like (received: ${explicit})`);
    }
    return normalized;
  }
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const version = String(packageJson.version ?? "").trim().replace(/^v/i, "");
  if (!isSemverLike(version)) {
    throw new Error(`package.json version is not semver-like (${packageJson.version ?? "missing"})`);
  }
  return version;
};

const buildArtifactEntry = async (params) => {
  const checksumSha256 = await hashFileSha256(params.filePath);
  const signatureFromFile = await readOptionalSignature(params.filePath);
  const signature = signatureFromFile || "signature-published-with-release-artifact";
  if (hasFlag("--strict-signatures") && !signatureFromFile) {
    throw new Error(`Missing signature file for artifact: ${params.filePath}`);
  }
  const url = `${params.baseUrl}/${encodeURIComponent(basename(params.filePath))}`;
  return {
    url,
    signature,
    checksumSha256,
  };
};

const main = async () => {
  const assetsDir = resolve(repoRoot, getArg("--assets-dir", defaultAssetsDir));
  const outputPath = resolve(repoRoot, getArg("--output", defaultOutputPath));
  const baseUrl = String(
    getArg("--base-url", "https://github.com/Dendro-X0/Obscur/releases/latest/download"),
  ).replace(/\/+$/, "");
  const channel = String(getArg("--channel", "stable"));
  if (!["stable", "beta", "canary"].includes(channel)) {
    throw new Error(`--channel must be stable|beta|canary (received: ${channel})`);
  }
  const rolloutPercentage = Number.parseInt(String(getArg("--rollout", "100")), 10);
  if (!Number.isFinite(rolloutPercentage) || rolloutPercentage < 0 || rolloutPercentage > 100) {
    throw new Error(`--rollout must be an integer between 0 and 100 (received: ${getArg("--rollout")})`);
  }
  const killSwitch = hasFlag("--kill-switch");
  const minSafeVersionRaw = getArg("--min-safe-version");
  const minSafeVersion = minSafeVersionRaw ? String(minSafeVersionRaw).trim().replace(/^v/i, "") : undefined;
  if (minSafeVersion && !isSemverLike(minSafeVersion)) {
    throw new Error(`--min-safe-version must be semver-like (received: ${minSafeVersionRaw})`);
  }
  const releaseNotesUrl = getArg("--release-notes-url", null);
  if (releaseNotesUrl && !/^https?:\/\//.test(String(releaseNotesUrl))) {
    throw new Error("--release-notes-url must be http(s)");
  }
  const version = await resolveVersion();

  const windowsFiles = await walk(resolve(assetsDir, "windows"));
  const macosFiles = await walk(resolve(assetsDir, "macos"));
  const linuxFiles = await walk(resolve(assetsDir, "linux"));

  const windowsArtifact = pickArtifact(windowsFiles, new Set([".exe", ".msi"]));
  const macosArtifact = pickArtifact(macosFiles, new Set([".dmg"]));
  const linuxArtifact = pickArtifact(linuxFiles, new Set([".appimage", ".deb"]));

  if (!windowsArtifact || !macosArtifact || !linuxArtifact) {
    throw new Error(
      "Missing required desktop artifacts for streaming manifest generation (windows/macos/linux).",
    );
  }

  const artifactEntries = {
    "windows-x86_64": await buildArtifactEntry({ filePath: windowsArtifact, baseUrl }),
    "darwin-aarch64": await buildArtifactEntry({ filePath: macosArtifact, baseUrl }),
    "linux-x86_64": await buildArtifactEntry({ filePath: linuxArtifact, baseUrl }),
  };

  const manifest = {
    version,
    channel,
    rolloutPercentage,
    killSwitch,
    ...(minSafeVersion ? { minSafeVersion } : {}),
    ...(releaseNotesUrl ? { releaseNotesUrl } : {}),
    artifacts: artifactEntries,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const outputStats = await stat(outputPath);
  console.log("[release:streaming-update-manifest] Generated streaming update manifest.");
  console.log(`- version: ${version}`);
  console.log(`- channel: ${channel}`);
  console.log(`- rolloutPercentage: ${rolloutPercentage}`);
  console.log(`- killSwitch: ${killSwitch}`);
  console.log(`- output: ${toPosix(outputPath)}`);
  console.log(`- size: ${outputStats.size} bytes`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:streaming-update-manifest] Failed: ${message}`);
  process.exit(1);
});
