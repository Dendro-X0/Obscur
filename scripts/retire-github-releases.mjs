#!/usr/bin/env node
/**
 * Optional cosmetic cleanup of old GitHub Release pages.
 *
 * CANONICAL: ignore GitHub Releases for version truth. Optional UI: repo home → About gear →
 * uncheck Releases under "Include in the home page". Bulk delete below requires gh CLI.
 * Requires gh CLI:
 *   pnpm github:releases:retire -- --dry-run
 *   pnpm github:releases:retire -- --apply
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const dryRun = !args.includes("--apply");
const deleteTags = args.includes("--delete-tags");
const repo = process.env.GITHUB_REPOSITORY ?? "Dendro-X0/Obscur";

const runGh = (ghArgs, { inherit = false } = {}) => {
  const result = spawnSync("gh", ghArgs, {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: inherit ? "inherit" : "pipe",
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(`gh ${ghArgs.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
  }
  return result.stdout?.trim() ?? "";
};

const main = () => {
  try {
    runGh(["auth", "status"], { inherit: true });
  } catch {
    console.error("[github:releases:retire] gh CLI not available or not authenticated.");
    console.error("  Install: https://cli.github.com/  then: gh auth login");
    process.exit(1);
  }

  const json = runGh(["release", "list", "--repo", repo, "--limit", "500", "--json", "tagName,isDraft,isLatest"]);
  const releases = JSON.parse(json);
  if (!Array.isArray(releases) || releases.length === 0) {
    console.log("[github:releases:retire] No GitHub Releases found.");
    return;
  }

  console.log(`[github:releases:retire] Found ${releases.length} release(s) on ${repo}.`);
  if (dryRun) {
    console.log("[github:releases:retire] DRY RUN — pass --apply to delete release pages.");
  }

  for (const entry of releases) {
    const tag = entry.tagName;
    const draft = entry.isDraft ? " (draft)" : "";
    const latest = entry.isLatest ? " [Latest]" : "";
    console.log(`  - ${tag}${draft}${latest}`);
    if (dryRun) {
      continue;
    }
    runGh(["release", "delete", tag, "--repo", repo, "--yes"], { inherit: true });
    if (deleteTags) {
      runGh(["api", "-X", "DELETE", `repos/${repo}/git/refs/tags/${encodeURIComponent(tag)}`], { inherit: true });
      console.log(`    deleted tag ${tag}`);
    }
  }

  if (dryRun) {
    console.log("");
    console.log("[github:releases:retire] After --apply, version truth lives at:");
    console.log("  https://raw.githubusercontent.com/Dendro-X0/Obscur/main/version.json");
    console.log("  docs/program/unified-version-source.md");
  } else {
    console.log("[github:releases:retire] Done. GitHub Releases cleared. Publish via repo channel + local package.");
  }
};

main();
