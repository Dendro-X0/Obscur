#!/usr/bin/env node
/**
 * Append a capture row to docs/handoffs/v2-perf-baseline.md from an S0 JSON artifact.
 *
 * Usage:
 *   node scripts/v2-perf-baseline-record.mjs [path/to/report.json] [--notes "free text"]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBaselineReport, summarizeBaselineReport } from "./obscur-shell-perf-baseline-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const handoffPath = path.join(repoRoot, "docs", "handoffs", "v2-perf-baseline.md");
const defaultJson = path.join(repoRoot, "docs", "assets", "perf", "v2-static-prod.json");

const args = process.argv.slice(2);
const notesFlagIndex = args.indexOf("--notes");
const notes = notesFlagIndex >= 0 ? args[notesFlagIndex + 1] ?? "" : "";
const jsonPath = args.find((arg) => !arg.startsWith("--") && arg !== notes) ?? defaultJson;

if (!fs.existsSync(jsonPath)) {
  console.error(`Missing report: ${jsonPath}`);
  process.exit(1);
}

const report = parseBaselineReport(JSON.parse(fs.readFileSync(jsonPath, "utf8")));
const summary = summarizeBaselineReport(report);
const rapidGate = report.checks?.rapidNav?.gatePass;
const rapidLabel = typeof rapidGate === "boolean" ? (rapidGate ? "pass" : "fail") : "—";
const artifactRel = path.relative(repoRoot, jsonPath).split(path.sep).join("/");

const row = [
  report.recordedAt.slice(0, 19).replace("T", " "),
  report.mode === "prod" ? "static export" : "dev webpack",
  summary.coldStartDomMs ?? "—",
  summary.shellPhase ?? "—",
  summary.medianNavMs ?? "—",
  summary.maxNavMs ?? "—",
  summary.maxRouteMountWorstMs ?? "—",
  rapidLabel,
  artifactRel,
  notes || (report.warnings?.[0] ?? ""),
].join(" | ");

const placeholder = "| _pending first run_ |";
const markdown = fs.readFileSync(handoffPath, "utf8");
if (!markdown.includes(placeholder)) {
  console.error("Could not find placeholder row in v2-perf-baseline.md");
  process.exit(1);
}

const updated = markdown.replace(
  placeholder,
  `| ${row} |\n| _pending first run_ |`,
);
fs.writeFileSync(handoffPath, updated, "utf8");
console.log(`Appended row to ${handoffPath}`);
console.log(row);
