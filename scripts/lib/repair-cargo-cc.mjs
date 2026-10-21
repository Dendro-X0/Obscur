import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CC_VERSIONS = ["cc-1.4.2", "cc-1.4.3", "cc-1.4.0"];
const REGISTRY_INDEX = "index.crates.io-1949cf8c6b5b557f";

/**
 * The cc crate's `src/target/` module tree is occasionally missing after a partial
 * registry extract on Windows (E0583 / E0599 during tor-gateway builds).
 * Re-extract by deleting the broken src tree and running `cargo fetch`.
 */
export function repairCargoCcIfNeeded(options = {}) {
  const log = options.log ?? ((msg) => console.log(`[cargo-repair] ${msg}`));
  const registryRoot = path.join(
    homedir(),
    ".cargo",
    "registry",
    "src",
    REGISTRY_INDEX,
  );

  let repaired = false;
  for (const crateDir of CC_VERSIONS) {
    const srcRoot = path.join(registryRoot, crateDir, "src");
    const targetModule = path.join(srcRoot, "target", "apple.rs");
    if (!existsSync(path.join(registryRoot, crateDir, "src", "target.rs"))) {
      continue;
    }
    if (existsSync(targetModule)) {
      continue;
    }
    log(`${crateDir} missing src/target/ — removing broken extract for re-fetch`);
    try {
      rmSync(path.join(registryRoot, crateDir), { recursive: true, force: true });
      repaired = true;
    } catch (error) {
      log(`failed to remove ${crateDir}: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!repaired) {
    return { repaired: false };
  }

  const repoRoot = options.repoRoot ?? process.cwd();
  const result = spawnSync("cargo", ["fetch"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    log(`cargo fetch failed${detail ? `: ${detail.split("\n").slice(-3).join(" ")}` : ""}`);
    return { repaired: true, ok: false };
  }

  log("cargo fetch completed — cc crate re-extracted");
  return { repaired: true, ok: true };
}
