#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const assetDir = path.join(repoRoot, "docs", "assets", "demo", "v1.2.5");
const statusPath = path.join(assetDir, "m10-status.json");

const readJson = async (fullPath) => {
  const text = await fs.readFile(fullPath, "utf8");
  return JSON.parse(text);
};

const ensureStatus = async () => {
  try {
    await fs.access(statusPath);
  } catch {
    console.log("[demo:rc:next] status file missing.");
    console.log("- run: pnpm demo:m10:rc:status");
    process.exit(1);
  }
};

const renderStrictReady = () => {
  console.log("[demo:rc:next] strict gate is already ready.");
  console.log("- strictReady: true");
  console.log("- next: proceed with v1.3.0 closeout matrix and release preflight.");
};

const renderStrictPending = (status) => {
  const strictViolations = Array.isArray(status?.strictViolations)
    ? status.strictViolations
    : [];
  const topViolations = strictViolations.slice(0, 5);

  console.log("[demo:rc:next] strict gate is not ready yet.");
  console.log(`- strictReady: ${String(status?.strictReady === true)}`);
  console.log(`- violationCount: ${strictViolations.length}`);
  if (topViolations.length > 0) {
    console.log("- topViolations:");
    topViolations.forEach((violation, index) => {
      const name = (
        violation
        && typeof violation === "object"
        && "name" in violation
      ) ? String(violation.name) : "unknown";
      const detail = (
        violation
        && typeof violation === "object"
        && "detail" in violation
      ) ? String(violation.detail) : "";
      console.log(`  ${index + 1}. ${name}${detail ? ` -> ${detail}` : ""}`);
    });
  }
  console.log("- next commands:");
  console.log("  1. Run stabilized capture in browser console:");
  console.log("     copy(window.obscurM10TrustControls?.runV130ReleaseCandidateCaptureStabilizedJson?.({ eventWindowSize: 400, expectedStable: true, settlePasses: 2 }));");
  console.log("  2. Save JSON to docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json");
  console.log("  3. Run: pnpm demo:m10:rc:materialize -- --capture docs/assets/demo/v1.2.5/raw/m10-v130-release-candidate-capture.json");
  console.log("  4. Run: pnpm demo:m10:rc:check");
  console.log("  5. Run: pnpm demo:m10:rc:status");
};

const main = async () => {
  await ensureStatus();
  const status = await readJson(statusPath);
  if (status?.strictReady === true) {
    renderStrictReady();
    return;
  }
  renderStrictPending(status);
};

main().catch((error) => {
  console.error("[demo:rc:next] failed:", error);
  process.exit(1);
});
