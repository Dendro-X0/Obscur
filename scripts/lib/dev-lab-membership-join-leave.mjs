/**
 * membership-join-leave — dual-browser membership truth probes (CLI).
 *
 * Requires: pnpm dev:desktop:online (coordination on :8787).
 * Note: full join/leave publish is stubbed while group backend is visual-only;
 * this scenario proves coordination health, network chrome, M8 capture, and digest gates on both actors.
 */

import { evaluateMembershipDigestGates } from "./dev-lab-digest-policy.mjs";
import { applyDevOperatorBundle, ensureDevLabAccountUnlocked } from "./dev-lab-playwright-auth.mjs";
import {
  checkCoordinationHealth,
  clickSidebarLink,
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
    await pageA.goto("/");
    await pageB.goto("/");
    await applyDevOperatorBundle(pageA);
    await applyDevOperatorBundle(pageB);

    const coordination = await checkCoordinationHealth(pageA);
    pushStep(
      steps,
      "coordination_health",
      coordination.ok,
      coordination.ok
        ? "Coordination worker /health OK."
        : `Coordination /health failed (status=${coordination.status}). Start pnpm dev:desktop:online.`,
      { coordination },
    );
    if (!coordination.ok) {
      return buildScenarioResult(steps, startedAt, false);
    }

    await waitForDevLab(pageA);
    await waitForDevLab(pageB);
    log("unlocking Tester1 + Tester2");
    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 120_000 });
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 120_000 });

    const actorAOk = await probeActor(pageA, "tester1", steps);
    const actorBOk = await probeActor(pageB, "tester2", steps);
    const settingsOk = await probeMembershipSettingsPanel(pageA, steps, log);

    const joinerProbeAvailable = await pageA.evaluate(() => (
      typeof window.obscurDevLab?.probeJoinerMembershipRepair === "function"
    ));
    const joinerRepair = joinerProbeAvailable
      ? await pageA.evaluate(() => window.obscurDevLab.probeJoinerMembershipRepair())
      : null;
    const joinerRepairOk = !joinerProbeAvailable
      || joinerRepair?.ok === true
      || joinerRepair?.skipped === true;
    pushStep(
      steps,
      "tester1_joiner_membership_repair",
      joinerRepairOk,
      !joinerProbeAvailable
        ? "Joiner membership repair probe skipped (rebuild static shell: pnpm dev:desktop:online -- --rebuild)."
        : joinerRepair?.skipped
          ? `Joiner membership repair probe skipped (${joinerRepair.reason}).`
          : joinerRepair?.ok
            ? `Joiner membership repair probe passed (${joinerRepair.groupsChecked} group(s)).`
            : `Joiner membership repair probe failed: ${joinerRepair?.reason ?? "unknown"}`,
      { joinerProbeAvailable, joinerRepair },
    );

    const passed = steps.every((entry) => entry.passed === true)
      && actorAOk
      && actorBOk
      && settingsOk
      && joinerRepairOk;
    return buildScenarioResult(steps, startedAt, passed);
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
  }
}
