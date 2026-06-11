import { SETTINGS_VALID_TABS } from "@/app/settings/settings-nav";
import { GROUP_MESSAGING_STUB_MESSAGE } from "@/app/features/groups/services/group-messaging-stub-policy";
import { getPublicProfileHref } from "@/app/features/navigation/public-routes";
import {
  DISCOVERY_EXACT_MATCH_ELEMENT_ID,
  discoverySearchResultElementId,
} from "@/app/shared/search-target-highlight";
import { DEV_LAB_ACCOUNTS } from "./dev-lab-accounts";
import {
  evaluateDmContinuityDigestGate,
  evaluateMembershipDigestGates,
  readCrossDeviceDigestSummary,
} from "./dev-lab-digest-policy";
import { probeDevLabShellHealth } from "./dev-lab-shell-health";
import type { DevLabScenarioStepResult } from "./dev-lab-types";

const MAIN_ROUTES = [
  { label: "Network", href: "/network" },
  { label: "Settings", href: "/settings" },
  { label: "Search", href: "/search" },
  { label: "Chats", href: "/" },
] as const;

const step = (
  id: string,
  passed: boolean,
  message: string,
  startedAt: number,
  context?: Readonly<Record<string, unknown>>,
): DevLabScenarioStepResult => ({
  id,
  passed,
  message,
  durationMs: Date.now() - startedAt,
  context,
});

export const delay = (ms: number): Promise<void> => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

const fillReactControlledInput = (element: HTMLInputElement, value: string): void => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  const setter = descriptor?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
};

const clickButtonByLabel = (label: string): boolean => {
  const buttons = document.querySelectorAll("button");
  for (const button of buttons) {
    if (button instanceof HTMLButtonElement && button.textContent?.trim() === label) {
      button.click();
      return true;
    }
  }
  return false;
};

const waitForElementById = async (
  elementId: string,
  timeoutMs = 20_000,
): Promise<HTMLElement | null> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const element = document.getElementById(elementId);
    if (element instanceof HTMLElement) {
      return element;
    }
    await delay(250);
  }
  return null;
};

const bodyContainsText = (needle: string): boolean => (
  typeof document !== "undefined"
  && document.body.textContent?.includes(needle) === true
);

const pathnameMatchesRoute = (pathname: string, routePath: string): boolean => {
  const normalized = routePath.startsWith("/") ? routePath : `/${routePath}`;
  if (normalized === "/") {
    return pathname === "/" || pathname.length === 0;
  }
  return pathname === normalized || pathname.startsWith(`${normalized}/`);
};

const clickSidebar = (label: string): boolean => {
  const link = document.querySelector(`a[aria-label="${label}"]`);
  if (link instanceof HTMLElement) {
    link.click();
    return true;
  }
  return false;
};

const clickSidebarByHref = (href: string): boolean => {
  const path = href.startsWith("/") ? href : `/${href}`;
  const selectors = [
    `.sidebar-interactive a[href="${path}"]`,
    `a.nav-link[href="${path}"]`,
    `a[href="${path}"][aria-label]`,
  ];
  for (const selector of selectors) {
    const link = document.querySelector(selector);
    if (link instanceof HTMLElement) {
      link.click();
      return true;
    }
  }
  return false;
};

const waitForPathname = async (routePath: string, timeoutMs = 15_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pathnameMatchesRoute(window.location.pathname, routePath)) {
      return true;
    }
    await delay(200);
  }
  return pathnameMatchesRoute(window.location.pathname, routePath);
};

/** Client-side navigation only — avoids location.assign (breaks Playwright evaluate). */
const navigateViaSidebar = async (label: string, fallbackPath: string): Promise<boolean> => {
  const path = fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`;
  if (
    pathnameMatchesRoute(window.location.pathname, path)
    || `${window.location.pathname}${window.location.search}` === path
  ) {
    return true;
  }
  const clicked = clickSidebarByHref(path) || clickSidebar(label);
  if (!clicked) {
    return false;
  }
  return waitForPathname(path);
};

const openSettingsRoute = async (): Promise<void> => {
  if (window.location.pathname.startsWith("/settings")) {
    return;
  }
  await navigateViaSidebar("Settings", "/settings");
};

const clickSettingsTab = (tabId: string): boolean => {
  const button = document.querySelector(`[data-settings-tab="${tabId}"]`);
  if (button instanceof HTMLElement) {
    button.click();
    return true;
  }
  return false;
};

export const runShellHealthStep = async (stepId = "shell_health"): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const health = probeDevLabShellHealth();
  return step(
    stepId,
    health.healthy,
    health.healthy ? "Shell healthy." : `Shell unhealthy: ${health.issues.join(", ")}`,
    startedAt,
    { health },
  );
};

export const runUnlockAndShellStep = async (
  unlock: () => Promise<void>,
): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const unlockStarted = Date.now();
  try {
    await unlock();
  } catch (error) {
    return [
      step(
        "unlock",
        false,
        error instanceof Error ? error.message : "Unlock failed",
        unlockStarted,
      ),
    ];
  }

  const pollStarted = Date.now();
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const health = probeDevLabShellHealth();
    if (health.shellUnlocked && !health.rootFatalBoundary) {
      return [
        step("unlock", true, "Unlock invoked.", unlockStarted),
        step("post_unlock_health", true, "Shell healthy after unlock.", pollStarted, { health }),
      ];
    }
    await delay(500);
  }

  return [
    step("unlock", true, "Unlock invoked.", unlockStarted),
    await runShellHealthStep("post_unlock_health"),
  ];
};

export const runNavigationMatrixSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  for (const route of MAIN_ROUTES) {
    const startedAt = Date.now();
    const navOk = await navigateViaSidebar(route.label, route.href);
    await delay(400);
    const health = probeDevLabShellHealth();
    results.push(step(
      `nav_${route.href.replace(/\//g, "_") || "home"}`,
      navOk && health.healthy && !health.rootFatalBoundary,
      health.healthy
        ? `Route ${route.href} healthy.`
        : `Route ${route.href} failed: ${health.issues.join(", ")}`,
      startedAt,
      { route: route.href, health },
    ));
    if (health.rootFatalBoundary) {
      break;
    }
  }
  return results;
};

export const runSettingsTabSweepSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const enterStarted = Date.now();
  await openSettingsRoute();
  await delay(800);
  const enterHealth = probeDevLabShellHealth();
  results.push(step(
    "settings_enter",
    !enterHealth.rootFatalBoundary,
    enterHealth.rootFatalBoundary
      ? "Settings route hit fatal boundary."
      : "Settings route loaded.",
    enterStarted,
    { health: enterHealth },
  ));
  if (enterHealth.rootFatalBoundary) {
    return results;
  }

  for (const tabId of SETTINGS_VALID_TABS) {
    const startedAt = Date.now();
    if (!clickSettingsTab(tabId)) {
      results.push(step(
        `settings_tab_${tabId}`,
        false,
        `Settings tab button missing for ${tabId}.`,
        startedAt,
        { tabId },
      ));
      continue;
    }
    await delay(900);
    const health = probeDevLabShellHealth();
    const tabBoundary = document.querySelector(`[data-testid="settings-tab-error-${tabId}"]`);
    const passed = !health.rootFatalBoundary && !tabBoundary;
    results.push(step(
      `settings_tab_${tabId}`,
      passed,
      passed
        ? `Tab ${tabId} mounted without boundary.`
        : `Tab ${tabId} failed: ${health.issues.join(", ")}${tabBoundary ? " (tab boundary)" : ""}`,
      startedAt,
      { tabId, health, tabBoundary: Boolean(tabBoundary) },
    ));
    if (health.rootFatalBoundary) {
      break;
    }
  }
  return results;
};

export const runColdReloadStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  window.location.reload();
  await delay(2500);
  const health = probeDevLabShellHealth();
  return step(
    "cold_reload",
    health.healthy,
    health.healthy ? "Shell healthy after reload." : `Unhealthy after reload: ${health.issues.join(", ")}`,
    startedAt,
    { health },
  );
};

export const runM0ApisStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const m0 = typeof window.obscurM0Triage?.capture === "function"
    ? window.obscurM0Triage.capture(80)
    : null;
  const apis = (m0 as { checks?: { requiredApis?: Record<string, boolean> } } | null)?.checks?.requiredApis ?? {};
  const passed = apis.appEvents === true && apis.relayRuntime === true && apis.windowRuntime === true;
  return step(
    "m0_required_apis",
    passed,
    passed ? "M0 required APIs present." : "M0 required APIs missing.",
    startedAt,
    { requiredApis: apis },
  );
};

const DEV_LAB_DIGEST_HIGH_RISK_ALLOWLIST = new Set([
  // Fresh Playwright profiles import Tester1 programmatically — scope convergence is expected once.
  "accountSwitchScopeConvergence",
]);

export const runDigestGateStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const digest = typeof window.obscurAppEvents?.getCrossDeviceSyncDigest === "function"
    ? window.obscurAppEvents.getCrossDeviceSyncDigest(200)
    : null;
  const summary = readCrossDeviceDigestSummary(digest);
  const highRisks = Object.entries(summary)
    .filter(([key, value]) => (
      value?.riskLevel === "high"
      && !DEV_LAB_DIGEST_HIGH_RISK_ALLOWLIST.has(key)
    ))
    .map(([key]) => key);
  const recentErrors = ((digest as { recentWarnOrError?: ReadonlyArray<{ level?: string }> } | null)?.recentWarnOrError ?? [])
    .filter((entry) => entry.level === "error");
  const passed = highRisks.length === 0 && recentErrors.length === 0;
  return step(
    "digest_gates",
    passed,
    passed
      ? "Digest gates acceptable."
      : `Digest gates failed: high=${highRisks.join(",") || "none"} errors=${recentErrors.length}`,
    startedAt,
    { highRisks, recentErrorCount: recentErrors.length },
  );
};

export const runDigestMembershipGateStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const digest = typeof window.obscurAppEvents?.getCrossDeviceSyncDigest === "function"
    ? window.obscurAppEvents.getCrossDeviceSyncDigest(400)
    : null;
  const summary = readCrossDeviceDigestSummary(digest);
  const membership = evaluateMembershipDigestGates(summary);
  const recentErrors = ((digest as { recentWarnOrError?: ReadonlyArray<{ level?: string }> } | null)?.recentWarnOrError ?? [])
    .filter((entry) => entry.level === "error");
  const passed = membership.passed && recentErrors.length === 0;
  const failureSummary = membership.failures
    .map((failure) => `${failure.key}=${failure.riskLevel}`)
    .join(", ");
  return step(
    "membership_digest_gates",
    passed,
    passed
      ? "Membership digest gates acceptable."
      : `Membership digest gates failed: ${failureSummary || "unknown"} errors=${recentErrors.length}`,
    startedAt,
    {
      failures: membership.failures,
      summaries: membership.summaries,
      recentErrorCount: recentErrors.length,
    },
  );
};

export const runDmReloadHistorySeedSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const lab = window.obscurDevLab;
  const readyStarted = Date.now();
  if (!lab?.sendSyntheticDm || !lab.getMessagesForPeer) {
    return [step("dm_bridge_ready", false, "Dev Lab messaging bridge not ready.", readyStarted)];
  }
  const status = lab.getMessagingStatus?.() ?? null;
  results.push(step(
    "dm_bridge_ready",
    status === "ready" || status === null,
    status === "ready" || status === null
      ? "Messaging bridge ready."
      : `DM controller status: ${status ?? "unknown"}`,
    readyStarted,
    { status },
  ));

  const peer = DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? "";
  const markerText = `dev-lab-reload-seed-${Date.now()}`;
  const sendStarted = Date.now();
  let sendResult: { success?: boolean; deliveryStatus?: string; error?: string | null } = {};
  try {
    sendResult = await lab.sendSyntheticDm({ peerPublicKeyHex: peer, text: markerText });
  } catch (error) {
    return [
      ...results,
      step(
        "dm_seed_send",
        false,
        error instanceof Error ? error.message : "sendSyntheticDm threw",
        sendStarted,
      ),
    ];
  }
  const sendPassed = sendResult.success !== false && sendResult.deliveryStatus !== "failed";
  results.push(step(
    "dm_seed_send",
    sendPassed,
    sendPassed
      ? `Seed message accepted (${sendResult.deliveryStatus ?? "ok"}).`
      : `Seed send failed: ${sendResult.error ?? sendResult.deliveryStatus ?? "unknown"}`,
    sendStarted,
    { sendResult, markerText },
  ));
  if (!sendPassed) {
    return results;
  }

  await delay(800);
  const countStarted = Date.now();
  const messages = lab.getMessagesForPeer(peer);
  const hasMarker = messages.some((message) => message.content === markerText);
  results.push(step(
    "dm_count_before_reload",
    hasMarker,
    hasMarker
      ? `Peer thread has ${messages.length} message(s) including marker (reload via CLI).`
      : `Marker missing before reload (count=${messages.length}).`,
    countStarted,
    { count: messages.length, markerText, hasMarker },
  ));

  const digestStarted = Date.now();
  const digest = typeof window.obscurAppEvents?.getCrossDeviceSyncDigest === "function"
    ? window.obscurAppEvents.getCrossDeviceSyncDigest(400)
    : null;
  const summary = readCrossDeviceDigestSummary(digest);
  const continuity = evaluateDmContinuityDigestGate(summary);
  results.push(step(
    "dm_continuity_digest",
    continuity.passed,
    continuity.passed
      ? `DM continuity digest acceptable (${continuity.riskLevel}).`
      : `DM continuity digest too high (${continuity.riskLevel}).`,
    digestStarted,
    { continuity },
  ));

  return results;
};

export const runRuntimeIssuesStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const issues = window.obscurDevRuntimeIssues?.getRecentIssues() ?? [];
  const errors = issues.filter((issue) => issue.severity === "error");
  const passed = errors.length === 0;
  return step(
    "runtime_issues",
    passed,
    passed
      ? "No terminal dev runtime issues recorded."
      : `${errors.length} dev runtime error(s) recorded.`,
    startedAt,
    { errorCount: errors.length, sample: errors.slice(0, 3).map((e) => e.message) },
  );
};

export const runChatsChromeStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const chatsNavOk = await navigateViaSidebar("Chats", "/");
  await delay(400);
  const health = probeDevLabShellHealth();
  const passed = chatsNavOk && health.healthy && health.shellUnlocked;
  return step(
    "chats_chrome",
    passed,
    passed ? "Chats route healthy." : "Chats route failed or shell not unlocked.",
    startedAt,
    { health },
  );
};

export const runNetworkChromeStep = async (): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const networkNavOk = await navigateViaSidebar("Network", "/network");
  await delay(400);
  const health = probeDevLabShellHealth();
  const passed = networkNavOk && health.healthy && !health.rootFatalBoundary;
  return step(
    "network_chrome",
    passed,
    passed ? "Network route healthy." : `Network route failed: ${health.issues.join(", ")}`,
    startedAt,
    { health },
  );
};

export const devLabScenarioStepsInternals = {
  MAIN_ROUTES,
  fillReactControlledInput,
  discoverySearchResultElementId,
};

export const runRelayToggleStressSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const enterStarted = Date.now();
  await openSettingsRoute();
  if (!clickSettingsTab("relays")) {
    await delay(300);
    clickSettingsTab("relays");
  }
  await delay(900);
  let health = probeDevLabShellHealth();
  results.push(step(
    "relays_enter",
    !health.rootFatalBoundary,
    health.rootFatalBoundary ? "Relays tab hit fatal boundary." : "Relays tab loaded.",
    enterStarted,
    { health },
  ));
  if (health.rootFatalBoundary) {
    return results;
  }

  const categoryTabs = document.querySelectorAll('[aria-label="Relay categories"] [role="tab"]');
  for (let index = 0; index < categoryTabs.length; index += 1) {
    const startedAt = Date.now();
    const tab = categoryTabs[index];
    if (tab instanceof HTMLElement) {
      tab.click();
      await delay(450);
    }
    health = probeDevLabShellHealth();
    results.push(step(
      `relay_category_${index}`,
      health.healthy && !health.rootFatalBoundary,
      health.healthy ? `Relay category tab ${index} OK.` : `Relay category ${index} failed.`,
      startedAt,
      { health, index },
    ));
    if (health.rootFatalBoundary) {
      return results;
    }
  }

  const toggleStarted = Date.now();
  const availableToggle = document.querySelector('[role="switch"][aria-checked]');
  if (availableToggle instanceof HTMLElement) {
    availableToggle.click();
    await delay(400);
    availableToggle.click();
    await delay(400);
  }
  health = probeDevLabShellHealth();
  results.push(step(
    "relay_available_toggle",
    health.healthy && !health.rootFatalBoundary,
    health.healthy ? "Available-only toggle stress OK." : "Toggle stress failed.",
    toggleStarted,
    { health, toggled: Boolean(availableToggle) },
  ));
  if (health.rootFatalBoundary) {
    return results;
  }

  for (let cycle = 0; cycle < 5; cycle += 1) {
    const startedAt = Date.now();
    clickSettingsTab("relays");
    await delay(350);
    clickSettingsTab("profile");
    await delay(350);
    health = probeDevLabShellHealth();
    results.push(step(
      `relay_tab_ping_${cycle}`,
      !health.rootFatalBoundary,
      health.rootFatalBoundary ? `Tab ping ${cycle} hit fatal boundary.` : `Tab ping ${cycle} OK.`,
      startedAt,
      { health, cycle },
    ));
    if (health.rootFatalBoundary) {
      return results;
    }
  }

  const finalStarted = Date.now();
  clickSettingsTab("relays");
  await delay(500);
  health = probeDevLabShellHealth();
  results.push(step(
    "relays_final_health",
    health.healthy,
    health.healthy ? "Relays tab healthy after stress." : `Final relays health failed: ${health.issues.join(", ")}`,
    finalStarted,
    { health },
  ));
  return results;
};

export const runDmSendSyntheticSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const lab = window.obscurDevLab;
  const readyStarted = Date.now();
  if (!lab?.sendSyntheticDm) {
    return [step("dm_bridge_ready", false, "Dev Lab messaging bridge not ready.", readyStarted)];
  }
  const status = lab.getMessagingStatus?.() ?? null;
  results.push(step(
    "dm_bridge_ready",
    status === "ready" || status === null,
    status === "ready" || status === null
      ? "Messaging bridge ready."
      : `DM controller status: ${status ?? "unknown"}`,
    readyStarted,
    { status },
  ));

  const sendStarted = Date.now();
  const text = `dev-lab-synthetic-${Date.now()}`;
  const peer = DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? "";
  let sendResult: { success?: boolean; deliveryStatus?: string; error?: string | null } = {};
  try {
    sendResult = await lab.sendSyntheticDm({ peerPublicKeyHex: peer, text });
  } catch (error) {
    return [
      ...results,
      step(
        "dm_send",
        false,
        error instanceof Error ? error.message : "sendSyntheticDm threw",
        sendStarted,
      ),
    ];
  }
  const sendPassed = sendResult.success !== false && sendResult.deliveryStatus !== "failed";
  results.push(step(
    "dm_send",
    sendPassed,
    sendPassed
      ? `Synthetic DM send accepted (${sendResult.deliveryStatus ?? "ok"}).`
      : `Synthetic DM send failed: ${sendResult.error ?? sendResult.deliveryStatus ?? "unknown"}`,
    sendStarted,
    { sendResult, text },
  ));

  await delay(800);
  results.push(await runDigestGateStep());

  return results;
};

export const runSearchProfileJumpSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const peer = DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? "";
  const expectedProfilePath = getPublicProfileHref(peer);

  const enterStarted = Date.now();
  const searchNavOk = await navigateViaSidebar("Search", "/search");
  await delay(500);
  let health = probeDevLabShellHealth();
  results.push(step(
    "search_enter",
    searchNavOk && !health.rootFatalBoundary && window.location.pathname.startsWith("/search"),
    health.rootFatalBoundary
      ? "Search route hit fatal boundary."
      : searchNavOk && window.location.pathname.startsWith("/search")
        ? "Search route loaded."
        : "Search route did not load.",
    enterStarted,
    { health, pathname: window.location.pathname, searchNavOk },
  ));
  if (health.rootFatalBoundary || !searchNavOk) {
    return results;
  }

  const queryStarted = Date.now();
  const input = document.querySelector("form input");
  if (!(input instanceof HTMLInputElement)) {
    return [
      ...results,
      step("search_query", false, "Search input not found.", queryStarted),
    ];
  }
  fillReactControlledInput(input, peer);
  await delay(600);
  const form = input.closest("form");
  if (form instanceof HTMLFormElement) {
    form.requestSubmit();
  } else {
    clickButtonByLabel("Search");
  }
  await delay(400);

  const resultId = discoverySearchResultElementId(peer);
  const exactMatch = await waitForElementById(DISCOVERY_EXACT_MATCH_ELEMENT_ID, 20_000);
  const resultCard = exactMatch ?? await waitForElementById(resultId, 12_000);
  results.push(step(
    "search_result_visible",
    Boolean(resultCard),
    resultCard
      ? `Discovery result visible (${resultCard.id}).`
      : `No discovery result for ${peer.slice(0, 12)}…`,
    queryStarted,
    { resultId, exactMatch: Boolean(exactMatch) },
  ));
  if (!resultCard) {
    return results;
  }

  const clickStarted = Date.now();
  resultCard.click();
  await waitForPathname("/network/profile", 12_000);
  await delay(400);
  health = probeDevLabShellHealth();
  const onProfile = window.location.pathname.startsWith("/network/profile")
    && new URLSearchParams(window.location.search).get("pubkey") === peer;
  results.push(step(
    "profile_route",
    onProfile && !health.rootFatalBoundary,
    onProfile
      ? "Profile route opened from search result."
      : `Expected ${expectedProfilePath}, got ${window.location.pathname}${window.location.search}`,
    clickStarted,
    {
      health,
      pathname: window.location.pathname,
      search: window.location.search,
      expectedProfilePath,
    },
  ));
  return results;
};

export const runVaultChromeStep = async (stepId = "vault_chrome"): Promise<DevLabScenarioStepResult> => {
  const startedAt = Date.now();
  const vaultNavOk = await navigateViaSidebar("Vault", "/vault");
  await delay(400);
  const health = probeDevLabShellHealth();
  const onVault = vaultNavOk && window.location.pathname.startsWith("/vault");
  const passed = onVault && health.healthy && !health.rootFatalBoundary;
  return step(
    stepId,
    passed,
    passed
      ? "Vault route healthy."
      : onVault
        ? `Vault route unhealthy: ${health.issues.join(", ")}`
        : "Vault route did not load.",
    startedAt,
    { health, pathname: window.location.pathname, vaultNavOk },
  );
};

export const runGroupStubSendSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const lab = window.obscurDevLab;
  const readyStarted = Date.now();
  if (!lab?.probeGroupSendStub) {
    return [step("group_stub_bridge", false, "Dev Lab group stub probe not ready.", readyStarted)];
  }
  results.push(step("group_stub_bridge", true, "Group stub probe ready.", readyStarted));

  const uiStarted = Date.now();
  if (!clickSidebar("Chats")) {
    await navigateViaSidebar("Chats", "/");
  }
  await delay(600);
  clickButtonByLabel("Group");
  await delay(500);
  const groupRows = Array.from(document.querySelectorAll('[role="button"][tabindex="0"]'))
    .filter((element) => element instanceof HTMLElement && !element.closest("form"));
  const firstGroupRow = groupRows.find((element) => (
    element.textContent
    && !/^(chats|requests|chat|group)$/i.test(element.textContent.trim())
    && element.querySelector('[data-testid="conversation-row-avatar-button"]') === null
  ));
  if (firstGroupRow instanceof HTMLElement) {
    firstGroupRow.click();
    await delay(700);
    const textarea = document.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      const setter = descriptor?.set;
      if (setter) {
        setter.call(textarea, "dev-lab-group-stub");
      } else {
        textarea.value = "dev-lab-group-stub";
      }
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      const sendButton = document.querySelector('button[aria-label="Send"], button[aria-label="send"]');
      if (sendButton instanceof HTMLElement) {
        sendButton.click();
        await delay(600);
      }
    }
    results.push(step(
      "group_ui_send",
      true,
      "Attempted group composer send.",
      uiStarted,
      { hadGroupRow: true },
    ));
  } else {
    results.push(step(
      "group_ui_send",
      true,
      "No group thread in sidebar — API stub probe only.",
      uiStarted,
      { hadGroupRow: false },
    ));
  }

  const probeStarted = Date.now();
  let probeResult: { success?: boolean; message?: string } = {};
  try {
    probeResult = await lab.probeGroupSendStub();
  } catch (error) {
    return [
      ...results,
      step(
        "group_stub_probe",
        false,
        error instanceof Error ? error.message : "probeGroupSendStub threw",
        probeStarted,
      ),
    ];
  }
  await delay(500);
  const stubVisible = bodyContainsText(GROUP_MESSAGING_STUB_MESSAGE)
    || bodyContainsText("community backend");
  const health = probeDevLabShellHealth();
  const passed = probeResult.success !== false && stubVisible && !health.rootFatalBoundary;
  results.push(step(
    "group_stub_probe",
    passed,
    passed
      ? "Group stub toast shown without fatal boundary."
      : `Group stub failed: toast=${stubVisible} boundary=${health.rootFatalBoundary}`,
    probeStarted,
    { probeResult, stubVisible, health },
  ));
  return results;
};

const findConversationRowByLabel = (label: string): HTMLElement | null => {
  const rows = document.querySelectorAll('[role="button"][tabindex="0"]');
  for (const row of rows) {
    if (!(row instanceof HTMLElement)) {
      continue;
    }
    const text = row.textContent?.trim() ?? "";
    if (/^(chats|requests|chat|group)$/i.test(text)) {
      continue;
    }
    if (row.textContent?.includes(label)) {
      return row;
    }
  }
  return null;
};

export const runDmHistoryMonotonicSteps = async (): Promise<ReadonlyArray<DevLabScenarioStepResult>> => {
  const results: DevLabScenarioStepResult[] = [];
  const lab = window.obscurDevLab;
  const readyStarted = Date.now();
  if (!lab?.sendSyntheticDm || !lab.getMessagesForPeer) {
    return [step("dm_bridge_ready", false, "Dev Lab messaging bridge not ready.", readyStarted)];
  }
  const status = lab.getMessagingStatus?.() ?? null;
  results.push(step(
    "dm_bridge_ready",
    status === "ready" || status === null,
    status === "ready" || status === null
      ? "Messaging bridge ready."
      : `DM controller status: ${status ?? "unknown"}`,
    readyStarted,
    { status },
  ));

  const peer = DEV_LAB_ACCOUNTS.tester2.publicKeyHex ?? "";
  const peerLabel = DEV_LAB_ACCOUNTS.tester2.username;
  const runId = Date.now();
  const markers = [0, 1, 2].map((index) => `dev-lab-mono-${runId}-${index}`);
  const sendStarted = Date.now();
  for (const marker of markers) {
    try {
      const sendResult = await lab.sendSyntheticDm({ peerPublicKeyHex: peer, text: marker });
      const sendPassed = sendResult.success !== false && sendResult.deliveryStatus !== "failed";
      if (!sendPassed) {
        return [
          ...results,
          step(
            "dm_mono_send",
            false,
            `Send failed for marker ${marker}: ${sendResult.error ?? sendResult.deliveryStatus ?? "unknown"}`,
            sendStarted,
            { sendResult, marker },
          ),
        ];
      }
    } catch (error) {
      return [
        ...results,
        step(
          "dm_mono_send",
          false,
          error instanceof Error ? error.message : "sendSyntheticDm threw",
          sendStarted,
        ),
      ];
    }
    await delay(350);
  }
  results.push(step(
    "dm_mono_send",
    true,
    `Sent ${markers.length} marker message(s).`,
    sendStarted,
    { markers },
  ));

  await delay(600);
  const baselineStarted = Date.now();
  const baselineMessages = lab.getMessagesForPeer(peer);
  const baselineCount = baselineMessages.length;
  const baselineHasMarkers = markers.every((marker) => (
    baselineMessages.some((message) => message.content === marker)
  ));
  results.push(step(
    "dm_mono_baseline",
    baselineHasMarkers && baselineCount >= markers.length,
    baselineHasMarkers
      ? `Baseline thread count=${baselineCount} with all markers.`
      : `Baseline missing markers (count=${baselineCount}).`,
    baselineStarted,
    { baselineCount, baselineHasMarkers, markers },
  ));
  if (!baselineHasMarkers) {
    return results;
  }

  const navAwayStarted = Date.now();
  const networkNavOk = await navigateViaSidebar("Network", "/network");
  await delay(400);
  results.push(step(
    "dm_mono_nav_away",
    networkNavOk,
    networkNavOk ? "Navigated away from chats." : "Failed to navigate to Network.",
    navAwayStarted,
    { pathname: window.location.pathname, networkNavOk },
  ));
  if (!networkNavOk) {
    return results;
  }

  const navBackStarted = Date.now();
  const chatsNavOk = await navigateViaSidebar("Chats", "/");
  await delay(500);
  clickButtonByLabel("Chat");
  await delay(400);
  const peerRow = findConversationRowByLabel(peerLabel);
  if (peerRow) {
    peerRow.click();
    await delay(700);
  }
  results.push(step(
    "dm_mono_nav_back",
    chatsNavOk,
    peerRow
      ? "Returned to chats and re-selected peer thread."
      : chatsNavOk
        ? "Returned to chats (peer row not found; checking controller read model)."
        : "Failed to return to chats.",
    navBackStarted,
    { pathname: window.location.pathname, chatsNavOk, peerRowFound: Boolean(peerRow) },
  ));
  if (!chatsNavOk) {
    return results;
  }

  const afterStarted = Date.now();
  const afterMessages = lab.getMessagesForPeer(peer);
  const afterCount = afterMessages.length;
  const afterHasMarkers = markers.every((marker) => (
    afterMessages.some((message) => message.content === marker)
  ));
  const monotonic = afterCount >= baselineCount && afterHasMarkers;
  results.push(step(
    "dm_mono_count",
    monotonic,
    monotonic
      ? `Thread count monotonic (${baselineCount} → ${afterCount}).`
      : `History shrank or lost markers (${baselineCount} → ${afterCount}).`,
    afterStarted,
    { baselineCount, afterCount, afterHasMarkers, markers },
  ));

  const digestStarted = Date.now();
  const digest = typeof window.obscurAppEvents?.getCrossDeviceSyncDigest === "function"
    ? window.obscurAppEvents.getCrossDeviceSyncDigest(400)
    : null;
  const summary = readCrossDeviceDigestSummary(digest);
  const continuity = evaluateDmContinuityDigestGate(summary);
  results.push(step(
    "dm_mono_continuity_digest",
    continuity.passed,
    continuity.passed
      ? `DM continuity digest acceptable (${continuity.riskLevel}).`
      : `DM continuity digest too high (${continuity.riskLevel}).`,
    digestStarted,
    { continuity },
  ));

  return results;
};
