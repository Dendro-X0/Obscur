#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const packetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.3.0");
const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");

const requiredFiles = [
  "README.md",
  "manual-verification-checklist.md",
  "gif-shot-list.md",
  "runtime-evidence-summary.json",
  "raw/README.md",
  "raw/m10-v130-release-candidate-capture.json",
  "gifs/README.md",
];

const readUtf8 = async (relativePath) => {
  const fullPath = path.join(packetDir, relativePath);
  return fs.readFile(fullPath, "utf8");
};

const readJson = async (relativePath) => JSON.parse(await readUtf8(relativePath));

const exists = async (relativePath) => {
  const fullPath = path.join(packetDir, relativePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
};

const asBool = (value) => typeof value === "boolean";

const main = async () => {
  const errors = [];

  for (const relativePath of requiredFiles) {
    if (!(await exists(relativePath))) {
      errors.push(`missing required file: docs/assets/demo/v1.3.0/${relativePath}`);
    }
  }

  if (errors.length > 0) {
    console.error("[v130:packet:check] failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const checklist = await readUtf8("manual-verification-checklist.md");
  const shotList = await readUtf8("gif-shot-list.md");
  const readme = await readUtf8("README.md");
  const summary = await readJson("runtime-evidence-summary.json");

  if (!readme.startsWith("# ")) {
    errors.push("README.md must start with a markdown heading");
  }
  if (!checklist.startsWith("# ")) {
    errors.push("manual-verification-checklist.md must start with a markdown heading");
  }
  if (!shotList.startsWith("# ")) {
    errors.push("gif-shot-list.md must start with a markdown heading");
  }

  const checklistRequiredSections = [
    "## Runtime and Auth",
    "## Messaging and Groups",
    "## Media and Search",
    "## Performance and UX",
    "## Final Manual Verdict",
  ];
  for (const marker of checklistRequiredSections) {
    if (!checklist.includes(marker)) {
      errors.push(`manual-verification-checklist.md missing section: ${marker}`);
    }
  }

  if (!Array.isArray(summary?.gifAssets)) {
    errors.push("runtime-evidence-summary.json gifAssets must be an array");
  }
  if (!summary?.closeoutGates || typeof summary.closeoutGates !== "object") {
    errors.push("runtime-evidence-summary.json closeoutGates block missing");
  }
  if (!summary?.manualVerification || typeof summary.manualVerification !== "object") {
    errors.push("runtime-evidence-summary.json manualVerification block missing");
  }
  if (!summary?.performanceUx || typeof summary.performanceUx !== "object") {
    errors.push("runtime-evidence-summary.json performanceUx block missing");
  }

  if (strict) {
    const gateKeys = ["rcStrictReady", "closeoutCheckPassed", "releasePreflightPassed"];
    for (const gateKey of gateKeys) {
      if (summary?.closeoutGates?.[gateKey] !== true) {
        errors.push(`runtime-evidence-summary closeoutGates.${gateKey} must be true in strict mode`);
      }
    }
    if (summary?.manualVerification?.pass !== true) {
      errors.push("runtime-evidence-summary manualVerification.pass must be true in strict mode");
    }
    if (summary?.performanceUx?.pass !== true) {
      errors.push("runtime-evidence-summary performanceUx.pass must be true in strict mode");
    }
    if (!Array.isArray(summary?.gifAssets) || summary.gifAssets.length < 1) {
      errors.push("runtime-evidence-summary gifAssets must include at least one GIF in strict mode");
    } else {
      for (const item of summary.gifAssets) {
        if (typeof item !== "string" || item.trim().length === 0) {
          errors.push("runtime-evidence-summary gifAssets entries must be non-empty strings");
          continue;
        }
        const normalized = item.replaceAll("\\", "/");
        if (!normalized.startsWith("gifs/")) {
          errors.push(`gifAssets entry must be under gifs/: ${item}`);
          continue;
        }
        if (!(await exists(normalized))) {
          errors.push(`gif asset missing from packet: docs/assets/demo/v1.3.0/${normalized}`);
        }
      }
    }
    if (checklist.includes("- [ ]")) {
      errors.push("manual-verification-checklist.md still contains unchecked items in strict mode");
    }
  } else {
    if (!asBool(summary?.closeoutGates?.rcStrictReady) && summary?.closeoutGates?.rcStrictReady !== null) {
      errors.push("runtime-evidence-summary closeoutGates.rcStrictReady must be boolean or null");
    }
  }

  if (errors.length > 0) {
    console.error(`[v130:packet:check] failed (${strict ? "strict" : "structure"})`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`[v130:packet:check] ok (${strict ? "strict" : "structure"}) docs/assets/demo/v1.3.0`);
};

main().catch((error) => {
  console.error("[v130:packet:check] crashed:", error);
  process.exit(1);
});
