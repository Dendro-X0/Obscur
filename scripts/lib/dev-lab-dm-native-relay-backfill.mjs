/**
 * dm-native-relay-backfill — native CDP proof that relay backfill repair executes.
 * Optional two-actor seed (Tester2 browser → Tester1 CDP) then asserts bidirectional SQLite.
 */

import {
  applyDevOperatorBundle,
  ensureDevLabAccountUnlocked,
  TESTER1,
  TESTER2,
} from "./dev-lab-playwright-auth.mjs";
import {
  readRuntimeCapabilities,
  waitForDevLab,
  waitForMessagingReady,
} from "./dev-lab-playwright-shared.mjs";

const TESTER2_PUBKEY_HEX = TESTER2.privateKeyHex;

const SYNC_EVIDENCE_EVENTS = [
  "messaging.native_dm_sqlite_repair_relay_backfill_requested",
  "messaging.native_dm_sqlite_repair_relay_backfill_executing",
  "messaging.transport.sync_start",
  "messaging.transport.sync_complete",
];

function buildScenarioResult(steps, startedAt, passed) {
  return {
    id: "dm-native-relay-backfill",
    name: "Native DM relay backfill repair (CDP)",
    category: "messaging",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}

function pushStep(steps, id, passed, message, context = undefined) {
  steps.push({ id, passed, message, durationMs: 0, context });
}

const readSyncEvidence = async (page) => page.evaluate((eventNames) => {
  const api = window.obscurAppEvents;
  if (!api || typeof api.findByName !== "function") {
    return { available: false, matches: [] };
  }
  const matches = [];
  for (const name of eventNames) {
    const events = api.findByName(name, 80) ?? [];
    for (const event of events) {
      matches.push({
        name: event.name,
        atUnixMs: event.atUnixMs,
        level: event.level,
        context: event.context ?? null,
      });
    }
  }
  matches.sort((left, right) => left.atUnixMs - right.atUnixMs);
  return { available: true, matches };
}, SYNC_EVIDENCE_EVENTS);

const readSqliteDirections = async (page, peerHex) => page.evaluate(async (peer) => {
  const messages = await window.obscurDevLab?.getSqliteMessagesForPeer?.(peer) ?? [];
  let outgoing = 0;
  let incoming = 0;
  for (const message of messages) {
    if (message.isOutgoing) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  }
  const total = messages.length;
  return {
    outgoing,
    incoming,
    total,
    isBidirectional: total > 0 && outgoing > 0 && incoming > 0,
    source: "sqlite",
  };
}, peerHex);

const waitForSyncEvidence = async (page, sinceUnixMs, timeoutMs = 45_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const evidence = await readSyncEvidence(page);
    const fresh = evidence.matches.filter((entry) => entry.atUnixMs >= sinceUnixMs);
    const hasRepairRequested = fresh.some((entry) => (
      entry.name === "messaging.native_dm_sqlite_repair_relay_backfill_requested"
    ));
    const hasRepairExecuting = fresh.some((entry) => (
      entry.name === "messaging.native_dm_sqlite_relay_backfill_executing"
    ));
    const hasSyncStart = fresh.some((entry) => entry.name === "messaging.transport.sync_start");
    const hasSyncComplete = fresh.some((entry) => entry.name === "messaging.transport.sync_complete");
    if (hasRepairRequested && (hasRepairExecuting || hasSyncStart || hasSyncComplete)) {
      return { evidence, fresh, satisfied: true };
    }
    await page.waitForTimeout(500);
  }
  const evidence = await readSyncEvidence(page);
  const fresh = evidence.matches.filter((entry) => entry.atUnixMs >= sinceUnixMs);
  return { evidence, fresh, satisfied: false };
};

const waitForBidirectionalSqlite = async (page, peerHex, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  let last = { outgoing: 0, incoming: 0, total: 0, isBidirectional: false, source: "sqlite" };
  while (Date.now() < deadline) {
    last = await readSqliteDirections(page, peerHex);
    if (last.isBidirectional) {
      return { directions: last, satisfied: true };
    }
    await page.waitForTimeout(1000);
  }
  return { directions: last, satisfied: false };
};

/**
 * @param {Readonly<{
 *   chromium: typeof import('playwright').chromium;
 *   appBase: string;
 *   log?: (msg: string) => void;
 * }>} deps
 */
async function seedTwoActorTraffic(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: deps.appBase });
  const pageB = await context.newPage();
  try {
    await pageB.goto("/");
    await applyDevOperatorBundle(pageB);
    await waitForDevLab(pageB);
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 120_000 });
    await waitForMessagingReady(pageB);
    const inboundText = `dev-lab-relay-backfill-in-${Date.now()}`;
    const sendResult = await pageB.evaluate(async ({ peerHex, text }) => (
      window.obscurDevLab?.sendSyntheticDm?.({ peerPublicKeyHex: peerHex, text })
    ), { peerHex: TESTER1.privateKeyHex, text: inboundText });
    const sendPassed = sendResult?.success !== false && sendResult?.deliveryStatus !== "failed";
    return { sendPassed, inboundText, sendResult };
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {Readonly<{
 *   log?: (msg: string) => void;
 *   requireNative?: boolean;
 *   chromium?: typeof import('playwright').chromium;
 *   appBase?: string;
 * }>} deps
 */
export async function runDmNativeRelayBackfillScenario(page, deps) {
  const log = deps.log ?? (() => undefined);
  const startedAt = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const steps = [];
  let twoActorSeeded = false;
  let inboundMarker = null;

  const capabilities = await readRuntimeCapabilities(page);
  const nativeRequired = deps.requireNative !== false;
  if (!capabilities.isNativeRuntime) {
    const skipped = !nativeRequired;
    pushStep(
      steps,
      "native_runtime",
      skipped,
      skipped
        ? "Skipped — Chromium :3340 cannot prove native relay backfill (use --cdp against Tauri)."
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
  pushStep(steps, "messaging_ready", true, "Messaging bridge ready.");

  const sqliteWriteProbe = await page.evaluate(async () => (
    window.obscurDevLab?.probeNativeDmSqliteWrite?.() ?? {
      ok: false,
      reason: "probe_unavailable",
      errorMessage: null,
    }
  ));
  const sqliteProbeUnavailable = sqliteWriteProbe.reason === "probe_unavailable";
  pushStep(
    steps,
    "native_sqlite_write_probe",
    sqliteWriteProbe.ok || sqliteProbeUnavailable,
    sqliteWriteProbe.ok
      ? "Native SQLite write probe roundtrip OK."
      : sqliteProbeUnavailable
        ? "Skipped — restart desktop shell to load probeNativeDmSqliteWrite (stale Dev Lab bridge)."
        : `Native SQLite write probe failed: ${sqliteWriteProbe.reason}${sqliteWriteProbe.errorMessage ? ` (${sqliteWriteProbe.errorMessage})` : ""}`,
    { sqliteWriteProbe },
  );
  if (!sqliteWriteProbe.ok && !sqliteProbeUnavailable) {
    return buildScenarioResult(steps, startedAt, false);
  }

  if (deps.chromium && deps.appBase) {
    log("dm-native-relay-backfill: seeding Tester2 → Tester1 via browser");
    const seed = await seedTwoActorTraffic({
      chromium: deps.chromium,
      appBase: deps.appBase,
      log,
    });
    inboundMarker = seed.inboundText;
    twoActorSeeded = seed.sendPassed;
    pushStep(
      steps,
      "two_actor_inbound_seed",
      seed.sendPassed,
      seed.sendPassed
        ? "Tester2 sent inbound DM to Tester1 (browser context)."
        : `Tester2 send failed: ${seed.sendResult?.error ?? seed.sendResult?.deliveryStatus ?? "unknown"}`,
      { sendResult: seed.sendResult, inboundMarker },
    );
    if (!seed.sendPassed) {
      return buildScenarioResult(steps, startedAt, false);
    }

    await page.evaluate(async () => {
      await window.obscurDevLab?.triggerMissedMessageSync?.();
    });

    let receivePassed = false;
    let receiveContext = { inboundMarker, liveCount: 0, sqliteCount: null, sqliteMatched: false };
    const receiveDeadline = Date.now() + 45_000;
    while (Date.now() < receiveDeadline) {
      receiveContext = await page.evaluate(async ({ peerHex, text }) => {
        const live = window.obscurDevLab?.getMessagesForPeer?.(peerHex) ?? [];
        if (live.some((message) => message.content === text)) {
          return {
            inboundMarker: text,
            liveCount: live.length,
            sqliteCount: null,
            sqliteMatched: false,
            matched: true,
          };
        }
        const sqlite = await window.obscurDevLab?.getSqliteMessagesForPeer?.(peerHex);
        const sqliteCount = sqlite?.length ?? null;
        if (sqlite?.some((message) => message.content === text)) {
          return {
            inboundMarker: text,
            liveCount: live.length,
            sqliteCount,
            sqliteMatched: true,
            matched: true,
          };
        }
        return {
          inboundMarker: text,
          liveCount: live.length,
          sqliteCount,
          sqliteMatched: false,
          matched: false,
        };
      }, { peerHex: TESTER2_PUBKEY_HEX, text: inboundMarker });
      receivePassed = receiveContext.matched === true;
      if (receivePassed) {
        break;
      }
      await page.waitForTimeout(1000);
    }
    pushStep(
      steps,
      "tester1_live_receive",
      receivePassed,
      receivePassed
        ? receiveContext.sqliteMatched
          ? "Tester1 observed inbound message in SQLite (live controller empty)."
          : "Tester1 CDP thread shows inbound live message."
        : "Tester1 did not observe inbound message within 45s (live or SQLite).",
      receiveContext,
    );
    if (!receivePassed) {
      return buildScenarioResult(steps, startedAt, false);
    }

    const outboundText = `dev-lab-relay-backfill-out-${Date.now()}`;
    const outboundResult = await page.evaluate(async ({ peerHex, text }) => (
      window.obscurDevLab?.sendSyntheticDm?.({ peerPublicKeyHex: peerHex, text })
    ), { peerHex: TESTER2_PUBKEY_HEX, text: outboundText });
    const outboundPassed = outboundResult?.success !== false && outboundResult?.deliveryStatus !== "failed";
    pushStep(
      steps,
      "tester1_outbound_seed",
      outboundPassed,
      outboundPassed
        ? "Tester1 sent outbound DM on native CDP."
        : `Tester1 outbound send failed: ${outboundResult?.error ?? outboundResult?.deliveryStatus ?? "unknown"}`,
      { outboundResult, outboundText },
    );
    if (!outboundPassed) {
      return buildScenarioResult(steps, startedAt, false);
    }
    await page.waitForTimeout(2000);
  } else {
    pushStep(
      steps,
      "two_actor_inbound_seed",
      true,
      "Skipped — no browser context for Tester2 seed (pass chromium + appBase).",
      { skipped: true },
    );
  }

  const sqliteBeforeRepair = await readSqliteDirections(page, TESTER2_PUBKEY_HEX);
  pushStep(
    steps,
    "sqlite_directions_before_repair",
    true,
    sqliteBeforeRepair.total > 0
      ? `SQLite before repair: out=${sqliteBeforeRepair.outgoing} in=${sqliteBeforeRepair.incoming}.`
      : "SQLite empty before repair (may still recover via relay backfill).",
    { directions: sqliteBeforeRepair, twoActorSeeded },
  );

  const oneSided = await page.evaluate(async () => (
    window.obscurDevLab?.scanOneSidedNativeDmConversations?.() ?? []
  ));
  pushStep(
    steps,
    "scan_one_sided_sqlite",
    true,
    oneSided.length > 0
      ? `Found ${oneSided.length} one-sided native DM thread(s) before repair.`
      : "No one-sided SQLite threads detected (repair still forced for sync evidence).",
    { oneSidedCount: oneSided.length, sample: oneSided.slice(0, 3) },
  );

  const markerUnixMs = Date.now();
  const forced = await page.evaluate(async () => (
    window.obscurDevLab?.forceNativeDmRelayBackfillSync?.() ?? false
  ));
  pushStep(
    steps,
    "force_relay_backfill",
    forced,
    forced
      ? "Forced native relay backfill repair dispatch returned true."
      : "forceNativeDmRelayBackfillSync unavailable or returned false.",
    { forced },
  );
  if (!forced) {
    return buildScenarioResult(steps, startedAt, false);
  }

  log("dm-native-relay-backfill: waiting for sync evidence");
  const syncWait = await waitForSyncEvidence(page, markerUnixMs - 1000);
  const syncPassed = syncWait.satisfied;
  pushStep(
    steps,
    "relay_sync_evidence",
    syncPassed,
    syncPassed
      ? `Relay backfill evidence observed (${syncWait.fresh.length} event(s)).`
      : "No repair/sync app events observed after forced backfill.",
    {
      freshEvents: syncWait.fresh,
      eventNames: SYNC_EVIDENCE_EVENTS,
    },
  );

  if (twoActorSeeded) {
    log("dm-native-relay-backfill: waiting for bidirectional SQLite");
    const bidirectionalWait = await waitForBidirectionalSqlite(page, TESTER2_PUBKEY_HEX);
    pushStep(
      steps,
      "sqlite_bidirectional_after_repair",
      bidirectionalWait.satisfied,
      bidirectionalWait.satisfied
        ? `SQLite bidirectional after repair (out=${bidirectionalWait.directions.outgoing}, in=${bidirectionalWait.directions.incoming}).`
        : `SQLite still one-sided or empty after repair (out=${bidirectionalWait.directions.outgoing}, in=${bidirectionalWait.directions.incoming}).`,
      { directions: bidirectionalWait.directions },
    );
  } else {
    pushStep(
      steps,
      "sqlite_bidirectional_after_repair",
      true,
      "Skipped — bidirectional SQLite assertion requires two-actor seed.",
      { skipped: true },
    );
  }

  const passed = steps.every((entry) => entry.passed === true);
  return buildScenarioResult(steps, startedAt, passed);
}
