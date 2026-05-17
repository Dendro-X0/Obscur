#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const handoffPath = path.join(repoRoot, "docs", "handoffs", "current-session.md");
const rescueRoot = path.join(repoRoot, ".artifacts", "context-rescue");
const checkpointsStart = "<!-- CONTEXT_CHECKPOINTS_START -->";
const checkpointsEnd = "<!-- CONTEXT_CHECKPOINTS_END -->";

const usage = () => {
  console.log(`Usage:
  node scripts/context-rescue.mjs snapshot [--summary "..."] [--next "..."] [--status "..."] [--owner "..."] [--note "..."] [--label "..."]
  node scripts/context-rescue.mjs latest
`);
};

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const slugify = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 48);

const parseFlags = (args) => {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--") continue;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (!key) continue;
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
};

const normalizeResult = (result) => ({
  ok: result.status === 0 && !result.error,
  code: result.status ?? -1,
  stdout: result.stdout ?? "",
  stderr: result.stderr ?? "",
  error: result.error ? String(result.error.message ?? result.error) : "",
});

const runCommand = (command, args) => {
  const candidates = [];
  if (command === "node") {
    candidates.push(process.execPath);
  }
  candidates.push(command);
  if (process.platform === "win32" && path.extname(command).length === 0) {
    candidates.push(`${command}.exe`);
    candidates.push(`${command}.cmd`);
    candidates.push(`${command}.bat`);
  }

  const dedupedCandidates = [...new Set(candidates)];
  let lastResult = null;
  for (const candidate of dedupedCandidates) {
    const result = spawnSync(candidate, args, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
    });

    const errorCode = result.error && "code" in result.error ? result.error.code : null;
    const isNotFound = errorCode === "ENOENT";
    if (isNotFound) {
      lastResult = result;
      continue;
    }
    return normalizeResult(result);
  }

  return normalizeResult(
    lastResult ?? {
      status: -1,
      stdout: "",
      stderr: "",
      error: new Error(`Unable to execute command: ${command}`),
    },
  );
};

const safeRead = async (filePath) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const extractNextAtomicStep = (markdown) => {
  const match = markdown.match(/## Next Atomic Step\r?\n\r?\n([\s\S]*?)(?=\r?\n## |\r?\n<!-- CONTEXT_CHECKPOINTS_START -->|$)/m);
  return match?.[1]?.trim() || "Resume from the latest rescue bundle and continue from the prior atomic step.";
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceMetadataLine = (text, prefix, value) => {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}.*$`, "m");
  if (!pattern.test(text)) {
    return `${text.trimEnd()}\n${prefix}${value}\n`;
  }
  return text.replace(pattern, `${prefix}${value}`);
};

const replaceSection = (text, heading, body) => {
  const pattern = new RegExp(
    `(${escapeRegExp(heading)}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |$)`,
    "m",
  );
  if (!pattern.test(text)) {
    return `${text.trimEnd()}\n\n${heading}\n\n${body.trim()}\n`;
  }
  return text.replace(pattern, `$1${body.trim()}\n`);
};

const ensureCheckpointMarkers = (text) => {
  if (text.includes(checkpointsStart) && text.includes(checkpointsEnd)) {
    return text;
  }
  return `${text.trimEnd()}\n\n## Checkpoints\n\n${checkpointsStart}\n${checkpointsEnd}\n`;
};

const appendCheckpoint = (text, block) => {
  const startIndex = text.indexOf(checkpointsStart);
  const endIndex = text.indexOf(checkpointsEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("Checkpoint markers are missing in docs/handoffs/current-session.md.");
  }
  const beforeEnd = text.slice(0, endIndex).trimEnd();
  const afterEnd = text.slice(endIndex);
  return `${beforeEnd}\n${block}\n${afterEnd}`;
};

const buildSeedHandoff = ({ summary, next, owner, status }) => {
  const timestamp = nowIso();
  const activeOwner = owner ?? "context-rescue";
  const sessionStatus = status ?? "in-progress";
  return `# Current Session Handoff

- Last Updated (UTC): ${timestamp}
- Session Status: ${sessionStatus}
- Active Owner: ${activeOwner}

## Active Objective

Recover from interrupted context with durable handoff state.

## Current Snapshot

- What is true now:
- What changed in this thread:

## Evidence

- Captured via context rescue bundle.

## Changed Files

- Not recorded yet.

## Open Risks Or Blockers

- None recorded yet.

## Next Atomic Step

${next}

## Checkpoints

${checkpointsStart}
### ${timestamp} checkpoint
- Summary: ${summary}
- Evidence: created by context-rescue bootstrap
- Uncertainty: not provided
- Next: ${next}
${checkpointsEnd}
`;
};

const applyCheckpoint = async (params) => {
  const timestamp = nowIso();
  const summary = params.summary;
  const next = params.next;
  const status = params.status;
  const owner = params.owner;

  try {
    let text = await safeRead(handoffPath);
    if (!text) {
      await ensureDir(path.dirname(handoffPath));
      text = buildSeedHandoff({ summary, next, owner, status });
      await writeText(handoffPath, text);
      return {
        ok: true,
        code: 0,
        stdout: "Initialized handoff file and appended checkpoint.",
        stderr: "",
        error: "",
      };
    }

    text = replaceMetadataLine(text, "- Last Updated (UTC): ", timestamp);
    if (status) {
      text = replaceMetadataLine(text, "- Session Status: ", status);
    }
    if (owner) {
      text = replaceMetadataLine(text, "- Active Owner: ", owner);
    }
    text = replaceSection(text, "## Next Atomic Step", next);
    text = ensureCheckpointMarkers(text);

    const checkpointBlock = `### ${timestamp} checkpoint
- Summary: ${summary}
- Evidence: context rescue snapshot created
- Uncertainty: not provided
- Next: ${next}`;
    text = appendCheckpoint(text, checkpointBlock);
    await writeText(handoffPath, text);
    return {
      ok: true,
      code: 0,
      stdout: "Checkpoint appended to docs/handoffs/current-session.md.",
      stderr: "",
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      code: -1,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown checkpoint failure",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const formatCommandCapture = (label, result) => {
  if (result.ok) {
    return `${result.stdout}${result.stderr}`;
  }
  const failure = result.error || result.stderr || `exit ${result.code}`;
  return `[context-rescue] ${label} unavailable: ${failure}\n`;
};

const readGitHeadFallback = async () => {
  const headRaw = await safeRead(path.join(repoRoot, ".git", "HEAD"));
  if (!headRaw) {
    return { branch: null, head: null };
  }

  const headValue = headRaw.trim();
  if (!headValue.startsWith("ref: ")) {
    return { branch: null, head: headValue || null };
  }

  const refPath = headValue.slice(5).trim();
  const refFullPath = path.join(repoRoot, ".git", ...refPath.split("/"));
  const refHead = await safeRead(refFullPath);
  return {
    branch: refPath.replace(/^refs\/heads\//, "") || null,
    head: refHead?.trim() || null,
  };
};

const writeText = async (filePath, text) => {
  await fs.writeFile(filePath, text, "utf8");
};

const runSnapshot = async (flags) => {
  const handoffMarkdown = await safeRead(handoffPath);
  const fallbackNext = handoffMarkdown ? extractNextAtomicStep(handoffMarkdown) : "Define the next atomic step in docs/handoffs/current-session.md.";
  const summary = flags.summary ?? "Context rescue snapshot created to preserve progress before interruption.";
  const next = flags.next ?? fallbackNext;
  const checkpointResult = await applyCheckpoint({
    summary,
    next,
    status: flags.status,
    owner: flags.owner,
  });

  const timestamp = nowIso();
  const safeTimestamp = timestamp.replace(/[:]/g, "-");
  const labelSeed = flags.label ?? flags.summary ?? "snapshot";
  const label = slugify(labelSeed) || "snapshot";
  const bundleDir = path.join(rescueRoot, `${safeTimestamp}-${label}`);
  await ensureDir(bundleDir);

  const gitBranch = runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const gitHead = runCommand("git", ["rev-parse", "HEAD"]);
  const gitStatusShort = runCommand("git", ["status", "--short"]);
  const gitStatusLong = runCommand("git", ["status"]);
  const gitDiff = runCommand("git", ["diff"]);
  const gitDiffCached = runCommand("git", ["diff", "--cached"]);
  const gitUntracked = runCommand("git", ["ls-files", "--others", "--exclude-standard"]);
  const gitHeadFallback = await readGitHeadFallback();

  const refreshedHandoffMarkdown = await safeRead(handoffPath);
  await writeText(path.join(bundleDir, "handoff-current-session.md"), refreshedHandoffMarkdown ?? "current-session.md not found");
  await writeText(path.join(bundleDir, "git-status-short.txt"), formatCommandCapture("git status --short", gitStatusShort));
  await writeText(path.join(bundleDir, "git-status.txt"), formatCommandCapture("git status", gitStatusLong));
  await writeText(path.join(bundleDir, "git-diff.patch"), formatCommandCapture("git diff", gitDiff));
  await writeText(path.join(bundleDir, "git-diff-staged.patch"), formatCommandCapture("git diff --cached", gitDiffCached));
  await writeText(path.join(bundleDir, "git-untracked.txt"), formatCommandCapture("git ls-files --others --exclude-standard", gitUntracked));

  const note = flags.note?.trim() || "";
  if (note.length > 0) {
    await writeText(path.join(bundleDir, "note.txt"), `${note}\n`);
  }

  const manifest = {
    createdAtUtc: timestamp,
    repoRoot,
    bundleDir,
    checkpoint: {
      attempted: true,
      ok: checkpointResult.ok,
      code: checkpointResult.code,
      summary,
      next,
      stderr: checkpointResult.stderr.trim() || null,
      error: checkpointResult.error || null,
    },
    git: {
      branch: gitBranch.ok
        ? gitBranch.stdout.trim() || null
        : gitHeadFallback.branch,
      head: gitHead.ok
        ? gitHead.stdout.trim() || null
        : gitHeadFallback.head,
      statusShortLineCount: gitStatusShort.ok
        ? gitStatusShort.stdout.split(/\r?\n/).filter(Boolean).length
        : 0,
      untrackedCount: gitUntracked.ok
        ? gitUntracked.stdout.split(/\r?\n/).filter(Boolean).length
        : 0,
      branchError: gitBranch.ok ? null : gitBranch.error || gitBranch.stderr || `exit ${gitBranch.code}`,
      headError: gitHead.ok ? null : gitHead.error || gitHead.stderr || `exit ${gitHead.code}`,
    },
  };
  await writeText(path.join(bundleDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`[context-rescue] Snapshot saved: ${path.relative(repoRoot, bundleDir)}`);
  if (!checkpointResult.ok) {
    console.warn("[context-rescue] Warning: checkpoint update failed. See manifest.json for details.");
  }
};

const runLatest = async () => {
  await ensureDir(rescueRoot);
  const entries = await fs.readdir(rescueRoot, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (dirs.length === 0) {
    console.log("[context-rescue] No rescue bundles found.");
    return;
  }
  const latest = dirs[dirs.length - 1];
  const latestPath = path.join(rescueRoot, latest);
  const manifest = await safeRead(path.join(latestPath, "manifest.json"));
  console.log(`[context-rescue] Latest bundle: ${path.relative(repoRoot, latestPath)}`);
  if (manifest) {
    console.log(manifest);
  }
};

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  switch (command) {
    case "snapshot":
      await runSnapshot(flags);
      return;
    case "latest":
      await runLatest();
      return;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      usage();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
};

main().catch((error) => {
  console.error(`context-rescue failed: ${error.message}`);
  process.exit(1);
});
