/**
 * dm-reload-history — send DM, reload, assert history did not shrink.
 */

const TESTER2_PUBKEY_HEX = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";

const waitForDevLab = async (page, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => typeof window.obscurDevLab?.sendSyntheticDm === "function");
    if (ready) {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("obscurDevLab messaging API not available");
};

const waitForMessagingReady = async (page, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await page.evaluate(() => window.obscurDevLab?.getMessagingStatus?.() ?? null);
    if (status === "ready") {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Messaging bridge not ready");
};

const probeNativeSqliteLab = async (page) => page.evaluate(() => {
  const w = window;
  const hasCallableBridge = (
    typeof w.__TAURI_INTERNALS__?.invoke === "function"
    || typeof w.__TAURI__?.core?.invoke === "function"
    || typeof w.__TAURI_IPC__ === "function"
  );
  return (
    hasCallableBridge
    && typeof window.obscurDevLab?.getSqliteMessagesForPeer === "function"
  );
});

const probeCoordinationReady = async () => {
  try {
    const response = await fetch("http://127.0.0.1:8787/health", {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const readPeerSnapshot = async (page, peerHex, markerText) => page.evaluate(async ({ peerHex: peer, markerText: marker }) => {
  const controllerMessages = window.obscurDevLab?.getMessagesForPeer?.(peer) ?? [];
  const controllerSnapshot = {
    source: "controller",
    count: controllerMessages.length,
    hasMarker: controllerMessages.some((message) => message.content === marker),
    sample: controllerMessages.slice(-3).map((message) => message.content),
  };
  if (typeof window.obscurDevLab?.getSqliteMessagesForPeer !== "function") {
    return controllerSnapshot;
  }
  const sqliteMessages = await window.obscurDevLab.getSqliteMessagesForPeer(peer);
  const sqliteSnapshot = {
    source: "sqlite",
    count: sqliteMessages.length,
    hasMarker: sqliteMessages.some((message) => message.content === marker),
    sample: sqliteMessages.slice(-3).map((message) => message.content),
  };
  if (sqliteSnapshot.hasMarker || sqliteSnapshot.count >= controllerSnapshot.count) {
    return sqliteSnapshot;
  }
  return controllerSnapshot;
}, { peerHex, markerText });

const readSqlitePeerSnapshot = async (page, peerHex, markerText) => page.evaluate(async ({ peerHex: peer, markerText: marker }) => {
  if (typeof window.obscurDevLab?.getSqliteMessagesForPeer !== "function") {
    return { source: "sqlite", count: 0, hasMarker: false, sample: [] };
  }
  const messages = await window.obscurDevLab.getSqliteMessagesForPeer(peer);
  return {
    source: "sqlite",
    count: messages.length,
    hasMarker: messages.some((message) => message.content === marker),
    sample: messages.slice(-3).map((message) => message.content),
  };
}, { peerHex, markerText });

const readDmContinuityRisk = async (page) => page.evaluate(() => {
  const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400) ?? null;
  const summary = digest?.summary ?? {};
  const riskLevel = summary.selfAuthoredDmContinuity?.riskLevel ?? "none";
  const order = { none: 0, watch: 1, high: 2 };
  return {
    riskLevel,
    passed: (order[riskLevel] ?? 0) <= order.watch,
  };
});

/**
 * @param {import('playwright').Page} page
 * @param {Readonly<{
 *   log?: (msg: string) => void;
 *   applyDevOperatorBundle: (page: import('playwright').Page) => Promise<void>;
 *   ensureTester1Unlocked: (page: import('playwright').Page, options?: object) => Promise<void>;
 * }>} deps
 */
export async function runDmReloadHistoryScenario(page, deps) {
  const log = deps.log ?? (() => undefined);
  const startedAt = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const steps = [];

  const pushStep = (id, passed, message, context = undefined) => {
    steps.push({
      id,
      passed,
      message,
      durationMs: 0,
      context,
    });
  };

  await waitForDevLab(page);

  const nativeSqlite = await probeNativeSqliteLab(page);
  if (!nativeSqlite) {
    pushStep(
      "skipped",
      true,
      "Skipped — Chromium static shell cannot prove DM reload durability (use --cdp against Tauri).",
    );
    return buildScenarioResult(steps, startedAt, true);
  }

  await waitForMessagingReady(page);
  pushStep("dm_bridge_ready", true, "Messaging bridge ready (native SQLite lab).");

  const markerText = `dev-lab-reload-history-${Date.now()}`;
  const sendResult = await page.evaluate(async ({ peerHex, text }) => {
    return window.obscurDevLab?.sendSyntheticDm?.({ peerPublicKeyHex: peerHex, text });
  }, { peerHex: TESTER2_PUBKEY_HEX, text: markerText });

  const sendPassed = sendResult?.success !== false && sendResult?.deliveryStatus !== "failed";
  pushStep(
    "dm_seed_send",
    sendPassed,
    sendPassed
      ? `Seed message accepted (${sendResult?.deliveryStatus ?? "ok"}).`
      : `Seed send failed: ${sendResult?.error ?? sendResult?.deliveryStatus ?? "unknown"}`,
    { sendResult, markerText },
  );
  if (!sendPassed) {
    return buildScenarioResult(steps, startedAt, false);
  }

  let before = { count: 0, hasMarker: false, sample: [], source: "controller" };
  const beforeDeadline = Date.now() + 20_000;
  while (Date.now() < beforeDeadline) {
    before = await readPeerSnapshot(page, TESTER2_PUBKEY_HEX, markerText);
    if (before.hasMarker) {
      break;
    }
    await page.waitForTimeout(500);
  }
  pushStep(
    "dm_count_before_reload",
    before.hasMarker,
    before.hasMarker
      ? `Peer thread has ${before.count} message(s) including marker before reload.`
      : `Marker message missing before reload (count=${before.count}).`,
    { before, markerText },
  );
  if (!before.hasMarker) {
    return buildScenarioResult(steps, startedAt, false);
  }

  log("dm-reload-history: reloading page");
  await page.reload({ waitUntil: "domcontentloaded" });
  await deps.applyDevOperatorBundle(page);
  await waitForDevLab(page);
  try {
    await deps.ensureTester1Unlocked(page, { log, timeoutMs: 90_000 });
    pushStep("dm_unlock_after_reload", true, "Tester1 unlocked after reload.");
  } catch (error) {
    pushStep(
      "dm_unlock_after_reload",
      false,
      error instanceof Error ? error.message : "Unlock after reload failed.",
    );
    return buildScenarioResult(steps, startedAt, false);
  }

  await waitForMessagingReady(page);

  let after = { count: 0, hasMarker: false, sample: [], source: "sqlite" };
  const hydrateDeadline = Date.now() + 45_000;
  while (Date.now() < hydrateDeadline) {
    after = await readSqlitePeerSnapshot(page, TESTER2_PUBKEY_HEX, markerText);
    if (after.hasMarker && after.count >= before.count) {
      break;
    }
    await page.waitForTimeout(500);
  }

  const historyPassed = after.hasMarker && after.count >= before.count;
  pushStep(
    "dm_count_after_reload",
    historyPassed,
    historyPassed
      ? `History preserved after reload (${before.count} → ${after.count} messages).`
      : `History lost or shrunk after reload (before=${before.count}, after=${after.count}, marker=${after.hasMarker}).`,
    { before, after, markerText },
  );

  const continuity = await readDmContinuityRisk(page);
  pushStep(
    "dm_continuity_digest",
    continuity.passed,
    continuity.passed
      ? `DM continuity digest acceptable (${continuity.riskLevel}).`
      : `DM continuity digest too high (${continuity.riskLevel}).`,
    { continuity },
  );

  const coordinationUp = await probeCoordinationReady();
  if (!coordinationUp) {
    pushStep(
      "relay_runtime_ready",
      true,
      "Skipped — coordination not running (not required for SQLite reload proof).",
      { skipped: true },
    );
  } else {
    let relayRuntimeReady = false;
    const relayDeadline = Date.now() + 45_000;
    while (Date.now() < relayDeadline) {
      relayRuntimeReady = await page.evaluate(() => {
        const apis = window.obscurM0Triage?.capture?.(80)?.checks?.requiredApis;
        return apis?.relayRuntime === true;
      });
      if (relayRuntimeReady) {
        break;
      }
      await page.waitForTimeout(500);
    }
    pushStep(
      "relay_runtime_ready",
      relayRuntimeReady,
      relayRuntimeReady
        ? "Relay runtime ready after reload."
        : "Relay runtime API not ready within 45s after reload.",
      { relayRuntimeReady },
    );
  }

  const passed = steps.every((entry) => entry.passed === true);
  return buildScenarioResult(steps, startedAt, passed);
}

function buildScenarioResult(steps, startedAt, passed) {
  return {
    id: "dm-reload-history",
    name: "DM thread history survives reload",
    category: "messaging",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}
