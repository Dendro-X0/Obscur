#!/usr/bin/env node
/**
 * Probe CDP + WebDriver ports for multi-window readiness.
 * Copy to Obscur repo: scripts/agent-window-probe.mjs
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PORTS = {
  cdpMain: Number.parseInt(process.env.OBSCUR_CDP_MAIN ?? "9230", 10),
  cdpProfile: Number.parseInt(process.env.OBSCUR_CDP_PROFILE ?? "9231", 10),
  webdriver: Number.parseInt(process.env.OBSCUR_WEBDRIVER ?? "4445", 10),
};

async function probeCdp(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return { port, listening: false, targetCount: 0, targets: [] };
    }
    const pages = await response.json();
    const targets = pages
      .filter((page) => page.type === "page" || page.type === "webview")
      .map((page) => ({
        id: page.id,
        title: page.title,
        url: page.url,
        type: page.type,
      }));
    return { port, listening: true, targetCount: targets.length, targets };
  } catch (err) {
    return { port, listening: false, targetCount: 0, error: String(err), targets: [] };
  }
}

async function probeWebdriver(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return { port, ready: false };
    }
    const body = await response.json().catch(() => ({}));
    return { port, ready: true, value: body?.value ?? body };
  } catch (err) {
    return { port, ready: false, error: String(err) };
  }
}

function probeBridgeWindowCount() {
  try {
    const raw = execFileSync(
      process.execPath,
      [path.join(repoRoot, "scripts", "agent-bridge-call.mjs"), "--method", "listWindows"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, OBSCUR_CDP_MAIN: String(PORTS.cdpMain) },
        timeout: 15_000,
      },
    );
    const payload = JSON.parse(raw);
    const windows = Array.isArray(payload?.result) ? payload.result : [];
    return {
      windowCount: windows.length,
      bridgeReady: windows.length >= 2,
      windows,
    };
  } catch (err) {
    return { windowCount: 0, bridgeReady: false, error: String(err), windows: [] };
  }
}

async function main() {
  const [cdpMain, cdpProfile, webdriver] = await Promise.all([
    probeCdp(PORTS.cdpMain),
    probeCdp(PORTS.cdpProfile),
    probeWebdriver(PORTS.webdriver),
  ]);

  const bridge = probeBridgeWindowCount();

  const dualWindowReady =
    cdpMain.targetCount + cdpProfile.targetCount >= 2 ||
    (webdriver.ready && cdpMain.listening) ||
    bridge.bridgeReady;

  const blockedFlows = [];
  if (!dualWindowReady) {
    blockedFlows.push(
      "COM-RUN-11: use agent-bridge-call.mjs (focusWindow/openProfileSlot) or enable :9231 / WebDriver :4445",
    );
  } else if (bridge.bridgeReady && !cdpProfile.listening) {
    blockedFlows.push(
      "COM-RUN-11: bridge lane ready (2+ windows) but profile CDP :9231 down — use focusWindow + main CDP or fix per-window CDP args",
    );
  }

  const report = {
    schema: "obscur.agent.windowProbe@0.1.1",
    dualWindowReady,
    cdp: { main: cdpMain, profile: cdpProfile },
    bridge,
    webdriver,
    blockedFlows,
    recommended: dualWindowReady
      ? {
          lane: cdpProfile.listening ? "cdp" : bridge.bridgeReady ? "agent-bridge" : "cdp",
          cdpPort: cdpProfile.listening ? PORTS.cdpProfile : PORTS.cdpMain,
          script: cdpProfile.listening ? undefined : "scripts/agent-bridge-call.mjs",
        }
      : { lane: "agent-bridge", cdpPort: PORTS.cdpMain, script: "scripts/agent-bridge-call.mjs" },
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(dualWindowReady ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
