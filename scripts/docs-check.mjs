#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs");

const isLikelyFileRef = (value) =>
  /^(apps|packages|docs|scripts|infra)\//.test(value) ||
  value.startsWith("README.md") ||
  value.startsWith("CHANGELOG.md") ||
  value.startsWith("package.json") ||
  value.startsWith("pnpm-workspace.yaml");

const cleanTarget = (target) => {
  const noAnchor = target.split("#")[0];
  const noQuery = noAnchor.split("?")[0];
  return noQuery.trim();
};

const exists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const walkMarkdownFiles = async (dir) => {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "archive") continue; // legacy docs are informational only
      out.push(...(await walkMarkdownFiles(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
};

const collectMarkdownLinks = (content) => {
  const links = [];
  const mdLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
};

const collectCodePathRefs = (content) => {
  const refs = [];
  const codeRefRegex = /`([^`\n]+)`/g;
  let match;
  while ((match = codeRefRegex.exec(content)) !== null) {
    const candidate = match[1].trim();
    if (isLikelyFileRef(candidate)) refs.push(candidate);
  }
  return refs;
};

const main = async () => {
  const markdownFiles = await walkMarkdownFiles(docsRoot);
  const errors = [];
  const reviewedStampRegex =
    /^_Last reviewed: \d{4}-\d{2}-\d{2} \(baseline commit [0-9a-f]{7,}\)\._$/m;

  for (const mdFile of markdownFiles) {
    const text = await fs.readFile(mdFile, "utf8");
    const relDoc = path.relative(repoRoot, mdFile).replaceAll("\\", "/");
    const filename = path.basename(mdFile);
    const firstNonEmpty = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";

    if (!firstNonEmpty.startsWith("# ")) {
      errors.push(`[missing-title-heading] ${relDoc}`);
    }

    if (/^\d{2}-.*\.md$/.test(filename) && !reviewedStampRegex.test(text)) {
      errors.push(`[missing-last-reviewed-stamp] ${relDoc}`);
    }

    // control characters (except tab/newline/carriage return)
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
      errors.push(`[control-chars] ${relDoc}`);
    }

    for (const link of collectMarkdownLinks(text)) {
      if (/^(https?:|mailto:|#)/i.test(link)) continue;
      const target = cleanTarget(link);
      if (!target) continue;
      const resolved = path.resolve(path.dirname(mdFile), target);
      if (!(await exists(resolved))) {
        errors.push(`[broken-link] ${relDoc} -> ${link}`);
      }
    }

    for (const ref of collectCodePathRefs(text)) {
      if (ref.includes("*")) continue;
      if (ref.includes("`r") || ref.includes("\u0007") || ref.includes("\b")) {
        errors.push(`[encoding-garbage] ${relDoc} -> ${JSON.stringify(ref)}`);
        continue;
      }
      const resolved = path.resolve(repoRoot, ref);
      if (!(await exists(resolved))) {
        errors.push(`[stale-path-ref] ${relDoc} -> ${ref}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("docs-check failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`docs-check passed (${markdownFiles.length} markdown files checked).`);
};

main().catch((error) => {
  console.error("docs-check crashed:", error);
  process.exit(1);
});
