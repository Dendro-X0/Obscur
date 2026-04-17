#!/usr/bin/env node
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const defaultAssetsDir = resolve(repoRoot, "release-assets");
const defaultOutputPath = resolve(defaultAssetsDir, "streaming-update", "latest.json");
const changelogPath = resolve(repoRoot, "CHANGELOG.md");

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

const isSemverLike = (value) => /^\d+(\.\d+){1,3}(-[A-Za-z0-9.-]+)?$/.test(value);

const walk = async (root) => {
  try {
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
  } catch {
    return [];
  }
};

const normalizeVersion = (value) => String(value).trim().replace(/^v/i, "");

const resolveVersion = async () => {
  const explicit = getArg("--version");
  if (explicit) {
    const normalized = normalizeVersion(explicit);
    if (!isSemverLike(normalized)) {
      throw new Error(`--version must be semver-like (received: ${explicit})`);
    }
    return normalized;
  }
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, "package.json"), "utf8"));
  const version = normalizeVersion(packageJson.version ?? "");
  if (!isSemverLike(version)) {
    throw new Error(`package.json version is not semver-like (${packageJson.version ?? "missing"})`);
  }
  return version;
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

const pickArtifactWithSignature = async (files, matcher) => {
  const sorted = files.slice().sort((left, right) => left.localeCompare(right));
  for (const file of sorted) {
    if (!matcher(file)) {
      continue;
    }
    const signature = await readOptionalSignature(file);
    if (!signature) {
      continue;
    }
    return { filePath: file, signature };
  }
  return null;
};

const toReleaseUrl = (baseUrl, filePath) =>
  `${baseUrl.replace(/\/+$/g, "")}/${encodeURIComponent(basename(filePath))}`;

const readReleaseNotes = async (versionTag) => {
  const changelog = await readFile(changelogPath, "utf8");
  const escapedTag = versionTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startPattern = new RegExp(`^## \\[${escapedTag}\\] - .+$`, "m");
  const startMatch = changelog.match(startPattern);
  if (!startMatch || typeof startMatch.index !== "number") {
    return `Release ${versionTag}`;
  }
  const startIndex = startMatch.index + startMatch[0].length;
  const rest = changelog.slice(startIndex);
  const nextSectionIndex = rest.search(/^## \[/m);
  const sectionBody = nextSectionIndex === -1 ? rest : rest.slice(0, nextSectionIndex);
  const notes = sectionBody.trim();
  return notes.length > 0 ? notes : `Release ${versionTag}`;
};

const main = async () => {
  const assetsDir = resolve(repoRoot, getArg("--assets-dir", defaultAssetsDir));
  const outputPath = resolve(repoRoot, getArg("--output", defaultOutputPath));
  const baseUrl = String(
    getArg("--base-url", "https://github.com/Dendro-X0/Obscur/releases/latest/download"),
  );
  const version = await resolveVersion();
  const versionTag = `v${version}`;

  const windowsFiles = await walk(resolve(assetsDir, "windows"));
  const macosFiles = await walk(resolve(assetsDir, "macos"));
  const linuxFiles = await walk(resolve(assetsDir, "linux"));

  const windowsArtifact = await pickArtifactWithSignature(
    windowsFiles,
    (file) => {
      const lower = file.toLowerCase();
      return lower.endsWith("_x64-setup.exe") || lower.endsWith(".exe") || lower.endsWith(".msi");
    },
  );
  const macosArtifact = await pickArtifactWithSignature(
    macosFiles,
    (file) => {
      const lower = file.toLowerCase();
      return lower.endsWith(".app.tar.gz") || lower.endsWith(".dmg");
    },
  );
  const linuxArtifact = await pickArtifactWithSignature(
    linuxFiles,
    (file) => {
      const lower = file.toLowerCase();
      return lower.endsWith(".appimage.tar.gz") || lower.endsWith(".appimage") || lower.endsWith(".deb");
    },
  );

  if (!windowsArtifact || !macosArtifact || !linuxArtifact) {
    throw new Error("Missing signed desktop updater artifacts required for latest.json generation.");
  }

  const notes = await readReleaseNotes(versionTag);

  const updaterFeed = {
    version,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: windowsArtifact.signature,
        url: toReleaseUrl(baseUrl, windowsArtifact.filePath),
      },
      "darwin-aarch64": {
        signature: macosArtifact.signature,
        url: toReleaseUrl(baseUrl, macosArtifact.filePath),
      },
      "linux-x86_64": {
        signature: linuxArtifact.signature,
        url: toReleaseUrl(baseUrl, linuxArtifact.filePath),
      },
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(updaterFeed, null, 2)}\n`, "utf8");
  const outputStats = await stat(outputPath);

  console.log("[release:tauri-updater-feed] Generated latest.json updater feed.");
  console.log(`- version: ${version}`);
  console.log(`- output: ${outputPath}`);
  console.log(`- size: ${outputStats.size} bytes`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:tauri-updater-feed] Failed: ${message}`);
  process.exit(1);
});
