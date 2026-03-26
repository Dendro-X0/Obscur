#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const assetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.5");
const args = new Set(process.argv.slice(2));
const structureOnly = args.has("--structure-only");
const emitReport = args.has("--report");
const reportPath = path.join(assetDir, "m10-status.json");

const requiredFiles = [
  "m10-v130-release-candidate-pass.json",
  "m10-v130-release-candidate-capture.json",
  "m10-digest-summary.json",
  "m10-event-slices.json",
  "m10-demo-storyboard.md",
];

const gateSpecs = [
  { file: "m10-v130-release-candidate-pass.json", path: "releaseCandidateGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "cp2TriageCapture.cp2TriageGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "v130EvidenceCapture.v130CloseoutCapture.cp4CloseoutCapture.cp3SuiteCapture.cp3ReadinessCapture.cp3ReadinessGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "v130EvidenceCapture.v130CloseoutCapture.cp4CloseoutCapture.cp3SuiteCapture.cp3SuiteGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "v130EvidenceCapture.v130CloseoutCapture.cp4CloseoutCapture.cp4CloseoutGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "v130EvidenceCapture.v130CloseoutCapture.v130CloseoutGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "v130EvidenceCapture.v130EvidenceGate.pass" },
  { file: "m10-v130-release-candidate-capture.json", path: "releaseCandidateGate.pass" },
];

const eventSliceKeys = [
  "cp2",
  "cp3Readiness",
  "cp3Suite",
  "cp4Closeout",
  "v130Closeout",
  "v130Evidence",
  "v130ReleaseCandidate",
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
  const checks = [];
  const strictViolations = [];

  const addCheck = (name, pass, detail = null) => {
    checks.push({ name, pass, detail });
    if (!pass) {
      errors.push(detail ? `${name}: ${detail}` : name);
    }
  };
  const addStrictViolation = (name, detail) => {
    strictViolations.push({ name, detail });
  };

  for (const filename of requiredFiles) {
    const fullPath = path.join(assetDir, filename);
    try {
      await fs.access(fullPath);
      addCheck(`required_file:${filename}`, true);
    } catch {
      addCheck(
        `required_file:${filename}`,
        false,
        `missing required file: docs/assets/demo/v1.2.5/${filename}`,
      );
    }
  }

  const missingRequiredFiles = checks.some((check) => !check.pass && check.name.startsWith("required_file:"));
  if (missingRequiredFiles) {
    if (emitReport) {
      const report = {
        generatedAtUnixMs: Date.now(),
        structureOnly,
        ready: false,
        strictReady: false,
        errors,
        strictViolations,
        checks,
      };
      await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      console.log(`[demo:rc:check] wrote report: ${path.relative(repoRoot, reportPath)}`);
    }
    console.error("[demo:rc:check] failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  for (const spec of gateSpecs) {
    const payload = await readJson(spec.file);
    const gate = getAtPath(payload, spec.path);
    if (structureOnly) {
      if (gate !== true && gate !== false && gate !== null) {
        addCheck(
          `gate_shape:${spec.file}:${spec.path}`,
          false,
          `${spec.file} -> ${spec.path} must be boolean or null`,
        );
      } else {
        addCheck(`gate_shape:${spec.file}:${spec.path}`, true);
      }
      if (gate !== true) {
        addStrictViolation(
          `gate_strict:${spec.file}:${spec.path}`,
          `${spec.file} -> ${spec.path} should be true for strict verification`,
        );
      }
      continue;
    }
    if (gate !== true) {
      addCheck(
        `gate_strict:${spec.file}:${spec.path}`,
        false,
        `${spec.file} -> ${spec.path} must be true for strict verification`,
      );
      addStrictViolation(
        `gate_strict:${spec.file}:${spec.path}`,
        `${spec.file} -> ${spec.path} must be true for strict verification`,
      );
    } else {
      addCheck(`gate_strict:${spec.file}:${spec.path}`, true);
    }
  }

  const digestSummary = await readJson("m10-digest-summary.json");
  const trustControlsSummary = digestSummary?.summary?.m10TrustControls;
  if (structureOnly) {
    if (!("summary" in digestSummary)) {
      addCheck(
        "digest_summary_shape",
        false,
        "m10-digest-summary.json missing summary block",
      );
    } else {
      addCheck("digest_summary_shape", true);
    }
    if (trustControlsSummary == null) {
      addStrictViolation(
        "digest_summary_strict",
        "m10-digest-summary.json requires summary.m10TrustControls to be non-null",
      );
    }
  } else if (trustControlsSummary == null) {
    addCheck(
      "digest_summary_strict",
      false,
      "m10-digest-summary.json requires summary.m10TrustControls to be non-null",
    );
  } else {
    addCheck("digest_summary_strict", true);
  }

  const eventSlices = await readJson("m10-event-slices.json");
  for (const key of eventSliceKeys) {
    const bucket = eventSlices?.events?.[key];
    if (!Array.isArray(bucket)) {
      addCheck(
        `event_slice_shape:${key}`,
        false,
        `m10-event-slices.json events.${key} must be an array`,
      );
      continue;
    }
    addCheck(`event_slice_shape:${key}`, true);
    if (!structureOnly && bucket.length < 1) {
      addCheck(
        `event_slice_strict:${key}`,
        false,
        `m10-event-slices.json events.${key} must contain at least one event`,
      );
      addStrictViolation(
        `event_slice_strict:${key}`,
        `m10-event-slices.json events.${key} must contain at least one event`,
      );
    } else if (!structureOnly) {
      addCheck(`event_slice_strict:${key}`, true);
    } else if (bucket.length < 1) {
      addStrictViolation(
        `event_slice_strict:${key}`,
        `m10-event-slices.json events.${key} should contain at least one event`,
      );
    }
  }

  if (!Array.isArray(eventSlices?.recentWarnOrError)) {
    addCheck(
      "recent_warn_or_error_shape",
      false,
      "m10-event-slices.json recentWarnOrError must be an array",
    );
  } else {
    addCheck("recent_warn_or_error_shape", true);
  }

  const storyboardPath = path.join(assetDir, "m10-demo-storyboard.md");
  const storyboard = await fs.readFile(storyboardPath, "utf8");
  if (!storyboard.startsWith("# ")) {
    addCheck(
      "storyboard_title",
      false,
      "m10-demo-storyboard.md must start with a Markdown title",
    );
  } else {
    addCheck("storyboard_title", true);
  }

  const strictReady = strictViolations.length === 0;
  const ready = errors.length === 0 && (!structureOnly ? strictReady : true);
  const report = {
    generatedAtUnixMs: Date.now(),
    structureOnly,
    ready,
    strictReady,
    errors,
    strictViolations,
    checks,
  };

  if (emitReport) {
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`[demo:rc:check] wrote report: ${path.relative(repoRoot, reportPath)}`);
  }

  if (errors.length > 0) {
    console.error("[demo:rc:check] failed:");
    errors.forEach((error) => console.error(`- ${error}`));
    if (!structureOnly) {
      console.error("- action: recapture release-candidate JSON assets via docs/35 matrix commands");
    }
    process.exit(1);
  }

  console.log(
    `[demo:rc:check] ok (${structureOnly ? "structure-only" : "strict"}) docs/assets/demo/v1.2.5`,
  );
};

main().catch((error) => {
  console.error("[demo:rc:check] crashed:", error);
  process.exit(1);
});
