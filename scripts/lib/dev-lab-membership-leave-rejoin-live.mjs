/**
 * membership-leave-rejoin-live — dual-browser membership stability after cold reload.
 *
 * Requires: pnpm dev:desktop:online (coordination on :8787).
 * Proves: scope snapshots stable after Tester2 reload; leave zombie gates; joiner probes.
 */

import { evaluateMembershipDigestGates } from "./dev-lab-digest-policy.mjs";
import { applyDevOperatorBundle, ensureDevLabAccountUnlocked } from "./dev-lab-playwright-auth.mjs";
import {
  formatDevLabShellRebuildMessage,
  readDevLabShellCapabilities,
} from "./dev-lab-playwright-capabilities.mjs";
import { reloadDevLabPage } from "./dev-lab-playwright-reload.mjs";
import {
  checkCoordinationHealth,
  readMembershipDigestSummary,
  waitForDevLab,
} from "./dev-lab-playwright-shared.mjs";

function buildScenarioResult(steps, startedAt, passed) {
  return {
    id: "membership-leave-rejoin-live",
    name: "Membership leave/rejoin live stability (CLI dual browser)",
    category: "network",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}

function pushStep(steps, id, passed, message, context = undefined) {
  steps.push({ id, passed, message, durationMs: 0, context });
}

const readScopeSnapshot = async (page) => page.evaluate(() => {
  if (typeof window.obscurDevLab?.probeMembershipScope !== "function") {
    return null;
  }
  return window.obscurDevLab.probeMembershipScope();
});

const compareScopeSnapshots = (before, after) => {
  const issues = [];
  if (!before || !after) {
    return { stable: false, issues: ["missing_snapshot"] };
  }
  if (before.profileId !== after.profileId) {
    issues.push("profile_id_changed");
  }
  if (before.publicKeyHex !== after.publicKeyHex) {
    issues.push("public_key_changed");
  }
  if (before.leaveOutboxCount !== after.leaveOutboxCount) {
    issues.push(`leave_outbox_${before.leaveOutboxCount}_to_${after.leaveOutboxCount}`);
  }
  const beforeKeys = new Set((before.managedGroupScopes ?? []).map((entry) => `${entry.groupId}::${entry.relayUrl}`));
  const afterKeys = new Set((after.managedGroupScopes ?? []).map((entry) => `${entry.groupId}::${entry.relayUrl}`));
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      issues.push(`group_lost_${key}`);
    }
  }
  if (after.joinerProbe?.ok === false && after.joinerProbe?.skipped !== true) {
    issues.push(`joiner_probe_${after.joinerProbe.reason}`);
  }
  return { stable: issues.length === 0, issues };
};

/**
 * @param {Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log?: (msg: string) => void }>} deps
 */
export async function runMembershipLeaveRejoinLiveScenario(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const startedAt = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const steps = [];
  const contextA = await browser.newContext({ baseURL: deps.appBase, viewport: { width: 1280, height: 720 } });
  const contextB = await browser.newContext({ baseURL: deps.appBase, viewport: { width: 1280, height: 720 } });
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
      coordination.ok ? "Coordination /health OK." : `Coordination failed (status=${coordination.status}).`,
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

    const shellCaps = await readDevLabShellCapabilities(pageA, {
      requiredScenarioIds: ["membership-leave-rejoin-zombie"],
    });
    if (!shellCaps.hasScopeProbe) {
      pushStep(
        steps,
        "shell_capabilities",
        false,
        formatDevLabShellRebuildMessage(shellCaps),
        { shellCaps },
      );
      return buildScenarioResult(steps, startedAt, false);
    }
    pushStep(steps, "shell_capabilities", true, "Dev Lab Phase 2 shell surface present.", { shellCaps });

    const scopeA0 = await readScopeSnapshot(pageA);
    const scopeB0 = await readScopeSnapshot(pageB);
    pushStep(
      steps,
      "baseline_scope_captured",
      Boolean(scopeA0?.publicKeyHex && scopeB0?.publicKeyHex),
      scopeA0?.publicKeyHex && scopeB0?.publicKeyHex
        ? "Baseline membership scope snapshots captured."
        : "Failed to capture baseline scope snapshots.",
      { scopeA0, scopeB0 },
    );

    if (scopeA0?.publicKeyHex && scopeB0?.publicKeyHex && scopeA0.publicKeyHex === scopeB0.publicKeyHex) {
      pushStep(steps, "profile_isolation", false, "Tester1 and Tester2 share public key — profile isolation broken.", {});
      return buildScenarioResult(steps, startedAt, false);
    }
    pushStep(steps, "profile_isolation", true, "Tester1 and Tester2 have distinct public keys.", {});

    log("cold reload Tester2");
    await reloadDevLabPage(pageB);
    await applyDevOperatorBundle(pageB);
    await waitForDevLab(pageB);
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 90_000 });

    const scopeB1 = await readScopeSnapshot(pageB);
    const reloadStable = compareScopeSnapshots(scopeB0, scopeB1);
    pushStep(
      steps,
      "tester2_reload_scope_stable",
      reloadStable.stable,
      reloadStable.stable
        ? "Tester2 membership scope stable after reload."
        : `Tester2 scope drift after reload: ${reloadStable.issues.join(", ")}`,
      { scopeB0, scopeB1, issues: reloadStable.issues },
    );

    const leaveZombie = await pageA.evaluate(() => {
      if (typeof window.obscurDevLab?.runScenario !== "function") {
        return { ok: false, reason: "dev_lab_unavailable" };
      }
      return window.obscurDevLab.runScenario("membership-leave-rejoin-zombie").then((result) => ({
        ok: result.passed,
        steps: result.steps?.map((step) => ({ id: step.id, passed: step.passed })),
      }));
    });
    pushStep(
      steps,
      "leave_zombie_gates",
      leaveZombie?.ok === true,
      leaveZombie?.ok
        ? "Leave zombie synthetic gates passed on Tester1."
        : `Leave zombie gates failed: ${leaveZombie?.reason ?? "scenario_failed"}`,
      { leaveZombie },
    );

    const summaryB = await readMembershipDigestSummary(pageB);
    const membershipGates = evaluateMembershipDigestGates(summaryB);
    pushStep(
      steps,
      "tester2_membership_digest",
      membershipGates.passed,
      membershipGates.passed
        ? "Tester2 membership digest gates acceptable after reload."
        : `Tester2 membership digest failed: ${membershipGates.failures.map((f) => `${f.key}=${f.riskLevel}`).join(", ")}`,
      { failures: membershipGates.failures },
    );

    const passed = steps.every((entry) => entry.passed === true);
    return buildScenarioResult(steps, startedAt, passed);
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
  }
}
