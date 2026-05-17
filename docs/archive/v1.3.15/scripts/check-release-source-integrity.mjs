#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const runGit = (args) => {
  const isWin = process.platform === "win32";
  const result = spawnSync(isWin ? "git.exe" : "git", args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: isWin,
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const output = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(output || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
};

const findGitlinks = (treeOutput) => {
  return treeOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("160000 "));
};

const main = () => {
  const problems = [];

  if (existsSync(resolve(rootDir, ".gitmodules"))) {
    problems.push(".gitmodules exists (submodule config is not allowed for release repo integrity).");
  }

  const headTree = runGit(["ls-tree", "-r", "--full-tree", "HEAD"]);
  const headGitlinks = findGitlinks(headTree);
  if (headGitlinks.length > 0) {
    problems.push(
      `HEAD contains gitlink entries (mode 160000):\n- ${headGitlinks.join("\n- ")}`
    );
  }

  const indexTree = runGit(["ls-files", "-s"]);
  const indexGitlinks = findGitlinks(indexTree);
  if (indexGitlinks.length > 0) {
    problems.push(
      `Index contains gitlink entries (mode 160000):\n- ${indexGitlinks.join("\n- ")}`
    );
  }

  if (problems.length > 0) {
    console.error("[release:integrity-check] Failed:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log("[release:integrity-check] Source-integrity checks passed (no submodule config, no gitlinks).");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:integrity-check] Failed: ${message}`);
  process.exit(1);
}
