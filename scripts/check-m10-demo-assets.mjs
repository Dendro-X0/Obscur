#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const assetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.4");
const args = new Set(process.argv.slice(2));
const structureOnly = args.has("--structure-only");

const requiredFiles = [
  "m10-cp3-readiness-pass.json",
  "m10-cp3-suite-pass.json",
  "m10-cp4-closeout-pass.json",
  "m10-v130-closeout-pass.json",
  "m10-v130-evidence-pass.json",
  "m10-digest-summary.json",
  "m10-event-slices.json",
  "m10-demo-storyboard.md",
];

const gateSpecs = [
  { file: "m10-cp3-readiness-pass.json", path: "cp3ReadinessGate.pass" },
  { file: "m10-cp3-suite-pass.json", path: "cp3SuiteGate.pass" },
  { file: "m10-cp4-closeout-pass.json", path: "cp4CloseoutGate.pass" },
  { file: "m10-v130-closeout-pass.json", path: "v130CloseoutGate.pass" },
  { file: "m10-v130-evidence-pass.json", path: "v130EvidenceGate.pass" },
];

const eventSliceKeys = [
  "cp2",
  "cp3Readiness",
  "cp3Suite",
  "cp4Closeout",
  "v130Closeout",
  "v130Evidence",
];

const readJson = async (filename) => {
  const fullPath = path.join(assetDir, filename);
  const text = await fs.readFile(fullPath, "utf8");
  return JSON.parse(text);
};

const getAtPath = (value, dottedPath) => dottedPath
  .split(".")
  .reduce((current, key) => (
    current && typeof current === "object" ? current[key] : undefined
  ), value);

const main = async () => {
  const errors = [];

  for (const filename of requiredFiles) {
    const fullPath = path.join(assetDir, filename);
    try {
      await fs.access(fullPath);
    } catch {
      errors.push(`missing required file: docs/assets/demo/v1.2.4/${filename}`);
    }
  }

  if (errors.length > 0) {
    console.error("[demo:check] failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  for (const spec of gateSpecs) {
    const payload = await readJson(spec.file);
    const gate = getAtPath(payload, spec.path);
    if (structureOnly) {
      if (gate !== true && gate !== false && gate !== null) {
        errors.push(`${spec.file} -> ${spec.path} must be boolean or null`);
      }
      continue;
    }
    if (gate !== true) {
      errors.push(`${spec.file} -> ${spec.path} must be true for strict verification`);
    }
  }

  const digestSummary = await readJson("m10-digest-summary.json");
  const trustControlsSummary = digestSummary?.summary?.m10TrustControls;
  if (structureOnly) {
    if (!("summary" in digestSummary)) {
      errors.push("m10-digest-summary.json missing summary block");
    }
  } else if (trustControlsSummary == null) {
    errors.push("m10-digest-summary.json requires summary.m10TrustControls to be non-null");
  }

  const eventSlices = await readJson("m10-event-slices.json");
  for (const key of eventSliceKeys) {
    const bucket = eventSlices?.events?.[key];
    if (!Array.isArray(bucket)) {
      errors.push(`m10-event-slices.json events.${key} must be an array`);
      continue;
    }
    if (!structureOnly && bucket.length < 1) {
      errors.push(`m10-event-slices.json events.${key} must contain at least one event`);
    }
  }

  if (!Array.isArray(eventSlices?.recentWarnOrError)) {
    errors.push("m10-event-slices.json recentWarnOrError must be an array");
  }

  const storyboardPath = path.join(assetDir, "m10-demo-storyboard.md");
  const storyboard = await fs.readFile(storyboardPath, "utf8");
  if (!storyboard.startsWith("# ")) {
    errors.push("m10-demo-storyboard.md must start with a Markdown title");
  }

  if (errors.length > 0) {
    console.error("[demo:check] failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(
    `[demo:check] ok (${structureOnly ? "structure-only" : "strict"}) docs/assets/demo/v1.2.4`,
  );
};

main().catch((error) => {
  console.error("[demo:check] crashed:", error);
  process.exit(1);
});
