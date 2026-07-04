#!/usr/bin/env node
/**
 * Combined probe + bridge preflight for agents (COM-RUN-11 handoff).
 * Copy to Obscur repo: scripts/agent-multiwindow-preflight.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runNode(script, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...extraArgs], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  const probeScript = path.join(__dirname, "agent-window-probe.mjs");
  const bridgeScript = path.join(__dirname, "agent-bridge-call.mjs");

  const probe = await runNode(probeScript);
  let probeJson = null;
  try {
    probeJson = JSON.parse(probe.stdout);
  } catch {
    probeJson = { parseError: true, stdout: probe.stdout, stderr: probe.stderr };
  }

  let bridgeJson = null;
  if (probeJson?.dualWindowReady !== true) {
    const bridge = await runNode(bridgeScript, ["--method", "listWindows"]);
    try {
      bridgeJson = JSON.parse(bridge.stdout);
    } catch {
      bridgeJson = { parseError: true, stdout: bridge.stdout, stderr: bridge.stderr };
    }
  }

  const windowCount = bridgeJson?.result?.length ?? probeJson?.cdp?.main?.targetCount ?? 0;

  const report = {
    schema: "obscur.agent.multiwindowPreflight@0.1.0",
    dualWindowReady: probeJson?.dualWindowReady === true,
    windowCount,
    probe: probeJson,
    bridge: bridgeJson,
    navigationPreflight: [
      "Open Chats tab before profile sidebar clicks",
      "Use agent-bridge navigateRoute('/') or MCP client_interact_click a[href='/']",
    ],
    blockedFlows: probeJson?.blockedFlows ?? [],
    recommendedNext:
      probeJson?.dualWindowReady === true
        ? "client_session_connect second port or WebDriver"
        : "pnpm run agent:bridge-call -- --method openProfileSlot --args '[2]' then focusWindow",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(probeJson?.dualWindowReady ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
