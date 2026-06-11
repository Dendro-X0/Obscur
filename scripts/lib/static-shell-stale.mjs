/**
 * Detect when apps/pwa/out is older than v2 slim kernel sources or wrong experiment mode.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const STATIC_SHELL_MANIFEST_FILE = "obscur-shell-manifest.json";

export const buildStaticShellManifest = (env = process.env) => ({
  experimentOnline: env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE === "1",
  desktopShell: env.NEXT_PUBLIC_DESKTOP_SHELL === "1",
  devLabEnabled: env.NEXT_PUBLIC_OBSCUR_DEV_LAB === "1",
  builtAt: new Date().toISOString(),
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

const collectNewestMtime = (root, maxDepth = 6, depth = 0) => {
  if (!existsSync(root)) {
    return 0;
  }

  let newest = statSync(root).mtimeMs;
  if (depth >= maxDepth) {
    return newest;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, collectNewestMtime(fullPath, maxDepth, depth + 1));
      continue;
    }
    if (/\.(ts|tsx|mjs|json)$/.test(entry.name)) {
      newest = Math.max(newest, statSync(fullPath).mtimeMs);
    }
  }
  return newest;
};

export const isStaticShellStale = (repoRoot) => {
  const outIndex = path.join(repoRoot, "apps", "pwa", "out", "index.html");
  if (!existsSync(outIndex)) {
    return { stale: true, reason: "missing out/index.html" };
  }

  const outMtime = statSync(outIndex).mtimeMs;
  const watchRoots = [
    path.join(repoRoot, "apps", "pwa", "app", "features", "dm-kernel"),
    path.join(repoRoot, "apps", "pwa", "app", "features", "workspace-kernel"),
    path.join(repoRoot, "apps", "pwa", "app", "features", "groups", "services", "community-joiner-membership-repair-scenario.ts"),
    path.join(repoRoot, "apps", "pwa", "app", "features", "dev-lab", "dev-lab-joiner-membership-probe.ts"),
    path.join(repoRoot, "apps", "pwa", "app", "features", "messaging", "hooks", "use-thread-messages.ts"),
    path.join(repoRoot, "apps", "pwa", "app", "features", "messaging", "services", "native-dm-read-policy.ts"),
  ];

  for (const watchRoot of watchRoots) {
    const sourceMtime = collectNewestMtime(watchRoot, watchRoot.endsWith(".ts") ? 0 : 5);
    if (sourceMtime > outMtime) {
      return {
        stale: true,
        reason: `${path.relative(repoRoot, watchRoot)} changed after static export`,
      };
    }
  }

  return { stale: false, reason: "out/index.html is current" };
};
