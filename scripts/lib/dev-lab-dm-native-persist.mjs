/**
 * dm-native-persist — native SQLite DM history survives WebView reload (Tauri CDP only).
 */

import { applyDevOperatorBundle, ensureTester1Unlocked } from "./dev-lab-playwright-auth.mjs";
import {
  readRuntimeCapabilities,
  waitForDevLab,
  waitForMessagingReady,
} from "./dev-lab-playwright-shared.mjs";

const TESTER2_PUBKEY_HEX = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";

const readPeerSnapshot = async (page, peerHex, markerText) => page.evaluate(async ({ peerHex: peer, markerText: marker }) => {
  const sqliteMessages = await window.obscurDevLab?.getSqliteMessagesForPeer?.(peer);
  const messages = sqliteMessages ?? window.obscurDevLab?.getMessagesForPeer?.(peer) ?? [];
  return {
    count: messages.length,
    hasMarker: messages.some((message) => message.content === marker),
    source: sqliteMessages ? "sqlite" : "controller_memory",
  };
}, { peerHex, markerText });

function buildScenarioResult(steps, startedAt, passed) {
  return {
    id: "dm-native-persist",
    name: "Native DM history survives reload (CDP)",
    category: "messaging",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}

function pushStep(steps, id, passed, message, context = undefined) {
  steps.push({ id, passed, message, durationMs: 0, context });
}

/**
 * @param {import('playwright').Page} page
 * @param {Readonly<{
 *   log?: (msg: string) => void;
 *   applyDevOperatorBundle: (page: import('playwright').Page) => Promise<void>;
 *   ensureTester1Unlocked: (page: import('playwright').Page, options?: object) => Promise<void>;
 *   requireNative?: boolean;
 * }>} deps
 */
export async function runDmNativePersistScenario(page, deps) {
  const log = deps.log ?? (() => undefined);
  const startedAt = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const steps = [];

  const capabilities = await readRuntimeCapabilities(page);
  const nativeRequired = deps.requireNative !== false;
  if (!capabilities.isNativeRuntime) {
    const skipped = !nativeRequired;
    pushStep(
      steps,
      "native_runtime",
      skipped,
      skipped
        ? "Skipped — Chromium :3340 cannot prove native SQLite (use --cdp against Tauri)."
        : "Native Tauri bridge required — connect with --cdp and unlocked Tester1.",
      { capabilities },
    );
    return buildScenarioResult(steps, startedAt, skipped);
  }

  pushStep(
    steps,
    "native_runtime",
    true,
    "Native Tauri bridge detected.",
    { capabilities },
  );

  await waitForDevLab(page);
  await waitForMessagingReady(page);

  const markerText = `dev-lab-native-persist-${Date.now()}`;
  const sendResult = await page.evaluate(async ({ peerHex, text }) => {
    return window.obscurDevLab?.sendSyntheticDm?.({ peerPublicKeyHex: peerHex, text });
  }, { peerHex: TESTER2_PUBKEY_HEX, text: markerText });

  const sendPassed = sendResult?.success !== false && sendResult?.deliveryStatus !== "failed";
  pushStep(
    steps,
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

  await page.waitForTimeout(1500);
  const before = await readPeerSnapshot(page, TESTER2_PUBKEY_HEX, markerText);
  pushStep(
    steps,
    "dm_count_before_reload",
    before.hasMarker,
    before.hasMarker
      ? `Peer thread has ${before.count} message(s) before native reload.`
      : `Marker missing before reload (count=${before.count}).`,
    { before, markerText },
  );
  if (!before.hasMarker) {
    return buildScenarioResult(steps, startedAt, false);
  }

  log("dm-native-persist: reloading native WebView");
  await page.reload({ waitUntil: "domcontentloaded" });
  await deps.applyDevOperatorBundle(page);
  await waitForDevLab(page);
  try {
    await deps.ensureTester1Unlocked(page, { log, timeoutMs: 120_000 });
    pushStep(steps, "dm_unlock_after_reload", true, "Tester1 unlocked after native reload.");
  } catch (error) {
    pushStep(
      steps,
      "dm_unlock_after_reload",
      false,
      error instanceof Error ? error.message : "Unlock after reload failed.",
    );
    return buildScenarioResult(steps, startedAt, false);
  }

  await waitForMessagingReady(page);

  let after = { count: 0, hasMarker: false };
  const hydrateDeadline = Date.now() + 60_000;
  while (Date.now() < hydrateDeadline) {
    after = await readPeerSnapshot(page, TESTER2_PUBKEY_HEX, markerText);
    if (after.hasMarker && after.count >= before.count) {
      break;
    }
    await page.waitForTimeout(500);
  }

  const historyPassed = after.hasMarker && after.count >= before.count;
  pushStep(
    steps,
    "dm_count_after_reload",
    historyPassed,
    historyPassed
      ? `Native history preserved (${before.count} → ${after.count}).`
      : `Native history lost after reload (before=${before.count}, after=${after.count}).`,
    { before, after, markerText },
  );

  const continuity = await page.evaluate(() => {
    const digest = window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400) ?? null;
    const riskLevel = digest?.summary?.selfAuthoredDmContinuity?.riskLevel ?? "none";
    const order = { none: 0, watch: 1, high: 2 };
    return { riskLevel, passed: (order[riskLevel] ?? 0) <= order.watch };
  });
  pushStep(
    steps,
    "dm_continuity_digest",
    continuity.passed,
    continuity.passed
      ? `DM continuity digest acceptable (${continuity.riskLevel}).`
      : `DM continuity digest too high (${continuity.riskLevel}).`,
    { continuity },
  );

  const passed = steps.every((entry) => entry.passed === true);
  return buildScenarioResult(steps, startedAt, passed);
}
