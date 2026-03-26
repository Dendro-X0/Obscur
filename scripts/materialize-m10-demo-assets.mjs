#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const defaultTargetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.4");

const args = process.argv.slice(2);

const parseArgs = (argv) => {
  const parsed = {
    targetDir: defaultTargetDir,
    v130EvidencePath: null,
    digestBundlePath: null,
    bundlePath: null,
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
    if (token === "--v130-evidence") {
      parsed.v130EvidencePath = path.resolve(repoRoot, value ?? "");
      index += 1;
      continue;
    }
    if (token === "--digest-bundle") {
      parsed.digestBundlePath = path.resolve(repoRoot, value ?? "");
      index += 1;
      continue;
    }
    if (token === "--bundle") {
      parsed.bundlePath = path.resolve(repoRoot, value ?? "");
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
  "  node scripts/materialize-m10-demo-assets.mjs --bundle <path> [--target-dir <path>]",
  "  node scripts/materialize-m10-demo-assets.mjs --v130-evidence <path> [--digest-bundle <path>] [--target-dir <path>]",
  "",
  "Required:",
  "  Either --bundle OR --v130-evidence.",
  "",
  "Bundle mode:",
  "  --bundle          Path to JSON from window.obscurM10TrustControls.runV124DemoAssetBundleCaptureJson(...)",
  "",
  "Split mode:",
  "  --v130-evidence   Path to JSON from window.obscurM10TrustControls.runV130EvidenceCaptureJson(...)",
  "",
  "Optional:",
  "  --digest-bundle   Path to JSON digest bundle captured from docs/34 matrix command",
  "  --target-dir      Output folder (default: docs/assets/demo/v1.2.4)",
].join("\n");

const readJson = async (fullPath, label) => {
  const text = await fs.readFile(fullPath, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON (${fullPath}): ${String(error)}`);
  }
};

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isBoolean = (value) => typeof value === "boolean";
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const pickAtPath = (value, dottedPath) => dottedPath
  .split(".")
  .reduce((current, key) => (isRecord(current) ? current[key] : undefined), value);

const toRecordOrNull = (value) => (isRecord(value) ? value : null);

const toPositiveInteger = (value, fallback) => {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  const intValue = Math.floor(value);
  return intValue > 0 ? intValue : fallback;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const buildGatePayload = (capture, gateKey) => {
  const generatedAtUnixMs = isFiniteNumber(capture.generatedAtUnixMs)
    ? capture.generatedAtUnixMs
    : Date.now();
  const eventWindowSize = toPositiveInteger(capture.eventWindowSize, 400);
  const expectedStable = isBoolean(capture.expectedStable) ? capture.expectedStable : true;
  const gate = isRecord(capture[gateKey]) ? capture[gateKey] : {
    pass: null,
    failedChecks: [],
    failedCheckSample: null,
  };
  return {
    generatedAtUnixMs,
    eventWindowSize,
    expectedStable,
    [gateKey]: gate,
  };
};

const normalizeBundlePayload = (bundlePayload, warnings) => {
  if (!isRecord(bundlePayload)) {
    throw new Error("bundle root must be a JSON object");
  }
  const demoAssets = isRecord(bundlePayload.demoAssets) ? bundlePayload.demoAssets : null;
  if (!demoAssets) {
    throw new Error("bundle payload missing demoAssets object");
  }

  const cp3ReadinessPayload = isRecord(demoAssets.cp3ReadinessPass)
    ? demoAssets.cp3ReadinessPass
    : buildGatePayload({}, "cp3ReadinessGate");
  if (!isRecord(demoAssets.cp3ReadinessPass)) {
    warnings.push("bundle demoAssets.cp3ReadinessPass missing; using null fallback payload");
  }

  const cp3SuitePayload = isRecord(demoAssets.cp3SuitePass)
    ? demoAssets.cp3SuitePass
    : buildGatePayload({}, "cp3SuiteGate");
  if (!isRecord(demoAssets.cp3SuitePass)) {
    warnings.push("bundle demoAssets.cp3SuitePass missing; using null fallback payload");
  }

  const cp4CloseoutPayload = isRecord(demoAssets.cp4CloseoutPass)
    ? demoAssets.cp4CloseoutPass
    : buildGatePayload({}, "cp4CloseoutGate");
  if (!isRecord(demoAssets.cp4CloseoutPass)) {
    warnings.push("bundle demoAssets.cp4CloseoutPass missing; using null fallback payload");
  }

  const v130CloseoutPayload = isRecord(demoAssets.v130CloseoutPass)
    ? demoAssets.v130CloseoutPass
    : buildGatePayload({}, "v130CloseoutGate");
  if (!isRecord(demoAssets.v130CloseoutPass)) {
    warnings.push("bundle demoAssets.v130CloseoutPass missing; using null fallback payload");
  }

  const v130EvidencePayload = isRecord(demoAssets.v130EvidencePass)
    ? demoAssets.v130EvidencePass
    : buildGatePayload({}, "v130EvidenceGate");
  if (!isRecord(demoAssets.v130EvidencePass)) {
    warnings.push("bundle demoAssets.v130EvidencePass missing; using null fallback payload");
  }

  const rawDigestSummary = isRecord(demoAssets.digestSummary) ? demoAssets.digestSummary : null;
  const rawSummary = isRecord(rawDigestSummary?.summary) ? rawDigestSummary.summary : {};
  const digestSummaryPayload = {
    summary: {
      incomingRequestAntiAbuse: rawSummary.incomingRequestAntiAbuse ?? null,
      uiResponsiveness: rawSummary.uiResponsiveness ?? null,
      m10TrustControls: rawSummary.m10TrustControls ?? null,
    },
  };
  if (!isRecord(demoAssets.digestSummary)) {
    warnings.push("bundle demoAssets.digestSummary missing; using null summary fallback");
  }

  const rawEventSlices = isRecord(demoAssets.eventSlices) ? demoAssets.eventSlices : null;
  const rawEvents = isRecord(rawEventSlices?.events) ? rawEventSlices.events : {};
  const eventSlicesPayload = {
    events: {
      cp2: toArray(rawEvents.cp2),
      cp3Readiness: toArray(rawEvents.cp3Readiness),
      cp3Suite: toArray(rawEvents.cp3Suite),
      cp4Closeout: toArray(rawEvents.cp4Closeout),
      v130Closeout: toArray(rawEvents.v130Closeout),
      v130Evidence: toArray(rawEvents.v130Evidence),
    },
    recentWarnOrError: toArray(rawEventSlices?.recentWarnOrError),
  };
  if (!isRecord(demoAssets.eventSlices)) {
    warnings.push("bundle demoAssets.eventSlices missing; using empty events fallback");
  }

  return {
    cp3ReadinessPayload,
    cp3SuitePayload,
    cp4CloseoutPayload,
    v130CloseoutPayload,
    v130EvidencePayload,
    digestSummaryPayload,
    eventSlicesPayload,
  };
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
  if (!parsed.bundlePath && !parsed.v130EvidencePath) {
    throw new Error("either --bundle or --v130-evidence is required\n\n" + usage);
  }

  const warnings = [];
  let cp3ReadinessPayload;
  let cp3SuitePayload;
  let cp4CloseoutPayload;
  let v130CloseoutPayload;
  let v130EvidencePayload;
  let digestSummaryPayload;
  let eventSlicesPayload;

  if (parsed.bundlePath) {
    const bundlePayload = await readJson(parsed.bundlePath, "v1.2.4 demo bundle");
    ({
      cp3ReadinessPayload,
      cp3SuitePayload,
      cp4CloseoutPayload,
      v130CloseoutPayload,
      v130EvidencePayload,
      digestSummaryPayload,
      eventSlicesPayload,
    } = normalizeBundlePayload(bundlePayload, warnings));
  } else {
    const v130Evidence = await readJson(parsed.v130EvidencePath, "v130 evidence capture");
    if (!isRecord(v130Evidence)) {
      throw new Error("v130 evidence capture root must be a JSON object");
    }

    const v130CloseoutCapture = toRecordOrNull(pickAtPath(v130Evidence, "v130CloseoutCapture")) ?? {};
    if (!isRecord(pickAtPath(v130Evidence, "v130CloseoutCapture"))) {
      warnings.push("v130CloseoutCapture is missing; v130/cp4/cp3 gate payloads may remain null");
    }

    const cp4CloseoutCapture = toRecordOrNull(pickAtPath(v130CloseoutCapture, "cp4CloseoutCapture")) ?? {};
    if (!isRecord(pickAtPath(v130CloseoutCapture, "cp4CloseoutCapture"))) {
      warnings.push("v130CloseoutCapture.cp4CloseoutCapture is missing; cp4/cp3 gate payloads may remain null");
    }

    const cp3SuiteCapture = toRecordOrNull(pickAtPath(cp4CloseoutCapture, "cp3SuiteCapture")) ?? {};
    if (!isRecord(pickAtPath(cp4CloseoutCapture, "cp3SuiteCapture"))) {
      warnings.push("cp4CloseoutCapture.cp3SuiteCapture is missing; cp3 suite/readiness payloads may remain null");
    }

    const cp3ReadinessCapture = toRecordOrNull(pickAtPath(cp3SuiteCapture, "cp3ReadinessCapture")) ?? {};
    if (!isRecord(pickAtPath(cp3SuiteCapture, "cp3ReadinessCapture"))) {
      warnings.push("cp3SuiteCapture.cp3ReadinessCapture is missing; cp3 readiness gate payload may remain null");
    }

    let digestBundle = null;
    if (parsed.digestBundlePath) {
      digestBundle = await readJson(parsed.digestBundlePath, "digest bundle");
    } else {
      warnings.push(
        "digest bundle not provided; summary/events will be populated from limited v130 capture fallbacks",
      );
    }

    const digestSummary = (
      isRecord(digestBundle?.summary)
        ? digestBundle.summary
        : isRecord(v130Evidence.digestSummaryAfterV130Event)
          ? v130Evidence.digestSummaryAfterV130Event
          : null
    );
    const digestEvents = isRecord(digestBundle?.events) ? digestBundle.events : {};
    const recentWarnOrError = toArray(digestBundle?.recentWarnOrError);

    cp3ReadinessPayload = buildGatePayload(cp3ReadinessCapture, "cp3ReadinessGate");
    cp3SuitePayload = buildGatePayload(cp3SuiteCapture, "cp3SuiteGate");
    cp4CloseoutPayload = buildGatePayload(cp4CloseoutCapture, "cp4CloseoutGate");
    v130CloseoutPayload = buildGatePayload(v130CloseoutCapture, "v130CloseoutGate");
    v130EvidencePayload = buildGatePayload(v130Evidence, "v130EvidenceGate");

    digestSummaryPayload = {
      summary: {
        incomingRequestAntiAbuse: digestSummary?.incomingRequestAntiAbuse ?? null,
        uiResponsiveness: digestSummary?.uiResponsiveness ?? null,
        m10TrustControls: digestSummary?.m10TrustControls ?? null,
      },
    };
    eventSlicesPayload = {
      events: {
        cp2: toArray(digestEvents.cp2),
        cp3Readiness: toArray(digestEvents.cp3Readiness),
        cp3Suite: toArray(digestEvents.cp3Suite),
        cp4Closeout: toArray(digestEvents.cp4Closeout).length > 0
          ? toArray(digestEvents.cp4Closeout)
          : toArray(v130Evidence.cp4CloseoutEventContexts),
        v130Closeout: toArray(digestEvents.v130Closeout).length > 0
          ? toArray(digestEvents.v130Closeout)
          : toArray(v130Evidence.v130CloseoutEventContexts),
        v130Evidence: toArray(digestEvents.v130Evidence),
      },
      recentWarnOrError,
    };
  }

  const targetDir = parsed.targetDir;
  await fs.mkdir(targetDir, { recursive: true });

  const writes = [
    ["m10-cp3-readiness-pass.json", cp3ReadinessPayload],
    ["m10-cp3-suite-pass.json", cp3SuitePayload],
    ["m10-cp4-closeout-pass.json", cp4CloseoutPayload],
    ["m10-v130-closeout-pass.json", v130CloseoutPayload],
    ["m10-v130-evidence-pass.json", v130EvidencePayload],
    ["m10-digest-summary.json", digestSummaryPayload],
    ["m10-event-slices.json", eventSlicesPayload],
  ];

  for (const [filename, payload] of writes) {
    await writeJson(path.join(targetDir, filename), payload);
  }

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

  console.log(`[demo:materialize] wrote ${writes.length} file(s) to ${path.relative(repoRoot, targetDir)}`);
  console.log("[demo:materialize] next:");
  console.log("- pnpm demo:m10:check:structure");
  console.log("- pnpm demo:m10:check");

  if (warnings.length > 0) {
    console.warn("[demo:materialize] warnings:");
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
};

main().catch((error) => {
  console.error("[demo:materialize] failed:", error.message ?? error);
  process.exit(1);
});
