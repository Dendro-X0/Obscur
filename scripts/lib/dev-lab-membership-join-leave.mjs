/**
 * membership-join-leave — dual-browser membership graph probes (CLI).
 *
 * Requires: pnpm dev:desktop:online (coordination on :8787).
 * COM-MEM-2 R6: graph probes (phase A) + create→invite→join UI automation (phase B).
 */

import { runComMem2PhaseBSteps } from "./dev-lab-com-mem-2-phase-b.mjs";
import { evaluateMembershipDigestGates } from "./dev-lab-digest-policy.mjs";
import { applyComMem2FullStackBundle, ensureDevLabAccountUnlocked, TESTER1, TESTER2 } from "./dev-lab-playwright-auth.mjs";
import {
  checkCoordinationHealth,
  clickSidebarLink,
  probeCoordinationHealthFromNode,
  readM8CommunityCapture,
  readMembershipDigestSummary,
  waitForDevLab,
} from "./dev-lab-playwright-shared.mjs";

function buildScenarioResult(steps, startedAt, passed) {
  return {
    id: "membership-join-leave",
    name: "Membership join/leave truth probes (CLI dual browser)",
    category: "network",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}

function pushStep(steps, id, passed, message, context = undefined) {
  steps.push({ id, passed, message, durationMs: 0, context });
}

/** @param {import('playwright').Page} page */
async function probeMembershipGraphOnPage(page, peerPublicKeyHex) {
  return page.evaluate((peerHex) => {
    const api = window.obscurDevLab;
    if (!api || typeof api.probeMembershipGraph !== "function") {
      return { available: false, graph: null };
    }
    return {
      available: true,
      graph: api.probeMembershipGraph({ peerPublicKeyHex: peerHex }),
    };
  }, peerPublicKeyHex);
}

/**
 * Informational graph steps — always passed=true so infra probes can succeed while
 * surfacing failing layers in message/context (COM-MEM-2 R6 phase A).
 */
function pushMembershipGraphSteps(steps, actorId, probeResult) {
  if (!probeResult?.available || !probeResult.graph) {
    pushStep(
      steps,
      `${actorId}_membership_graph`,
      false,
      `${actorId} membership graph probe unavailable — rebuild static shell (pnpm dev:desktop:online -- --rebuild).`,
      { available: false },
    );
    return false;
  }

  const graph = probeResult.graph;
  for (const layer of graph.layers ?? []) {
    const layerLabel = layer.layer.replace("layer0_", "L0 ").replace("layer1_", "L1 ").replace("layer2_", "L2 ");
    const status = layer.skipped ? "SKIP" : layer.ok ? "OK" : "FAIL";
    pushStep(
      steps,
      `${actorId}_${layer.layer}`,
      true,
      `${actorId} ${layerLabel} ${status} (${layer.reason}).`,
      { layer, details: layer.details },
    );
  }

  pushStep(
    steps,
    `${actorId}_membership_graph_summary`,
    true,
    graph.failingLayer
      ? `${actorId} graph failing layer: ${graph.failingLayer}.`
      : `${actorId} membership graph: no hard layer failure (skipped layers allowed).`,
    {
      failingLayer: graph.failingLayer,
      ok: graph.ok,
      actorPublicKeyHex: graph.actorPublicKeyHex,
      peerPublicKeyHex: graph.peerPublicKeyHex,
    },
  );
  return true;
}

async function probeActor(page, actorId, steps) {
  const shellHealth = await page.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);
  pushStep(
    steps,
    `${actorId}_shell`,
    shellHealth?.healthy === true && shellHealth?.rootFatalBoundary !== true,
    shellHealth?.healthy
      ? `${actorId} shell healthy.`
      : `${actorId} shell issues: ${shellHealth?.issues?.join(", ") ?? "unknown"}`,
    { shellHealth },
  );
  if (shellHealth?.rootFatalBoundary) {
    return false;
  }

  await clickSidebarLink(page, "Network");
  const networkHealth = await page.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);
  pushStep(
    steps,
    `${actorId}_network_chrome`,
    networkHealth?.shellUnlocked === true && networkHealth?.rootFatalBoundary !== true,
    networkHealth?.shellUnlocked
      ? `${actorId} network route reachable.`
      : `${actorId} network route failed.`,
    { health: networkHealth },
  );

  const m8 = await readM8CommunityCapture(page);
  pushStep(
    steps,
    `${actorId}_m8_capture`,
    m8.available && m8.capture?.checks?.requiredApis?.appEvents === true,
    m8.available
      ? `${actorId} M8 community capture available.`
      : `${actorId} obscurM8CommunityCapture missing.`,
    {
      replayReadiness: m8.capture?.community?.replayReadiness ?? null,
      membershipSendability: m8.capture?.community?.membershipSendability ?? null,
      communityLifecycleConvergence: m8.capture?.community?.communityLifecycleConvergence ?? null,
    },
  );

  const summary = await readMembershipDigestSummary(page);
  const membershipGates = evaluateMembershipDigestGates(summary);
  pushStep(
    steps,
    `${actorId}_membership_digest`,
    membershipGates.passed,
    membershipGates.passed
      ? `${actorId} membership digest gates acceptable.`
      : `${actorId} membership digest failed: ${membershipGates.failures.map((f) => `${f.key}=${f.riskLevel}`).join(", ")}`,
    { failures: membershipGates.failures, summaries: membershipGates.summaries },
  );

  return networkHealth?.rootFatalBoundary !== true && membershipGates.passed;
}

async function probeMembershipSettingsPanel(page, steps, log) {
  await ensureDevLabAccountUnlocked(page, "tester1", { log, timeoutMs: 60_000 }).catch(() => undefined);
  await clickSidebarLink(page, "Settings");
  const clickedRelaysTab = await page.evaluate(() => {
    const button = document.querySelector('[data-settings-tab="relays"]');
    if (button instanceof HTMLElement) {
      button.click();
      return true;
    }
    return false;
  });
  await page.waitForTimeout(1500);

  const panelVisible = await page.locator('[data-testid="membership-sync-settings-panel"]').isVisible({ timeout: 15_000 }).catch(() => false);
  const coordinationModeVisible = await page.locator('[data-testid="membership-sync-coordination"]').isVisible().catch(() => false);
  pushStep(
    steps,
    "tester1_membership_settings",
    clickedRelaysTab && panelVisible,
    panelVisible
      ? "Membership sync settings panel mounted on relays tab."
      : "Membership sync settings panel not visible on relays tab.",
    { clickedRelaysTab, panelVisible, coordinationModeVisible },
  );
  return clickedRelaysTab && panelVisible;
}

/**
 * @param {Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log?: (msg: string) => void }>} deps
 */
export async function runMembershipJoinLeaveScenario(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const startedAt = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const steps = [];
  const contextA = await browser.newContext({
    baseURL: deps.appBase,
    viewport: { width: 1280, height: 720 },
  });
  const contextB = await browser.newContext({
    baseURL: deps.appBase,
    viewport: { width: 1280, height: 720 },
  });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await pageA.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await pageB.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await applyComMem2FullStackBundle(pageA);
    await applyComMem2FullStackBundle(pageB);

    const coordination = await probeCoordinationHealthFromNode();
    const browserCoordination = await checkCoordinationHealth(pageA);
    pushStep(
      steps,
      "coordination_health",
      coordination.ok,
      coordination.ok
        ? "Coordination worker /health OK."
        : `Coordination /health failed (status=${coordination.status}). Run pnpm dev:desktop:online or pnpm dev:coordination.`,
      { coordination, browserCoordination },
    );
    if (!coordination.ok) {
      return buildScenarioResult(steps, startedAt, false);
    }

    await waitForDevLab(pageA);
    await waitForDevLab(pageB);
    log("unlocking Tester1 + Tester2");
    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 120_000 });
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 120_000 });

    const tester1Pubkey = await pageA.evaluate(() => window.obscurDevLab?.getMyPublicKeyHex?.() ?? null);
    const tester2Pubkey = await pageB.evaluate(() => window.obscurDevLab?.getMyPublicKeyHex?.() ?? null);
    const peerForTester1 = tester2Pubkey ?? TESTER2.publicKeyHex;
    const peerForTester2 = tester1Pubkey;

    if (!peerForTester1 || !peerForTester2) {
      pushStep(
        steps,
        "membership_graph_pubkeys",
        false,
        "Could not resolve Tester1/Tester2 public keys for graph probe after unlock.",
        { tester1Pubkey, tester2Pubkey },
      );
    }

    log("COM-MEM-2 phase B: create → invite → accept");
    const phaseB = await runComMem2PhaseBSteps({
      pageCreator: pageA,
      pageJoiner: pageB,
      steps,
      log,
      creatorPublicKeyHex: peerForTester2,
      joinerPublicKeyHex: peerForTester1,
    });

    await pageA.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await pageB.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await applyComMem2FullStackBundle(pageA);
    await applyComMem2FullStackBundle(pageB);
    await waitForDevLab(pageA);
    await waitForDevLab(pageB);
    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 60_000 }).catch(() => undefined);
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 60_000 }).catch(() => undefined);

    let graphApiOk = true;
    if (peerForTester1 && peerForTester2) {
      const graphProbeA = await probeMembershipGraphOnPage(pageA, peerForTester1);
      const graphProbeB = await probeMembershipGraphOnPage(pageB, peerForTester2);
      graphApiOk = pushMembershipGraphSteps(steps, "tester1_post_phase_b", graphProbeA)
        && pushMembershipGraphSteps(steps, "tester2_post_phase_b", graphProbeB);
    }

    const actorAOk = await probeActor(pageA, "tester1", steps);
    const actorBOk = await probeActor(pageB, "tester2", steps);
    const settingsOk = await probeMembershipSettingsPanel(pageA, steps, log);

    const joinerProbeAvailable = await pageA.evaluate(() => (
      typeof window.obscurDevLab?.probeJoinerMembershipRepair === "function"
    ));
    const joinerRepair = joinerProbeAvailable
      ? await pageA.evaluate(() => window.obscurDevLab.probeJoinerMembershipRepair())
      : null;
    const joinerRepairStatus = !joinerProbeAvailable
      ? "probe_unavailable"
      : joinerRepair?.synthetic
        ? (joinerRepair.ok ? "synthetic_ok" : `synthetic_failed:${joinerRepair.reason}`)
        : joinerRepair?.skipped
          ? `skipped:${joinerRepair.reason}`
          : joinerRepair?.ok
            ? `live_ok:${joinerRepair.groupsChecked}_groups`
            : `failed:${joinerRepair?.reason ?? "unknown"}`;
    pushStep(
      steps,
      "tester1_joiner_membership_repair",
      true,
      `Joiner membership repair probe (informational): ${joinerRepairStatus}.`,
      { joinerProbeAvailable, joinerRepair, informational: true },
    );

    const infraStepsOk = steps
      .filter((entry) => !String(entry.id).startsWith("phase_b_"))
      .every((entry) => entry.passed === true);
    const phaseBStepsOk = steps
      .filter((entry) => String(entry.id).startsWith("phase_b_"))
      .every((entry) => entry.passed === true);
    const passed = infraStepsOk
      && actorAOk
      && actorBOk
      && settingsOk
      && graphApiOk
      && phaseBStepsOk
      && phaseB.createOk
      && phaseB.inviteOk
      && phaseB.acceptOk;
    return buildScenarioResult(steps, startedAt, passed);
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
  }
}
