#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.4");
const rawCaptureDir = path.join(targetDir, "raw");

const fileTemplates = new Map([
  ["m10-cp3-readiness-pass.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    cp3ReadinessGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-cp3-suite-pass.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    cp3SuiteGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-cp4-closeout-pass.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    cp4CloseoutGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-v130-closeout-pass.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    v130CloseoutGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-v130-evidence-pass.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    v130EvidenceGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-digest-summary.json", {
    summary: {
      incomingRequestAntiAbuse: null,
      uiResponsiveness: null,
      m10TrustControls: null,
    },
  }],
  ["m10-event-slices.json", {
    events: {
      cp2: [],
      cp3Readiness: [],
      cp3Suite: [],
      cp4Closeout: [],
      v130Closeout: [],
      v130Evidence: [],
    },
    recentWarnOrError: [],
  }],
]);

const rawFileTemplates = new Map([
  ["m10-v124-demo-bundle.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    demoAssets: {
      cp3ReadinessPass: null,
      cp3SuitePass: null,
      cp4CloseoutPass: null,
      v130CloseoutPass: null,
      v130EvidencePass: null,
      digestSummary: {
        summary: {
          incomingRequestAntiAbuse: null,
          uiResponsiveness: null,
          m10TrustControls: null,
        },
      },
      eventSlices: {
        events: {
          cp2: [],
          cp3Readiness: [],
          cp3Suite: [],
          cp4Closeout: [],
          v130Closeout: [],
          v130Evidence: [],
        },
        recentWarnOrError: [],
      },
    },
    strictGatePreview: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
      checks: {
        cp3ReadinessPass: null,
        cp3SuitePass: null,
        cp4CloseoutPass: null,
        v130CloseoutPass: null,
        v130EvidencePass: null,
        digestSummaryHasM10TrustControls: null,
        cp2EventSlicePresent: null,
        cp3ReadinessEventSlicePresent: null,
        cp3SuiteEventSlicePresent: null,
        cp4CloseoutEventSlicePresent: null,
        v130CloseoutEventSlicePresent: null,
        v130EvidenceEventSlicePresent: null,
      },
    },
  }],
  ["m10-v130-evidence-capture.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    v130CloseoutCapture: null,
    digestSummaryAfterV130Event: null,
    cp4CloseoutEventContexts: [],
    v130CloseoutEventContexts: [],
    v130EvidenceGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-digest-event-bundle.json", {
    summary: {
      incomingRequestAntiAbuse: null,
      uiResponsiveness: null,
      m10TrustControls: null,
    },
    events: {
      cp2: [],
      cp3Readiness: [],
      cp3Suite: [],
      cp4Closeout: [],
      v130Closeout: [],
      v130Evidence: [],
    },
    recentWarnOrError: [],
  }],
]);

const storyboardTemplate = `# m10 Demo Storyboard (v1.2.4)

_Status: pending capture_

## Segment 1: Trust Controls
1. Open settings and show trust controls area.
2. Toggle attack-mode profile and show deterministic counters.

## Segment 2: Gate Capture
1. Run CP3/CP4/v130 helpers in console.
2. Show gate pass/fail fields and failed-check samples.

## Segment 3: Digest Correlation
1. Show \`summary.m10TrustControls\` in digest output.
2. Show event chain slices:
: \`cp2_stability_gate\`, \`cp3_readiness_gate\`, \`cp3_suite_gate\`, \`cp4_closeout_gate\`, \`v130_closeout_gate\`, \`v130_evidence_gate\`.
`;

const rawCaptureReadmeTemplate = `# Raw Capture Inputs

Store raw console outputs here before materializing canonical pass-lane files.

Recommended files:
1. \`m10-v124-demo-bundle.json\`
: output from \`window.obscurM10TrustControls.runV124DemoAssetBundleCaptureJson(...)\`.
2. \`m10-v130-evidence-capture.json\`
: output from \`window.obscurM10TrustControls.runV130EvidenceCaptureJson(...)\`.
3. \`m10-digest-event-bundle.json\`
: output from the digest/event bundle command in \`docs/34-v1.2.4-m10-demo-asset-matrix.md\`.

Materialize command (preferred, one-shot bundle):
\`pnpm demo:m10:materialize -- --bundle docs/assets/demo/v1.2.4/raw/m10-v124-demo-bundle.json\`

Materialize command (split mode fallback):
\`pnpm demo:m10:materialize -- --v130-evidence docs/assets/demo/v1.2.4/raw/m10-v130-evidence-capture.json --digest-bundle docs/assets/demo/v1.2.4/raw/m10-digest-event-bundle.json\`
`;

const writeJsonIfMissing = async (filename, payload) => {
  const fullPath = path.join(targetDir, filename);
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return true;
  }
};

const writeTextIfMissing = async (filename, payload) => {
  const fullPath = path.join(targetDir, filename);
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.writeFile(fullPath, payload, "utf8");
    return true;
  }
};

const writeJsonPathIfMissing = async (fullPath, payload) => {
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return true;
  }
};

const main = async () => {
  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(rawCaptureDir, { recursive: true });
  let createdCount = 0;

  for (const [filename, payload] of fileTemplates.entries()) {
    if (await writeJsonIfMissing(filename, payload)) {
      createdCount += 1;
      console.log(`[demo:init] created ${path.relative(repoRoot, path.join(targetDir, filename))}`);
    }
  }

  if (await writeTextIfMissing("m10-demo-storyboard.md", storyboardTemplate)) {
    createdCount += 1;
    console.log(`[demo:init] created ${path.relative(repoRoot, path.join(targetDir, "m10-demo-storyboard.md"))}`);
  }

  const rawReadmePath = path.join(rawCaptureDir, "README.md");
  try {
    await fs.access(rawReadmePath);
  } catch {
    await fs.writeFile(rawReadmePath, rawCaptureReadmeTemplate, "utf8");
    createdCount += 1;
    console.log(`[demo:init] created ${path.relative(repoRoot, rawReadmePath)}`);
  }

  for (const [filename, payload] of rawFileTemplates.entries()) {
    const fullPath = path.join(rawCaptureDir, filename);
    if (await writeJsonPathIfMissing(fullPath, payload)) {
      createdCount += 1;
      console.log(`[demo:init] created ${path.relative(repoRoot, fullPath)}`);
    }
  }

  if (createdCount === 0) {
    console.log("[demo:init] no files created (all assets already exist).");
    return;
  }

  console.log(`[demo:init] initialized ${createdCount} demo asset template file(s).`);
};

main().catch((error) => {
  console.error("[demo:init] failed:", error);
  process.exit(1);
});
