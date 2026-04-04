#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const handoffPath = path.join(repoRoot, "docs", "handoffs", "current-session.md");
const checkpointsStart = "<!-- CONTEXT_CHECKPOINTS_START -->";
const checkpointsEnd = "<!-- CONTEXT_CHECKPOINTS_END -->";

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

const usage = () => {
  console.log(`Usage:
  node scripts/context-handoff.mjs init [--owner "..."] [--objective "..."]
  node scripts/context-handoff.mjs checkpoint --summary "..." --next "..." [--evidence "..."] [--uncertainty "..."] [--status "..."] [--owner "..."]
  node scripts/context-handoff.mjs show
`);
};

const parseFlags = (args) => {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractSection = (markdown, heading) => {
  const pattern = new RegExp(
    `${escapeRegExp(heading)}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`,
    "m",
  );
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
};

const buildInitialHandoff = ({ owner, objective }) => {
  const timestamp = nowIso();
  return `# Current Session Handoff

- Last Updated (UTC): ${timestamp}
- Session Status: in-progress
- Active Owner: ${owner}

## Active Objective

${objective}

## Current Snapshot

- What is true now:
- What changed in this thread:

## Evidence

- Not recorded yet.

## Changed Files

- None yet.

## Open Risks Or Blockers

- None recorded.

## Next Atomic Step

Define the next concrete action.

## Next Thread Bootstrap Prompt

\`\`\`text
Read AGENTS.md, docs/08-maintainer-playbook.md, and docs/handoffs/current-session.md.
Resume from the Next Atomic Step exactly.
Keep edits scoped to that step and update docs/handoffs/current-session.md before finishing.
\`\`\`

## Checkpoints

${checkpointsStart}
### ${timestamp} checkpoint
- Summary: initialized session handoff document.
- Evidence: no commands run yet.
- Uncertainty: objective and next step still need refinement.
- Next: refine objective and begin implementation.
${checkpointsEnd}
`;
};

const ensureHandoffExists = async (flags) => {
  try {
    await fs.access(handoffPath);
  } catch {
    await fs.mkdir(path.dirname(handoffPath), { recursive: true });
    const seed = buildInitialHandoff({
      owner: flags.owner ?? "unassigned",
      objective: flags.objective ?? "Define objective for this session.",
    });
    await fs.writeFile(handoffPath, seed, "utf8");
  }
};

const replaceMetadataLine = (text, prefix, value) => {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}.*$`, "m");
  return text.replace(pattern, `${prefix}${value}`);
};

const replaceSection = (text, heading, body) => {
  const pattern = new RegExp(
    `(${escapeRegExp(heading)}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |$)`,
    "m",
  );
  return text.replace(pattern, `$1${body.trim()}\n`);
};

const appendCheckpoint = (text, block) => {
  const startIndex = text.indexOf(checkpointsStart);
  const endIndex = text.indexOf(checkpointsEnd);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `Checkpoint markers are missing in ${path.relative(repoRoot, handoffPath)}.`,
    );
  }

  const beforeEnd = text.slice(0, endIndex).trimEnd();
  const afterEnd = text.slice(endIndex);
  return `${beforeEnd}\n${block}\n${afterEnd}`;
};

const printShow = (text) => {
  const lastUpdated = (text.match(/^- Last Updated \(UTC\): (.+)$/m) ?? [])[1] ?? "unknown";
  const status = (text.match(/^- Session Status: (.+)$/m) ?? [])[1] ?? "unknown";
  const owner = (text.match(/^- Active Owner: (.+)$/m) ?? [])[1] ?? "unknown";
  const objective = extractSection(text, "## Active Objective");
  const next = extractSection(text, "## Next Atomic Step");

  const checkpointMatches = [...text.matchAll(/^### (.+) checkpoint$/gm)]
    .map((match) => match[1])
    .slice(-5);

  console.log(`Current Session Handoff
Last Updated (UTC): ${lastUpdated}
Status: ${status}
Owner: ${owner}

Active Objective:
${objective || "not set"}

Next Atomic Step:
${next || "not set"}

Recent Checkpoints:
${checkpointMatches.length > 0 ? checkpointMatches.map((item) => `- ${item}`).join("\n") : "- none"}
`);
};

const runInit = async (flags) => {
  await fs.mkdir(path.dirname(handoffPath), { recursive: true });

  if (flags.force !== "true") {
    try {
      await fs.access(handoffPath);
      console.log(
        `${path.relative(repoRoot, handoffPath)} already exists. Use --force to overwrite.`,
      );
      return;
    } catch {
      // File does not exist; proceed.
    }
  }

  const content = buildInitialHandoff({
    owner: flags.owner ?? "context continuity system",
    objective:
      flags.objective ??
      "Establish a durable handoff record for cross-thread continuity.",
  });
  await fs.writeFile(handoffPath, content, "utf8");
  console.log(`Initialized ${path.relative(repoRoot, handoffPath)}.`);
};

const runCheckpoint = async (flags) => {
  const summary = flags.summary;
  const next = flags.next;
  if (!summary || !next) {
    throw new Error("checkpoint requires --summary and --next.");
  }

  await ensureHandoffExists(flags);
  let text = await fs.readFile(handoffPath, "utf8");

  text = replaceMetadataLine(text, "- Last Updated (UTC): ", nowIso());
  if (flags.status) {
    text = replaceMetadataLine(text, "- Session Status: ", flags.status);
  }
  if (flags.owner) {
    text = replaceMetadataLine(text, "- Active Owner: ", flags.owner);
  }

  text = replaceSection(text, "## Next Atomic Step", next);

  const timestamp = nowIso();
  const checkpoint = `### ${timestamp} checkpoint
- Summary: ${summary}
- Evidence: ${flags.evidence ?? "not provided"}
- Uncertainty: ${flags.uncertainty ?? "not provided"}
- Next: ${next}`;

  text = appendCheckpoint(text, checkpoint);
  await fs.writeFile(handoffPath, text, "utf8");
  console.log(`Checkpoint appended to ${path.relative(repoRoot, handoffPath)}.`);
};

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  switch (command) {
    case "init":
      await runInit(flags);
      return;
    case "checkpoint":
      await runCheckpoint(flags);
      return;
    case "show": {
      await ensureHandoffExists(flags);
      const text = await fs.readFile(handoffPath, "utf8");
      printShow(text);
      return;
    }
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
  console.error(`context-handoff failed: ${error.message}`);
  process.exit(1);
});
