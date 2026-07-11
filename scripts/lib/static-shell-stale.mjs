/**
 * Detect when apps/pwa/out is older than PWA app sources or wrong experiment mode.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const STATIC_SHELL_MANIFEST_FILE = "obscur-shell-manifest.json";

/** Roots scanned for staleness — entire app tree, not a hand-picked subset. */
export const STATIC_SHELL_SOURCE_ROOTS = [
  "apps/pwa/app",
  "apps/pwa/next.config.ts",
  "apps/pwa/package.json",
];

const SOURCE_FILE_PATTERN = /\.(ts|tsx|mjs|json|css)$/;
const IGNORED_DIR_NAMES = new Set(["node_modules", ".next", "__tests__"]);

export const buildStaticShellManifest = (env = process.env, sourceRevision = null) => ({
  experimentOnline: env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE === "1",
  desktopShell: env.NEXT_PUBLIC_DESKTOP_SHELL === "1",
  devLabEnabled: env.NEXT_PUBLIC_OBSCUR_DEV_LAB === "1",
  builtAt: new Date().toISOString(),
  sourceRevision: sourceRevision ?? null,
  clientBuildStamp: sourceRevision?.stamp ?? null,
});

export const readStaticShellManifest = (repoRoot) => {
  const manifestPath = path.join(repoRoot, "apps", "pwa", "out", STATIC_SHELL_MANIFEST_FILE);
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
};

export const isStaticShellExperimentModeMismatch = (repoRoot, wantOnline) => {
  const manifest = readStaticShellManifest(repoRoot);
  if (!manifest) {
    return { mismatch: true, reason: "missing obscur-shell-manifest.json (rebuild required)" };
  }
  const builtOnline = manifest.experimentOnline === true;
  if (builtOnline !== wantOnline) {
    return {
      mismatch: true,
      reason: wantOnline
        ? "static shell was built offline — online relays require an online build"
        : "static shell was built for online mode",
    };
  }
  return { mismatch: false, reason: "experiment mode matches" };
};

export const isStaticShellDevLabMismatch = (repoRoot) => {
  const manifest = readStaticShellManifest(repoRoot);
  if (!manifest) {
    return { mismatch: true, reason: "missing obscur-shell-manifest.json (rebuild required)" };
  }
  if (manifest.devLabEnabled !== true) {
    return {
      mismatch: true,
      reason: "static shell built without dev-lab — pnpm dev:lab:smoke requires NEXT_PUBLIC_OBSCUR_DEV_LAB=1",
    };
  }
  return { mismatch: false, reason: "dev-lab enabled in static shell" };
};

const collectNewestSource = (root, maxDepth = 12, depth = 0) => {
  if (!existsSync(root)) {
    return { mtimeMs: 0, newestPath: null };
  }

  const stat = statSync(root);
  if (!stat.isDirectory()) {
    return SOURCE_FILE_PATTERN.test(root)
      ? { mtimeMs: stat.mtimeMs, newestPath: root }
      : { mtimeMs: 0, newestPath: null };
  }

  if (depth >= maxDepth) {
    return { mtimeMs: 0, newestPath: null };
  }

  let best = { mtimeMs: 0, newestPath: null };
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (IGNORED_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = collectNewestSource(fullPath, maxDepth, depth + 1);
      if (nested.mtimeMs > best.mtimeMs) {
        best = nested;
      }
      continue;
    }
    if (!SOURCE_FILE_PATTERN.test(entry.name)) {
      continue;
    }
    const fileMtime = statSync(fullPath).mtimeMs;
    if (fileMtime > best.mtimeMs) {
      best = { mtimeMs: fileMtime, newestPath: fullPath };
    }
  }

  return best;
};

/**
 * Newest source file under STATIC_SHELL_SOURCE_ROOTS.
 * Used for manifest stamping and staleness checks.
 */
export const resolveStaticShellSourceRevision = (repoRoot) => {
  let best = { mtimeMs: 0, newestPath: null };
  for (const relativeRoot of STATIC_SHELL_SOURCE_ROOTS) {
    const absoluteRoot = path.join(repoRoot, relativeRoot);
    const candidate = collectNewestSource(absoluteRoot);
    if (candidate.mtimeMs > best.mtimeMs) {
      best = candidate;
    }
  }

  const stamp = best.newestPath
    ? `shell-${new Date(best.mtimeMs).toISOString().replace(/\.\d{3}Z$/, "Z")}`
    : "shell-unknown";

  return {
    mtimeMs: best.mtimeMs,
    newestPath: best.newestPath,
    stamp,
    relativeNewestPath: best.newestPath ? path.relative(repoRoot, best.newestPath) : null,
  };
};

export const isStaticShellStale = (repoRoot) => {
  const outIndex = path.join(repoRoot, "apps", "pwa", "out", "index.html");
  if (!existsSync(outIndex)) {
    return { stale: true, reason: "missing out/index.html" };
  }

  const outMtime = statSync(outIndex).mtimeMs;
  const source = resolveStaticShellSourceRevision(repoRoot);

  if (source.mtimeMs > outMtime) {
    return {
      stale: true,
      reason: source.relativeNewestPath
        ? `${source.relativeNewestPath} changed after static export`
        : "PWA sources changed after static export",
    };
  }

  return { stale: false, reason: "out/index.html is current" };
};

export const formatStaticShellStaleHelp = (staleReason) => [
  `[desktop-static] Static shell is STALE (${staleReason}).`,
  "  Desktop dev serves pre-built files from apps/pwa/out — source edits do not apply until rebuild.",
  "  Fix: pnpm dev:desktop:no-coord -- --rebuild",
  "  Or:  pnpm dev:desktop:online:live  (webpack HMR — UI iteration only)",
  "  Override (not recommended): OBSCUR_ALLOW_STALE_SHELL=1",
].join("\n");
