#!/usr/bin/env node
/**
 * Append a dev-vs-static compare summary to docs/handoffs/v2-perf-baseline.md.
 *
 * Usage:
 *   node scripts/v2-perf-baseline-compare-record.mjs [comparison.json] [--notes "text"]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const handoffPath = path.join(repoRoot, "docs", "handoffs", "v2-perf-baseline.md");
const defaultJson = path.join(repoRoot, "docs", "assets", "perf", "v2-comparison.json");

const args = process.argv.slice(2);
const notesFlagIndex = args.indexOf("--notes");
const notes = notesFlagIndex >= 0 ? args[notesFlagIndex + 1] ?? "" : "";
const jsonPath = args.find((arg) => !arg.startsWith("--") && arg !== notes) ?? defaultJson;

if (!fs.existsSync(jsonPath)) {
  console.error(`Missing comparison: ${jsonPath}`);
  process.exit(1);
}

const comparison = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const placeholder = "| _pending compare_ |";
const markdown = fs.readFileSync(handoffPath, "utf8");

if (!markdown.includes("## Compare log")) {
  console.error("v2-perf-baseline.md missing ## Compare log section");
  process.exit(1);
}

if (!markdown.includes(placeholder)) {
  console.error("Could not find compare placeholder row");
  process.exit(1);
}

const row = [
  (comparison.comparedAt ?? new Date().toISOString()).slice(0, 19).replace("T", " "),
  comparison.verdict ?? "—",
  comparison.dev?.medianNavMs ?? "—",
  comparison.prod?.medianNavMs ?? "—",
  comparison.devToProdMedianRatio ?? "—",
  comparison.settingsCompileSignal ? "yes" : "no",
  path.relative(repoRoot, jsonPath).split(path.sep).join("/"),
  notes || comparison.rationale || "",
].join(" | ");

const updated = markdown.replace(
  placeholder,
  `| ${row} |\n| _pending compare_ |`,
);
fs.writeFileSync(handoffPath, updated, "utf8");
console.log(`Appended compare row to ${handoffPath}`);
console.log(row);
