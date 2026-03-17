#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const REQUIRED_EXTENSIONS = [".exe", ".dmg", ".appimage", ".deb", ".apk", ".aab"];

const getArg = (name) => {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
};

const run = (cmd, args) => {
  const isWin = process.platform === "win32";
  const command = isWin && cmd === "git" ? "git" : cmd;
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: isWin,
  });
  if (result.status !== 0) {
    const out = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(out || `${cmd} ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
};

const listFilesRecursive = (dir) => {
  if (!existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const name of readdirSync(current)) {
      const full = resolve(current, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push(full);
      } else if (st.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
};

const getRemoteTag = () => {
  const version = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")).version;
  return `v${version}`;
};

const deriveOwnerRepoFromOrigin = () => {
  const origin = run("git", ["remote", "get-url", "origin"]);
  const cleaned = origin.replace(/\.git$/, "");
  const httpsMatch = cleaned.match(/github\.com[:/](.+?)\/(.+)$/i);
  if (!httpsMatch) {
    throw new Error(`Unable to parse origin for GitHub owner/repo: ${origin}`);
  }
  return { owner: httpsMatch[1], repo: httpsMatch[2] };
};

const fetchReleaseAssets = async (owner, repo, tag) => {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;
  const response = await fetch(url, {
    headers: { "Accept": "application/vnd.github+json" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch release (${response.status}): ${text}`);
  }
  const json = await response.json();
  const assets = Array.isArray(json.assets) ? json.assets : [];
  return assets.map((asset) => ({
    name: String(asset.name ?? ""),
    size: Number(asset.size ?? 0),
    downloadUrl: String(asset.browser_download_url ?? ""),
  }));
};

const toExtensionSet = (files) => {
  const extSet = new Set();
  for (const file of files) {
    extSet.add(extname(file).toLowerCase());
  }
  return extSet;
};

const main = async () => {
  const tag = getArg("--tag") ?? getRemoteTag();
  const localDir = getArg("--local-assets-dir");
  const owner = getArg("--owner");
  const repo = getArg("--repo");

  const packageVersion = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")).version;
  const versionJson = JSON.parse(readFileSync(resolve(rootDir, "version.json"), "utf8")).version;
  const changelog = readFileSync(resolve(rootDir, "CHANGELOG.md"), "utf8");
  const tagVersion = tag.startsWith("v") ? tag.slice(1) : tag;

  if (packageVersion !== versionJson) {
    throw new Error(`Version mismatch: package.json=${packageVersion}, version.json=${versionJson}`);
  }
  if (tagVersion !== packageVersion) {
    throw new Error(`Tag/version mismatch: tag=${tagVersion}, package.json=${packageVersion}`);
  }
  if (!changelog.includes(`## [${tag}]`)) {
    throw new Error(`CHANGELOG.md missing heading for ${tag}`);
  }

  let assetNames = [];
  if (localDir) {
    const files = listFilesRecursive(resolve(rootDir, localDir));
    assetNames = files.map((f) => f.toLowerCase());
  } else {
    const resolved = owner && repo ? { owner, repo } : deriveOwnerRepoFromOrigin();
    const assets = await fetchReleaseAssets(resolved.owner, resolved.repo, tag);
    assetNames = assets.map((asset) => asset.name.toLowerCase());
  }

  const extSet = toExtensionSet(assetNames);
  const hasLinux = extSet.has(".appimage") || extSet.has(".deb");
  const missing = [];
  if (!extSet.has(".exe")) missing.push(".exe");
  if (!extSet.has(".dmg")) missing.push(".dmg");
  if (!hasLinux) missing.push(".appimage|.deb");
  if (!extSet.has(".apk")) missing.push(".apk");
  if (!extSet.has(".aab")) missing.push(".aab");

  if (missing.length > 0) {
    throw new Error(`Missing required release artifacts for ${tag}: ${missing.join(", ")}`);
  }

  const aabNames = assetNames.filter((n) => n.endsWith(".aab"));
  const unsignedAabPresent = aabNames.some((n) => n.includes("unsigned"));

  console.log(`[release:verify-tag] ${tag} consistency checks passed.`);
  console.log(`[release:verify-tag] Required artifacts present: ${REQUIRED_EXTENSIONS.join(", ")} (linux allows .appimage or .deb).`);
  console.log(`[release:verify-tag] AAB summary: total=${aabNames.length}, unsigned_present=${unsignedAabPresent}`);
};

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[release:verify-tag] Failed: ${msg}`);
  process.exit(1);
});
