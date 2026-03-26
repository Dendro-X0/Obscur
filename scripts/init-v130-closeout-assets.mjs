#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.3.0");
const rawDir = path.join(targetDir, "raw");
const gifsDir = path.join(targetDir, "gifs");

const textTemplates = new Map([
  ["README.md", `# v1.3.0 Closeout Evidence Packet

This folder stores the manual closeout packet for \`v1.3.0\`.

Use this packet during final runtime verification before tagging:

1. initialize templates:
: \`pnpm demo:v130:init\`
2. refresh strict release-candidate evidence:
: \`pnpm demo:m10:rc:refresh\`
3. run closeout validation pack:
: \`pnpm closeout:v130:check\`
4. complete manual verification checklist:
: \`docs/assets/demo/v1.3.0/manual-verification-checklist.md\`
5. capture and attach GIF assets in:
: \`docs/assets/demo/v1.3.0/gifs/\`
6. record final summary in:
: \`docs/assets/demo/v1.3.0/runtime-evidence-summary.json\`
`],
  ["manual-verification-checklist.md", `# v1.3.0 Manual Verification Checklist

Mark each gate after completing manual replay on the target runtime/device mix.

## Runtime and Auth

- [ ] Startup completes without infinite loading on cold launch.
- [ ] Remember-me/session restore behavior matches expected policy.
- [ ] Account switching does not corrupt profile scope or boot ownership.

## Messaging and Groups

- [ ] DM history includes self-authored and peer-authored messages after sync.
- [ ] Group membership and display name remain stable after account/device replay.
- [ ] Group sendability works (no false room-key missing block) for joined members.
- [ ] End-to-end delete convergence works for text and voice notes.

## Media and Search

- [ ] Historical media (image/video/audio/voice-note) renders after restore.
- [ ] Message search navigation scrolls to target message deterministically.
- [ ] Voice-note cards show expected compact UI and metadata.

## Performance and UX

- [ ] Page navigation remains responsive under multi-page switching.
- [ ] Chat scrolling remains smooth on larger histories.
- [ ] No unrecoverable blank-page or frozen UI state in stress replay.

## Final Manual Verdict

- [ ] Manual verification pass accepted for \`v1.3.0\` closeout.
- Notes:
  - 
`],
  ["gif-shot-list.md", `# v1.3.0 GIF Shot List

Capture concise GIF demos for final release proof and feature walkthrough.

Recommended file naming:
- \`01-startup-and-restore.gif\`
- \`02-dm-sync-self-history.gif\`
- \`03-group-membership-sendability.gif\`
- \`04-e2e-delete-text-and-voice.gif\`
- \`05-message-search-jump.gif\`
- \`06-media-restore-and-preview.gif\`
- \`07-navigation-and-scroll-performance.gif\`

For each GIF, record:
1. scenario setup,
2. user action,
3. expected outcome shown on-screen.
`],
  [path.join("raw", "README.md"), `# Raw Evidence Inputs

Store one-copy runtime capture files here before materializing canonical artifacts.

Required capture path for M10 release-candidate replay:
- \`m10-v130-release-candidate-capture.json\`

Source command:
\`copy(window.obscurM10TrustControls?.runV130ReleaseCandidateCaptureStabilizedJson?.({ eventWindowSize: 400, expectedStable: true, settlePasses: 2 }));\`
`],
  [path.join("gifs", "README.md"), `# GIF Outputs

Store final release demonstration GIF files in this folder.

Keep filenames aligned with:
- \`docs/assets/demo/v1.3.0/gif-shot-list.md\`
`],
]);

const jsonTemplates = new Map([
  ["runtime-evidence-summary.json", {
    generatedAtUnixMs: null,
    targetTag: "v1.3.0",
    appVersion: null,
    environment: {
      runtime: null,
      os: null,
      deviceProfile: null,
    },
    closeoutGates: {
      rcStrictReady: null,
      closeoutCheckPassed: null,
      releasePreflightPassed: null,
    },
    manualVerification: {
      pass: null,
      notes: [],
    },
    performanceUx: {
      pass: null,
      notes: [],
    },
    gifAssets: [],
  }],
  [path.join("raw", "m10-v130-release-candidate-capture.json"), {
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

const writeTextIfMissing = async (fullPath, text) => {
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, text, "utf8");
    return true;
  }
};

const writeJsonIfMissing = async (fullPath, payload) => {
  try {
    await fs.access(fullPath);
    return false;
  } catch {
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return true;
  }
};

const main = async () => {
  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(gifsDir, { recursive: true });
  let createdCount = 0;

  for (const [relativePath, payload] of textTemplates.entries()) {
    const fullPath = path.join(targetDir, relativePath);
    if (await writeTextIfMissing(fullPath, payload)) {
      createdCount += 1;
      console.log(`[demo:v130:init] created ${path.relative(repoRoot, fullPath)}`);
    }
  }

  for (const [relativePath, payload] of jsonTemplates.entries()) {
    const fullPath = path.join(targetDir, relativePath);
    if (await writeJsonIfMissing(fullPath, payload)) {
      createdCount += 1;
      console.log(`[demo:v130:init] created ${path.relative(repoRoot, fullPath)}`);
    }
  }

  if (createdCount === 0) {
    console.log("[demo:v130:init] no files created (all templates already exist).");
    return;
  }

  console.log(`[demo:v130:init] initialized ${createdCount} v1.3.0 closeout template file(s).`);
};

main().catch((error) => {
  console.error("[demo:v130:init] failed:", error);
  process.exit(1);
});
