#!/usr/bin/env node
/**
 * Call window.__codactrlAgentBridge via CDP evaluate on the main attach port.
 * Copy to Obscur repo: scripts/agent-bridge-call.mjs
 *
 * Usage:
 *   node scripts/agent-bridge-call.mjs --method listWindows
 *   node scripts/agent-bridge-call.mjs --method focusWindow --args '["profile-slot-2"]'
 *   node scripts/agent-bridge-call.mjs --method openProfileSlot --args '[2]'
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const loadPlaywright = async () => {
  const pwaRoot = path.join(repoRoot, "apps", "pwa");
  const requireFromPwa = createRequire(path.join(pwaRoot, "package.json"));
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
};

const DEFAULT_PORT = Number.parseInt(process.env.OBSCUR_CDP_MAIN ?? "9230", 10);

function parseArgs(argv) {
  let method = "listWindows";
  let args = [];
  let port = DEFAULT_PORT;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--method" && argv[i + 1]) {
      method = argv[++i];
    } else if (argv[i] === "--args" && argv[i + 1]) {
      args = JSON.parse(argv[++i]);
    } else if (argv[i] === "--port" && argv[i + 1]) {
      port = Number.parseInt(argv[++i], 10);
    }
  }
  return { method, args, port };
}

async function resolvePage(port, targetId) {
  const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!listResponse.ok) {
    throw new Error(`CDP list failed on :${port}: ${listResponse.status}`);
  }
  const targets = await listResponse.json();
  const pages = targets.filter((entry) => entry.type === "page" || entry.type === "webview");
  const match =
    (targetId ? pages.find((entry) => entry.id === targetId) : null) ??
    pages.find((entry) => /1430|asset\.localhost/i.test(entry.url ?? "")) ??
    pages[0];
  if (!match?.webSocketDebuggerUrl) {
    throw new Error(`no CDP page target on :${port}`);
  }
  return match;
}

async function evaluateOnCdp(page, port, expression) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  try {
    const contexts = browser.contexts();
    for (const context of contexts) {
      for (const livePage of context.pages()) {
        const normalized = (page.url ?? "").replace(/\/$/, "");
        const liveUrl = livePage.url().replace(/\/$/, "");
        if (liveUrl === normalized || liveUrl.startsWith(normalized)) {
          return livePage.evaluate(expression);
        }
      }
    }
    const fallback = contexts[0]?.pages()[0];
    if (!fallback) {
      throw new Error("no live CDP page after connectOverCDP");
    }
    return fallback.evaluate(expression);
  } finally {
    await browser.close();
  }
}

function bridgeExpression(method, args) {
  const serializedArgs = JSON.stringify(args);
  return `(async () => {
    const bridge = window.__codactrlAgentBridge;
    if (!bridge || typeof bridge[${JSON.stringify(method)}] !== 'function') {
      return { ok: false, error: 'window.__codactrlAgentBridge.${method} missing — install src/dev/agent-bridge.ts' };
    }
    return bridge[${JSON.stringify(method)}](...${serializedArgs});
  })()`;
}

async function main() {
  const { method, args, port } = parseArgs(process.argv);
  const page = await resolvePage(port);
  const expression = bridgeExpression(method, args);
  const result = await evaluateOnCdp(page, port, expression);

  const payload = {
    schema: "obscur.agent.bridgeCall@0.1.0",
    method,
    args,
    cdpPort: port,
    targetUrl: page.url,
    result,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (result && result.ok === false) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }, null, 2));
  process.exit(1);
});
