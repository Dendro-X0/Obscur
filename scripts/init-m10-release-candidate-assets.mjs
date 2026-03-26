#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.5");
const rawCaptureDir = path.join(targetDir, "raw");

const fileTemplates = new Map([
  ["m10-v130-release-candidate-pass.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    releaseCandidateGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
  ["m10-v130-release-candidate-capture.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    cp2TriageCapture: {
      cp2TriageGate: {
        pass: null,
        failedChecks: [],
        failedCheckSample: null,
      },
    },
    v130EvidenceCapture: {
      v130CloseoutCapture: {
        cp4CloseoutCapture: {
          cp3SuiteCapture: {
            cp3ReadinessCapture: {
              cp3ReadinessGate: {
                pass: null,
                failedChecks: [],
                failedCheckSample: null,
              },
            },
            cp3SuiteGate: {
              pass: null,
              failedChecks: [],
              failedCheckSample: null,
            },
          },
          cp4CloseoutGate: {
            pass: null,
            failedChecks: [],
            failedCheckSample: null,
          },
        },
        v130CloseoutGate: {
          pass: null,
          failedChecks: [],
          failedCheckSample: null,
        },
      },
      v130EvidenceGate: {
        pass: null,
        failedChecks: [],
        failedCheckSample: null,
      },
    },
    digestSummaryAfterV130EvidenceEvent: null,
    eventSlices: {
      events: {
        cp2: [],
        cp3Readiness: [],
        cp3Suite: [],
        cp4Closeout: [],
        v130Closeout: [],
        v130Evidence: [],
        v130ReleaseCandidate: [],
      },
      recentWarnOrError: [],
    },
    releaseCandidateGate: {
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
  ["m10-v130-release-candidate-capture.json", {
    generatedAtUnixMs: null,
    eventWindowSize: 400,
    expectedStable: true,
    cp2TriageCapture: {
      cp2TriageGate: {
        pass: null,
        failedChecks: [],
        failedCheckSample: null,
      },
    },
    v130EvidenceCapture: {
      v130CloseoutCapture: {
        cp4CloseoutCapture: {
          cp3SuiteCapture: {
            cp3ReadinessCapture: {
              cp3ReadinessGate: {
                pass: null,
                failedChecks: [],
                failedCheckSample: null,
              },
            },
            cp3SuiteGate: {
              pass: null,
              failedChecks: [],
              failedCheckSample: null,
            },
          },
          cp4CloseoutGate: {
            pass: null,
            failedChecks: [],
            failedCheckSample: null,
          },
        },
        v130CloseoutGate: {
          pass: null,
          failedChecks: [],
          failedCheckSample: null,
        },
      },
      v130EvidenceGate: {
        pass: null,
        failedChecks: [],
        failedCheckSample: null,
      },
    },
    digestSummaryAfterV130EvidenceEvent: null,
    eventSlices: {
      events: {
        cp2: [],
        cp3Readiness: [],
        cp3Suite: [],
        cp4Closeout: [],
        v130Closeout: [],
        v130Evidence: [],
        v130ReleaseCandidate: [],
      },
      recentWarnOrError: [],
    },
    releaseCandidateGate: {
      pass: null,
      failedChecks: [],
      failedCheckSample: null,
    },
  }],
]);

const storyboardTemplate = `# m10 Release Candidate Storyboard (v1.2.5)

_Status: pending capture_

## Segment 1: One-Shot Candidate Capture
1. Clear app events and run one command:
: \`window.obscurM10TrustControls.runV130ReleaseCandidateCaptureJson(...)\`
2. Save raw output in \`docs/assets/demo/v1.2.5/raw/\`.

## Segment 2: Gate Readout
1. Show \`releaseCandidateGate.pass\` and \`failedChecks\`.
2. Confirm nested CP2/CP3/CP4/v130 gate posture is visible in the same payload.

## Segment 3: Digest + Event Correlation
1. Show \`summary.m10TrustControls\` from \`m10-digest-summary.json\`.
2. Show event chain slices in \`m10-event-slices.json\` including \`v130ReleaseCandidate\`.
`;

const rawCaptureReadmeTemplate = `# Raw Capture Inputs

Store raw console outputs here before materializing canonical pass-lane files.

Required file:
1. \`m10-v130-release-candidate-capture.json\`
: output from \`window.obscurM10TrustControls.runV130ReleaseCandidateCaptureJson(...)\`.

Materialize command:
\`pnpm demo:m10:rc:materialize -- --capture docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json\`
`;

const writeJsonIfMissing = async (fullPath, payload) => {
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return true;
  }
};

const writeTextIfMissing = async (fullPath, payload) => {
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.writeFile(fullPath, payload, "utf8");
    return true;
  }
};

const main = async () => {
  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(rawCaptureDir, { recursive: true });
  let createdCount = 0;

  for (const [filename, payload] of fileTemplates.entries()) {
    const fullPath = path.join(targetDir, filename);
    if (await writeJsonIfMissing(fullPath, payload)) {
      createdCount += 1;
      console.log(`[demo:rc:init] created ${path.relative(repoRoot, fullPath)}`);
    }
  }

  if (await writeTextIfMissing(path.join(targetDir, "m10-demo-storyboard.md"), storyboardTemplate)) {
    createdCount += 1;
    console.log(`[demo:rc:init] created ${path.relative(repoRoot, path.join(targetDir, "m10-demo-storyboard.md"))}`);
  }

  if (await writeTextIfMissing(path.join(rawCaptureDir, "README.md"), rawCaptureReadmeTemplate)) {
    createdCount += 1;
    console.log(`[demo:rc:init] created ${path.relative(repoRoot, path.join(rawCaptureDir, "README.md"))}`);
  }

  for (const [filename, payload] of rawFileTemplates.entries()) {
    const fullPath = path.join(rawCaptureDir, filename);
    if (await writeJsonIfMissing(fullPath, payload)) {
      createdCount += 1;
      console.log(`[demo:rc:init] created ${path.relative(repoRoot, fullPath)}`);
    }
  }

  if (createdCount === 0) {
    console.log("[demo:rc:init] no files created (all assets already exist).");
    return;
  }
  console.log(`[demo:rc:init] initialized ${createdCount} release-candidate asset template file(s).`);
};

main().catch((error) => {
  console.error("[demo:rc:init] failed:", error);
  process.exit(1);
});
