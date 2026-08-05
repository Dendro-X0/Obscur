#!/usr/bin/env node
/**
 * Packaged Tauri UI soak — mesh configure / snapshot / publish via CDP.
 * Requires Docker :7000 and desktop CDP :9230 (Tester1 unlock).
 *
 *   OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build
 *   node scripts/l3-mesh-tauri-ui-soak-cdp.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatNoObscurPageError,
  pickAppPageFromBrowser,
  waitForAppPageFromBrowser,
} from "./lib/cdp-app-page.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pwaDir = path.join(repoRoot, "apps", "pwa");
const requireFromPwa = createRequire(path.join(pwaDir, "package.json"));
const { generateSecretKey, finalizeEvent } = requireFromPwa("nostr-tools");

const CDP = process.env.OBSCUR_CDP_URL ?? "http://127.0.0.1:9230";
const PASSWORD = process.env.OBSCUR_SOAK_PASSWORD ?? "SyI14^ew1E";
const USERNAME = process.env.OBSCUR_SOAK_USER ?? "Tester1";
const PROFILE_ID = process.env.OBSCUR_SOAK_PROFILE_ID ?? "default";
const RELAY_URL = process.env.OBSCUR_L3_RELAY_URL ?? "ws://127.0.0.1:7000";
const outJson = path.join(repoRoot, "docs", "handoffs", "r-relay-rust-l3-tauri-ui-soak-2026-07-30.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "r-relay-rust-l3-tauri-ui-soak-2026-07-30.md");

function loadPlaywright() {
  try {
    return requireFromPwa("playwright");
  } catch {
    return requireFromPwa("@playwright/test");
  }
}

async function isShell(page) {
  for (const label of ["Settings", "Network", "Search", "Chats"]) {
    if (await page.getByRole("link", { name: label, exact: true }).isVisible().catch(() => false)) {
      return true;
    }
  }
  return page.getByRole("link", { name: /^chats$/i }).isVisible().catch(() => false);
}

async function isGate(page) {
  if (await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    return true;
  }
  return page.getByText(/welcome back|enter your password/i).isVisible().catch(() => false);
}

async function tauriInvoke(page, cmd, args = {}) {
  return page.evaluate(
    async ({ cmd, args }) => {
      const invoke =
        window.__TAURI_INTERNALS__?.invoke
        ?? window.__TAURI__?.core?.invoke
        ?? window.__TAURI__?.invoke;
      if (typeof invoke !== "function") {
        return { ok: false, error: "no Tauri invoke" };
      }
      try {
        const value = await invoke(cmd, args);
        return { ok: true, value };
      } catch (err) {
        return { ok: false, error: String(err?.message ?? err) };
      }
    },
    { cmd, args },
  );
}

async function unlockTester1(page) {
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 20000 });
  const textInput = page.locator('input:not([type="password"]):not([type="hidden"])').first();
  if (await textInput.isVisible().catch(() => false)) {
    await textInput.click();
    await textInput.fill("");
    await textInput.pressSequentially(USERNAME, { delay: 15 });
  }
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.pressSequentially(PASSWORD, { delay: 15 });
  const unlockBtn = page.getByRole("button", { name: /unlock|sign in|continue/i }).first();
  if (await unlockBtn.isVisible().catch(() => false)) {
    await unlockBtn.click();
  } else {
    await passwordInput.press("Enter");
  }
}

async function waitShell(page, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isShell(page)) return "shell";
    if (await isGate(page)) return "gate";
    await page.waitForTimeout(400);
  }
  return (await isShell(page)) ? "shell" : "timeout";
}

const main = async () => {
  const { chromium } = loadPlaywright();
  const results = [];
  const record = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  };

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch (error) {
    console.error(`CDP connect failed at ${CDP}:`, error instanceof Error ? error.message : error);
    console.error("Start: OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build");
    process.exit(2);
  }

  try {
    let page = await pickAppPageFromBrowser(browser);
    if (!page) {
      page = await waitForAppPageFromBrowser(browser, 30000);
    }
    if (!page) {
      throw new Error(formatNoObscurPageError(CDP));
    }

    let phase = await waitShell(page, 15000);
    if (phase === "gate") {
      await unlockTester1(page);
      phase = await waitShell(page, 60000);
    }
    record("unlock_or_shell", phase === "shell", phase);
    if (phase !== "shell") {
      throw new Error(`expected shell after unlock, got ${phase}`);
    }

    const configure = await tauriInvoke(page, "engine_invoke_transport_configure_mesh_conduits", {
      request: {
        engine: "transport",
        method: "configureMeshConduits",
        scope: { profileId: PROFILE_ID },
        payload: {
          conduits: [
            {
              conduitId: "l3-ui-local",
              dialect: "nostr_ws",
              endpoints: [RELAY_URL],
              capabilities: ["publish", "subscribe"],
              networkPolicy: "clearnet",
              trustTier: "user_configured",
              enabled: true,
              priority: 10,
              label: "l3-ui",
            },
          ],
          maxRedundancy: 1,
          connect: true,
          torReady: false,
          torConfigured: false,
        },
      },
    });
    const configureOk = configure.ok && configure.value?.ok !== false;
    const owns =
      configure.value?.data?.meshSchedulerOwnsFailover
      ?? configure.value?.meshSchedulerOwnsFailover;
    record(
      "configureMeshConduits",
      Boolean(configureOk),
      configure.ok
        ? `ownsFailover=${owns} keys=${Object.keys(configure.value?.data ?? configure.value ?? {}).join(",")}`
        : configure.error,
    );

    const snapshot = await tauriInvoke(page, "engine_invoke_transport_get_mesh_snapshot", {
      request: {
        engine: "transport",
        method: "getMeshSnapshot",
        scope: { profileId: PROFILE_ID },
      },
    });
    const snapData = snapshot.value?.data ?? snapshot.value;
    const writable = snapData?.writableConduitCount ?? 0;
    record(
      "getMeshSnapshot",
      Boolean(snapshot.ok) && writable >= 1,
      snapshot.ok ? `phase=${snapData?.phase} writable=${writable}` : snapshot.error,
    );

    const sk = generateSecretKey();
    const event = finalizeEvent(
      {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [["client", "obscur-l3-tauri-ui"]],
        content: `obscur-l3-tauri-ui-soak-${Date.now()}`,
      },
      sk,
    );
    const eventPayload = JSON.stringify(["EVENT", event]);

    const publish = await tauriInvoke(page, "engine_invoke_transport_publish_mesh_envelope", {
      request: {
        engine: "transport",
        method: "publishMeshEnvelope",
        scope: { profileId: PROFILE_ID },
        payload: {
          envelopeId: `env-ui-${Date.now()}`,
          eventPayload,
          relayUrls: [RELAY_URL],
        },
      },
    });
    const pubResult = publish.value;
    const pubData = pubResult?.data ?? pubResult;
    const publishAccepted =
      Boolean(publish.ok)
      && pubResult?.ok !== false
      && pubData?.accepted === true;
    record(
      "publishMeshEnvelope",
      publishAccepted,
      publish.ok
        ? `invokeOk=${pubResult?.ok} accepted=${pubData?.accepted} successCount=${pubData?.successCount}`
        : publish.error,
    );

    const escape = await tauriInvoke(page, "engine_invoke_transport_publish_mesh_envelope", {
      request: {
        engine: "transport",
        method: "publishMeshEnvelope",
        scope: { profileId: PROFILE_ID },
        payload: {
          envelopeId: `env-escape-${Date.now()}`,
          eventPayload,
          relayUrls: ["wss://relay.damus.io"],
        },
      },
    });
    const escResult = escape.value;
    const escData = escResult?.data ?? escResult;
    const escapeRejected =
      Boolean(escape.ok)
      && escResult?.ok !== false
      && escData?.accepted === false
      && String(escData?.errorMessage ?? "").includes("not_in_mesh_active_set");
    record(
      "damus_escape_rejected",
      escapeRejected,
      escape.ok
        ? `accepted=${escData?.accepted} err=${escData?.errorMessage ?? ""}`
        : escape.error,
    );
  } finally {
    // leave desktop running
  }

  const payload = {
    at: new Date().toISOString(),
    cdp: CDP,
    profileId: PROFILE_ID,
    relayUrl: RELAY_URL,
    results,
    pass: results.every((r) => r.ok),
  };
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const md = `# L3 Tauri UI mesh soak

**Status:** ${payload.pass ? "**PASS**" : "**FAIL**"} · ${payload.at}  
**CDP:** \`${CDP}\` · profile \`${PROFILE_ID}\` · relay \`${RELAY_URL}\`

| Check | Result |
|-------|--------|
${results.map((r) => `| ${r.name} | ${r.ok ? "Pass" : "Fail"} — ${r.detail ?? ""} |`).join("\n")}

JSON: [\`r-relay-rust-l3-tauri-ui-soak-2026-07-30.json\`](./r-relay-rust-l3-tauri-ui-soak-2026-07-30.json)
`;
  fs.writeFileSync(outMd, md, "utf8");
  console.log("");
  console.log(payload.pass ? "L3 Tauri UI mesh soak PASS" : "L3 Tauri UI mesh soak FAIL");
  console.log(`Wrote ${outMd}`);
  process.exit(payload.pass ? 0 : 1);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
