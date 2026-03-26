#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const defaultTargetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.5");

const args = process.argv.slice(2);

const parseArgs = (argv) => {
  const parsed = {
    targetDir: defaultTargetDir,
    capturePath: null,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      continue;
    }
    const value = argv[index + 1];
    if (token === "--target-dir") {
      parsed.targetDir = path.resolve(repoRoot, value ?? "");
      index += 1;
      continue;
    }
    if (token === "--capture") {
      parsed.capturePath = path.resolve(repoRoot, value ?? "");
      index += 1;
      continue;
    }
    if (token === "--help") {
      parsed.help = true;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }
  return parsed;
};

const usage = [
  "Usage:",
  "  node scripts/materialize-m10-release-candidate-assets.mjs --capture <path> [--target-dir <path>]",
  "",
  "Required:",
  "  --capture        Path to JSON from window.obscurM10TrustControls.runV130ReleaseCandidateCaptureStabilizedJson(...)",
  "",
  "Optional:",
  "  --target-dir     Output folder (default: docs/assets/demo/v1.2.5)",
].join("\n");

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const toPositiveInteger = (value, fallback) => {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  const intValue = Math.floor(value);
  return intValue > 0 ? intValue : fallback;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const readJson = async (fullPath) => {
  const text = await fs.readFile(fullPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`capture is not valid JSON (${fullPath}): ${String(error)}`);
  }
};

const writeJson = async (fullPath, payload) => {
  await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const main = async () => {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(usage);
    return;
  }
  if (!parsed.capturePath) {
    throw new Error(`--capture is required\n\n${usage}`);
  }

  const capture = await readJson(parsed.capturePath);
  if (!isRecord(capture)) {
    throw new Error("capture root must be a JSON object");
  }
  if (!isRecord(capture.releaseCandidateGate)) {
    throw new Error("capture missing releaseCandidateGate");
  }

  const generatedAtUnixMs = isFiniteNumber(capture.generatedAtUnixMs) ? capture.generatedAtUnixMs : Date.now();
  const eventWindowSize = toPositiveInteger(capture.eventWindowSize, 400);
  const expectedStable = typeof capture.expectedStable === "boolean" ? capture.expectedStable : true;

  const digestSummaryPayload = {
    summary: {
      incomingRequestAntiAbuse: capture?.digestSummaryAfterV130EvidenceEvent?.incomingRequestAntiAbuse ?? null,
      uiResponsiveness: capture?.digestSummaryAfterV130EvidenceEvent?.uiResponsiveness ?? null,
      m10TrustControls: capture?.digestSummaryAfterV130EvidenceEvent?.m10TrustControls ?? null,
    },
  };

  const rawEvents = isRecord(capture?.eventSlices?.events) ? capture.eventSlices.events : {};
  const eventSlicesPayload = {
    events: {
      cp2: toArray(rawEvents.cp2),
      cp3Readiness: toArray(rawEvents.cp3Readiness),
      cp3Suite: toArray(rawEvents.cp3Suite),
      cp4Closeout: toArray(rawEvents.cp4Closeout),
      v130Closeout: toArray(rawEvents.v130Closeout),
      v130Evidence: toArray(rawEvents.v130Evidence),
      v130ReleaseCandidate: toArray(rawEvents.v130ReleaseCandidate),
    },
    recentWarnOrError: toArray(capture?.eventSlices?.recentWarnOrError),
  };

  const releaseCandidatePassPayload = {
    generatedAtUnixMs,
    eventWindowSize,
    expectedStable,
    releaseCandidateGate: capture.releaseCandidateGate,
  };

  const targetDir = parsed.targetDir;
  await fs.mkdir(targetDir, { recursive: true });

  const writes = [
    ["m10-v130-release-candidate-pass.json", releaseCandidatePassPayload],
    ["m10-v130-release-candidate-capture.json", capture],
    ["m10-digest-summary.json", digestSummaryPayload],
    ["m10-event-slices.json", eventSlicesPayload],
  ];
  for (const [filename, payload] of writes) {
    await writeJson(path.join(targetDir, filename), payload);
  }

  const warnings = [];
  const isEmptyBucket = (bucket) => !Array.isArray(bucket) || bucket.length < 1;
  if (isEmptyBucket(eventSlicesPayload.events.cp2)) {
    warnings.push("events.cp2 is empty (strict gate will fail until cp2 events are captured)");
  }
  if (isEmptyBucket(eventSlicesPayload.events.cp3Readiness)) {
    warnings.push("events.cp3Readiness is empty (strict gate will fail until cp3 readiness events are captured)");
  }
  if (isEmptyBucket(eventSlicesPayload.events.cp3Suite)) {
    warnings.push("events.cp3Suite is empty (strict gate will fail until cp3 suite events are captured)");
  }
  if (isEmptyBucket(eventSlicesPayload.events.cp4Closeout)) {
    warnings.push("events.cp4Closeout is empty (strict gate will fail until cp4 closeout events are captured)");
  }
  if (isEmptyBucket(eventSlicesPayload.events.v130Closeout)) {
    warnings.push("events.v130Closeout is empty (strict gate will fail until v130 closeout events are captured)");
  }
  if (isEmptyBucket(eventSlicesPayload.events.v130Evidence)) {
    warnings.push("events.v130Evidence is empty (strict gate will fail until v130 evidence events are captured)");
  }
  if (isEmptyBucket(eventSlicesPayload.events.v130ReleaseCandidate)) {
    warnings.push("events.v130ReleaseCandidate is empty (strict gate will fail until release-candidate events are captured)");
  }

  console.log(`[demo:rc:materialize] wrote ${writes.length} file(s) to ${path.relative(repoRoot, targetDir)}`);
  console.log("[demo:rc:materialize] next:");
  console.log("- pnpm demo:m10:rc:check:structure");
  console.log("- pnpm demo:m10:rc:check");

  if (warnings.length > 0) {
    console.warn("[demo:rc:materialize] warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
};

main().catch((error) => {
  console.error("[demo:rc:materialize] failed:", error.message ?? error);
  process.exit(1);
});
