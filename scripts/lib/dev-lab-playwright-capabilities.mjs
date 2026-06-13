/**
 * Probe whether the loaded shell includes the requested Dev Lab surface.
 */

/**
 * @param {import('playwright').Page} page
 * @param {Readonly<{ requiredScenarioIds?: ReadonlyArray<string> }>} [options]
 */
export async function readDevLabShellCapabilities(page, options = {}) {
  return page.evaluate((requiredScenarioIds) => {
    const listScenarios = window.obscurDevLab?.listScenarios?.() ?? [];
    const scenarioIds = listScenarios.map((entry) => entry.id);
    const missingScenarioIds = (requiredScenarioIds ?? []).filter((id) => !scenarioIds.includes(id));
    return {
      devLabReady: typeof window.obscurDevLab?.unlock === "function",
      hasScopeProbe: typeof window.obscurDevLab?.probeMembershipScope === "function",
      hasCreateZombiePersona: typeof window.obscurDevLab?.createZombiePersona === "function",
      scenarioIds,
      missingScenarioIds,
    };
  }, options.requiredScenarioIds ?? []);
}

/**
 * @param {Readonly<{ devLabReady?: boolean; hasScopeProbe?: boolean; missingScenarioIds?: ReadonlyArray<string> }>} caps
 */
export function formatDevLabShellRebuildMessage(caps) {
  const parts = ["Static shell missing Dev Lab Phase 2 surface."];
  if (caps.missingScenarioIds?.length) {
    parts.push(`Missing scenarios: ${caps.missingScenarioIds.join(", ")}.`);
  }
  if (!caps.hasScopeProbe) {
    parts.push("Missing probeMembershipScope API.");
  }
  parts.push("Rebuild: pnpm dev:desktop:online -- --rebuild");
  return parts.join(" ");
}

/**
 * @param {import('playwright').Page} page
 * @param {Readonly<{ requiredScenarioIds?: ReadonlyArray<string> }>} options
 */
export async function assertDevLabShellCapabilities(page, options = {}) {
  const caps = await readDevLabShellCapabilities(page, options);
  const missingApis = !caps.devLabReady || !caps.hasScopeProbe;
  const missingScenarios = (caps.missingScenarioIds?.length ?? 0) > 0;
  if (missingApis || missingScenarios) {
    throw new Error(formatDevLabShellRebuildMessage(caps));
  }
  return caps;
}
