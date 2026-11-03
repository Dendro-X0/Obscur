import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REGISTRY_INDEX = "index.crates.io-1949cf8c6b5b557f";

/**
 * The cc crate's `src/target/` module tree is occasionally missing after a partial
 * registry extract on Windows (E0583 / E0599 during tor-gateway / Tauri builds).
 * Scan every `cc-*` extract, delete broken trees (+ matching .crate cache), then
 * re-fetch from the desktop + tor-gateway Cargo workspaces.
 */
export function repairCargoCcIfNeeded(options = {}) {
  const log = options.log ?? ((msg) => console.log(`[cargo-repair] ${msg}`));
  const home = homedir();
  const registryRoot = path.join(home, ".cargo", "registry", "src", REGISTRY_INDEX);
  const cacheRoot = path.join(home, ".cargo", "registry", "cache", REGISTRY_INDEX);

  if (!existsSync(registryRoot)) {
    return { repaired: false };
  }

  const crateDirs = readdirSync(registryRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^cc-\d/.test(entry.name))
    .map((entry) => entry.name);

  let repaired = false;
  for (const crateDir of crateDirs) {
    const crateRoot = path.join(registryRoot, crateDir);
    const targetRs = path.join(crateRoot, "src", "target.rs");
    const appleModule = path.join(crateRoot, "src", "target", "apple.rs");
    if (!existsSync(targetRs)) {
      continue;
    }
    if (existsSync(appleModule)) {
      continue;
    }
    log(`${crateDir} missing src/target/ — removing broken extract for re-fetch`);
    try {
      rmSync(crateRoot, { recursive: true, force: true });
      repaired = true;
    } catch (error) {
      log(`failed to remove ${crateDir}: ${error instanceof Error ? error.message : error}`);
    }
    const cacheName = `${crateDir}.crate`;
    const cachePath = path.join(cacheRoot, cacheName);
    if (existsSync(cachePath)) {
      try {
        // Force a clean download — partial .crate files also reproduce broken extracts.
        rmSync(cachePath, { force: true });
        log(`removed cache ${cacheName}`);
      } catch (error) {
        log(`failed to remove cache ${cacheName}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  if (!repaired) {
    return { repaired: false };
  }

  const repoRoot = options.repoRoot ?? process.cwd();
  // Prefer the packages that actually compile `cc` during desktop online boots.
  // Root workspace fetch is last and optional — it can be slow on cold networks.
  const fetchCwds = options.fetchCwds ?? [
    path.join(repoRoot, "apps", "tor-gateway"),
    path.join(repoRoot, "apps", "desktop", "src-tauri"),
  ];

  let ok = true;
  for (const cwd of fetchCwds) {
    if (!existsSync(path.join(cwd, "Cargo.toml"))) {
      continue;
    }
    log(`cargo fetch in ${path.relative(repoRoot, cwd) || "."}…`);
    const result = spawnSync("cargo", ["fetch"], {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
      timeout: 180_000,
    });
    if (result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM") {
      log(`cargo fetch timed out in ${path.relative(repoRoot, cwd) || "."}`);
      ok = false;
      continue;
    }
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "").trim();
      log(`cargo fetch failed in ${path.relative(repoRoot, cwd) || "."}${detail ? `: ${detail.split("\n").slice(-3).join(" ")}` : ""}`);
      ok = false;
    }
  }

  if (ok) {
    log("cargo fetch completed — cc crate re-extracted");
  }
  return { repaired: true, ok };
}
