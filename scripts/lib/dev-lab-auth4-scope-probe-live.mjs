/**
 * auth4-scope-probe-live — dual-browser AUTH-4 profile scope isolation.
 */

import { applyDevOperatorBundle, ensureDevLabAccountUnlocked } from "./dev-lab-playwright-auth.mjs";
import {
  formatDevLabShellRebuildMessage,
  readDevLabShellCapabilities,
} from "./dev-lab-playwright-capabilities.mjs";
import { reloadDevLabPage } from "./dev-lab-playwright-reload.mjs";
import { waitForDevLab } from "./dev-lab-playwright-shared.mjs";

function buildScenarioResult(steps, startedAt, passed) {
  return {
    id: "auth4-scope-probe-live",
    name: "AUTH-4 profile scope isolation (CLI dual browser)",
    category: "auth",
    passed,
    durationMs: Date.now() - startedAt,
    steps,
  };
}

function pushStep(steps, id, passed, message, context = undefined) {
  steps.push({ id, passed, message, durationMs: 0, context });
}

const fingerprint = (snapshot) => {
  if (!snapshot) {
    return "";
  }
  const scopes = (snapshot.managedGroupScopes ?? [])
    .map((entry) => `${entry.groupId}::${entry.relayUrl}`)
    .sort()
    .join("|");
  return `${snapshot.profileId}::${snapshot.publicKeyHex}::${scopes}::${snapshot.leaveOutboxCount}`;
};

const readScopeSnapshot = async (page) => page.evaluate(() => (
  window.obscurDevLab?.probeMembershipScope?.() ?? null
));

/**
 * @param {Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log?: (msg: string) => void }>} deps
 */
export async function runAuth4ScopeProbeLiveScenario(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const startedAt = Date.now();
  /** @type {Array<Record<string, unknown>>} */
  const steps = [];
  const contextA = await browser.newContext({ baseURL: deps.appBase });
  const contextB = await browser.newContext({ baseURL: deps.appBase });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await pageA.goto("/");
    await pageB.goto("/");
    await applyDevOperatorBundle(pageA);
    await applyDevOperatorBundle(pageB);
    await waitForDevLab(pageA);
    await waitForDevLab(pageB);

    log("unlocking Tester1 + Tester2 for AUTH-4");
    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 120_000 });
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 120_000 });

    const shellCaps = await readDevLabShellCapabilities(pageA, {
      requiredScenarioIds: ["auth4-scope-probe", "trust-fixtures"],
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
    const scopeB = await readScopeSnapshot(pageB);
    const fpA0 = fingerprint(scopeA0);
    const fpB = fingerprint(scopeB);

    pushStep(
      steps,
      "distinct_public_keys",
      Boolean(scopeA0?.publicKeyHex && scopeB?.publicKeyHex && scopeA0.publicKeyHex !== scopeB.publicKeyHex),
      scopeA0?.publicKeyHex !== scopeB?.publicKeyHex
        ? "Tester1 and Tester2 scope pubkeys differ."
        : "Profile pubkeys not distinct.",
      { scopeA0, scopeB },
    );

    pushStep(
      steps,
      "distinct_fingerprints",
      fpA0 !== fpB && fpA0.length > 0 && fpB.length > 0,
      fpA0 !== fpB
        ? "Scope fingerprints differ between profiles."
        : "Scope fingerprints overlap — possible cross-profile bleed.",
      { fpA0, fpB },
    );

    log("reload Tester1 for scope convergence check");
    await reloadDevLabPage(pageA);
    await applyDevOperatorBundle(pageA);
    await waitForDevLab(pageA);
    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 90_000 });

    const scopeA1 = await readScopeSnapshot(pageA);
    const fpA1 = fingerprint(scopeA1);
    pushStep(
      steps,
      "tester1_reload_fingerprint_stable",
      fpA0 === fpA1,
      fpA0 === fpA1
        ? "Tester1 scope fingerprint stable after reload."
        : `Tester1 fingerprint changed: ${fpA0} → ${fpA1}`,
      { fpA0, fpA1, scopeA0, scopeA1 },
    );

    const digestA = await pageA.evaluate(() => (
      window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400)?.summary?.accountSwitchScopeConvergence ?? null
    ));
    const digestRiskOk = !digestA
      || digestA.riskLevel === "none"
      || digestA.riskLevel === "watch"
      || (
        digestA.riskLevel === "high"
        && digestA.latestRuntimeActivationReasonCode === "projection_profile_mismatch_bound_profile"
        && Boolean(scopeA0?.publicKeyHex)
      );
    pushStep(
      steps,
      "account_switch_scope_digest",
      digestRiskOk,
      digestRiskOk
        ? `accountSwitchScopeConvergence acceptable (${digestA?.riskLevel ?? "none"}).`
        : `accountSwitchScopeConvergence high risk (${digestA?.riskLevel}).`,
      { digestA },
    );

    const passed = steps.every((entry) => entry.passed === true);
    return buildScenarioResult(steps, startedAt, passed);
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
  }
}
